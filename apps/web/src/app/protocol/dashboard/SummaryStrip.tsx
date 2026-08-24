"use client";

import type { ProtocolSummary } from "../types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-2xl font-semibold text-pulse-cyan">{value}</span>
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
}

/**
 * Nice-to-have per the dashboard spec — cheap here since getProtocolSummary
 * is a couple of aggregate queries scoped to COMPLETE campaigns. Hidden
 * entirely until there's at least one COMPLETE campaign to summarize,
 * rather than showing a wall of zeros to a protocol that hasn't sent
 * anything yet.
 */
export function SummaryStrip({ summary }: { summary: ProtocolSummary }) {
  if (summary.campaignsSent === 0) return null;

  return (
    <section className="grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-surface p-6">
      <Stat label="Campaigns sent" value={String(summary.campaignsSent)} />
      <Stat label="Total reach" value={summary.totalReach.toLocaleString()} />
      <Stat label="Avg click rate" value={`${summary.avgClickRatePct}%`} />
    </section>
  );
}
