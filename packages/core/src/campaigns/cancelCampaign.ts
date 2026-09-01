import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";
import { assertTransition, type CampaignStatus } from "./moderation.js";

export class CampaignNotCancellableError extends Error {
  constructor(status: CampaignStatus) {
    super(`Campaign is ${status} — only an IN_REVIEW or APPROVED campaign with no payment yet can be cancelled.`);
    this.name = "CampaignNotCancellableError";
  }
}

export interface CancelCampaignPort {
  getCampaignOwnerStatusAndPayment(
    campaignId: string,
  ): Promise<{ protocolId: string; status: CampaignStatus; hasVerifiedPayment: boolean } | null>;
  /** Terminal — the protocol gave up before ever paying. */
  cancel(campaignId: string): Promise<void>;
}

export interface CancelCampaignParams {
  campaignId: string;
  protocolId: string;
}

/**
 * IN_REVIEW and APPROVED are the only statuses where a campaign genuinely
 * has nothing paid: a Payment row (and the AWAITING_PAYMENT status that
 * comes with it) only starts to exist once a chain/token has been picked
 * (setPaymentMethod.ts) — so cancelling here is never a refund question.
 *
 * hasVerifiedPayment is still checked directly rather than trusted to the
 * status label alone, so there's no window where a payment that verified a
 * moment ago — before the campaign's own status row catches up — could
 * still be cancelled. AWAITING_PAYMENT and later have their own,
 * deliberately narrower, way out (paymentWindowRecovery.ts's
 * cancelPaymentWindow), which only fires once a payment attempt has
 * already failed — never on a live open window or a verified one.
 */
export async function cancelCampaign(port: CancelCampaignPort, params: CancelCampaignParams): Promise<void> {
  const campaign = await port.getCampaignOwnerStatusAndPayment(params.campaignId);
  if (!campaign) throw new CampaignNotFoundError(params.campaignId);
  if (campaign.protocolId !== params.protocolId) throw new CampaignNotOwnedError(params.campaignId);
  if ((campaign.status !== "IN_REVIEW" && campaign.status !== "APPROVED") || campaign.hasVerifiedPayment) {
    throw new CampaignNotCancellableError(campaign.status);
  }
  assertTransition(campaign.status, "CANCELLED");
  await port.cancel(params.campaignId);
}
