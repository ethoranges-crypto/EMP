import type { PrismaClient } from "@emp/db";
import type { SetPaymentMethodPort } from "./setPaymentMethod.js";

export function createPrismaSetPaymentMethodStore(prisma: PrismaClient): SetPaymentMethodPort {
  return {
    async getCampaignOwnerAndStatus(campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { protocolId: true, status: true, costAmount: true },
      });
      if (!campaign) return null;
      return {
        protocolId: campaign.protocolId,
        status: campaign.status,
        costAmount: campaign.costAmount?.toString() ?? null,
      };
    },

    async openPaymentWindow(params) {
      await prisma.$transaction([
        prisma.campaign.update({
          where: { id: params.campaignId },
          data: { chain: params.chain, token: params.token, status: "AWAITING_PAYMENT" },
        }),
        prisma.payment.create({
          data: {
            campaignId: params.campaignId,
            chain: params.chain,
            token: params.token,
            amount: params.amount,
            fromAddress: params.fromAddress,
            windowExpiresAt: params.windowExpiresAt,
          },
        }),
      ]);
    },
  };
}
