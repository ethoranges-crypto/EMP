import { describe, expect, it } from "vitest";
import { getAudienceCount, getCampaignMetrics, type ProtocolQueryPort } from "./index.js";
import { assertNoForbiddenKeys } from "../testUtils/privacyAssertions.js";

function createFakePort(overrides: Partial<ProtocolQueryPort> = {}): ProtocolQueryPort {
  return {
    countMessageableUsers: async () => 250,
    getCampaignSnapshotCount: async () => 250,
    getCampaignCost: async () => ({ token: "USDC", amount: "125.00" }),
    getDeliveryCounts: async () => ({ SENT: 200, FAILED: 10, BLOCKED: 40 }),
    getCtaClickCounts: async () => [
      { ctaId: "cta-1", label: "Claim yield", count: 30 },
      { ctaId: "cta-2", label: "Learn more", count: 12 },
    ],
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

  it("getCampaignMetrics computes rates from aggregate counts, not raw rows", async () => {
    const port = createFakePort();
    const metrics = await getCampaignMetrics(port, "campaign-1");

    expect(metrics.audienceSize).toBe(250);
    expect(metrics.delivered).toEqual({ count: 200, ratePct: 80 });
    expect(metrics.clicks.total).toBe(42);
    expect(metrics.clicks.ratePct).toBe(21); // 42 / 200 delivered
    expect(metrics.clicks.byCta).toEqual([
      { ctaId: "cta-1", label: "Claim yield", count: 30, ratePct: 15 },
      { ctaId: "cta-2", label: "Learn more", count: 12, ratePct: 6 },
    ]);
  });

  it("handles a campaign with zero deliveries without dividing by zero", async () => {
    const port = createFakePort({
      getCampaignSnapshotCount: async () => 0,
      getDeliveryCounts: async () => ({ SENT: 0, FAILED: 0, BLOCKED: 0 }),
      getCtaClickCounts: async () => [],
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
});
