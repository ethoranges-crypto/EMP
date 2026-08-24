"use client";

import { formatDateTime } from "../schedule";
import type { ProtocolCampaign } from "../types";

/**
 * SPEC's dashboard requirement 1: every campaign the protocol has ever run,
 * any status, with the facts that matter at a glance. No compose/pay
 * actions here (that's CampaignsPanel's job on the main /protocol page) —
 * this is purely a history to click into, via CampaignDetailView.
 */
export function CampaignHistoryList({
  campaigns,
  selectedId,
  onSelect,
}: {
  campaigns: ProtocolCampaign[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (campaigns.length === 0) {
    return (
      <section className="rounded-xl border border-white/10 bg-surface p-6">
        <p className="text-sm text-slate-500">No campaigns yet.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Campaign history</h2>
      <div className="flex flex-col gap-2">
        {campaigns.map((c) => {
          const usd = c.costAmount !== null ? Number(c.costAmount) : null;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`flex flex-col gap-1 rounded-lg border p-4 text-left transition ${
                selectedId === c.id
                  ? "border-pulse-cyan/60 bg-void/60"
                  : "border-white/10 bg-void/40 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-100">{c.title}</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-400">{c.status}</span>
              </div>
              <p className="text-xs text-slate-500">
                {c.categoryNames.join(", ") || "—"} · {c.sentAt ? `Sent ${formatDateTime(c.sentAt)}` : `Created ${formatDateTime(c.createdAt)}`}
              </p>
              <p className="text-xs text-slate-600">
                {c.snapshotCount !== null ? `${c.snapshotCount} user${c.snapshotCount === 1 ? "" : "s"}` : "Audience not locked"}
                {usd !== null ? ` · $${usd.toFixed(2)}` : ""}
                {c.metrics ? ` · ${c.metrics.delivered.ratePct}% delivered` : ""}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
