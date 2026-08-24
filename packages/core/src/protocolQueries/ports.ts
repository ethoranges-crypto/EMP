/**
 * Storage port for everything a protocol is allowed to ask about. Every
 * method here returns a count, a rate, or an opaque cta id/label — never a
 * wallet address, chat_id, or any other per-user identifier. This is the
 * one place in the codebase permitted to read CampaignRecipient,
 * TelegramLink, or User rows; it turns them into aggregates before anything
 * else sees them. See CLAUDE.md rule 1 and SPEC §9.
 */
export interface ProtocolQueryPort {
  /** Users with a currently-VERIFIED Telegram link matching the category filter. */
  countMessageableUsers(filter: CategoryFilter): Promise<number>;
  getCampaignSnapshotCount(campaignId: string): Promise<number>;
  getCampaignCost(campaignId: string): Promise<{ token: string; amount: string } | null>;
  getDeliveryCounts(campaignId: string): Promise<Record<"SENT" | "FAILED" | "BLOCKED", number>>;
  getCtaClickCounts(
    campaignId: string,
  ): Promise<Array<{ ctaId: string; label: string; count: number }>>;
  /**
   * Raw counts behind the dashboard's aggregate summary strip — scoped to
   * COMPLETE campaigns owned by this protocol, nothing else. Rate math
   * happens in getProtocolSummary (index.ts), not here, same split as every
   * other method on this port.
   */
  getProtocolSummaryCounts(
    protocolId: string,
  ): Promise<{ campaignsSent: number; totalReach: number; totalClicks: number }>;
}

export interface CategoryFilter {
  categoryIds: string[];
  /** True when the "Everything" meta-category is among the selected ids. */
  includeAll: boolean;
}
