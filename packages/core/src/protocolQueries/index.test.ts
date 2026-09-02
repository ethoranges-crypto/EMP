import { describe, expect, it } from "vitest";
import { getAudienceCount, getCampaignMetrics, getProtocolSummary, type ProtocolQueryPort } from "./index.js";
import { assertNoForbiddenKeys } from "../testUtils/privacyAssertions.js";

function createFakePort(overrides: Partial<ProtocolQueryPort> = {}): ProtocolQueryPort {
  return {
    countMessageableUsers: async () => 250,
    getCampaignSnapshotCount: async () => 250,
    getCampaignCost: async () => ({ token: "USDC", amount: "125.00" }),
    getDeliveryCounts: async () => ({ SENT: 200, FAILED: 10, BLOCKED: 40 }),
    getClickStats: async () => ({
      totalClicks: 60,
      uniqueClickers: 42,
      byCta: [
        { ctaId: "cta-1", label: "Claim yield", count: 40, uniqueClickers: 30 },
        { ctaId: "cta-2", label: "Learn more", count: 20, uniqueClickers: 12 },
      ],
    }),
    getProtocolSummaryCounts: async () => ({ campaignsSent: 4, totalReach: 800, totalAudience: 1000, totalUniqueClickers: 120 }),
    ...overrides,
  };
}

describe("privacy boundary — protocol-facing query layer", () => {
  it("getAudienceCount returns a bare number, never a list", async () => {
    const port = createFakePort();
    const count = await getAudienceCount(port, { categoryIds: ["yields"], includeAll: false });
    expect(count).toBe(250);
  });

  it("getCampaignMetrics response contains no wallet/chat_id/address-shaped keys at any depth", async () => {
    const port = createFakePort();
    const metrics = await getCampaignMetrics(port, "campaign-1");
    assertNoForbiddenKeys(metrics);
  });

  it("getCampaignMetrics computes rates from unique clickers, not raw click counts (a repeat clicker must never push CTR past 100%)", async () => {
    const port = createFakePort();
    const metrics = await getCampaignMetrics(port, "campaign-1");

    expect(metrics.audienceSize).toBe(250);
    expect(metrics.delivered).toEqual({ count: 200, ratePct: 80 });
    expect(metrics.clicks.total).toBe(60); // raw total clicks, repeats included
    expect(metrics.clicks.uniqueClickers).toBe(42);
    expect(metrics.clicks.ratePct).toBe(21); // 42 unique clickers / 200 delivered — NOT 60/200
    expect(metrics.clicks.byCta).toEqual([
      { ctaId: "cta-1", label: "Claim yield", count: 40, uniqueClickers: 30, ratePct: 15 },
      { ctaId: "cta-2", label: "Learn more", count: 20, uniqueClickers: 12, ratePct: 6 },
    ]);
  });

  it("a recipient clicking repeatedly raises Total Clicks but never pushes CTR past 100%", async () => {
    const port = createFakePort({
      getDeliveryCounts: async () => ({ SENT: 10, FAILED: 0, BLOCKED: 0 }),
      getClickStats: async () => ({
        totalClicks: 30, // one recipient clicking the same CTA 3 times, among others
        uniqueClickers: 10,
        byCta: [{ ctaId: "cta-1", label: "Claim", count: 30, uniqueClickers: 10 }],
      }),
    });
    const metrics = await getCampaignMetrics(port, "campaign-repeat-clicker");
    expect(metrics.clicks.total).toBe(30);
    expect(metrics.clicks.ratePct).toBe(100); // every delivered recipient clicked once each — 100%, not 300%
  });

  it("handles a campaign with zero deliveries without dividing by zero", async () => {
    const port = createFakePort({
      getCampaignSnapshotCount: async () => 0,
      getDeliveryCounts: async () => ({ SENT: 0, FAILED: 0, BLOCKED: 0 }),
      getClickStats: async () => ({ totalClicks: 0, uniqueClickers: 0, byCta: [] }),
    });
    const metrics = await getCampaignMetrics(port, "campaign-empty");
    expect(metrics.delivered).toEqual({ count: 0, ratePct: 0 });
    expect(metrics.clicks.ratePct).toBe(0);
  });

  it("returns null spend for an unpaid campaign rather than leaking a payer address", async () => {
    const port = createFakePort({ getCampaignCost: async () => null });
    const metrics = await getCampaignMetrics(port, "campaign-1");
    expect(metrics.spend).toBeNull();
  });

  it("getProtocolSummary response contains no wallet/chat_id/address-shaped keys at any depth", async () => {
    const port = createFakePort();
    const summary = await getProtocolSummary(port, "protocol-1");
    assertNoForbiddenKeys(summary);
  });

  it("getProtocolSummary computes aggregate delivered/click rates from aggregate totals, not an average of per-campaign rates", async () => {
    const port = createFakePort();
    const summary = await getProtocolSummary(port, "protocol-1");
    expect(summary).toEqual({ campaignsSent: 4, totalReach: 800, avgDeliveredRatePct: 80, avgClickRatePct: 15 }); // 800/1000, 120/800
  });

  it("handles a protocol with no COMPLETE campaigns yet without dividing by zero", async () => {
    const port = createFakePort({
      getProtocolSummaryCounts: async () => ({ campaignsSent: 0, totalReach: 0, totalAudience: 0, totalUniqueClickers: 0 }),
    });
    const summary = await getProtocolSummary(port, "protocol-1");
    expect(summary).toEqual({ campaignsSent: 0, totalReach: 0, avgDeliveredRatePct: 0, avgClickRatePct: 0 });
  });
});
