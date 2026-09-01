import { assertTransition, type CampaignStatus } from "./moderation.js";
import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";

export class CampaignNotSubmittableError extends Error {
  constructor(status: string) {
    super(`Campaign is ${status} — only a DRAFT or REJECTED campaign can be submitted for approval.`);
    this.name = "CampaignNotSubmittableError";
  }
}

export class CampaignNotComposedError extends Error {
  constructor() {
    super("Add a message before submitting for approval.");
    this.name = "CampaignNotComposedError";
  }
}

export interface SubmitForReviewPort {
  getCampaignForSubmit(
    campaignId: string,
  ): Promise<{ protocolId: string; status: CampaignStatus; hasComposeContent: boolean } | null>;
  markInReview(campaignId: string): Promise<void>;
}

export interface SubmitCampaignForReviewParams {
  campaignId: string;
  protocolId: string;
}

/**
 * SPEC §4.3 step 3: moves a composed DRAFT (or a REJECTED campaign the
 * protocol has fixed up) into IN_REVIEW, where it locks from further edits
 * (updateCompose.ts/updateCampaignImage.ts's EDITABLE_CAMPAIGN_STATUSES no
 * longer includes IN_REVIEW) and becomes visible to admin moderation
 * (listInReviewCampaigns.ts). A campaign with no message can't be
 * submitted — there'd be nothing for an admin to review or a recipient to
 * receive.
 */
export async function submitCampaignForReview(port: SubmitForReviewPort, params: SubmitCampaignForReviewParams): Promise<void> {
  const campaign = await port.getCampaignForSubmit(params.campaignId);
  if (!campaign) throw new CampaignNotFoundError(params.campaignId);
  if (campaign.protocolId !== params.protocolId) throw new CampaignNotOwnedError(params.campaignId);
  if (campaign.status !== "DRAFT" && campaign.status !== "REJECTED") {
    throw new CampaignNotSubmittableError(campaign.status);
  }
  if (!campaign.hasComposeContent) throw new CampaignNotComposedError();

  assertTransition(campaign.status, "IN_REVIEW");
  await port.markInReview(params.campaignId);
}
