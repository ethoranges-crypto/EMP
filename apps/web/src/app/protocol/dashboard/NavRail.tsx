"use client";

import Link from "next/link";
import { isActive } from "./statusStyle";
import type { ProtocolCampaign } from "../types";

export type HistoryFilter = "ALL" | "NEEDS_ACTION" | "SENDING" | "IN_REVIEW" | "COMPLETE" | "DRAFT";

const FILTERS: Array<{ key: HistoryFilter; label: string; match: (c: ProtocolCampaign) => boolean; tone: string }> = [
  { key: "ALL", label: "All", match: () => true, tone: "text-ink-4" },
  { key: "NEEDS_ACTION", label: "Needs action", match: (c) => c.status === "APPROVED" || c.status === "AWAITING_PAYMENT", tone: "text-pulse-amber" },
  { key: "SENDING", label: "Sending", match: (c) => c.status === "SENDING", tone: "text-pulse-cyan" },
  { key: "IN_REVIEW", label: "In review", match: (c) => c.status === "IN_REVIEW", tone: "text-ink-4" },
  { key: "COMPLETE", label: "Complete", match: (c) => c.status === "COMPLETE", tone: "text-ink-4" },
  { key: "DRAFT", label: "Drafts", match: (c) => c.status === "DRAFT", tone: "text-ink-4" },
];

/**
 * Left rail: account nav (only "Campaigns" and "New campaign" go anywhere
 * real — Audience explorer / Payments / Settings are in the design but
 * don't exist as screens in this codebase yet, so they render inert rather
 * than linking to something that isn't there), the status filter that
 * drives the history list below, and a one-glance active-campaign count.
 * Everything here is derived client-side from the campaigns list already
 * fetched for the page — no new endpoint.
 */
export function NavRail({
  campaigns,
  filter,
  onFilterChange,
}: {
  campaigns: ProtocolCampaign[];
  filter: HistoryFilter;
  onFilterChange: (f: HistoryFilter) => void;
}) {
  const activeCampaigns = campaigns.filter((c) => isActive(c.status));
  const sendingCount = campaigns.filter((c) => c.status === "SENDING").length;
  const inReviewCount = campaigns.filter((c) => c.status === "IN_REVIEW").length;

  return (
    <nav className="flex flex-col gap-6 overflow-y-auto border-r border-white/[.07] bg-rail px-[18px] py-6">
      <div className="flex flex-col gap-0.5">
        <div className="px-2.5 pb-2 font-mono text-[9.5px] font-medium tracking-[.14em] text-ink-5">PROTOCOL</div>
        <div className="flex items-center gap-2.5 rounded-md bg-pulse-cyan/10 px-2.5 py-2 font-medium text-pulse-cyan">
          <div className="h-1 w-1 rounded-sm bg-pulse-cyan" />
          Campaigns
        </div>
        <Link href="/protocol" className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-ink-3 transition hover:bg-white/[.04]">
          <div className="h-1 w-1 rounded-sm bg-white/20" />
          New campaign
        </Link>
        {["Audience explorer", "Payments", "Settings"].map((label) => (
          <div key={label} className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-ink-6" title="Not built yet">
            <div className="h-1 w-1 rounded-sm bg-white/10" />
            {label}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-0.5 border-t border-white/[.08] pt-5">
        <div className="px-2.5 pb-2 font-mono text-[9.5px] font-medium tracking-[.14em] text-ink-5">FILTER</div>
        {FILTERS.map((f) => {
          const count = campaigns.filter(f.match).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={`flex items-center justify-between rounded-md px-2.5 py-[7px] text-left text-[12.5px] transition ${
                active ? "bg-white/[.06] text-ink-1" : "text-ink-3 hover:bg-white/[.03]"
              }`}
            >
              <span>{f.label}</span>
              <span className={`font-mono text-[10.5px] ${f.tone}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col gap-1.5 rounded-lg border border-white/[.08] p-3">
        <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">ACTIVE CAMPAIGNS</div>
        <div className="font-mono text-xl font-medium">{activeCampaigns.length}</div>
        <div className="font-mono text-[11px] text-pulse-green">
          {sendingCount} sending · {inReviewCount} in review
        </div>
      </div>
    </nav>
  );
}
