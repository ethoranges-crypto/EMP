"use client";

import { monthYearLabel, shortDate, shortDateTime } from "./format";
import { statusChipClass } from "./statusStyle";
import type { ProtocolCampaign, CampaignStatus } from "../types";
import type { HistoryFilter } from "./NavRail";

const FILTER_MATCH: Record<HistoryFilter, (c: ProtocolCampaign) => boolean> = {
  ALL: () => true,
  NEEDS_ACTION: (c) => c.status === "APPROVED" || c.status === "AWAITING_PAYMENT",
  SENDING: (c) => c.status === "SENDING",
  IN_REVIEW: (c) => c.status === "IN_REVIEW",
  COMPLETE: (c) => c.status === "COMPLETE",
  DRAFT: (c) => c.status === "DRAFT",
  CANCELLED: (c) => c.status === "CANCELLED",
};

function metaLine(c: ProtocolCampaign): string {
  const parts = [c.categoryNames.join(", ") || "No categories yet"];
  if (c.chain) parts.push(c.chain);
  if (c.snapshotCount !== null) parts.push(`${c.snapshotCount.toLocaleString()} recipients`);
  parts.push(shortDate(c.createdAt));
  if (c.status === "COMPLETE" && c.metrics) parts.push(`${c.metrics.delivered.ratePct}% delivered`);
  return parts.join(" · ");
}

function RowResult({ c }: { c: ProtocolCampaign }) {
  if ((c.status === "COMPLETE" || c.status === "SENDING") && c.metrics) {
    return (
      <div className="text-right">
        <div className="font-mono text-lg font-medium text-pulse-violet">{c.metrics.clicks.ratePct}%</div>
        <div className="mt-1 font-mono text-[10px] text-ink-5">
          {c.metrics.delivered.ratePct}% delivered
        </div>
      </div>
    );
  }
  if (c.status === "APPROVED" || c.status === "AWAITING_PAYMENT") {
    const usd = c.costAmount !== null ? Number(c.costAmount) : null;
    return (
      <div className="text-right">
        <span className="inline-block rounded-md bg-pulse-amber px-[13px] py-2 text-xs font-semibold text-onaccent-amber">
          {usd !== null ? `Pay $${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Choose payment"}
        </span>
      </div>
    );
  }
  if (c.status === "SCHEDULED") {
    return (
      <div className="text-right font-mono text-[11px] text-pulse-violet">
        {c.scheduledSendAt ? shortDateTime(c.scheduledSendAt) : "Not yet set"}
      </div>
    );
  }
  if (c.status === "DRAFT") {
    return (
      <div className="text-right">
        <span className="inline-block rounded-md border border-white/[.14] px-3 py-[7px] text-xs text-ink-2">Resume</span>
      </div>
    );
  }
  if (c.status === "REJECTED") {
    return (
      <div className="text-right">
        <span className="inline-block rounded-md border border-white/[.14] px-3 py-[7px] text-xs text-ink-2">Edit &amp; resubmit</span>
      </div>
    );
  }
  return <div className="text-right font-mono text-[10.5px] text-ink-6">—</div>;
}

function midColumnNote(c: ProtocolCampaign): string | null {
  if (c.status === "APPROVED" || c.status === "AWAITING_PAYMENT") return "Cost locked against the approval snapshot.";
  if (c.status === "IN_REVIEW") return "Typical review under 2h.";
  if (c.status === "DRAFT") return "Not submitted.";
  if (c.status === "REJECTED") return c.rejectionReason ? c.rejectionReason.slice(0, 80) + (c.rejectionReason.length > 80 ? "…" : "") : null;
  return null;
}

/**
 * Where a row click goes, by status:
 *  - DRAFT/REJECTED: still being written — the composer (also handles
 *    delete for these two).
 *  - APPROVED/AWAITING_PAYMENT/SCHEDULED: payment is the live concern —
 *    the payment screen (chain/token pick, treasury address, or
 *    reschedule for an already-paid SCHEDULED send).
 *  - IN_REVIEW: the read-only campaign view — the one place cancel (no
 *    payment yet) lives for this status.
 *  - SENDING/COMPLETE/CANCELLED: the existing inline CampaignDetailView
 *    below, which shows delivered/click metrics CampaignView doesn't —
 *    switching these to CampaignView would lose that, so they're
 *    deliberately left as they were.
 */
function actionFor(status: CampaignStatus): "compose" | "pay" | "view" | "detail" {
  if (status === "DRAFT" || status === "REJECTED") return "compose";
  if (status === "APPROVED" || status === "AWAITING_PAYMENT" || status === "SCHEDULED") return "pay";
  if (status === "IN_REVIEW") return "view";
  return "detail";
}

function Row({
  c,
  onSelect,
  onCompose,
  onPay,
  onView,
}: {
  c: ProtocolCampaign;
  onSelect: (id: string) => void;
  onCompose: (id: string) => void;
  onPay: (id: string) => void;
  onView: (id: string) => void;
}) {
  const action = actionFor(c.status);
  const note = midColumnNote(c);

  const content = (
    <div
      className={`grid grid-cols-[1fr_150px_128px] items-center gap-[18px] rounded-card border p-[14px_16px] transition ${
        c.status === "AWAITING_PAYMENT" || c.status === "APPROVED"
          ? "border-pulse-amber/30 bg-pulse-amber/5"
          : c.status === "SENDING"
            ? "border-white/[.09] bg-gradient-to-r from-pulse-cyan/[.07] to-transparent"
            : "border-white/[.09] hover:border-white/[.16]"
      } ${c.status === "IN_REVIEW" ? "opacity-70" : ""}`}
    >
      <div className="flex min-w-0 flex-col gap-[5px]">
        <div className="flex items-center gap-2.5">
          <div className="truncate text-[13.5px] font-medium">{c.title}</div>
          <span className={`shrink-0 rounded-chip px-2 py-[3px] font-mono text-[10px] font-medium ${statusChipClass(c.status)}`}>
            {c.status.replace("_", " ")}
          </span>
        </div>
        <div className="truncate font-mono text-[10.5px] text-ink-5">{metaLine(c)}</div>
      </div>
      <div className="font-mono text-[10.5px] leading-[1.5] text-ink-5">{note}</div>
      <RowResult c={c} />
    </div>
  );

  const onClick =
    action === "compose" ? () => onCompose(c.id) : action === "pay" ? () => onPay(c.id) : action === "view" ? () => onView(c.id) : () => onSelect(c.id);

  return (
    <button onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  );
}

export function HistoryList({
  campaigns,
  filter,
  onSelect,
  onCompose,
  onPay,
  onView,
}: {
  campaigns: ProtocolCampaign[];
  filter: HistoryFilter;
  onSelect: (id: string) => void;
  onCompose: (id: string) => void;
  onPay: (id: string) => void;
  onView: (id: string) => void;
}) {
  const filtered = campaigns.filter(FILTER_MATCH[filter]);

  if (filtered.length === 0) {
    return <p className="text-sm text-ink-4">No campaigns match this filter.</p>;
  }

  const groups: Array<{ label: string; rows: ProtocolCampaign[] }> = [];
  for (const c of filtered) {
    const label = monthYearLabel(c.createdAt);
    const group = groups.at(-1);
    if (group?.label === label) group.rows.push(c);
    else groups.push({ label, rows: [c] });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-2">
          <div className="pt-1 font-mono text-[9.5px] font-medium tracking-[.14em] text-ink-6">{g.label}</div>
          {g.rows.map((c) => (
            <Row key={c.id} c={c} onSelect={onSelect} onCompose={onCompose} onPay={onPay} onView={onView} />
          ))}
        </div>
      ))}
    </div>
  );
}
