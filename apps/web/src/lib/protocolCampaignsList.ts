import { prisma } from "@emp/db";
import { createPrismaProtocolQueryStore, getCampaignMetrics } from "@emp/core";
import type { ProtocolCampaign } from "@/app/protocol/types";

/**
 * The one place a protocol's own campaign list is assembled — used by both
 * GET /api/protocol/campaigns (JSON) and the CSV export
 * (/api/protocol/campaigns/export), so there is exactly one query to keep
 * privacy-safe rather than two that could drift apart.
 *
 * Campaign/CampaignCategory carry no wallet/chat_id, so a direct query for
 * that metadata is fine (see the JSON route's original doc comment).
 * Metrics (delivered %, click %) are the one part that's derived from user
 * data (CLAUDE.md rule 1) — those go through @emp/core's protocol-queries
 * chokepoint (getCampaignMetrics), never a raw query here, and only for
 * COMPLETE campaigns, same as before this was extracted.
 */
export async function getProtocolCampaignsList(protocolId: string): Promise<ProtocolCampaign[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { protocolId },
    orderBy: { createdAt: "desc" },
    include: {
      categories: { include: { category: true } },
      _count: { select: { ctas: true } },
      moderationReviews: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const metricsStore = createPrismaProtocolQueryStore(prisma);
  const metricsByCampaignId = new Map(
    await Promise.all(
      campaigns
        .filter((c) => c.status === "COMPLETE")
        .map(async (c) => [c.id, await getCampaignMetrics(metricsStore, c.id)] as const),
    ),
  );

  return campaigns.map((c) => {
    const metrics = metricsByCampaignId.get(c.id);
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      chain: c.chain,
      token: c.token,
      categoryNames: c.categories.map((cc) => cc.category.name),
      hasComposeContent: c.bodyText !== null,
      ctaCount: c._count.ctas,
      snapshotCount: c.snapshotCount,
      costAmount: c.costAmount?.toString() ?? null,
      rejectionReason: c.status === "REJECTED" ? (c.moderationReviews[0]?.reason ?? null) : null,
      createdAt: c.createdAt.toISOString(),
      scheduledSendAt: c.scheduledSendAt?.toISOString() ?? null,
      sentAt: c.sentAt?.toISOString() ?? null,
      metrics: metrics
        ? {
            delivered: metrics.delivered,
            clicks: { total: metrics.clicks.total, ratePct: metrics.clicks.ratePct },
          }
        : null,
    };
  });
}
