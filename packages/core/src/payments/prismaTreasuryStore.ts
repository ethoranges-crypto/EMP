import type { PrismaClient } from "@emp/db";
import type { TreasuryConfigPort } from "./treasuryConfig.js";

export function createPrismaTreasuryStore(prisma: PrismaClient): TreasuryConfigPort {
  return {
    async listTreasuryAddresses() {
      const rows = await prisma.chainTreasury.findMany();
      return Object.fromEntries(rows.map((r) => [r.chain, r.treasuryAddress]));
    },

    async setTreasuryAddress(chainKey, treasuryAddress) {
      await prisma.chainTreasury.upsert({
        where: { chain: chainKey },
        create: { chain: chainKey, treasuryAddress },
        update: { treasuryAddress },
      });
    },
  };
}
