import { PAYMENT_TOKENS, type PaymentToken } from "@emp/config";
import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";

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

export interface SetPaymentMethodPort {
  getCampaignOwnerAndStatus(campaignId: string): Promise<{ protocolId: string; status: string } | null>;
  savePaymentMethod(campaignId: string, chain: string, token: PaymentToken): Promise<void>;
}

export interface SetCampaignPaymentMethodParams {
  campaignId: string;
  protocolId: string;
  chain: string;
  token: string;
  /** The chains EMP can actually receive payment on right now (configured RPC + treasury) — injected so this stays framework-free. */
  validChainKeys: string[];
}

/**
 * SPEC §6: once a campaign is APPROVED, the protocol picks which supported
 * chain and which stablecoin (USDC/USDT — ETH isn't accepted, see
 * packages/config's PAYMENT_TOKENS) to pay EMP on. This is a payment-method
 * choice, not campaign content — it's collected here, at the payment step,
 * never at creation (createCampaign.ts). Only APPROVED campaigns have a
 * locked cost (CLAUDE.md rule 3) worth paying, so anything else is refused.
 */
export async function setCampaignPaymentMethod(port: SetPaymentMethodPort, params: SetCampaignPaymentMethodParams): Promise<void> {
  const campaign = await port.getCampaignOwnerAndStatus(params.campaignId);
  if (!campaign) throw new CampaignNotFoundError(params.campaignId);
  if (campaign.protocolId !== params.protocolId) throw new CampaignNotOwnedError(params.campaignId);
  if (campaign.status !== "APPROVED") throw new CampaignNotApprovedError(campaign.status);

  if (!params.validChainKeys.includes(params.chain)) throw new InvalidPaymentChainError(params.chain);
  if (!(PAYMENT_TOKENS as readonly string[]).includes(params.token)) throw new InvalidPaymentTokenError(params.token);

  await port.savePaymentMethod(params.campaignId, params.chain, params.token as PaymentToken);
}
