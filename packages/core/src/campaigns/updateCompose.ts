import { CTA_LABEL_MAX_LENGTH, MAX_CTAS_PER_CAMPAIGN, telegramTextLimit } from "@emp/config";

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

/**
 * A campaign's compose (text/image/CTAs) can be edited while it's a fresh
 * DRAFT, and again after a REJECTED decision (SPEC §4.3: rejection sends it
 * back to the protocol with the admin's reason, still editable — see
 * moderation.ts's REJECTED -> IN_REVIEW resubmit transition). Once it's
 * IN_REVIEW or later, content is locked in — CLAUDE.md rule 2's
 * moderate -> pay -> send ordering means nothing may change out from under
 * a review or an already-approved snapshot.
 */
export const EDITABLE_CAMPAIGN_STATUSES = new Set(["DRAFT", "REJECTED"]);

export class CampaignNotEditableError extends Error {
  constructor(status: string) {
    super(`Campaign is ${status} — only a DRAFT or REJECTED campaign's compose can be edited.`);
    this.name = "CampaignNotEditableError";
  }
}

export class InvalidCtaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCtaError";
  }
}

export class TooManyCtasError extends Error {
  constructor() {
    super(`At most ${MAX_CTAS_PER_CAMPAIGN} CTAs are allowed per campaign.`);
    this.name = "TooManyCtasError";
  }
}

export class MessageTooLongError extends Error {
  constructor(length: number, limit: number, hasImage: boolean) {
    super(
      `Message text is ${length} characters — the limit is ${limit}${hasImage ? " with an image attached" : ""} (Telegram's own sendMessage/sendPhoto limits).`,
    );
    this.name = "MessageTooLongError";
  }
}

export class InvalidScheduledSendAtError extends Error {
  constructor(raw: string) {
    super(`"${raw}" isn't a valid date/time.`);
    this.name = "InvalidScheduledSendAtError";
  }
}

export interface CtaInput {
  label: string;
  targetUrl: string;
}

export interface ComposePort {
  /** hasImage reflects whatever the campaign's separate image-upload endpoint has currently saved (see updateCampaignImage.ts) — compose no longer carries the image itself. */
  getCampaignOwnerAndStatus(campaignId: string): Promise<{ protocolId: string; status: string; hasImage: boolean } | null>;
  saveCompose(params: { campaignId: string; bodyText: string | null; ctas: CtaInput[]; scheduledSendAt: Date | null }): Promise<void>;
}

export interface SaveComposeParams {
  campaignId: string;
  protocolId: string;
  bodyText: string | null;
  ctas: CtaInput[];
  /**
   * The protocol's chosen send time as an ISO-8601 string (whatever
   * `Date`'s constructor accepts — the client sends the UTC instant it
   * computed from the picked local time/zone), or null for "send as soon as
   * payment clears" (the only behaviour that existed before scheduled
   * sending — see SPEC's scheduled-sending addendum). Parsed/validated here,
   * same as a CTA's target URL, rather than trusting the client's own
   * parsing. Read again at payment-verification time (watchPayments.ts) to
   * decide SENDING vs SCHEDULED; editable directly while SCHEDULED via
   * rescheduleCampaign.ts, without this function or its
   * DRAFT/REJECTED-only editability gate being involved again.
   */
  scheduledSendAt: string | null;
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
 * null means "send as soon as payment clears" — always valid. A non-null
 * value must parse to a real instant; how far in the future (or whether
 * it's already in the past by the time this saves) is deliberately not
 * policed here — an arbitrary amount of real time can pass between compose
 * and payment clearing anyway (moderation, then the payment window itself),
 * so a "must be in the future" check here would only ever be checking the
 * wrong moment. The one behaviour that matters — what happens if it's
 * already past by the time payment verifies — is handled once, at
 * verification (watchPayments.ts), not here.
 */
function parseScheduledSendAt(raw: string | null): Date | null {
  if (raw === null) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new InvalidScheduledSendAtError(raw);
  return parsed;
}

/**
 * SPEC §4.3 step 2 / §8: save a DRAFT campaign's text/CTAs. The image is a
 * separate upload (updateCampaignImage.ts) — this function only reads
 * whether one is currently attached, to pick the right text-length limit.
 * CTAs are saved with just their label/target here — the actual /r/:token
 * redirect wrapping happens per-recipient at send time (apps/worker's
 * sendCampaignNow mints one ClickToken per recipient per CTA), not at
 * compose time, since a click needs to be attributable to whoever actually
 * clicked it (see ClickToken's schema comment).
 *
 * Only the owning protocol may edit, and only in an EDITABLE_CAMPAIGN_STATUSES
 * status (DRAFT, or REJECTED so a protocol can fix and resubmit) — SPEC's
 * moderate -> pay -> send ordering (CLAUDE.md rule 2) means compose content
 * must be locked in before it reaches an admin, not editable out from under
 * a review or an already-approved snapshot.
 *
 * Enforces Telegram's real message/caption limits (packages/config's
 * telegramTextLimit — 4096 chars with no image, 1024 with one, since an
 * image forces the text into sendPhoto's caption) plus MAX_CTAS_PER_CAMPAIGN
 * and CTA_LABEL_MAX_LENGTH. The client-side compose UI checks the same
 * numbers for a live counter, but this is the check that actually holds —
 * never trust the client's arithmetic alone.
 */
export async function saveCampaignCompose(port: ComposePort, params: SaveComposeParams): Promise<{ ctas: CtaInput[] }> {
  const campaign = await port.getCampaignOwnerAndStatus(params.campaignId);
  if (!campaign) throw new CampaignNotFoundError(params.campaignId);
  if (campaign.protocolId !== params.protocolId) throw new CampaignNotOwnedError(params.campaignId);
  if (!EDITABLE_CAMPAIGN_STATUSES.has(campaign.status)) throw new CampaignNotEditableError(campaign.status);

  const textLimit = telegramTextLimit(campaign.hasImage);
  const bodyLength = (params.bodyText ?? "").length;
  if (bodyLength > textLimit) throw new MessageTooLongError(bodyLength, textLimit, campaign.hasImage);

  if (params.ctas.length > MAX_CTAS_PER_CAMPAIGN) throw new TooManyCtasError();

  const scheduledSendAt = parseScheduledSendAt(params.scheduledSendAt);

  for (const cta of params.ctas) {
    if (cta.label.trim().length === 0) throw new InvalidCtaError("Every CTA needs a label.");
    if (cta.label.length > CTA_LABEL_MAX_LENGTH) {
      throw new InvalidCtaError(`CTA label "${cta.label}" is too long (max ${CTA_LABEL_MAX_LENGTH} characters).`);
    }
    assertValidTargetUrl(cta.targetUrl);
  }

  const ctas: CtaInput[] = params.ctas.map((cta) => ({
    label: cta.label.trim(),
    targetUrl: cta.targetUrl,
  }));

  await port.saveCompose({
    campaignId: params.campaignId,
    bodyText: params.bodyText,
    ctas,
    scheduledSendAt,
  });

  return { ctas };
}
