import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@emp/db";
import { EVERYTHING_CATEGORY_NAME } from "@emp/config";
import { createPrismaProtocolQueryStore } from "./prismaAdapter.js";
import type { ProtocolQueryPort } from "./ports.js";
import { assertNoForbiddenKeys, assertNoLeakedValues } from "../testUtils/privacyAssertions.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the integration lane. Start Postgres " +
      "(docker compose up -d postgres, or a local instance) and run via " +
      "`pnpm test:integration` — see packages/core/vitest.integration.config.ts.",
  );
}

/**
 * Real, non-null secret values — not the unit test's synthetic fakes. A
 * forbidden-key scan over a null column passes whether or not the
 * protection works; these exist so an actual leak has something real to
 * leak, and so assertNoLeakedValues has something to look for.
 */
const REAL_WALLET = "0xabcdef0123456789abcdef0123456789abcdef01";
const REAL_CHAT_ID = "999888777";
const REAL_PAYER_ADDRESS = "0x1111222233334444555566667777888899990000";
const SECRETS = [REAL_WALLET, REAL_CHAT_ID, REAL_PAYER_ADDRESS] as const;

/**
 * Runs both shared privacy checks — the structural key-name scan and the
 * real-value leak scan — against one adapter method's return value.
 */
function assertClean(value: unknown, label: string): void {
  assertNoForbiddenKeys(value, `$.${label}`);
  assertNoLeakedValues(value, SECRETS, `$.${label}`);
}

/**
 * Type-level exhaustiveness check: this Record must have an entry for every
 * key of ProtocolQueryPort. Add a method to that interface without adding a
 * corresponding `it(...)` block + entry here, and this file fails to
 * compile (`tsc --noEmit` / `vitest run` both catch it) — a future adapter
 * method that returns a row with chatId on it cannot ship without either
 * being scanned here or breaking the build.
 */
type MethodCoverage = Record<keyof ProtocolQueryPort, true>;
const METHOD_COVERAGE: MethodCoverage = {
  countMessageableUsers: true,
  getCampaignSnapshotCount: true,
  getCampaignCost: true,
  getDeliveryCounts: true,
  getClickStats: true,
  getProtocolSummaryCounts: true,
};

describe("prismaAdapter — protocol-facing privacy boundary (integration, real Postgres)", () => {
  let campaignId: string;
  let categoryId: string;
  let protocolId: string;
  let completeCampaignId: string;

  beforeAll(async () => {
    // Fresh slate: this suite owns these tables in the integration DB.
    await prisma.$transaction([
      prisma.clickToken.deleteMany(),
      prisma.clickEvent.deleteMany(),
      prisma.deliveryEvent.deleteMany(),
      prisma.campaignRecipient.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.cta.deleteMany(),
      prisma.campaignCategory.deleteMany(),
      prisma.moderationReview.deleteMany(),
      prisma.campaign.deleteMany(),
      prisma.protocol.deleteMany(),
      prisma.userInterest.deleteMany(),
      prisma.telegramLinkHistory.deleteMany(),
      prisma.telegramLink.deleteMany(),
      prisma.linkRequest.deleteMany(),
      prisma.user.deleteMany(),
      prisma.category.deleteMany(),
    ]);

    const category = await prisma.category.create({ data: { name: "Yields", active: true } });
    categoryId = category.id;

    const user = await prisma.user.create({
      data: { primaryWallet: REAL_WALLET, accountType: "EOA" },
    });

    await prisma.telegramLink.create({
      data: { userId: user.id, chatId: REAL_CHAT_ID, status: "VERIFIED", verifiedAt: new Date() },
    });
    await prisma.userInterest.create({ data: { userId: user.id, categoryId } });

    const protocol = await prisma.protocol.create({
      data: { wallet: "0xprotocol000000000000000000000000000000", name: "Test Protocol", status: "APPROVED" },
    });
    protocolId = protocol.id;

    const campaign = await prisma.campaign.create({
      data: {
        protocolId: protocol.id,
        title: "Test Campaign",
        status: "SENDING",
        chain: "ETHEREUM",
        token: "USDC",
        snapshotCount: 1,
        costAmount: "125.00",
        approvedAt: new Date(),
      },
    });
    campaignId = campaign.id;

    await prisma.campaignCategory.create({ data: { campaignId, categoryId } });
    const recipient = await prisma.campaignRecipient.create({
      data: { campaignId, chatId: REAL_CHAT_ID, deliveryStatus: "SENT" },
    });
    await prisma.deliveryEvent.create({ data: { campaignId, status: "SENT", count: 1 } });

    const cta = await prisma.cta.create({
      data: { campaignId, label: "Claim", targetUrl: "https://example.com" },
    });
    await prisma.clickEvent.create({ data: { ctaId: cta.id, campaignId, recipientId: recipient.id } });

    // The exact row shape the earlier mutation leaked from: a Payment with a real fromAddress.
    await prisma.payment.create({
      data: {
        campaignId,
        chain: "ETHEREUM",
        token: "USDC",
        amount: "125.00",
        fromAddress: REAL_PAYER_ADDRESS,
        status: "VERIFIED",
        windowExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        verifiedAt: new Date(),
      },
    });

    // A second, COMPLETE campaign for the same protocol — getProtocolSummaryCounts
    // scopes to COMPLETE only, so the SENDING campaign above must not be
    // counted in it (proven by the exact totals asserted below).
    const completeCampaign = await prisma.campaign.create({
      data: {
        protocolId,
        title: "Completed Campaign",
        status: "COMPLETE",
        chain: "ETHEREUM",
        token: "USDC",
        snapshotCount: 10,
        costAmount: "50.00",
        approvedAt: new Date(),
        sentAt: new Date(),
      },
    });
    completeCampaignId = completeCampaign.id;
    await prisma.deliveryEvent.create({ data: { campaignId: completeCampaignId, status: "SENT", count: 8 } });
    const completeCta = await prisma.cta.create({
      data: { campaignId: completeCampaignId, label: "Claim", targetUrl: "https://example.com" },
    });
    // The same recipient clicking twice — real proof that a repeat click
    // raises the raw total but must NOT inflate the unique-clicker count
    // (the exact bug this schema/query change fixes: a rate computed from
    // the raw count could exceed 100% for one person clicking repeatedly).
    const completeRecipient = await prisma.campaignRecipient.create({
      data: { campaignId: completeCampaignId, chatId: "555000111", deliveryStatus: "SENT" },
    });
    await prisma.clickEvent.createMany({
      data: [
        { ctaId: completeCta.id, campaignId: completeCampaignId, recipientId: completeRecipient.id },
        { ctaId: completeCta.id, campaignId: completeCampaignId, recipientId: completeRecipient.id },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("countMessageableUsers: clean and correct", async () => {
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.countMessageableUsers({ categoryIds: [categoryId], includeAll: false });
    expect(result).toBe(1);
    assertClean(result, "countMessageableUsers");
  });

  it("countMessageableUsers: matches ANY of several selected categories, not all of them (SPEC §4.3 step 1 — multi-category targeting)", async () => {
    const otherCategory = await prisma.category.create({ data: { name: "New features", active: true } });
    const store = createPrismaProtocolQueryStore(prisma);
    // REAL_WALLET's user only has an interest in `categoryId` (Yields, seeded above) — selecting
    // a second, unrelated category alongside it should still count them once (OR semantics), not
    // zero them out for failing to match *every* selected category.
    const result = await store.countMessageableUsers({
      categoryIds: [categoryId, otherCategory.id],
      includeAll: false,
    });
    expect(result).toBe(1);
    assertClean(result, "countMessageableUsers");
  });

  it("countMessageableUsers: a matching-interest user with no verified Telegram link doesn't inflate the count, and their wallet never surfaces either", async () => {
    const decoyWallet = "0xdecoy00000000000000000000000000000000";
    const decoy = await prisma.user.create({ data: { primaryWallet: decoyWallet, accountType: "EOA" } });
    await prisma.userInterest.create({ data: { userId: decoy.id, categoryId } });
    // Deliberately no TelegramLink for the decoy — SPEC §7.5: only a *verified* link makes an
    // account messageable, interest alone isn't enough.

    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.countMessageableUsers({ categoryIds: [categoryId], includeAll: false });
    expect(result).toBe(1); // still just REAL_WALLET's user — the decoy is excluded, not double-counted
    assertNoForbiddenKeys(result, "$.countMessageableUsers");
    assertNoLeakedValues(result, [...SECRETS, decoyWallet], "$.countMessageableUsers");
  });

  it("countMessageableUsers: a paused user is excluded even with a verified link and matching interest — the self-service opt-out", async () => {
    const pausedWallet = "0xpauseduser0000000000000000000000000000";
    const paused = await prisma.user.create({ data: { primaryWallet: pausedWallet, accountType: "EOA", paused: true } });
    await prisma.telegramLink.create({
      data: { userId: paused.id, chatId: "444555666", status: "VERIFIED", verifiedAt: new Date() },
    });
    await prisma.userInterest.create({ data: { userId: paused.id, categoryId } });

    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.countMessageableUsers({ categoryIds: [categoryId], includeAll: false });
    expect(result).toBe(1); // still just REAL_WALLET's user — the paused one doesn't count
    assertNoForbiddenKeys(result, "$.countMessageableUsers");
    assertNoLeakedValues(result, [...SECRETS, pausedWallet], "$.countMessageableUsers");
  });

  it("countMessageableUsers: a user who selected 'Everything' matches a specific-category targeting too — Everything means the same thing on both sides of the match", async () => {
    const everythingCategory = await prisma.category.create({ data: { name: EVERYTHING_CATEGORY_NAME, active: true } });
    const everythingWallet = "0xeverythinguser00000000000000000000000001";
    const everythingUser = await prisma.user.create({ data: { primaryWallet: everythingWallet, accountType: "EOA" } });
    await prisma.telegramLink.create({
      data: { userId: everythingUser.id, chatId: "333222111", status: "VERIFIED", verifiedAt: new Date() },
    });
    // Only ever ONE UserInterest row for this user — Everything, not every
    // real category individually. The query layer is what expands this,
    // not extra rows written on save.
    await prisma.userInterest.create({ data: { userId: everythingUser.id, categoryId: everythingCategory.id } });

    const store = createPrismaProtocolQueryStore(prisma);
    // Targeting Yields specifically — NOT Everything — must now count BOTH
    // REAL_WALLET's user (picked Yields) and this new user (picked
    // Everything), previously it counted only the former.
    const result = await store.countMessageableUsers({ categoryIds: [categoryId], includeAll: false });
    expect(result).toBe(2);
    assertNoForbiddenKeys(result, "$.countMessageableUsers");
    assertNoLeakedValues(result, [...SECRETS, everythingWallet], "$.countMessageableUsers");
  });

  it("getCampaignSnapshotCount: clean and correct", async () => {
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.getCampaignSnapshotCount(campaignId);
    expect(result).toBe(1);
    assertClean(result, "getCampaignSnapshotCount");
  });

  it("getCampaignCost: clean and correct — the exact path the earlier fromAddress mutation broke", async () => {
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.getCampaignCost(campaignId);
    expect(result?.token).toBe("USDC");
    expect(Number(result?.amount)).toBe(125);
    assertClean(result, "getCampaignCost");
  });

  it("getDeliveryCounts: clean and correct", async () => {
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.getDeliveryCounts(campaignId);
    expect(result.SENT).toBe(1);
    assertClean(result, "getDeliveryCounts");
  });

  it("getClickStats: clean and correct — one recipient's one click is one raw click and one unique clicker", async () => {
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.getClickStats(campaignId);
    expect(result).toEqual({
      totalClicks: 1,
      uniqueClickers: 1,
      byCta: [{ ctaId: expect.any(String), label: "Claim", count: 1, uniqueClickers: 1 }],
    });
    assertClean(result, "getClickStats");
  });

  it("getClickStats: the same recipient clicking twice counts as 2 raw clicks but 1 unique clicker — the >100% CTR bug this fixes", async () => {
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.getClickStats(completeCampaignId);
    expect(result).toEqual({
      totalClicks: 2,
      uniqueClickers: 1,
      byCta: [{ ctaId: expect.any(String), label: "Claim", count: 2, uniqueClickers: 1 }],
    });
    assertClean(result, "getClickStats");
  });

  it("getProtocolSummaryCounts: clean and correct — counts only the COMPLETE campaign, not the SENDING one, and dedupes its repeat clicker", async () => {
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.getProtocolSummaryCounts(protocolId);
    // totalUniqueClickers is 1, not 2 — the COMPLETE campaign's one recipient
    // clicked twice (see beforeAll); a raw click count here would wrongly
    // read 2.
    expect(result).toEqual({ campaignsSent: 1, totalReach: 8, totalAudience: 10, totalUniqueClickers: 1 });
    assertClean(result, "getProtocolSummaryCounts");
  });

  it("getProtocolSummaryCounts: a protocol with no COMPLETE campaigns gets zeros, not another protocol's totals", async () => {
    const otherProtocol = await prisma.protocol.create({
      data: { wallet: "0xotherprotocol0000000000000000000000000", name: "Other Protocol", status: "APPROVED" },
    });
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.getProtocolSummaryCounts(otherProtocol.id);
    expect(result).toEqual({ campaignsSent: 0, totalReach: 0, totalAudience: 0, totalUniqueClickers: 0 });
    assertClean(result, "getProtocolSummaryCounts");
  });

  it("covers every ProtocolQueryPort method — see METHOD_COVERAGE's doc comment", () => {
    expect(Object.keys(METHOD_COVERAGE).sort()).toEqual(
      [
        "countMessageableUsers",
        "getCampaignCost",
        "getCampaignSnapshotCount",
        "getClickStats",
        "getDeliveryCounts",
        "getProtocolSummaryCounts",
      ].sort(),
    );
  });
});
