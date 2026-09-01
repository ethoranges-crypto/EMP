"use client";

import type { TreasuryChainRow } from "./types";

function TreasuryRow({ chain }: { chain: TreasuryChainRow }) {
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
      {chain.treasuryAddress ? (
        <code className="truncate rounded-md border border-white/10 bg-void px-3 py-2 text-xs text-slate-300">
          {chain.treasuryAddress}
        </code>
      ) : (
        <p className="text-xs text-slate-500">No treasury address set for this chain yet.</p>
      )}
      {!chain.rpcConfigured && (
        <p className="text-xs text-slate-500">This chain isn&apos;t payable yet — its RPC URL still needs setting in env.</p>
      )}
    </div>
  );
}

/**
 * SPEC §6 / CLAUDE.md Payments: "one EMP treasury address per chain" — read
 * only here, on purpose. Treasury address is env-only, not admin/DB-
 * configurable: it's the highest-value config in the system (redirect it and
 * every protocol payment reroutes to an attacker), so changing it requires
 * server/deploy access, not just an admin session — an admin session is
 * exactly what this panel's own audience (someone who compromised it) would
 * have. This exists purely so an admin can verify what's currently set, the
 * same env vars both the Pay panel and the worker's payment watcher read.
 */
export function TreasurySettingsPanel({ chains }: { chains: TreasuryChainRow[] }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Treasury addresses</h2>
      <p className="text-xs text-slate-500">
        Where protocols pay EMP on each chain — read-only. Set via <code>{"{CHAIN}_TREASURY_ADDRESS"}</code> in env
        (server/deploy access only, not editable here) — see .env.example. Payment verification is fully automated:
        an on-chain watcher confirms the correct token and amount arrived here from the protocol&apos;s own wallet.
      </p>
      <div className="flex flex-col gap-3">
        {chains.map((c) => (
          <TreasuryRow key={c.key} chain={c} />
        ))}
      </div>
    </section>
  );
}
