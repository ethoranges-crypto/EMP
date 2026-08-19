export type ProtocolStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

/** Mirrors GET /api/protocol's response shape exactly. */
export interface ProtocolMe {
  wallet: string;
  accountType: "EOA" | "SAFE";
  safeAddress: string | null;
  name: string;
  status: ProtocolStatus;
  approvalNotes: string | null;
}

export type TokenSymbol = "USDC" | "USDT" | "ETH";

/** SPEC §7 taxonomy — same admin-configured categories users pick interests from. */
export interface Category {
  id: string;
  name: string;
}

export type CampaignStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "AWAITING_PAYMENT" | "SENDING" | "COMPLETE";

/** One row from GET /api/protocol/campaigns. */
export interface ProtocolCampaign {
  id: string;
  status: CampaignStatus;
  chain: string;
  token: TokenSymbol;
  categoryNames: string[];
  hasComposeContent: boolean;
  ctaCount: number;
  createdAt: string;
}

/** A CTA as returned by the campaign detail/compose-save endpoints — already wrapped in its /r/:token redirect. */
export interface CampaignCta {
  label: string;
  targetUrl: string;
  redirectUrl: string;
}

/** GET /api/protocol/campaigns/[id]'s response shape. */
export interface CampaignDetail {
  id: string;
  status: CampaignStatus;
  chain: string;
  token: TokenSymbol;
  categoryNames: string[];
  bodyText: string | null;
  imageUrl: string | null;
  ctas: CampaignCta[];
  createdAt: string;
}
