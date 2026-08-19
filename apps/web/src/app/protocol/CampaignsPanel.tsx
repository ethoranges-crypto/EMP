"use client";

import type { ProtocolCampaign } from "./types";

export function CampaignsPanel({
  campaigns,
  onCompose,
}: {
  campaigns: ProtocolCampaign[];
  onCompose: (campaignId: string) => void;
}) {
  if (campaigns.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Your campaigns</h2>
      <div className="flex flex-col gap-3">
        {campaigns.map((c) => (
          <div key={c.id} className="flex flex-col gap-1 rounded-lg border border-white/10 bg-void/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-100">{c.categoryNames.join(", ") || "—"}</span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-400">
                {c.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {c.chain} · {c.token} · {new Date(c.createdAt).toLocaleString()}
            </p>
            <p className="text-xs text-slate-600">
              {c.hasComposeContent
                ? `Composed — ${c.ctaCount} CTA${c.ctaCount === 1 ? "" : "s"}`
                : "Not composed yet"}
            </p>
            {c.status === "DRAFT" && (
              <button
                onClick={() => onCompose(c.id)}
                className="mt-1 self-start rounded-full bg-white/10 px-4 py-1.5 text-xs text-slate-100 hover:bg-white/20"
              >
                {c.hasComposeContent ? "Edit compose" : "Compose"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
