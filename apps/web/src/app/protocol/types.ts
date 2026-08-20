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

export type CampaignStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "AWAITING_PAYMENT" | "SENDING" | "COMPLETE";

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
  payment: CampaignPaymentInfo | null;
}
