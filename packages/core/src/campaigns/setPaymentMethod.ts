import { PAYMENT_TOKENS, type PaymentToken } from "@emp/config";
import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";
import { assertTransition } from "./moderation.js";

export class CampaignNotApprovedError extends Error {
  constructor(status: string) {
    super(`Campaign is ${status} — a payment method can only be set once a campaign is APPROVED.`);
    this.name = "CampaignNotApprovedError";
  }
}

export class InvalidPaymentChainError extends Error {
  constructor(chain: string) {
    super(`"${chain}" isn't a chain EMP can currently receive payment on.`);
    this.name = "InvalidPaymentChainError";
  }
}

export class InvalidPaymentTokenError extends Error {
  constructor(token: string) {
    super(`"${token}" isn't accepted — pay in ${PAYMENT_TOKENS.join(" or ")}.`);
    this.name = "InvalidPaymentTokenError";
  }
}

export class CampaignCostNotLockedError extends Error {
  constructor(campaignId: string) {
    super(`Campaign ${campaignId} has no locked cost yet — approval must run before a payment window can open.`);
    this.name = "CampaignCostNotLockedError";
  }
}

export interface SetPaymentMethodPort {
  getCampaignOwnerAndStatus(
    campaignId: string,
  ): Promise<{ protocolId: string; status: string; costAmount: string | null } | null>;
  /** Opens the payment window: creates the AWAITING Payment row and moves the campaign APPROVED -> AWAITING_PAYMENT, atomically. */
  openPaymentWindow(params: {
    campaignId: string;
    chain: string;
    token: PaymentToken;
    amount: string;
    fromAddress: string;
    windowExpiresAt: Date;
  }): Promise<void>;
}

export interface SetCampaignPaymentMethodParams {
  campaignId: string;
  protocolId: string;
  /** The protocol's authenticated wallet (SIWE session address) — MVP payment verification keys off this (SPEC §6). */
  protocolWallet: string;
  chain: string;
  token: string;
  /** The chains EMP can actually receive payment on right now (RPC + admin-set treasury) — injected so this stays framework-free. */
  validChainKeys: string[];
  /** How long the payment window stays open once opened (env PAYMENT_WINDOW_MINUTES). */
  paymentWindowMinutes: number;
  now?: Date;
}

/**
 * SPEC §6: once a campaign is APPROVED, the protocol picks which supported
 * chain and which stablecoin (USDC/USDT — ETH isn't accepted, see
 * packages/config's PAYMENT_TOKENS) to pay EMP on. Choosing a payment method
 * immediately opens the payment window: it creates the AWAITING Payment row
 * (amount = the cost locked at approval, CLAUDE.md rule 3) and moves the
 * campaign to AWAITING_PAYMENT (CLAUDE.md rule 2 — nothing is sent before
 * this gate opens and later clears). Only APPROVED campaigns have a locked
 * cost worth paying, so anything else is refused.
 */
export async function setCampaignPaymentMethod(
  port: SetPaymentMethodPort,
  params: SetCampaignPaymentMethodParams,
): Promise<void> {
  const campaign = await port.getCampaignOwnerAndStatus(params.campaignId);
  if (!campaign) throw new CampaignNotFoundError(params.campaignId);
  if (campaign.protocolId !== params.protocolId) throw new CampaignNotOwnedError(params.campaignId);
  if (campaign.status !== "APPROVED") throw new CampaignNotApprovedError(campaign.status);

  if (!params.validChainKeys.includes(params.chain)) throw new InvalidPaymentChainError(params.chain);
  if (!(PAYMENT_TOKENS as readonly string[]).includes(params.token)) throw new InvalidPaymentTokenError(params.token);
  if (!campaign.costAmount) throw new CampaignCostNotLockedError(params.campaignId);

  assertTransition("APPROVED", "AWAITING_PAYMENT");

  const now = params.now ?? new Date();
  const windowExpiresAt = new Date(now.getTime() + params.paymentWindowMinutes * 60_000);

  await port.openPaymentWindow({
    campaignId: params.campaignId,
    chain: params.chain,
    token: params.token as PaymentToken,
    amount: campaign.costAmount,
    fromAddress: params.protocolWallet,
    windowExpiresAt,
  });
}
