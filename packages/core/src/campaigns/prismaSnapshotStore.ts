import type { PrismaClient } from "@emp/db";
import { buildMessageableUsersWhere } from "../protocolQueries/messageableUsersWhere.js";
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
      // buildMessageableUsersWhere is the single source of truth for who
      // matches a CategoryFilter — shared with countMessageableUsers so the
      // preview a protocol sees and the actual recipient set locked at
      // approval can never drift apart. See its own doc comment for the
      // Everything-matches-any-category semantics this encodes.
      const users = await prisma.user.findMany({
        where: await buildMessageableUsersWhere(prisma, filter),
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
