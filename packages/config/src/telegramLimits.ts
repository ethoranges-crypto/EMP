/**
 * Telegram Bot API's actual documented limits (core.telegram.org/bots/api,
 * verified — not guessed):
 *   - sendMessage's `text`: 1-4096 characters.
 *   - sendPhoto/sendVideo's `caption`: 0-1024 characters. A message with an
 *     image is always sent via one of these, so attaching an image drops
 *     the usable text budget from 4096 to 1024, not the other way round.
 * Shared between the client (live counter) and the server (real
 * enforcement) so they can never drift — the client check is only ever a
 * courtesy, saveCampaignCompose() is what actually enforces this.
 */
export const TELEGRAM_TEXT_LIMIT_NO_IMAGE = 4096;
export const TELEGRAM_TEXT_LIMIT_WITH_IMAGE = 1024;

export function telegramTextLimit(hasImage: boolean): number {
  return hasImage ? TELEGRAM_TEXT_LIMIT_WITH_IMAGE : TELEGRAM_TEXT_LIMIT_NO_IMAGE;
}

/**
 * Telegram does NOT publish a character limit for an inline keyboard
 * button's label text. The only length limit the Bot API documents near
 * inline buttons is callback_data at 1-64 *bytes* — and that field doesn't
 * even apply to a `url` button like ours (no callback_data involved). This
 * is a practical cap for clean, non-wrapping button rendering, not a
 * platform limit — chosen to match callback_data's commonly-referenced 64
 * figure only because Telegram gives no better anchor to go on.
 */
export const CTA_LABEL_MAX_LENGTH = 64;

/**
 * Not a Telegram limit either — a UX choice. More than a handful of
 * buttons stops reading as a clean set of inline actions.
 */
export const MAX_CTAS_PER_CAMPAIGN = 3;
