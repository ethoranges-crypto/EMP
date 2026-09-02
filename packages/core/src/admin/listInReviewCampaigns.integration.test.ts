import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@emp/db";
import { listInReviewCampaigns } from "./listInReviewCampaigns.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the integration lane. Run via `pnpm test:integration` — see packages/core/vitest.integration.config.ts.",
  );
}

/**
 * Real-Postgres proof that the admin moderation-queue query actually works
 * against the real migrated schema and the real generated Prisma Client —
 * same reasoning as listPendingProtocols.integration.test.ts. In
 * particular this catches a `select` that names a field the client
 * doesn't know about yet (stale codegen) before it reaches a browser as a
 * 500 — exactly the class of bug that motivated that file.
 *
 * Unique-per-run protocol wallets + assertions scoped to just the rows
 * this file created, so leftover state from any other test — or a stale
 * row from someone's own manual testing against the same dev database —
 * can't make this flaky.
 */
describe("listInReviewCampaigns (integration, real Postgres)", () => {
  const createdCampaignIds: string[] = [];
  const createdProtocolIds: string[] = [];
  const runId = `${Date.now()}-${Math.random()}`;

  afterEach(async () => {
    if (createdCampaignIds.length > 0) {
      await prisma.cta.deleteMany({ where: { campaignId: { in: createdCampaignIds } } });
      await prisma.campaignCategory.deleteMany({ where: { campaignId: { in: createdCampaignIds } } });
      await prisma.campaign.deleteMany({ where: { id: { in: createdCampaignIds } } });
      createdCampaignIds.length = 0;
    }
    if (createdProtocolIds.length > 0) {
      await prisma.protocol.deleteMany({ where: { id: { in: createdProtocolIds } } });
      createdProtocolIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedProtocol(name: string) {
    const protocol = await prisma.protocol.create({
      data: { wallet: `0xprotocol-${name}-${runId}`, name, status: "APPROVED", accountType: "EOA" },
    });
    createdProtocolIds.push(protocol.id);
    return protocol;
  }

  async function seedCampaign(data: {
    protocolId: string;
    title: string;
    status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
    bodyText?: string | null;
    imageMimeType?: string | null;
    createdAt?: Date;
  }) {
    const campaign = await prisma.campaign.create({ data });
    createdCampaignIds.push(campaign.id);
    return campaign;
  }

  it("returns an IN_REVIEW campaign's title, protocol name/wallet, text, image presence, and CTAs", async () => {
    const protocol = await seedProtocol(`Acme-${runId}`);
    const campaign = await seedCampaign({
      protocolId: protocol.id,
      title: `Launch ${runId}`,
      status: "IN_REVIEW",
      bodyText: "Come earn yield",
      imageMimeType: "image/png",
    });
    await prisma.cta.create({
      data: { campaignId: campaign.id, label: "Claim", targetUrl: "https://example.com" },
    });

    const rows = (await listInReviewCampaigns(prisma)).filter((r) => createdCampaignIds.includes(r.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: `Launch ${runId}`,
      protocolName: `Acme-${runId}`,
      protocolWallet: protocol.wallet,
      bodyText: "Come earn yield",
      hasImage: true,
    });
    expect(rows[0]!.ctas).toEqual([{ id: expect.any(String), label: "Claim", targetUrl: "https://example.com" }]);
  });

  it("excludes non-IN_REVIEW campaigns", async () => {
    const protocol = await seedProtocol(`Beta-${runId}`);
    await seedCampaign({ protocolId: protocol.id, title: `Draft ${runId}`, status: "DRAFT" });
    await seedCampaign({ protocolId: protocol.id, title: `Approved ${runId}`, status: "APPROVED" });
    await seedCampaign({ protocolId: protocol.id, title: `Rejected ${runId}`, status: "REJECTED" });
    await seedCampaign({ protocolId: protocol.id, title: `Still in review ${runId}`, status: "IN_REVIEW" });

    const rows = (await listInReviewCampaigns(prisma)).filter((r) => createdCampaignIds.includes(r.id));

    expect(rows.map((r) => r.title)).toEqual([`Still in review ${runId}`]);
  });

  it("orders oldest-first, so the queue is worked in submission order", async () => {
    const protocol = await seedProtocol(`Gamma-${runId}`);
    const first = await seedCampaign({ protocolId: protocol.id, title: `First ${runId}`, status: "IN_REVIEW" });
    await seedCampaign({
      protocolId: protocol.id,
      title: `Second ${runId}`,
      status: "IN_REVIEW",
      createdAt: new Date(first.createdAt.getTime() + 1000),
    });

    const rows = (await listInReviewCampaigns(prisma)).filter((r) => createdCampaignIds.includes(r.id));

    expect(rows.map((r) => r.title)).toEqual([`First ${runId}`, `Second ${runId}`]);
  });

  it("reports hasImage: false and an empty CTA list when neither is set", async () => {
    const protocol = await seedProtocol(`Delta-${runId}`);
    await seedCampaign({ protocolId: protocol.id, title: `Bare ${runId}`, status: "IN_REVIEW", bodyText: "Just text" });

    const rows = (await listInReviewCampaigns(prisma)).filter((r) => createdCampaignIds.includes(r.id));

    expect(rows[0]).toMatchObject({ hasImage: false, ctas: [] });
  });
});
