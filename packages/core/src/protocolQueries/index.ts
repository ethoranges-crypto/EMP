import type { CategoryFilter, ProtocolQueryPort } from "./ports.js";

export type { CategoryFilter, ProtocolQueryPort };

export interface CampaignMetrics {
  campaignId: string;
  audienceSize: number;
  delivered: { count: number; ratePct: number };
  clicks: {
    /** Raw total click events, repeats included — "Total Clicks". */
    total: number;
    /** Distinct recipients who clicked at least once. */
    uniqueClickers: number;
    /** CTR: uniqueClickers / delivered — can never exceed 100%, unlike a rate computed from `total`. */
    ratePct: number;
    byCta: Array<{ ctaId: string; label: string; count: number; uniqueClickers: number; ratePct: number }>;
  };
  spend: { token: string; amount: string } | null;
}

function ratePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export interface ProtocolSummary {
  campaignsSent: number;
  totalReach: number;
  avgDeliveredRatePct: number;
  avgClickRatePct: number;
}

/**
 * The only function protocol-facing "audience size" UI/API may call.
 * CLAUDE.md rule 1 + SPEC §4.3 step 1: this is the *only* audience data a
 * protocol ever sees, and it is a count, never a list.
 */
export async function getAudienceCount(
  port: ProtocolQueryPort,
  filter: CategoryFilter,
): Promise<number> {
  return port.countMessageableUsers(filter);
}

/**
 * The only function protocol-facing campaign dashboards may call for metrics.
 * Every field on the returned object is a count or a rate — see
 * ProtocolQueryPort's doc comment. Do not add a field here that isn't.
 */
export async function getCampaignMetrics(
  port: ProtocolQueryPort,
  campaignId: string,
): Promise<CampaignMetrics> {
  const [audienceSize, cost, deliveryCounts, clickStats] = await Promise.all([
    port.getCampaignSnapshotCount(campaignId),
    port.getCampaignCost(campaignId),
    port.getDeliveryCounts(campaignId),
    port.getClickStats(campaignId),
  ]);

  const delivered = deliveryCounts.SENT;

  return {
    campaignId,
    audienceSize,
    delivered: { count: delivered, ratePct: ratePct(delivered, audienceSize) },
    clicks: {
      total: clickStats.totalClicks,
      uniqueClickers: clickStats.uniqueClickers,
      ratePct: ratePct(clickStats.uniqueClickers, delivered),
      byCta: clickStats.byCta.map((c) => ({
        ctaId: c.ctaId,
        label: c.label,
        count: c.count,
        uniqueClickers: c.uniqueClickers,
        ratePct: ratePct(c.uniqueClickers, delivered),
      })),
    },
    spend: cost,
  };
}

/**
 * The dashboard's aggregate summary strip (nice-to-have per the dashboard
 * spec, cheap here since it's a couple of scoped aggregate queries) — total
 * campaigns sent, total reach, and an average click rate computed from
 * aggregate totals (never an average of per-campaign rates, which would
 * over-weight a small campaign against a large one).
 */
export async function getProtocolSummary(port: ProtocolQueryPort, protocolId: string): Promise<ProtocolSummary> {
  const { campaignsSent, totalReach, totalAudience, totalUniqueClickers } = await port.getProtocolSummaryCounts(protocolId);
  return {
    campaignsSent,
    totalReach,
    avgDeliveredRatePct: ratePct(totalReach, totalAudience),
    avgClickRatePct: ratePct(totalUniqueClickers, totalReach),
  };
}
