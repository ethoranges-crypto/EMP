import type { PrismaClient } from "@emp/db";
import type { SetPaymentMethodPort } from "./setPaymentMethod.js";

export function createPrismaSetPaymentMethodStore(prisma: PrismaClient): SetPaymentMethodPort {
  return {
    async getCampaignOwnerAndStatus(campaignId) {
      return prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { protocolId: true, status: true },
      });
    },

    async savePaymentMethod(campaignId, chain, token) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { chain, token } });
    },
  };
}
