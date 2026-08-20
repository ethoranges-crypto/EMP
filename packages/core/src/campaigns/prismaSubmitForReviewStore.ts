import type { PrismaClient } from "@emp/db";
import type { SubmitForReviewPort } from "./submitForReview.js";

export function createPrismaSubmitForReviewStore(prisma: PrismaClient): SubmitForReviewPort {
  return {
    async getCampaignForSubmit(campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { protocolId: true, status: true, bodyText: true },
      });
      if (!campaign) return null;
      return {
        protocolId: campaign.protocolId,
        status: campaign.status,
        hasComposeContent: campaign.bodyText !== null,
      };
    },

    async markInReview(campaignId) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: "IN_REVIEW" } });
    },
  };
}
