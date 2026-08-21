import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";
import { assertTransition, type CampaignStatus } from "./moderation.js";

export class CampaignNotAwaitingPaymentError extends Error {
  constructor(status: CampaignStatus) {
    super(`Campaign is ${status} — there's no payment attempt to retry or cancel.`);
    this.name = "CampaignNotAwaitingPaymentError";
  }
}

export class PaymentWindowStillActiveError extends Error {
  constructor(campaignId: string) {
    super(`Campaign ${campaignId}'s current payment window is still open — wait for it to resolve before retrying or cancelling.`);
    this.name = "PaymentWindowStillActiveError";
  }
}

export interface PaymentWindowRecoveryPort {
  /** The campaign's own status plus its most recent Payment's status (null if it somehow has none yet). */
  getCampaignAndLatestPaymentStatus(
    campaignId: string,
  ): Promise<{ protocolId: string; status: CampaignStatus; latestPaymentStatus: string | null } | null>;
  /** Reverts to APPROVED for a fresh payment-method pick — snapshot/cost stay locked, untouched. */
  revertToApproved(campaignId: string): Promise<void>;
  /** Terminal — the protocol gave up on this campaign. */
  cancel(campaignId: string): Promise<void>;
}

interface PaymentWindowRecoveryParams {
  campaignId: string;
  protocolId: string;
}

/**
 * A payment window that expired with nothing (ever) received, or that
 * received an underpayment/wrong-token/duplicate transfer, otherwise has no
 * way out — CLAUDE.md rule 2 (payment gates send) means the campaign just
 * sits in AWAITING_PAYMENT forever with no path forward. Both actions here
 * only apply once the *current* Payment has already left AWAITING (see
 * matchPayment.ts's window-expiry fix, which is what gets a
 * never-paid window there in the first place) — retrying or cancelling a
 * still-open window would leave two live attempts for the same campaign,
 * and an on-chain transfer arriving late could match either.
 */
async function assertRecoverable(
  port: PaymentWindowRecoveryPort,
  params: PaymentWindowRecoveryParams,
): Promise<void> {
  const campaign = await port.getCampaignAndLatestPaymentStatus(params.campaignId);
  if (!campaign) throw new CampaignNotFoundError(params.campaignId);
  if (campaign.protocolId !== params.protocolId) throw new CampaignNotOwnedError(params.campaignId);
  if (campaign.status !== "AWAITING_PAYMENT") throw new CampaignNotAwaitingPaymentError(campaign.status);
  if (campaign.latestPaymentStatus === "AWAITING" || campaign.latestPaymentStatus === null) {
    throw new PaymentWindowStillActiveError(params.campaignId);
  }
}

/** Back to APPROVED — the protocol can pick a chain/token again, opening a fresh payment window. */
export async function retryPaymentWindow(
  port: PaymentWindowRecoveryPort,
  params: PaymentWindowRecoveryParams,
): Promise<void> {
  await assertRecoverable(port, params);
  assertTransition("AWAITING_PAYMENT", "APPROVED");
  await port.revertToApproved(params.campaignId);
}

/** Terminal — the protocol is giving up on this campaign rather than retrying payment. */
export async function cancelPaymentWindow(
  port: PaymentWindowRecoveryPort,
  params: PaymentWindowRecoveryParams,
): Promise<void> {
  await assertRecoverable(port, params);
  assertTransition("AWAITING_PAYMENT", "CANCELLED");
  await port.cancel(params.campaignId);
}
