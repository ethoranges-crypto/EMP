import type { PrismaClient } from "@emp/db";
import type { LinkRequestPort } from "./linkRequest.js";

export function createPrismaLinkRequestStore(prisma: PrismaClient): LinkRequestPort {
  return {
    async invalidateExisting(userId) {
      await prisma.linkRequest.deleteMany({ where: { userId } });
    },

    async create({ userId, code, expiresAt }) {
      await prisma.linkRequest.create({ data: { userId, code, expiresAt } });
    },

    async findRedeemable(code, now) {
      return prisma.linkRequest.findFirst({
        where: { code, expiresAt: { gt: now } },
        select: { id: true, userId: true },
      });
    },

    async deleteById(id) {
      await prisma.linkRequest.delete({ where: { id } });
    },
  };
}
