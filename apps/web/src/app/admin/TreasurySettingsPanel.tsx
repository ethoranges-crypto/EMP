"use client";

import { useState } from "react";
import type { TreasuryChainRow } from "./types";

function TreasuryRow({ chain, onChange }: { chain: TreasuryChainRow; onChange: () => void }) {
  const [value, setValue] = useState(chain.treasuryAddress ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/treasury", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain: chain.key, treasuryAddress: value.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    onChange();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-void/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-100">{chain.displayName}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            chain.rpcConfigured ? "border-pulse-cyan/40 text-pulse-cyan" : "border-white/10 text-slate-500"
          }`}
        >
          {chain.rpcConfigured ? "RPC configured" : "RPC not configured"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="0x… treasury address"
          className="flex-1 rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-cyan/50"
        />
        <button
          onClick={() => void save()}
          disabled={saving || value.trim() === ""}
          className="shrink-0 whitespace-nowrap rounded-full bg-pulse-cyan px-4 py-1.5 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {!chain.rpcConfigured && (
        <p className="text-xs text-slate-500">This chain isn&apos;t payable yet — its RPC URL still needs setting in env.</p>
      )}
      {saved && <p className="text-xs text-pulse-cyan">Saved.</p>}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * SPEC §6 / CLAUDE.md Payments: "one EMP treasury address per chain",
 * admin-configurable. A chain is actually payable (shows up at the
 * protocol's payment step) only once it's both RPC-configured (env) and has
 * a treasury address here (DB) — see @emp/core's getPayableChains.
 */
export function TreasurySettingsPanel({ chains, onChange }: { chains: TreasuryChainRow[]; onChange: () => void }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Treasury addresses</h2>
      <p className="text-xs text-slate-500">
        Where protocols pay EMP on each chain. Payment verification is fully automated — an on-chain watcher
        confirms the correct token and amount arrived here from the protocol&apos;s own wallet.
      </p>
      <div className="flex flex-col gap-3">
        {chains.map((c) => (
          <TreasuryRow key={c.key} chain={c} onChange={onChange} />
        ))}
      </div>
    </section>
  );
}
