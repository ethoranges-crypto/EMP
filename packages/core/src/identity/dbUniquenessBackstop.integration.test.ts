import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@emp/db";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the integration lane. Start Postgres " +
      "and run via `pnpm test:integration` — see packages/core/vitest.integration.config.ts.",
  );
}

/**
 * These tests exist because the app-layer check in telegramLinking.ts kept
 * passing its own tests while the DB-level backstop was silently inert
 * twice in a row (wrong column casing, then a dropped SQL statement — see
 * the git history on prisma/sql/partial_unique_indexes.sql). Neither bug
 * touched telegramLinking.ts, so nothing in the unit suite could have
 * caught either one. This file tests the backstop directly, independent of
 * the application code it backs up:
 *   1. the two partial unique indexes physically exist, on the real
 *      (camelCase) column names — this alone would have caught bug #1.
 *   2. Postgres itself rejects a violation when written directly via the
 *      Prisma client, bypassing attemptLink()/telegramLinking.ts entirely —
 *      this alone would have caught bug #2 (an index that exists in name
 *      but was never actually created).
 */
describe("DB backstop — partial unique indexes enforce SPEC §7.5 independent of app logic", () => {
  beforeEach(async () => {
    await prisma.$transaction([
      prisma.telegramLinkHistory.deleteMany(),
      prisma.telegramLink.deleteMany(),
      prisma.linkRequest.deleteMany(),
      prisma.userInterest.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("index existence — fails the build on camelCase/snake_case drift", () => {
    it("has a partial unique index on telegram_links.chatId WHERE status = VERIFIED", async () => {
      const rows = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'telegram_links' AND indexname = 'telegram_links_chat_id_verified_unique'
      `;
      expect(rows).toHaveLength(1);
      const def = rows[0]!.indexdef;
      expect(def).toContain("UNIQUE");
      // Asserted against the real column name, quoted exactly as Postgres
      // stores it — a snake_case regression (chat_id) would not match this.
      expect(def).toContain('("chatId")');
      expect(def).toContain("WHERE (status = 'VERIFIED'");
    });

    it("has a partial unique index on telegram_links.userId WHERE status = VERIFIED", async () => {
      const rows = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'telegram_links' AND indexname = 'telegram_links_user_id_verified_unique'
      `;
      expect(rows).toHaveLength(1);
      const def = rows[0]!.indexdef;
      expect(def).toContain("UNIQUE");
      expect(def).toContain('("userId")');
      expect(def).toContain("WHERE (status = 'VERIFIED'");
    });
  });

  describe("behavioral proof — Postgres rejects the violation with app-layer checks bypassed", () => {
    it("rejects a second VERIFIED link binding an already-bound chatId", async () => {
      const userA = await prisma.user.create({ data: { primaryWallet: "0xdbtest-user-a", accountType: "EOA" } });
      const userB = await prisma.user.create({ data: { primaryWallet: "0xdbtest-user-b", accountType: "EOA" } });

      // Written directly via the Prisma client — attemptLink()'s
      // findActiveLinkByChatId check is never called.
      await prisma.telegramLink.create({
        data: { userId: userA.id, chatId: "dbtest-shared-chat", status: "VERIFIED", verifiedAt: new Date() },
      });

      await expect(
        prisma.telegramLink.create({
          data: { userId: userB.id, chatId: "dbtest-shared-chat", status: "VERIFIED", verifiedAt: new Date() },
        }),
      ).rejects.toMatchObject({ code: "P2002" }); // Prisma's code for a unique-constraint violation
    });

    it("rejects a second VERIFIED link for an account that already has one", async () => {
      const user = await prisma.user.create({ data: { primaryWallet: "0xdbtest-user-c", accountType: "EOA" } });

      await prisma.telegramLink.create({
        data: { userId: user.id, chatId: "dbtest-chat-a", status: "VERIFIED", verifiedAt: new Date() },
      });

      await expect(
        prisma.telegramLink.create({
          data: { userId: user.id, chatId: "dbtest-chat-b", status: "VERIFIED", verifiedAt: new Date() },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    it("does NOT block a second VERIFIED link for the same chatId once the first is UNLINKED (proves the index is partial, not a blanket unique constraint)", async () => {
      const userA = await prisma.user.create({ data: { primaryWallet: "0xdbtest-user-d", accountType: "EOA" } });
      const userB = await prisma.user.create({ data: { primaryWallet: "0xdbtest-user-e", accountType: "EOA" } });

      const firstLink = await prisma.telegramLink.create({
        data: { userId: userA.id, chatId: "dbtest-relinkable-chat", status: "VERIFIED", verifiedAt: new Date() },
      });
      await prisma.telegramLink.update({
        where: { id: firstLink.id },
        data: { status: "UNLINKED", unlinkedAt: new Date() },
      });

      await expect(
        prisma.telegramLink.create({
          data: { userId: userB.id, chatId: "dbtest-relinkable-chat", status: "VERIFIED", verifiedAt: new Date() },
        }),
      ).resolves.toMatchObject({ status: "VERIFIED" });
    });
  });
});
