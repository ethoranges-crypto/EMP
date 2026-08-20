import { CAMPAIGN_IMAGE_ALLOWED_MIME_TYPES, CAMPAIGN_IMAGE_MAX_BYTES, isAllowedCampaignImageMimeType } from "@emp/config";
import { CampaignNotEditableError, CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";

export class CampaignImageTooLargeError extends Error {
  constructor(byteLength: number) {
    const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
    super(`Image is ${mb(byteLength)}MB — the max is ${mb(CAMPAIGN_IMAGE_MAX_BYTES)}MB (Telegram's own sendPhoto direct-upload limit).`);
    this.name = "CampaignImageTooLargeError";
  }
}

export class InvalidCampaignImageTypeError extends Error {
  constructor(mimeType: string) {
    super(`"${mimeType}" isn't a supported image type — use ${CAMPAIGN_IMAGE_ALLOWED_MIME_TYPES.join(", ")}.`);
    this.name = "InvalidCampaignImageTypeError";
  }
}

export interface CampaignImagePort {
  getCampaignOwnerAndStatus(campaignId: string): Promise<{ protocolId: string; status: string } | null>;
  saveImage(campaignId: string, data: Uint8Array | null, mimeType: string | null): Promise<void>;
}

export interface SaveCampaignImageParams {
  campaignId: string;
  protocolId: string;
  /** null means "remove the image" — always a valid state, SPEC §8's image is optional. */
  data: Uint8Array | null;
  mimeType: string | null;
}

/**
 * SPEC §4.3 step 2 / §8: upload (or remove) a DRAFT campaign's image. Split
 * out from saveCampaignCompose() because the image is a real file upload
 * (multipart), not a form field saved alongside text/CTAs — it's its own
 * action with its own request, so text/CTA saves never depend on it.
 * Same ownership/DRAFT-only editability rules as compose (CLAUDE.md rule
 * 2): only the owning protocol may change it, and only pre-moderation.
 */
export async function saveCampaignImage(port: CampaignImagePort, params: SaveCampaignImageParams): Promise<void> {
  const campaign = await port.getCampaignOwnerAndStatus(params.campaignId);
  if (!campaign) throw new CampaignNotFoundError(params.campaignId);
  if (campaign.protocolId !== params.protocolId) throw new CampaignNotOwnedError(params.campaignId);
  if (campaign.status !== "DRAFT") throw new CampaignNotEditableError(campaign.status);

  if (params.data === null) {
    await port.saveImage(params.campaignId, null, null);
    return;
  }

  if (params.data.byteLength > CAMPAIGN_IMAGE_MAX_BYTES) throw new CampaignImageTooLargeError(params.data.byteLength);
  if (!params.mimeType || !isAllowedCampaignImageMimeType(params.mimeType)) {
    throw new InvalidCampaignImageTypeError(params.mimeType ?? "unknown");
  }

  await port.saveImage(params.campaignId, params.data, params.mimeType);
}
