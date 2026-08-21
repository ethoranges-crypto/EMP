import type { Bot } from "grammy";
import { InlineKeyboard, InputFile } from "grammy";
import { isTelegramCompatibleUrl } from "./urlValidation.js";
import { buildTrustedButtonText } from "./trustLabel.js";

export interface CtaButton {
  label: string;
  /** The real destination — never sent to Telegram directly, only used to build the button's visible text (see buildTrustedButtonText) so it always shows where a tap actually leads. */
  targetUrl: string;
  /** Already rewritten to the EMP redirect endpoint (/r/:token) by the caller — see apps/web's click tracking. This is what the button actually opens. */
  redirectUrl: string;
}

export interface SendCampaignMessageParams {
  chatId: string;
  text: string;
  /**
   * Raw image bytes, not a URL — the campaign image is stored in EMP's own
   * DB (packages/db's Campaign.imageData), not hosted anywhere Telegram's
   * servers could fetch from, so it's uploaded to Telegram directly here.
   */
  imageData?: Buffer;
  ctas: CtaButton[];
}

export type SendResult =
  | { status: "SENT" }
  | { status: "BLOCKED" }
  /**
   * `retryable` tells the caller (apps/worker's queue processor) whether
   * BullMQ's automatic retry/backoff is worth running at all. A malformed
   * CTA URL or a 4xx Telegram rejects the request itself for
   * (anything but 429) will fail identically every time — retrying just
   * delays the same outcome and spams the logs. Only an unknown-shaped
   * error (network blip), a 429 (rate limited), or a 5xx (Telegram-side,
   * transient) are worth another attempt.
   */
  | { status: "FAILED"; error: string; retryable: boolean };

/**
 * One recipient, one send. apps/worker calls this per job from the
 * telegram-send queue — never in a synchronous loop (SPEC §8).
 */
export async function sendCampaignMessage(bot: Bot, params: SendCampaignMessageParams): Promise<SendResult> {
  // Checked before ever calling Telegram: every CTA shares the same
  // REDIRECT_BASE_URL, so if one is wrong they all are — no point letting
  // this fail once per recipient with a 400 that just repeats Telegram's
  // own opaque text (see isTelegramCompatibleUrl's doc comment).
  const invalidCta = params.ctas.find((cta) => !isTelegramCompatibleUrl(cta.redirectUrl));
  if (invalidCta) {
    return {
      status: "FAILED",
      error:
        `CTA "${invalidCta.label}" URL (${invalidCta.redirectUrl}) isn't a public HTTPS address — ` +
        "Telegram requires one for inline keyboard buttons. Check REDIRECT_BASE_URL (must be a real " +
        "HTTPS host, not localhost/http).",
      retryable: false,
    };
  }

  const keyboard = params.ctas.reduce(
    (kb, cta) => kb.url(buildTrustedButtonText(cta.label, cta.targetUrl), cta.redirectUrl).row(),
    new InlineKeyboard(),
  );

  try {
    if (params.imageData) {
      await bot.api.sendPhoto(params.chatId, new InputFile(params.imageData), {
        caption: params.text,
        reply_markup: keyboard,
      });
    } else {
      await bot.api.sendMessage(params.chatId, params.text, { reply_markup: keyboard });
    }
    return { status: "SENT" };
  } catch (err) {
    if (isBlockedByUserError(err)) return { status: "BLOCKED" };
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err), retryable: isRetryableTelegramError(err) };
  }
}

function isBlockedByUserError(err: unknown): boolean {
  const description = (err as { description?: string } | undefined)?.description ?? "";
  return /bot was blocked by the user|user is deactivated|chat not found/i.test(description);
}

/** grammY's GrammyError exposes Telegram's own numeric error_code. */
function isRetryableTelegramError(err: unknown): boolean {
  const code = (err as { error_code?: number } | undefined)?.error_code;
  if (typeof code !== "number") return true; // unknown shape (network error, etc.) — assume transient
  if (code === 429) return true; // rate limited — worth another attempt after backoff
  if (code >= 500) return true; // Telegram-side, transient
  return false; // other 4xx — a structurally wrong request or a permanent block; retrying won't change it
}
