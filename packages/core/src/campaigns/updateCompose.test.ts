import { describe, expect, it } from "vitest";
import { CTA_LABEL_MAX_LENGTH, MAX_CTAS_PER_CAMPAIGN, TELEGRAM_TEXT_LIMIT_NO_IMAGE, TELEGRAM_TEXT_LIMIT_WITH_IMAGE } from "@emp/config";
import {
  saveCampaignCompose,
  CampaignNotFoundError,
  CampaignNotOwnedError,
  CampaignNotEditableError,
  InvalidCtaError,
  MessageTooLongError,
  TooManyCtasError,
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

  it("allows message text right at the no-image limit (4096 chars)", async () => {
    const port = createFakePort();
    const result = await saveCampaignCompose(port, { ...baseParams, bodyText: "a".repeat(TELEGRAM_TEXT_LIMIT_NO_IMAGE) });
    expect(result.ctas).toHaveLength(1);
  });

  it("rejects message text one character over the no-image limit", async () => {
    const port = createFakePort();
    await expect(
      saveCampaignCompose(port, { ...baseParams, bodyText: "a".repeat(TELEGRAM_TEXT_LIMIT_NO_IMAGE + 1) }),
    ).rejects.toThrow(MessageTooLongError);
  });

  it("applies the shorter WITH-image limit (1024) once imageUrl is set, even if the text would fit the no-image limit", async () => {
    const port = createFakePort();
    const bodyText = "a".repeat(TELEGRAM_TEXT_LIMIT_WITH_IMAGE + 1);
    await expect(
      saveCampaignCompose(port, { ...baseParams, bodyText, imageUrl: "https://example.com/banner.png" }),
    ).rejects.toThrow(MessageTooLongError);
    // The same text is fine without an image — proves it's the image that changed the limit, not the length alone.
    await expect(saveCampaignCompose(port, { ...baseParams, bodyText, imageUrl: null })).resolves.toBeDefined();
  });

  it("rejects a CTA label over CTA_LABEL_MAX_LENGTH", async () => {
    const port = createFakePort();
    await expect(
      saveCampaignCompose(port, {
        ...baseParams,
        ctas: [{ label: "a".repeat(CTA_LABEL_MAX_LENGTH + 1), targetUrl: "https://example.com" }],
      }),
    ).rejects.toThrow(InvalidCtaError);
  });

  it("allows a CTA label at exactly CTA_LABEL_MAX_LENGTH", async () => {
    const port = createFakePort();
    const result = await saveCampaignCompose(port, {
      ...baseParams,
      ctas: [{ label: "a".repeat(CTA_LABEL_MAX_LENGTH), targetUrl: "https://example.com" }],
    });
    expect(result.ctas).toHaveLength(1);
  });

  it("rejects more than MAX_CTAS_PER_CAMPAIGN CTAs", async () => {
    const port = createFakePort();
    const tooMany = Array.from({ length: MAX_CTAS_PER_CAMPAIGN + 1 }, (_, i) => ({
      label: `CTA ${i}`,
      targetUrl: "https://example.com",
    }));
    await expect(saveCampaignCompose(port, { ...baseParams, ctas: tooMany })).rejects.toThrow(TooManyCtasError);
  });

  it("allows exactly MAX_CTAS_PER_CAMPAIGN CTAs", async () => {
    const port = createFakePort();
    const exactly = Array.from({ length: MAX_CTAS_PER_CAMPAIGN }, (_, i) => ({
      label: `CTA ${i}`,
      targetUrl: "https://example.com",
    }));
    const result = await saveCampaignCompose(port, { ...baseParams, ctas: exactly });
    expect(result.ctas).toHaveLength(MAX_CTAS_PER_CAMPAIGN);
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
