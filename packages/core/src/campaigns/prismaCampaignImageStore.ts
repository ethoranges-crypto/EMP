import type { PrismaClient } from "@emp/db";
import type { CampaignImagePort } from "./updateCampaignImage.js";

export function createPrismaCampaignImageStore(prisma: PrismaClient): CampaignImagePort {
  return {
    async getCampaignOwnerAndStatus(campaignId) {
      return prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { protocolId: true, status: true },
      });
    },

    async saveImage(campaignId, data, mimeType) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { imageData: data ? Buffer.from(data) : null, imageMimeType: mimeType },
      });
    },
  };
}
