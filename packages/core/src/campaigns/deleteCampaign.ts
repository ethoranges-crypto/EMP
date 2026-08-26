import { CampaignNotFoundError, CampaignNotOwnedError, EDITABLE_CAMPAIGN_STATUSES } from "./updateCompose.js";
import type { CampaignStatus } from "./moderation.js";

export class CampaignNotDeletableError extends Error {
  constructor(status: CampaignStatus) {
    super(`Campaign is ${status} — only a DRAFT or REJECTED campaign can be deleted.`);
    this.name = "CampaignNotDeletableError";
  }
}

export interface DeleteCampaignPort {
  getCampaignOwnerStatusAndPayment(
    campaignId: string,
  ): Promise<{ protocolId: string; status: CampaignStatus; hasVerifiedPayment: boolean } | null>;
  /** Hard delete — DRAFT/REJECTED never has recipients, deliveries, or payments to preserve. */
  deleteCampaign(campaignId: string): Promise<void>;
}

export interface DeleteCampaignParams {
  campaignId: string;
  protocolId: string;
}

/**
 * DRAFT and REJECTED are the same "nothing paid or sent yet" set
 * updateCompose.ts already treats as editable (EDITABLE_CAMPAIGN_STATUSES)
 * — deleting one outright is safe and final, unlike everything past
 * IN_REVIEW (cancelCampaign.ts/paymentWindowRecovery.ts's cancel paths,
 * which end a campaign without erasing it).
 *
 * hasVerifiedPayment is checked directly, not inferred from status alone —
 * same reasoning as cancelCampaign.ts — even though a DRAFT/REJECTED
 * campaign structurally can't have a Payment row yet (those only start to
 * exist once AWAITING_PAYMENT begins), this is the one gate CLAUDE.md's
 * "never let payment land and then discard it" requirement can't be
 * allowed to depend on that always holding true.
 */
export async function deleteCampaign(port: DeleteCampaignPort, params: DeleteCampaignParams): Promise<void> {
  const campaign = await port.getCampaignOwnerStatusAndPayment(params.campaignId);
  if (!campaign) throw new CampaignNotFoundError(params.campaignId);
  if (campaign.protocolId !== params.protocolId) throw new CampaignNotOwnedError(params.campaignId);
  if (!EDITABLE_CAMPAIGN_STATUSES.has(campaign.status) || campaign.hasVerifiedPayment) {
    throw new CampaignNotDeletableError(campaign.status);
  }
  await port.deleteCampaign(params.campaignId);
}
