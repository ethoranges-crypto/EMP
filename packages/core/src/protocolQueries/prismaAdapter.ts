import type { PrismaClient } from "@emp/db";
import type { CategoryFilter, ProtocolQueryPort } from "./ports.js";

/**
 * Implements ProtocolQueryPort using Prisma count/groupBy aggregation calls
 * only — never `findMany` returning recipient rows. If you're tempted to add
 * a method to this adapter that calls `.findMany` on CampaignRecipient or
 * selects `chatId`/`primaryWallet`/`fromAddress`, stop: that beats the point
 * of this file existing. Add an aggregate query instead.
 */
export function createPrismaProtocolQueryStore(prisma: PrismaClient): ProtocolQueryPort {
  return {
    async countMessageableUsers(filter: CategoryFilter) {
      return prisma.user.count({
        where: {
          telegramLinks: { some: { status: "VERIFIED" } },
          ...(filter.includeAll
            ? {}
            : { interests: { some: { categoryId: { in: filter.categoryIds } } } }),
        },
      });
    },

    async getCampaignSnapshotCount(campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { snapshotCount: true },
      });
      return campaign?.snapshotCount ?? 0;
    },

    async getCampaignCost(campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { costAmount: true, token: true },
      });
      // Cost locks at approval (CLAUDE.md rule 3), but token isn't chosen
      // until the payment step after that (SPEC §6) — nothing to report as
      // "spend" until both exist.
      if (!campaign?.costAmount || !campaign.token) return null;
      return { token: campaign.token, amount: campaign.costAmount.toString() };
    },

    async getDeliveryCounts(campaignId) {
      const rows = await prisma.deliveryEvent.findMany({
        where: { campaignId },
        select: { status: true, count: true },
      });
      const counts = { SENT: 0, FAILED: 0, BLOCKED: 0 };
      for (const row of rows) counts[row.status] = row.count;
      return counts;
    },

    async getCtaClickCounts(campaignId) {
      const ctas = await prisma.cta.findMany({
        where: { campaignId },
        select: { id: true, label: true, _count: { select: { clickEvents: true } } },
      });
      return ctas.map((cta) => ({ ctaId: cta.id, label: cta.label, count: cta._count.clickEvents }));
    },
  };
}
