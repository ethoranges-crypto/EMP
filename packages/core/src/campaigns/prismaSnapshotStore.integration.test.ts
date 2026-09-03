import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@emp/db";
import { EVERYTHING_CATEGORY_NAME } from "@emp/config";
import { createPrismaSnapshotStore } from "./prismaSnapshotStore.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the integration lane. Start Postgres " +
      "(docker compose up -d postgres, or a local instance) and run via " +
      "`pnpm test:integration` — see packages/core/vitest.integration.config.ts.",
  );
}

/**
 * listMessageableChatIds is the function that actually decides who gets a
 * campaign_recipients row at approval (snapshot.ts's approveCampaign) — the
 * real send list, not just the audience-count estimate shown to protocols
 * beforehand. A paused user (self-service opt-out) must never appear here,
 * even with a verified Telegram link and a matching interest, exactly as
 * CLAUDE.md requires: "a paused user must NOT be included in any campaign's
 * messageable audience."
 */
describe("prismaSnapshotStore.listMessageableChatIds — paused users are excluded from the real send list (integration, real Postgres)", () => {
  let categoryId: string;
  const ACTIVE_CHAT_ID = "111000111";
  const PAUSED_CHAT_ID = "222000222";

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

    const category = await prisma.category.create({ data: { name: "Yields", active: true } });
    categoryId = category.id;

    const active = await prisma.user.create({
      data: { primaryWallet: "0xactiveuser000000000000000000000000000001", accountType: "EOA", paused: false },
    });
    await prisma.telegramLink.create({
      data: { userId: active.id, chatId: ACTIVE_CHAT_ID, status: "VERIFIED", verifiedAt: new Date() },
    });
    await prisma.userInterest.create({ data: { userId: active.id, categoryId } });

    const paused = await prisma.user.create({
      data: { primaryWallet: "0xpausedauser000000000000000000000000001", accountType: "EOA", paused: true },
    });
    await prisma.telegramLink.create({
      data: { userId: paused.id, chatId: PAUSED_CHAT_ID, status: "VERIFIED", verifiedAt: new Date() },
    });
    await prisma.userInterest.create({ data: { userId: paused.id, categoryId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("excludes a paused user's chat_id from a category-filtered snapshot, even though their link is verified and their interest matches", async () => {
    const store = createPrismaSnapshotStore(prisma);
    const chatIds = await store.listMessageableChatIds({ categoryIds: [categoryId], includeAll: false });
    expect(chatIds).toEqual([ACTIVE_CHAT_ID]);
    expect(chatIds).not.toContain(PAUSED_CHAT_ID);
  });

  it("excludes a paused user's chat_id from an includeAll ('Everything') snapshot too", async () => {
    const store = createPrismaSnapshotStore(prisma);
    const chatIds = await store.listMessageableChatIds({ categoryIds: [], includeAll: true });
    expect(chatIds).toEqual([ACTIVE_CHAT_ID]);
    expect(chatIds).not.toContain(PAUSED_CHAT_ID);
  });
});

/**
 * The audience-targeting gap: a user who selected "Everything" as their own
 * interest previously matched ONLY a protocol campaign that also targeted
 * Everything (CategoryFilter.includeAll) — targeting a specific category
 * like Yields excluded them, because their only UserInterest row pointed at
 * Everything's own category id, not Yields'. buildMessageableUsersWhere
 * closes this by unioning Everything's id into the IN clause, so an
 * Everything user matches any specific-category targeting too — the same
 * fix proven here for the real send list (listMessageableChatIds), not just
 * the preview count (see prismaAdapter.integration.test.ts's equivalent
 * countMessageableUsers test).
 */
describe("prismaSnapshotStore.listMessageableChatIds — an 'Everything' user matches specific-category targeting too (integration, real Postgres)", () => {
  let yieldsId: string;
  const EVERYTHING_USER_CHAT_ID = "777000777";
  const YIELDS_USER_CHAT_ID = "888000888";

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

    // User A: picked Everything — a single UserInterest row, never one per
    // real category.
    const userA = await prisma.user.create({
      data: { primaryWallet: "0xuserAeverything00000000000000000000001", accountType: "EOA" },
    });
    await prisma.telegramLink.create({
      data: { userId: userA.id, chatId: EVERYTHING_USER_CHAT_ID, status: "VERIFIED", verifiedAt: new Date() },
    });
    await prisma.userInterest.create({ data: { userId: userA.id, categoryId: everything.id } });

    // User B: picked Yields only.
    const userB = await prisma.user.create({
      data: { primaryWallet: "0xuserByields000000000000000000000000001", accountType: "EOA" },
    });
    await prisma.telegramLink.create({
      data: { userId: userB.id, chatId: YIELDS_USER_CHAT_ID, status: "VERIFIED", verifiedAt: new Date() },
    });
    await prisma.userInterest.create({ data: { userId: userB.id, categoryId: yieldsId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("targeting Yields specifically returns BOTH the Yields user and the Everything user", async () => {
    const store = createPrismaSnapshotStore(prisma);
    const chatIds = await store.listMessageableChatIds({ categoryIds: [yieldsId], includeAll: false });
    expect(chatIds.sort()).toEqual([EVERYTHING_USER_CHAT_ID, YIELDS_USER_CHAT_ID].sort());
  });

  it("targeting Everything still returns both users (the pre-existing broadcast override, unaffected by this fix)", async () => {
    const store = createPrismaSnapshotStore(prisma);
    const chatIds = await store.listMessageableChatIds({ categoryIds: [], includeAll: true });
    expect(chatIds.sort()).toEqual([EVERYTHING_USER_CHAT_ID, YIELDS_USER_CHAT_ID].sort());
  });
});
