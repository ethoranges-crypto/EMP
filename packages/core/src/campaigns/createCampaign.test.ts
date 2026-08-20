import { describe, expect, it } from "vitest";
import { CAMPAIGN_TITLE_MAX_LENGTH } from "@emp/config";
import {
  createDraftCampaign,
  InvalidTitleError,
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

const baseParams = {
  protocolId: "protocol-1",
  title: "Yield Boost Launch",
  categoryIds: ["cat-1", "cat-2"],
  chain: "ETHEREUM",
  token: "USDC" as const,
};

describe("createDraftCampaign — SPEC §4.3 step 1 / §4.2's approval gate", () => {
  it("creates a draft for an approved protocol with a title and categories selected", async () => {
    const port = createFakePort();
    const result = await createDraftCampaign(port, baseParams);
    expect(result).toEqual({ campaignId: "campaign-1" });
  });

  it("refuses an un-approved protocol — un-approved protocols cannot create campaigns", async () => {
    const port = createFakePort({ isApprovedProtocol: async () => false });
    await expect(createDraftCampaign(port, baseParams)).rejects.toThrow(ProtocolNotApprovedError);
  });

  it("refuses zero categories selected", async () => {
    const port = createFakePort();
    await expect(createDraftCampaign(port, { ...baseParams, categoryIds: [] })).rejects.toThrow(
      NoCategoriesSelectedError,
    );
  });

  it("refuses an empty title", async () => {
    const port = createFakePort();
    await expect(createDraftCampaign(port, { ...baseParams, title: "   " })).rejects.toThrow(InvalidTitleError);
  });

  it("refuses a title over CAMPAIGN_TITLE_MAX_LENGTH", async () => {
    const port = createFakePort();
    await expect(
      createDraftCampaign(port, { ...baseParams, title: "a".repeat(CAMPAIGN_TITLE_MAX_LENGTH + 1) }),
    ).rejects.toThrow(InvalidTitleError);
  });

  it("allows a title at exactly CAMPAIGN_TITLE_MAX_LENGTH and trims whitespace", async () => {
    const port = createFakePort({
      createDraft: async ({ title }) => {
        expect(title).toBe("a".repeat(CAMPAIGN_TITLE_MAX_LENGTH));
        return { campaignId: "campaign-1" };
      },
    });
    const result = await createDraftCampaign(port, {
      ...baseParams,
      title: `  ${"a".repeat(CAMPAIGN_TITLE_MAX_LENGTH)}  `,
    });
    expect(result).toEqual({ campaignId: "campaign-1" });
  });

  it("checks the title before ever touching approval or categories", async () => {
    let isApprovedProtocolCalled = false;
    const port = createFakePort({
      isApprovedProtocol: async () => {
        isApprovedProtocolCalled = true;
        return true;
      },
    });
    await expect(createDraftCampaign(port, { ...baseParams, title: "" })).rejects.toThrow(InvalidTitleError);
    expect(isApprovedProtocolCalled).toBe(false);
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
    await expect(createDraftCampaign(port, baseParams)).rejects.toThrow(ProtocolNotApprovedError);
    expect(createDraftCalled).toBe(false);
  });
});
