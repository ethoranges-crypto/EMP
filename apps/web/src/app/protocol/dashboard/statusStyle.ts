import type { CampaignStatus } from "../types";

/**
 * One colour language for every status chip on the dashboard — the design's
 * palette maps status to meaning (amber = needs your action, cyan = live,
 * green = done, violet = waiting on someone else, red = rejected, grey =
 * inert/terminal). SCHEDULED and CANCELLED aren't in the original design
 * mockups (scheduled sending is this codebase's own addition, built after
 * the handoff) — given violet ("waiting, not blocking you") and grey
 * ("inert, like a draft") respectively, consistent with that language.
 */
export function statusChipClass(status: CampaignStatus): string {
  switch (status) {
    case "COMPLETE":
      return "bg-pulse-green/10 text-pulse-green";
    case "SENDING":
      return "bg-pulse-cyan/10 text-pulse-cyan";
    case "SCHEDULED":
      return "bg-pulse-violet/10 text-pulse-violet";
    case "IN_REVIEW":
      return "bg-pulse-violet/10 text-pulse-violet";
    case "APPROVED":
    case "AWAITING_PAYMENT":
      return "bg-pulse-amber/10 text-pulse-amber";
    case "REJECTED":
      return "bg-pulse-red/10 text-pulse-red";
    case "DRAFT":
    case "CANCELLED":
    default:
      return "bg-white/[.07] text-ink-3";
  }
}

/** Statuses where the protocol still owes an action to move the campaign forward — drives the "Needs action" filter + right-rail callout. */
export function needsAction(status: CampaignStatus): boolean {
  return status === "APPROVED" || status === "AWAITING_PAYMENT";
}

/** "In motion" — not a dead end (DRAFT/REJECTED/CANCELLED) and not finished (COMPLETE) — drives the left rail's ACTIVE CAMPAIGNS count. */
export function isActive(status: CampaignStatus): boolean {
  return status === "IN_REVIEW" || status === "APPROVED" || status === "AWAITING_PAYMENT" || status === "SCHEDULED" || status === "SENDING";
}
