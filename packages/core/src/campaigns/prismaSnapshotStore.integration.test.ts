import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@emp/db";
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
