import type { PrismaClient } from "@emp/db";
import type { DeleteCampaignPort } from "./deleteCampaign.js";

export function createPrismaDeleteCampaignStore(prisma: PrismaClient): DeleteCampaignPort {
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
    async deleteCampaign(campaignId) {
      // CampaignCategory/Cta/CampaignRecipient/DeliveryEvent all cascade on
      // Campaign delete already (see schema.prisma) — ModerationReview
      // doesn't (a REJECTED campaign always has at least one), so it's
      // cleared explicitly here rather than adding a schema-level cascade
      // just for this one caller.
      await prisma.$transaction([
        prisma.moderationReview.deleteMany({ where: { campaignId } }),
        prisma.campaign.delete({ where: { id: campaignId } }),
      ]);
    },
  };
}
