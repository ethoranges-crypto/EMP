import type { PrismaClient } from "@emp/db";
import type { RescheduleCampaignPort } from "./rescheduleCampaign.js";

export function createPrismaRescheduleCampaignStore(prisma: PrismaClient): RescheduleCampaignPort {
  return {
    async getCampaignOwnerAndStatus(campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { protocolId: true, status: true },
      });
      if (!campaign) return null;
      return { protocolId: campaign.protocolId, status: campaign.status };
    },

    async updateScheduledSendAt(campaignId, scheduledSendAt) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { scheduledSendAt } });
    },
  };
}
