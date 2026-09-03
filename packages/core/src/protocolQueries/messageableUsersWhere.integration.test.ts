import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@emp/db";
import { EVERYTHING_CATEGORY_NAME } from "@emp/config";
import { createPrismaProtocolQueryStore } from "./prismaAdapter.js";
import { createPrismaSnapshotStore } from "../campaigns/prismaSnapshotStore.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the integration lane. Run via `pnpm test:integration` — see packages/core/vitest.integration.config.ts.",
  );
}

/**
 * countMessageableUsers (the preview a protocol sees while composing) and
 * listMessageableChatIds (the real send list locked at approval) both call
 * the same buildMessageableUsersWhere helper — this proves that sharing
 * actually keeps them in numeric agreement for the exact scenario that
 * motivated it: User A picked "Everything", User B picked "Yields" only.
 * Before this fix, targeting Yields specifically counted 1 (B only) while
 * targeting Everything counted 2 (both) — an asymmetry a user picking
 * "Everything" would not expect. Both now return 2 either way, and the
 * preview count always equals the actual snapshot length.
 */
describe("countMessageableUsers and listMessageableChatIds agree — an Everything user matches specific-category targeting (integration, real Postgres)", () => {
  let yieldsId: string;
  const USER_A_EVERYTHING_CHAT_ID = "700000001";
  const USER_B_YIELDS_CHAT_ID = "700000002";

  beforeAll(async () => {
    await prisma.$transaction([
      prisma.campaignRecipient.deleteMany(),
      prisma.userInterest.deleteMany(),
      prisma.telegramLinkHistory.deleteMany(),
      prisma.telegramLink.deleteMany(),
      prisma.linkRequest.deleteMany(),
      prisma.user.deleteMany(),
      prisma.category.deleteMany(),
    ]);

    const yields = await prisma.category.create({ data: { name: "Yields", active: true } });
    yieldsId = yields.id;
    const everything = await prisma.category.create({ data: { name: EVERYTHING_CATEGORY_NAME, active: true } });

    const userA = await prisma.user.create({
      data: { primaryWallet: "0xagreeuserA00000000000000000000000000001", accountType: "EOA" },
    });
    await prisma.telegramLink.create({
      data: { userId: userA.id, chatId: USER_A_EVERYTHING_CHAT_ID, status: "VERIFIED", verifiedAt: new Date() },
    });
    await prisma.userInterest.create({ data: { userId: userA.id, categoryId: everything.id } });

    const userB = await prisma.user.create({
      data: { primaryWallet: "0xagreeuserB00000000000000000000000000001", accountType: "EOA" },
    });
    await prisma.telegramLink.create({
      data: { userId: userB.id, chatId: USER_B_YIELDS_CHAT_ID, status: "VERIFIED", verifiedAt: new Date() },
    });
    await prisma.userInterest.create({ data: { userId: userB.id, categoryId: yieldsId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("targeting Yields specifically: count is 2 and the snapshot list has exactly those 2 chat_ids", async () => {
    const queryStore = createPrismaProtocolQueryStore(prisma);
    const snapshotStore = createPrismaSnapshotStore(prisma);
    const filter = { categoryIds: [yieldsId], includeAll: false };

    const count = await queryStore.countMessageableUsers(filter);
    const chatIds = await snapshotStore.listMessageableChatIds(filter);

    expect(count).toBe(2);
    expect(chatIds.sort()).toEqual([USER_A_EVERYTHING_CHAT_ID, USER_B_YIELDS_CHAT_ID].sort());
    expect(count).toBe(chatIds.length);
  });

  it("targeting Everything: count is still 2 and the snapshot list still has exactly those 2 chat_ids", async () => {
    const queryStore = createPrismaProtocolQueryStore(prisma);
    const snapshotStore = createPrismaSnapshotStore(prisma);
    const filter = { categoryIds: [], includeAll: true };

    const count = await queryStore.countMessageableUsers(filter);
    const chatIds = await snapshotStore.listMessageableChatIds(filter);

    expect(count).toBe(2);
    expect(chatIds.sort()).toEqual([USER_A_EVERYTHING_CHAT_ID, USER_B_YIELDS_CHAT_ID].sort());
    expect(count).toBe(chatIds.length);
  });
});
