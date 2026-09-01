import type { PrismaClient } from "@emp/db";
import type { CancelCampaignPort } from "./cancelCampaign.js";

export function createPrismaCancelCampaignStore(prisma: PrismaClient): CancelCampaignPort {
  return {
    async getCampaignOwnerStatusAndPayment(campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          protocolId: true,
          status: true,
          payments: { where: { status: "VERIFIED" }, select: { id: true }, take: 1 },
        },
      });
      if (!campaign) return null;
      return { protocolId: campaign.protocolId, status: campaign.status, hasVerifiedPayment: campaign.payments.length > 0 };
    },
    async cancel(campaignId) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: "CANCELLED" } });
    },
  };
}
