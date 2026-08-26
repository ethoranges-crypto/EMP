import type { PrismaClient } from "@emp/db";
import type { CategoryFilter } from "../protocolQueries/ports.js";
import type { SnapshotPort } from "./snapshot.js";

/**
 * The only place outside packages/telegram allowed to read chat_ids in bulk.
 * Restricted to the admin-approval flow — never wire this into a
 * protocol-facing route.
 */
export function createPrismaSnapshotStore(prisma: PrismaClient): SnapshotPort {
  return {
    async listMessageableChatIds(filter: CategoryFilter) {
      const users = await prisma.user.findMany({
        where: {
          telegramLinks: { some: { status: "VERIFIED" } },
          // Same paused exclusion as countMessageableUsers — this is the
          // function that actually decides who gets a campaign_recipients
          // row (and gets messaged), so a paused user opting out here is
          // the real, functional part of that guarantee, not just the
          // count shown to protocols beforehand.
          paused: false,
          ...(filter.includeAll
            ? {}
            : { interests: { some: { categoryId: { in: filter.categoryIds } } } }),
        },
        select: { telegramLinks: { where: { status: "VERIFIED" }, select: { chatId: true }, take: 1 } },
      });
      return users.flatMap((u) => u.telegramLinks.map((l) => l.chatId));
    },

    async writeSnapshot({ campaignId, chatIds, costAmount, now }) {
      await prisma.$transaction([
        prisma.campaignRecipient.createMany({
          data: chatIds.map((chatId) => ({ campaignId, chatId })),
        }),
        prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: "APPROVED",
            snapshotCount: chatIds.length,
            costAmount,
            approvedAt: now,
          },
        }),
      ]);
    },
  };
}
