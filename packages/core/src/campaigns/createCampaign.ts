import { CAMPAIGN_TITLE_MAX_LENGTH } from "@emp/config";

export interface CreateCampaignPort {
  isApprovedProtocol(protocolId: string): Promise<boolean>;
  createDraft(params: { protocolId: string; title: string; categoryIds: string[] }): Promise<{
    campaignId: string;
  }>;
}

export class ProtocolNotApprovedError extends Error {
  constructor(protocolId: string) {
    super(`Protocol ${protocolId} is not approved — un-approved protocols cannot create campaigns (SPEC §4.2).`);
    this.name = "ProtocolNotApprovedError";
  }
}

export class NoCategoriesSelectedError extends Error {
  constructor() {
    super("At least one target interest category is required.");
    this.name = "NoCategoriesSelectedError";
  }
}

export class InvalidTitleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTitleError";
  }
}

export interface CreateDraftCampaignParams {
  protocolId: string;
  title: string;
  categoryIds: string[];
}

/**
 * SPEC §4.3 step 1: a protocol names its campaign and targets one or more
 * interest categories to start it. Persists a DRAFT — the title is
 * required up front because without one, campaigns targeting the same
 * categories are otherwise indistinguishable in every list (Your
 * Campaigns, admin moderation, the dashboard). Compose (text/image/CTAs,
 * step 2) and the snapshot/cost lock (step 5, on admin approval) are
 * later stages.
 *
 * Deliberately does NOT collect a payment chain/token here (SPEC §6): that's
 * how the protocol pays EMP, not what the campaign is about, so it's chosen
 * later at the payment step, once the campaign is APPROVED — see
 * setPaymentMethod.ts.
 */
export async function createDraftCampaign(
  port: CreateCampaignPort,
  params: CreateDraftCampaignParams,
): Promise<{ campaignId: string }> {
  const title = params.title.trim();
  if (title.length === 0) throw new InvalidTitleError("A campaign title is required.");
  if (title.length > CAMPAIGN_TITLE_MAX_LENGTH) {
    throw new InvalidTitleError(`Title is too long (max ${CAMPAIGN_TITLE_MAX_LENGTH} characters).`);
  }

  if (params.categoryIds.length === 0) throw new NoCategoriesSelectedError();

  const approved = await port.isApprovedProtocol(params.protocolId);
  if (!approved) throw new ProtocolNotApprovedError(params.protocolId);

  return port.createDraft({ ...params, title });
}
