import { describe, expect, it } from "vitest";
import {
  submitCampaignForReview,
  CampaignNotComposedError,
  CampaignNotSubmittableError,
  type SubmitForReviewPort,
} from "./submitForReview.js";
import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";

function createFakePort(overrides: Partial<SubmitForReviewPort> = {}): SubmitForReviewPort {
  return {
    getCampaignForSubmit: async () => ({ protocolId: "protocol-1", status: "DRAFT", hasComposeContent: true }),
    markInReview: async () => {},
    ...overrides,
  };
}

const baseParams = { campaignId: "campaign-1", protocolId: "protocol-1" };

describe("submitCampaignForReview — SPEC §4.3 step 3", () => {
  it("moves a composed DRAFT into IN_REVIEW", async () => {
    let marked = false;
    const port = createFakePort({ markInReview: async () => { marked = true; } });
    await submitCampaignForReview(port, baseParams);
    expect(marked).toBe(true);
  });

  it("moves a composed REJECTED campaign back into IN_REVIEW — the resubmit path", async () => {
    let marked = false;
    const port = createFakePort({
      getCampaignForSubmit: async () => ({ protocolId: "protocol-1", status: "REJECTED", hasComposeContent: true }),
      markInReview: async () => { marked = true; },
    });
    await submitCampaignForReview(port, baseParams);
    expect(marked).toBe(true);
  });

  it("refuses a campaign that doesn't exist", async () => {
    const port = createFakePort({ getCampaignForSubmit: async () => null });
    await expect(submitCampaignForReview(port, baseParams)).rejects.toThrow(CampaignNotFoundError);
  });

  it("refuses a campaign owned by a different protocol", async () => {
    const port = createFakePort({
      getCampaignForSubmit: async () => ({ protocolId: "someone-else", status: "DRAFT", hasComposeContent: true }),
    });
    await expect(submitCampaignForReview(port, baseParams)).rejects.toThrow(CampaignNotOwnedError);
  });

  it("refuses to submit a campaign that's already IN_REVIEW", async () => {
    const port = createFakePort({
      getCampaignForSubmit: async () => ({ protocolId: "protocol-1", status: "IN_REVIEW", hasComposeContent: true }),
    });
    await expect(submitCampaignForReview(port, baseParams)).rejects.toThrow(CampaignNotSubmittableError);
  });

  it("refuses to submit an already-APPROVED campaign", async () => {
    const port = createFakePort({
      getCampaignForSubmit: async () => ({ protocolId: "protocol-1", status: "APPROVED", hasComposeContent: true }),
    });
    await expect(submitCampaignForReview(port, baseParams)).rejects.toThrow(CampaignNotSubmittableError);
  });

  it("refuses a campaign with no composed message", async () => {
    const port = createFakePort({
      getCampaignForSubmit: async () => ({ protocolId: "protocol-1", status: "DRAFT", hasComposeContent: false }),
    });
    await expect(submitCampaignForReview(port, baseParams)).rejects.toThrow(CampaignNotComposedError);
  });

  it("checks ownership before ever checking compose content", async () => {
    let getCalled = 0;
    const port = createFakePort({
      getCampaignForSubmit: async () => {
        getCalled += 1;
        return { protocolId: "someone-else", status: "DRAFT", hasComposeContent: false };
      },
    });
    await expect(submitCampaignForReview(port, baseParams)).rejects.toThrow(CampaignNotOwnedError);
    expect(getCalled).toBe(1);
  });
});
