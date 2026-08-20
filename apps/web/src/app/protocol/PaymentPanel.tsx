"use client";

import { useEffect, useState } from "react";
import { PAYMENT_TOKENS, type PaymentToken } from "@emp/config/paymentTokens";
import type { CampaignDetail } from "./types";

interface ChainOption {
  key: string;
  displayName: string;
}

/**
 * SPEC §6: the payment step. Shown only for an APPROVED campaign — cost is
 * already locked (CLAUDE.md rule 3) as a plain USD amount, so this is
 * framed as paying EMP's bill, not as anything about campaign content
 * (that choice already happened, back at compose). The protocol picks
 * which supported chain to pay on and USDC or USDT (ETH isn't accepted —
 * see SPEC §6) and saves that choice; actually sending/verifying the
 * payment is a later stage.
 */
export function PaymentPanel({
  campaignId,
  onClose,
  onSaved,
}: {
  campaignId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [chains, setChains] = useState<ChainOption[] | null>(null);
  const [chain, setChain] = useState("");
  const [token, setToken] = useState<PaymentToken>("USDC");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/protocol/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((data: CampaignDetail) => {
        setDetail(data);
        if (data.chain) setChain(data.chain);
        if (data.token) setToken(data.token);
      });
  }, [campaignId]);

  useEffect(() => {
    fetch("/api/protocol/chains")
      .then((r) => r.json())
      .then((data: { chains: ChainOption[] }) => {
        setChains(data.chains);
        setChain((prev) => prev || data.chains[0]?.key || "");
      });
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}/payment-method`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain, token }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save payment method.");
      return;
    }
    onSaved("Payment method saved.");
  }

  if (!detail) {
    return (
      <section className="rounded-xl border border-white/10 bg-surface p-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </section>
    );
  }

  const usd = detail.costAmount !== null ? Number(detail.costAmount) : null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-pulse-cyan/40 bg-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Pay EMP — {detail.title}</h2>
        <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-100">
          ✕
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-void/40 px-4 py-3 text-center">
        {usd !== null && detail.snapshotCount !== null ? (
          <p className="text-lg font-semibold text-pulse-cyan">
            ${usd.toFixed(2)} to reach {detail.snapshotCount} user{detail.snapshotCount === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Cost not available.</p>
        )}
        <p className="mt-1 text-xs text-slate-500">This is what EMP charges to deliver this campaign — not part of its content.</p>
      </div>

      {chains === null && <p className="text-sm text-slate-500">Loading chains…</p>}
      {chains && chains.length === 0 && (
        <p className="text-sm text-slate-500">No payment chain is configured yet — check back soon.</p>
      )}

      {chains && chains.length > 0 && (
        <>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Pay on
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100"
            >
              {chains.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-sm text-slate-300">
            <span>Pay in</span>
            <div className="flex gap-2">
              {PAYMENT_TOKENS.map((t) => (
                <button
                  key={t}
                  onClick={() => setToken(t)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition ${
                    token === t
                      ? "border-pulse-cyan/60 bg-pulse-cyan/20 text-slate-100"
                      : "border-white/10 bg-void text-slate-400 hover:border-white/20"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => void save()}
            disabled={saving || !chain}
            className="self-start whitespace-nowrap rounded-full bg-pulse-cyan px-5 py-1.5 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save payment method"}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
