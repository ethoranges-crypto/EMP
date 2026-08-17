import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";

export interface CtaButton {
  label: string;
  /** Already rewritten to the EMP redirect endpoint (/r/:token) by the caller — see apps/web's click tracking. */
  redirectUrl: string;
}

export interface SendCampaignMessageParams {
  chatId: string;
  text: string;
  imageUrl?: string;
  ctas: CtaButton[];
}

export type SendResult =
  | { status: "SENT" }
  | { status: "BLOCKED" }
  | { status: "FAILED"; error: string };

/**
 * One recipient, one send. apps/worker calls this per job from the
 * telegram-send queue — never in a synchronous loop (SPEC §8).
 */
export async function sendCampaignMessage(bot: Bot, params: SendCampaignMessageParams): Promise<SendResult> {
  const keyboard = params.ctas.reduce((kb, cta) => kb.url(cta.label, cta.redirectUrl).row(), new InlineKeyboard());

  try {
    if (params.imageUrl) {
      await bot.api.sendPhoto(params.chatId, params.imageUrl, {
        caption: params.text,
        reply_markup: keyboard,
      });
    } else {
      await bot.api.sendMessage(params.chatId, params.text, { reply_markup: keyboard });
    }
    return { status: "SENT" };
  } catch (err) {
    if (isBlockedByUserError(err)) return { status: "BLOCKED" };
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}

function isBlockedByUserError(err: unknown): boolean {
  const description = (err as { description?: string } | undefined)?.description ?? "";
  return /bot was blocked by the user|user is deactivated|chat not found/i.test(description);
}
