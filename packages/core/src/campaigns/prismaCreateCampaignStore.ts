import type { PrismaClient } from "@emp/db";
import type { CreateCampaignPort } from "./createCampaign.js";

export function createPrismaCreateCampaignStore(prisma: PrismaClient): CreateCampaignPort {
  return {
    async isApprovedProtocol(protocolId) {
      const protocol = await prisma.protocol.findUnique({ where: { id: protocolId }, select: { status: true } });
      return protocol?.status === "APPROVED";
    },

    async createDraft({ protocolId, title, categoryIds }) {
      const campaign = await prisma.campaign.create({
        data: {
          protocolId,
          title,
          status: "DRAFT",
          categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        },
      });
      return { campaignId: campaign.id };
    },
  };
}
