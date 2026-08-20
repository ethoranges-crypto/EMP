/** One row from GET /api/admin/protocols. */
export interface PendingProtocol {
  id: string;
  name: string;
  wallet: string;
  accountType: "EOA" | "SAFE";
  safeAddress: string | null;
  createdAt: string;
}

/** One row from GET /api/admin/categories. */
export interface AdminCategory {
  id: string;
  name: string;
  active: boolean;
}

interface AdminCampaignCta {
  id: string;
  label: string;
  targetUrl: string;
}

/** One row from GET /api/admin/campaigns — the moderation queue (IN_REVIEW only). */
export interface InReviewCampaign {
  id: string;
  title: string;
  protocolName: string;
  chain: string;
  token: "USDC" | "USDT" | "ETH";
  categoryNames: string[];
  bodyText: string | null;
  imageUrl: string | null;
  ctas: AdminCampaignCta[];
  createdAt: string;
}
