import type { PrismaClient } from "@emp/db";
import { buildMessageableUsersWhere } from "./messageableUsersWhere.js";
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
      return prisma.user.count({ where: await buildMessageableUsersWhere(prisma, filter) });
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

    async getClickStats(campaignId) {
      const [ctas, rawCounts, uniqueRows] = await Promise.all([
        prisma.cta.findMany({ where: { campaignId }, select: { id: true, label: true } }),
        prisma.clickEvent.groupBy({ by: ["ctaId"], where: { campaignId }, _count: { _all: true } }),
        // Grouping by (ctaId, recipientId) yields one row per distinct
        // clicker-per-CTA — its LENGTH is the unique-clicker count. The
        // per-recipient identity in these rows never leaves this function;
        // only the derived counts below are returned, same aggregate-only
        // guarantee every other method on this adapter gives.
        prisma.clickEvent.groupBy({
          by: ["ctaId", "recipientId"],
          where: { campaignId, recipientId: { not: null } },
        }),
      ]);

      const rawCountByCta = new Map(rawCounts.map((r) => [r.ctaId, r._count._all]));
      const uniqueByCta = new Map<string, number>();
      const uniqueRecipientsOverall = new Set<string>();
      for (const row of uniqueRows) {
        uniqueByCta.set(row.ctaId, (uniqueByCta.get(row.ctaId) ?? 0) + 1);
        uniqueRecipientsOverall.add(row.recipientId as string);
      }

      const byCta = ctas.map((cta) => ({
        ctaId: cta.id,
        label: cta.label,
        count: rawCountByCta.get(cta.id) ?? 0,
        uniqueClickers: uniqueByCta.get(cta.id) ?? 0,
      }));
      const totalClicks = byCta.reduce((sum, c) => sum + c.count, 0);

      return { totalClicks, uniqueClickers: uniqueRecipientsOverall.size, byCta };
    },

    async getProtocolSummaryCounts(protocolId) {
      const completeCampaigns = await prisma.campaign.findMany({
        where: { protocolId, status: "COMPLETE" },
        select: { id: true, snapshotCount: true },
      });
      const campaignIds = completeCampaigns.map((c) => c.id);
      if (campaignIds.length === 0) return { campaignsSent: 0, totalReach: 0, totalAudience: 0, totalUniqueClickers: 0 };

      const totalAudience = completeCampaigns.reduce((sum, c) => sum + (c.snapshotCount ?? 0), 0);

      const [deliveredAgg, uniqueRows] = await Promise.all([
        prisma.deliveryEvent.aggregate({
          where: { campaignId: { in: campaignIds }, status: "SENT" },
          _sum: { count: true },
        }),
        // One row per (campaignId, recipientId) that ever clicked — its
        // LENGTH is exactly "each campaign's own unique-clicker count,
        // summed" (a recipient clicking twice within one campaign is one
        // row; clicking across two campaigns is two rows, correctly two
        // separate conversions — see this method's doc comment). Never
        // returns the underlying rows, same as every other aggregate here.
        prisma.clickEvent.groupBy({
          by: ["campaignId", "recipientId"],
          where: { campaignId: { in: campaignIds }, recipientId: { not: null } },
        }),
      ]);

      return {
        campaignsSent: campaignIds.length,
        totalReach: deliveredAgg._sum.count ?? 0,
        totalAudience,
        totalUniqueClickers: uniqueRows.length,
      };
    },
  };
}
