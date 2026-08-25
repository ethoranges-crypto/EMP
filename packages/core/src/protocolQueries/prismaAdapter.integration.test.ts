import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@emp/db";
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
  getCtaClickCounts: true,
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
    await prisma.campaignRecipient.create({
      data: { campaignId, chatId: REAL_CHAT_ID, deliveryStatus: "SENT" },
    });
    await prisma.deliveryEvent.create({ data: { campaignId, status: "SENT", count: 1 } });

    const cta = await prisma.cta.create({
      data: { campaignId, label: "Claim", targetUrl: "https://example.com", redirectToken: "tok-integration-1" },
    });
    await prisma.clickEvent.create({ data: { ctaId: cta.id, campaignId } });

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
      data: { campaignId: completeCampaignId, label: "Claim", targetUrl: "https://example.com", redirectToken: "tok-integration-2" },
    });
    await prisma.clickEvent.createMany({
      data: [
        { ctaId: completeCta.id, campaignId: completeCampaignId },
        { ctaId: completeCta.id, campaignId: completeCampaignId },
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

  it("getCtaClickCounts: clean and correct", async () => {
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.getCtaClickCounts(campaignId);
    expect(result).toEqual([{ ctaId: expect.any(String), label: "Claim", count: 1 }]);
    assertClean(result, "getCtaClickCounts");
  });

  it("getProtocolSummaryCounts: clean and correct — counts only the COMPLETE campaign, not the SENDING one", async () => {
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.getProtocolSummaryCounts(protocolId);
    expect(result).toEqual({ campaignsSent: 1, totalReach: 8, totalAudience: 10, totalClicks: 2 });
    assertClean(result, "getProtocolSummaryCounts");
  });

  it("getProtocolSummaryCounts: a protocol with no COMPLETE campaigns gets zeros, not another protocol's totals", async () => {
    const otherProtocol = await prisma.protocol.create({
      data: { wallet: "0xotherprotocol0000000000000000000000000", name: "Other Protocol", status: "APPROVED" },
    });
    const store = createPrismaProtocolQueryStore(prisma);
    const result = await store.getProtocolSummaryCounts(otherProtocol.id);
    expect(result).toEqual({ campaignsSent: 0, totalReach: 0, totalAudience: 0, totalClicks: 0 });
    assertClean(result, "getProtocolSummaryCounts");
  });

  it("covers every ProtocolQueryPort method — see METHOD_COVERAGE's doc comment", () => {
    expect(Object.keys(METHOD_COVERAGE).sort()).toEqual(
      [
        "countMessageableUsers",
        "getCampaignCost",
        "getCampaignSnapshotCount",
        "getCtaClickCounts",
        "getDeliveryCounts",
        "getProtocolSummaryCounts",
      ].sort(),
    );
  });
});
