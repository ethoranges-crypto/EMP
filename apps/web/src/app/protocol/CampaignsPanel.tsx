"use client";

import type { ProtocolCampaign } from "./types";

export function CampaignsPanel({
  campaigns,
  justUpdated,
  onCompose,
  onPay,
}: {
  campaigns: ProtocolCampaign[];
  /** A campaign id + short message to show briefly after a save/submit, so the collapse back to this list isn't silent (see ComposePanel's onSaved). */
  justUpdated: { campaignId: string; message: string } | null;
  onCompose: (campaignId: string) => void;
  onPay: (campaignId: string) => void;
}) {
  if (campaigns.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Your campaigns</h2>
      <div className="flex flex-col gap-3">
        {campaigns.map((c) => {
          const usd = c.costAmount !== null ? Number(c.costAmount) : null;
          return (
            <div key={c.id} className="flex flex-col gap-1 rounded-lg border border-white/10 bg-void/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-100">{c.title}</span>
                <div className="flex items-center gap-2">
                  {justUpdated?.campaignId === c.id && (
                    <span className="rounded-full bg-pulse-cyan/20 px-2 py-0.5 text-xs text-pulse-cyan">
                      {justUpdated.message}
                    </span>
                  )}
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-400">
                    {c.status}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {c.categoryNames.join(", ") || "—"}
                {c.chain && c.token ? ` · ${c.chain} · ${c.token}` : ""} · {new Date(c.createdAt).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600">
                {c.hasComposeContent
                  ? `Composed — ${c.ctaCount} CTA${c.ctaCount === 1 ? "" : "s"}`
                  : "Not composed yet"}
              </p>
              {c.status === "REJECTED" && c.rejectionReason && (
                <p className="text-xs text-red-400">Rejected: {c.rejectionReason}</p>
              )}
              {c.status === "APPROVED" && usd !== null && c.snapshotCount !== null && (
                <p className="text-xs text-pulse-cyan">
                  ${usd.toFixed(2)} to reach {c.snapshotCount} user{c.snapshotCount === 1 ? "" : "s"}
                </p>
              )}
              {(c.status === "DRAFT" || c.status === "REJECTED") && (
                <button
                  onClick={() => onCompose(c.id)}
                  className="mt-1 self-start whitespace-nowrap rounded-full bg-white/10 px-4 py-1.5 text-xs text-slate-100 hover:bg-white/20"
                >
                  {c.hasComposeContent ? "Edit compose" : "Compose"}
                </button>
              )}
              {c.status === "APPROVED" && (
                <button
                  onClick={() => onPay(c.id)}
                  className="mt-1 self-start whitespace-nowrap rounded-full bg-pulse-cyan px-4 py-1.5 text-xs font-medium text-void hover:shadow-glow"
                >
                  Pay
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
