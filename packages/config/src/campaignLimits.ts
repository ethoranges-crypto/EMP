/**
 * Practical caps EMP itself imposes on campaign compose data — not
 * Telegram platform facts (see telegramLimits.ts for those, which are kept
 * separate so the two kinds of limit are never confused with each other).
 * Shared between the client (form validation/maxLength) and the server
 * (real enforcement) so they can never drift.
 */
export const CAMPAIGN_TITLE_MAX_LENGTH = 120;

/**
 * Telegram Bot API's sendPhoto accepts a direct multipart upload up to
 * 10MB (verified — not guessed; its alternative HTTP-URL upload path is
 * capped lower, at 5MB, but EMP never uses that path: the campaign image
 * is stored as bytes and the eventual send uploads those bytes to
 * Telegram directly, so the higher direct-upload limit is the one that
 * actually applies here).
 */
export const CAMPAIGN_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * JPEG and PNG are Telegram's documented recommended sendPhoto formats;
 * WebP is also accepted (Telegram's own docs list it as supported, if
 * more commonly seen on stickers). GIF is deliberately excluded — Telegram
 * sends a GIF as an animation rather than a static photo, which isn't
 * what a campaign banner image is for.
 */
export const CAMPAIGN_IMAGE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type CampaignImageMimeType = (typeof CAMPAIGN_IMAGE_ALLOWED_MIME_TYPES)[number];

export function isAllowedCampaignImageMimeType(mimeType: string): mimeType is CampaignImageMimeType {
  return (CAMPAIGN_IMAGE_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}
