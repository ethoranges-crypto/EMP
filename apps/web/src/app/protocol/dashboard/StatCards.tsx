"use client";

import type { ProtocolSummary } from "../types";

function Card({ label, value, unit, valueClass, sub }: { label: string; value: string; unit?: string; valueClass?: string; sub: string }) {
  return (
    <div className="rounded-card border border-white/[.08] bg-surface p-4">
      <div className="mb-2.5 font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">{label}</div>
      <div className={`font-mono text-2xl font-medium ${valueClass ?? ""}`}>
        {value}
        {unit && <span className="text-sm text-ink-4">{unit}</span>}
      </div>
      <div className="mt-2 text-[11.5px] text-ink-4">{sub}</div>
    </div>
  );
}

/**
 * Three headline numbers, same shape as the design's "live truth" stat
 * row — all sourced from GET /api/protocol/dashboard/summary (the privacy
 * chokepoint's aggregate, scoped to this protocol's own COMPLETE
 * campaigns), plus a client-derived "best campaign" from the campaigns
 * list already on the page (no new endpoint).
 */
export function StatCards({ summary, bestCampaign }: { summary: ProtocolSummary; bestCampaign: { title: string; ratePct: number } | null }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card
        label="MESSAGES DELIVERED"
        value={summary.totalReach.toLocaleString()}
        sub={`across ${summary.campaignsSent} completed campaign${summary.campaignsSent === 1 ? "" : "s"}`}
      />
      <Card
        label="AVG DELIVERED"
        value={summary.avgDeliveredRatePct.toString()}
        unit="%"
        sub="undelivered = blocked or deactivated"
      />
      <Card
        label="AVG CTA CLICKS"
        value={summary.avgClickRatePct.toString()}
        unit="%"
        valueClass="text-pulse-violet"
        sub={bestCampaign ? `best: ${bestCampaign.ratePct}% · ${bestCampaign.title}` : "no completed campaigns yet"}
      />
    </div>
  );
}
