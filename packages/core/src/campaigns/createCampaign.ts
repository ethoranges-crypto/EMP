/** Kept as a plain union here (not imported from @emp/config or @emp/db) so this file stays framework-free, same as moderation.ts's CampaignStatus. */
export type TokenSymbol = "USDC" | "USDT" | "ETH";

export interface CreateCampaignPort {
  isApprovedProtocol(protocolId: string): Promise<boolean>;
  createDraft(params: { protocolId: string; categoryIds: string[]; chain: string; token: TokenSymbol }): Promise<{
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

export interface CreateDraftCampaignParams {
  protocolId: string;
  categoryIds: string[];
  chain: string;
  token: TokenSymbol;
}

/**
 * SPEC §4.3 step 1: a protocol targets one or more interest categories to
 * start a campaign. Persists a DRAFT — categories are the only thing
 * locked in at this point; compose (text/image/CTAs, step 2) and the
 * snapshot/cost lock (step 5, on admin approval) are later stages.
 */
export async function createDraftCampaign(
  port: CreateCampaignPort,
  params: CreateDraftCampaignParams,
): Promise<{ campaignId: string }> {
  if (params.categoryIds.length === 0) throw new NoCategoriesSelectedError();

  const approved = await port.isApprovedProtocol(params.protocolId);
  if (!approved) throw new ProtocolNotApprovedError(params.protocolId);

  return port.createDraft(params);
}
