export class CampaignNotFoundError extends Error {
  constructor(campaignId: string) {
    super(`Campaign ${campaignId} not found.`);
    this.name = "CampaignNotFoundError";
  }
}

export class CampaignNotOwnedError extends Error {
  constructor(campaignId: string) {
    super(`Campaign ${campaignId} does not belong to this protocol.`);
    this.name = "CampaignNotOwnedError";
  }
}

export class CampaignNotEditableError extends Error {
  constructor(status: string) {
    super(`Campaign is ${status} — only a DRAFT campaign's compose can be edited.`);
    this.name = "CampaignNotEditableError";
  }
}

export class InvalidCtaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCtaError";
  }
}

export interface CtaInput {
  label: string;
  targetUrl: string;
}

export interface SavedCta extends CtaInput {
  redirectToken: string;
}

export interface ComposePort {
  getCampaignOwnerAndStatus(campaignId: string): Promise<{ protocolId: string; status: string } | null>;
  saveCompose(params: { campaignId: string; bodyText: string | null; imageUrl: string | null; ctas: SavedCta[] }): Promise<void>;
  /** Injectable so tests get deterministic tokens instead of real randomness. */
  generateRedirectToken(): string;
}

export interface SaveComposeParams {
  campaignId: string;
  protocolId: string;
  bodyText: string | null;
  imageUrl: string | null;
  ctas: CtaInput[];
}

/**
 * A URL a CTA redirects to must be one Telegram/a browser will actually
 * follow — reject anything that isn't a plain http(s) address (no
 * javascript:, data:, etc.) rather than storing it and letting /r/:token
 * blindly 302 to it later.
 */
function assertValidTargetUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new InvalidCtaError(`"${raw}" isn't a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidCtaError(`"${raw}" must be an http(s) URL.`);
  }
}

/**
 * SPEC §4.3 step 2 / §8: save a DRAFT campaign's text/image/CTAs. Every CTA
 * URL the protocol enters gets a fresh redirect token here — the caller
 * never picks or sees a raw target URL again without it being wrapped, so
 * whatever eventually gets sent to a recipient always points at
 * /r/:token first (see apps/web's r/[token] route).
 *
 * Only the owning protocol may edit, and only while the campaign is still
 * DRAFT — SPEC's moderate -> pay -> send ordering (CLAUDE.md rule 2) means
 * compose content must be locked in before it reaches an admin, not
 * editable out from under a review or an already-approved snapshot.
 */
export async function saveCampaignCompose(port: ComposePort, params: SaveComposeParams): Promise<{ ctas: SavedCta[] }> {
  const campaign = await port.getCampaignOwnerAndStatus(params.campaignId);
  if (!campaign) throw new CampaignNotFoundError(params.campaignId);
  if (campaign.protocolId !== params.protocolId) throw new CampaignNotOwnedError(params.campaignId);
  if (campaign.status !== "DRAFT") throw new CampaignNotEditableError(campaign.status);

  for (const cta of params.ctas) {
    if (cta.label.trim().length === 0) throw new InvalidCtaError("Every CTA needs a label.");
    assertValidTargetUrl(cta.targetUrl);
  }

  const ctas: SavedCta[] = params.ctas.map((cta) => ({
    label: cta.label.trim(),
    targetUrl: cta.targetUrl,
    redirectToken: port.generateRedirectToken(),
  }));

  await port.saveCompose({
    campaignId: params.campaignId,
    bodyText: params.bodyText,
    imageUrl: params.imageUrl,
    ctas,
  });

  return { ctas };
}
