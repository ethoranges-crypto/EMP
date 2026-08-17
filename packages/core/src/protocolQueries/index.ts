import type { CategoryFilter, ProtocolQueryPort } from "./ports.js";

export type { CategoryFilter, ProtocolQueryPort };

export interface CampaignMetrics {
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

function ratePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
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
  const [audienceSize, cost, deliveryCounts, ctaClicks] = await Promise.all([
    port.getCampaignSnapshotCount(campaignId),
    port.getCampaignCost(campaignId),
    port.getDeliveryCounts(campaignId),
    port.getCtaClickCounts(campaignId),
  ]);

  const delivered = deliveryCounts.SENT;
  const totalClicks = ctaClicks.reduce((sum, c) => sum + c.count, 0);

  return {
    campaignId,
    audienceSize,
    delivered: { count: delivered, ratePct: ratePct(delivered, audienceSize) },
    clicks: {
      total: totalClicks,
      ratePct: ratePct(totalClicks, delivered),
      byCta: ctaClicks.map((c) => ({
        ctaId: c.ctaId,
        label: c.label,
        count: c.count,
        ratePct: ratePct(c.count, delivered),
      })),
    },
    spend: cost,
  };
}
