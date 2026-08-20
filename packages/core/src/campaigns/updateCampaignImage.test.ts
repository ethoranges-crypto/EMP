import { describe, expect, it } from "vitest";
import { CAMPAIGN_IMAGE_MAX_BYTES } from "@emp/config";
import {
  saveCampaignImage,
  CampaignImageTooLargeError,
  InvalidCampaignImageTypeError,
  type CampaignImagePort,
} from "./updateCampaignImage.js";
import { CampaignNotFoundError, CampaignNotOwnedError, CampaignNotEditableError } from "./updateCompose.js";

function createFakePort(overrides: Partial<CampaignImagePort> = {}): CampaignImagePort {
  return {
    getCampaignOwnerAndStatus: async () => ({ protocolId: "protocol-1", status: "DRAFT" }),
    saveImage: async () => {},
    ...overrides,
  };
}

const baseParams = {
  campaignId: "campaign-1",
  protocolId: "protocol-1",
  data: new Uint8Array([0xff, 0xd8, 0xff]),
  mimeType: "image/jpeg",
};

describe("saveCampaignImage — SPEC §4.3 step 2 / §8", () => {
  it("saves a valid image", async () => {
    let saved: unknown;
    const port = createFakePort({ saveImage: async (id, data, mimeType) => { saved = { id, data, mimeType }; } });
    await saveCampaignImage(port, baseParams);
    expect(saved).toEqual({ id: "campaign-1", data: baseParams.data, mimeType: "image/jpeg" });
  });

  it("removing the image (data: null) always succeeds — an image is optional, never required", async () => {
    let saved: unknown;
    const port = createFakePort({ saveImage: async (id, data, mimeType) => { saved = { id, data, mimeType }; } });
    await saveCampaignImage(port, { ...baseParams, data: null, mimeType: null });
    expect(saved).toEqual({ id: "campaign-1", data: null, mimeType: null });
  });

  it("refuses a campaign that doesn't exist", async () => {
    const port = createFakePort({ getCampaignOwnerAndStatus: async () => null });
    await expect(saveCampaignImage(port, baseParams)).rejects.toThrow(CampaignNotFoundError);
  });

  it("refuses a campaign owned by a different protocol", async () => {
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "someone-else", status: "DRAFT" }),
    });
    await expect(saveCampaignImage(port, baseParams)).rejects.toThrow(CampaignNotOwnedError);
  });

  it("refuses to edit a campaign that's left DRAFT", async () => {
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "protocol-1", status: "IN_REVIEW" }),
    });
    await expect(saveCampaignImage(port, baseParams)).rejects.toThrow(CampaignNotEditableError);
  });

  it("rejects an image over CAMPAIGN_IMAGE_MAX_BYTES", async () => {
    const port = createFakePort();
    await expect(
      saveCampaignImage(port, { ...baseParams, data: new Uint8Array(CAMPAIGN_IMAGE_MAX_BYTES + 1) }),
    ).rejects.toThrow(CampaignImageTooLargeError);
  });

  it("allows an image at exactly CAMPAIGN_IMAGE_MAX_BYTES", async () => {
    const port = createFakePort();
    await expect(
      saveCampaignImage(port, { ...baseParams, data: new Uint8Array(CAMPAIGN_IMAGE_MAX_BYTES) }),
    ).resolves.toBeUndefined();
  });

  it("rejects an unsupported mime type (e.g. image/gif)", async () => {
    const port = createFakePort();
    await expect(saveCampaignImage(port, { ...baseParams, mimeType: "image/gif" })).rejects.toThrow(
      InvalidCampaignImageTypeError,
    );
  });

  it("rejects a non-image mime type", async () => {
    const port = createFakePort();
    await expect(saveCampaignImage(port, { ...baseParams, mimeType: "application/pdf" })).rejects.toThrow(
      InvalidCampaignImageTypeError,
    );
  });

  it("accepts each allowed mime type", async () => {
    for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
      const port = createFakePort();
      await expect(saveCampaignImage(port, { ...baseParams, mimeType })).resolves.toBeUndefined();
    }
  });

  it("checks ownership/editability before ever validating the image itself", async () => {
    let saveCalled = false;
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "someone-else", status: "DRAFT" }),
      saveImage: async () => { saveCalled = true; },
    });
    await expect(
      saveCampaignImage(port, { ...baseParams, data: new Uint8Array(CAMPAIGN_IMAGE_MAX_BYTES + 1) }),
    ).rejects.toThrow(CampaignNotOwnedError);
    expect(saveCalled).toBe(false);
  });
});
