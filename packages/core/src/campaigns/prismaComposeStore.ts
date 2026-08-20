import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@emp/db";
import type { ComposePort } from "./updateCompose.js";

export function createPrismaComposeStore(prisma: PrismaClient): ComposePort {
  return {
    async getCampaignOwnerAndStatus(campaignId) {
      // Selects imageMimeType (small) rather than imageData (up to 10MB)
      // just to learn whether an image is currently attached — the two are
      // always set/cleared together (see updateCampaignImage.ts's store).
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { protocolId: true, status: true, imageMimeType: true },
      });
      if (!campaign) return null;
      return { protocolId: campaign.protocolId, status: campaign.status, hasImage: campaign.imageMimeType !== null };
    },

    async saveCompose({ campaignId, bodyText, ctas }) {
      // Replaces the whole CTA set on every save — simplest correct model
      // for a still-DRAFT campaign (nothing has been sent, so there are no
      // real clicks against the old tokens to preserve; ClickEvent cascades
      // with its Cta on delete).
      await prisma.$transaction([
        prisma.cta.deleteMany({ where: { campaignId } }),
        prisma.campaign.update({ where: { id: campaignId }, data: { bodyText } }),
        ...(ctas.length > 0
          ? [
              prisma.cta.createMany({
                data: ctas.map((cta) => ({
                  campaignId,
                  label: cta.label,
                  targetUrl: cta.targetUrl,
                  redirectToken: cta.redirectToken,
                })),
              }),
            ]
          : []),
      ]);
    },

    generateRedirectToken() {
      return randomUUID();
    },
  };
}
