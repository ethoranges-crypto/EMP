import { describe, expect, it } from "vitest";
import {
  saveCampaignCompose,
  CampaignNotFoundError,
  CampaignNotOwnedError,
  CampaignNotEditableError,
  InvalidCtaError,
  type ComposePort,
} from "./updateCompose.js";

function createFakePort(overrides: Partial<ComposePort> = {}): ComposePort {
  return {
    getCampaignOwnerAndStatus: async () => ({ protocolId: "protocol-1", status: "DRAFT" }),
    saveCompose: async () => {},
    generateRedirectToken: () => "tok-fixed",
    ...overrides,
  };
}

const baseParams = {
  campaignId: "campaign-1",
  protocolId: "protocol-1",
  bodyText: "Come earn yield",
  imageUrl: null,
  ctas: [{ label: "Claim", targetUrl: "https://example.com/claim" }],
};

describe("saveCampaignCompose — SPEC §4.3 step 2 / §8", () => {
  it("saves and wraps every CTA URL with a fresh redirect token", async () => {
    const port = createFakePort();
    const result = await saveCampaignCompose(port, baseParams);
    expect(result.ctas).toEqual([
      { label: "Claim", targetUrl: "https://example.com/claim", redirectToken: "tok-fixed" },
    ]);
  });

  it("refuses a campaign that doesn't exist", async () => {
    const port = createFakePort({ getCampaignOwnerAndStatus: async () => null });
    await expect(saveCampaignCompose(port, baseParams)).rejects.toThrow(CampaignNotFoundError);
  });

  it("refuses a campaign owned by a different protocol", async () => {
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "someone-else", status: "DRAFT" }),
    });
    await expect(saveCampaignCompose(port, baseParams)).rejects.toThrow(CampaignNotOwnedError);
  });

  it("refuses to edit a campaign that's left DRAFT (e.g. already IN_REVIEW)", async () => {
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "protocol-1", status: "IN_REVIEW" }),
    });
    await expect(saveCampaignCompose(port, baseParams)).rejects.toThrow(CampaignNotEditableError);
  });

  it("rejects a CTA with a blank label", async () => {
    const port = createFakePort();
    await expect(
      saveCampaignCompose(port, { ...baseParams, ctas: [{ label: "  ", targetUrl: "https://example.com" }] }),
    ).rejects.toThrow(InvalidCtaError);
  });

  it("rejects a malformed CTA URL", async () => {
    const port = createFakePort();
    await expect(
      saveCampaignCompose(port, { ...baseParams, ctas: [{ label: "Claim", targetUrl: "not-a-url" }] }),
    ).rejects.toThrow(InvalidCtaError);
  });

  it("rejects a non-http(s) CTA URL scheme (e.g. javascript:) rather than storing it for /r/:token to blindly redirect to", async () => {
    const port = createFakePort();
    await expect(
      saveCampaignCompose(port, { ...baseParams, ctas: [{ label: "Claim", targetUrl: "javascript:alert(1)" }] }),
    ).rejects.toThrow(InvalidCtaError);
  });

  it("validates every CTA before saving any of them — a bad second CTA never reaches saveCompose", async () => {
    let saveCalled = false;
    const port = createFakePort({ saveCompose: async () => { saveCalled = true; } });
    await expect(
      saveCampaignCompose(port, {
        ...baseParams,
        ctas: [
          { label: "Good", targetUrl: "https://example.com" },
          { label: "Bad", targetUrl: "javascript:alert(1)" },
        ],
      }),
    ).rejects.toThrow(InvalidCtaError);
    expect(saveCalled).toBe(false);
  });

  it("allows zero CTAs — SPEC only requires text, CTAs are additive", async () => {
    const port = createFakePort();
    const result = await saveCampaignCompose(port, { ...baseParams, ctas: [] });
    expect(result.ctas).toEqual([]);
  });

  it("checks ownership/editability before ever validating CTA content", async () => {
    let saveCalled = false;
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "someone-else", status: "DRAFT" }),
      saveCompose: async () => { saveCalled = true; },
    });
    await expect(
      saveCampaignCompose(port, { ...baseParams, ctas: [{ label: "x", targetUrl: "javascript:evil()" }] }),
    ).rejects.toThrow(CampaignNotOwnedError);
    expect(saveCalled).toBe(false);
  });
});
