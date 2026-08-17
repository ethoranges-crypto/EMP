import type { PrismaClient } from "@emp/db";
import type { TelegramLinkPort } from "./ports.js";

export function createPrismaTelegramLinkStore(prisma: PrismaClient): TelegramLinkPort {
  return {
    async findActiveLinkByChatId(chatId) {
      const link = await prisma.telegramLink.findFirst({
        where: { chatId, status: "VERIFIED" },
        select: { userId: true },
      });
      return link;
    },

    async findActiveLinkByUserId(userId) {
      const link = await prisma.telegramLink.findFirst({
        where: { userId, status: "VERIFIED" },
        select: { chatId: true },
      });
      return link;
    },

    async findMostRecentUnlink(chatId) {
      const row = await prisma.telegramLinkHistory.findFirst({
        where: { chatId, unlinkedAt: { not: null } },
        orderBy: { unlinkedAt: "desc" },
        select: { unlinkedAt: true },
      });
      return row?.unlinkedAt ? { unlinkedAt: row.unlinkedAt } : null;
    },

    async createVerifiedLink(userId, chatId, now) {
      await prisma.$transaction([
        prisma.telegramLink.create({
          data: { userId, chatId, status: "VERIFIED", verifiedAt: now },
        }),
        prisma.telegramLinkHistory.create({
          data: { userId, chatId, linkedAt: now },
        }),
      ]);
    },

    async unlink(userId, now, reason) {
      const active = await prisma.telegramLink.findFirst({
        where: { userId, status: "VERIFIED" },
      });
      if (!active) return null;

      await prisma.$transaction([
        prisma.telegramLink.update({
          where: { id: active.id },
          data: { status: "UNLINKED", unlinkedAt: now },
        }),
        prisma.telegramLinkHistory.updateMany({
          where: { userId, chatId: active.chatId, unlinkedAt: null },
          data: { unlinkedAt: now, reason },
        }),
      ]);
      return { chatId: active.chatId };
    },
  };
}
