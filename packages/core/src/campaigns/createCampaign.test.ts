import { describe, expect, it } from "vitest";
import {
  createDraftCampaign,
  NoCategoriesSelectedError,
  ProtocolNotApprovedError,
  type CreateCampaignPort,
} from "./createCampaign.js";

function createFakePort(overrides: Partial<CreateCampaignPort> = {}): CreateCampaignPort {
  return {
    isApprovedProtocol: async () => true,
    createDraft: async () => ({ campaignId: "campaign-1" }),
    ...overrides,
  };
}

describe("createDraftCampaign — SPEC §4.3 step 1 / §4.2's approval gate", () => {
  it("creates a draft for an approved protocol with categories selected", async () => {
    const port = createFakePort();
    const result = await createDraftCampaign(port, {
      protocolId: "protocol-1",
      categoryIds: ["cat-1", "cat-2"],
      chain: "ETHEREUM",
      token: "USDC",
    });
    expect(result).toEqual({ campaignId: "campaign-1" });
  });

  it("refuses an un-approved protocol — un-approved protocols cannot create campaigns", async () => {
    const port = createFakePort({ isApprovedProtocol: async () => false });
    await expect(
      createDraftCampaign(port, { protocolId: "protocol-1", categoryIds: ["cat-1"], chain: "ETHEREUM", token: "USDC" }),
    ).rejects.toThrow(ProtocolNotApprovedError);
  });

  it("refuses zero categories selected", async () => {
    const port = createFakePort();
    await expect(
      createDraftCampaign(port, { protocolId: "protocol-1", categoryIds: [], chain: "ETHEREUM", token: "USDC" }),
    ).rejects.toThrow(NoCategoriesSelectedError);
  });

  it("checks approval before ever touching the categories — a rejected protocol's request never reaches createDraft", async () => {
    let createDraftCalled = false;
    const port = createFakePort({
      isApprovedProtocol: async () => false,
      createDraft: async () => {
        createDraftCalled = true;
        return { campaignId: "should-not-happen" };
      },
    });
    await expect(
      createDraftCampaign(port, { protocolId: "protocol-1", categoryIds: ["cat-1"], chain: "ETHEREUM", token: "USDC" }),
    ).rejects.toThrow(ProtocolNotApprovedError);
    expect(createDraftCalled).toBe(false);
  });
});
