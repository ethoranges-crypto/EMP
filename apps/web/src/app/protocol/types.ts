export type ProtocolStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

/** Mirrors GET /api/protocol's response shape exactly. */
export interface ProtocolMe {
  wallet: string;
  accountType: "EOA" | "SAFE";
  safeAddress: string | null;
  name: string;
  status: ProtocolStatus;
  approvalNotes: string | null;
  approvedBannerDismissed: boolean;
}

export type TokenSymbol = "USDC" | "USDT";

/** SPEC §7 taxonomy — same admin-configured categories users pick interests from. */
export interface Category {
  id: string;
  name: string;
}

export type CampaignStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "AWAITING_PAYMENT"
  | "SCHEDULED"
  | "SENDING"
  | "COMPLETE"
  | "CANCELLED";

/** Delivered/click aggregates — present only once a campaign is COMPLETE. Always counts/rates, never per-user data (CLAUDE.md rule 1). */
export interface ProtocolCampaignMetrics {
  delivered: { count: number; ratePct: number };
  clicks: { total: number; ratePct: number };
}

/** One row from GET /api/protocol/campaigns. */
export interface ProtocolCampaign {
  id: string;
  title: string;
  status: CampaignStatus;
  /** Payment chain/token — null until chosen at the payment step (SPEC §6), only possible once APPROVED. */
  chain: string | null;
  token: TokenSymbol | null;
  categoryNames: string[];
  hasComposeContent: boolean;
  ctaCount: number;
  /** Locked at approval (CLAUDE.md rule 3) — audience size the cost was computed against. */
  snapshotCount: number | null;
  /** Locked at approval — already a USD amount (flatCostPerUser is USD, SPEC §6), as a decimal string. */
  costAmount: string | null;
  /** The admin's reason, present only while status is currently REJECTED. */
  rejectionReason: string | null;
  createdAt: string;
  /**
   * The protocol's chosen send time (UTC ISO string), or null for "send as
   * soon as payment clears" — set at compose, read again at payment
   * verification, and (while SCHEDULED) directly editable/clearable via
   * PATCH .../reschedule. Meaningful mainly once status is SCHEDULED, but
   * carried through every status so a draft's chosen schedule still shows
   * before it's even submitted.
   */
  scheduledSendAt: string | null;
  /** The actual moment this campaign entered SENDING (immediate, paid-late, or a scheduled time firing) — null until it has. */
  sentAt: string | null;
  /** Non-null only once status is COMPLETE. */
  metrics: ProtocolCampaignMetrics | null;
}

/**
 * A CTA as returned by GET /api/protocol/campaigns/[id]. Deliberately no
 * redirect token/URL here — it's wrapped on save (SPEC §8) but never
 * surfaced back to the protocol; see that route's own comment.
 */
export interface CampaignCta {
  id: string;
  label: string;
  targetUrl: string;
}

export type PaymentStatus = "AWAITING" | "VERIFIED" | "UNDERPAID" | "WRONG_TOKEN" | "LATE" | "DUPLICATE";

/**
 * The payment window EMP opened once a chain/token was chosen (SPEC §6) —
 * present once the campaign has ever had one (AWAITING_PAYMENT or later).
 * treasuryAddress is what the protocol pays into; status flips to VERIFIED
 * automatically once apps/worker's on-chain watcher confirms it — nothing
 * here is admin/manually verified.
 */
export interface CampaignPaymentInfo {
  chain: string;
  token: TokenSymbol;
  /** Decimal string, in the token's human units (USDC/USDT are 1:1 USD-pegged). */
  amount: string;
  status: PaymentStatus;
  windowExpiresAt: string;
  /** Null only if an admin removed the chain's treasury address after the window opened — shouldn't happen in practice. */
  treasuryAddress: string | null;
}

/** GET /api/protocol/campaigns/[id]'s response shape. */
export interface CampaignDetail {
  id: string;
  title: string;
  status: CampaignStatus;
  /** Payment chain/token — null until chosen at the payment step (SPEC §6), only possible once APPROVED. */
  chain: string | null;
  token: TokenSymbol | null;
  categoryNames: string[];
  bodyText: string | null;
  /** Server-derived — GET .../campaigns/[id]/image if an image is attached, otherwise null. Never a URL the protocol typed in. */
  imageUrl: string | null;
  ctas: CampaignCta[];
  /** Locked at approval (CLAUDE.md rule 3) — audience size the cost was computed against. */
  snapshotCount: number | null;
  /** Locked at approval — already a USD amount (flatCostPerUser is USD, SPEC §6), as a decimal string. */
  costAmount: string | null;
  /** The admin's reason, present only while status is currently REJECTED. */
  rejectionReason: string | null;
  createdAt: string;
  /** Set once, at IN_REVIEW -> APPROVED — null before that (DRAFT/IN_REVIEW/REJECTED-never-approved). */
  approvedAt: string | null;
  /** See ProtocolCampaign.scheduledSendAt — same field, same meaning. */
  scheduledSendAt: string | null;
  /** See ProtocolCampaign.sentAt — same field, same meaning. */
  sentAt: string | null;
  payment: CampaignPaymentInfo | null;
}

/**
 * GET /api/protocol/campaigns/[id]/metrics's full response shape — the
 * dashboard detail view's "Results" section. Every field is a count or a
 * rate (CLAUDE.md rule 1); byCta breaks the click total down per button
 * without ever naming which user clicked which.
 */
export interface CampaignFullMetrics {
  campaignId: string;
  audienceSize: number;
  delivered: { count: number; ratePct: number };
  clicks: {
    total: number;
    ratePct: number;
    byCta: Array<{ ctaId: string; label: string; count: number; ratePct: number }>;
  };
  spend: { token: string; amount: string } | null;
}

/** GET /api/protocol/dashboard/summary's response shape — the dashboard's aggregate strip. */
export interface ProtocolSummary {
  campaignsSent: number;
  totalReach: number;
  avgClickRatePct: number;
}
