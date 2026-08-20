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
  /** The owning protocol's wallet — admin-only context, not the user privacy boundary (CLAUDE.md rule 1). */
  protocolWallet: string;
  categoryNames: string[];
  bodyText: string | null;
  imageUrl: string | null;
  ctas: AdminCampaignCta[];
  createdAt: string;
}

/** GET /api/admin/settings's response shape. */
export interface PlatformSettings {
  /** USD, as a decimal string — null if never configured yet. */
  flatCostPerUser: string | null;
}

/** One row from GET /api/admin/treasury. */
export interface TreasuryChainRow {
  key: string;
  displayName: string;
  /** Whether this chain currently has an RPC URL configured (env, @emp/config) — a treasury address alone isn't enough to make it payable. */
  rpcConfigured: boolean;
  treasuryAddress: string | null;
}
