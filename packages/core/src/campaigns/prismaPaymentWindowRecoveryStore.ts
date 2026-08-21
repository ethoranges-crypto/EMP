import type { PrismaClient } from "@emp/db";
import type { PaymentWindowRecoveryPort } from "./paymentWindowRecovery.js";

export function createPrismaPaymentWindowRecoveryStore(prisma: PrismaClient): PaymentWindowRecoveryPort {
  return {
    async getCampaignAndLatestPaymentStatus(campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          protocolId: true,
          status: true,
          payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
        },
      });
      if (!campaign) return null;
      return {
        protocolId: campaign.protocolId,
        status: campaign.status,
        latestPaymentStatus: campaign.payments[0]?.status ?? null,
      };
    },

    async revertToApproved(campaignId) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    },

    async cancel(campaignId) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: "CANCELLED" } });
    },
  };
}
