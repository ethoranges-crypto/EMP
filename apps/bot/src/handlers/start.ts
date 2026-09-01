import type { Bot } from "grammy";
import { loadEnv } from "@emp/config";
import {
  AlreadyBoundError,
  AlreadyLinkedError,
  CooldownActiveError,
  attemptLink,
  createPrismaTelegramLinkStore,
  redeemLinkRequest,
  createPrismaLinkRequestStore,
} from "@emp/core";
import { prisma } from "@emp/db";

/**
 * `/start <code>` — the only way a chat_id ever gets bound (SPEC §3.1). The
 * code comes from a deep link the EMP web app generates
 * (t.me/<bot>?start=<code>) after the user requests to link Telegram.
 * redeemLinkRequest() rejects both an expired code and a superseded one
 * (regenerating a code on the website invalidates whatever came before) —
 * this handler doesn't need to know which.
 */
export function registerStartHandler(bot: Bot): void {
  bot.command("start", async (ctx) => {
    const code = ctx.match?.trim();
    if (!code) {
      await ctx.reply(
        "Welcome to EMP. Open the “Link Telegram” button on the EMP website to get your link.",
      );
      return;
    }

    const linkRequestStore = createPrismaLinkRequestStore(prisma);
    const redemption = await redeemLinkRequest(linkRequestStore, code);
    if (!redemption) {
      await ctx.reply("That link code is invalid or has expired. Generate a new one from the EMP website.");
      return;
    }

    const chatId = String(ctx.chat.id);
    const env = loadEnv();
    const telegramLinkStore = createPrismaTelegramLinkStore(prisma);

    try {
      await attemptLink(telegramLinkStore, {
        userId: redemption.userId,
        chatId,
        cooldownDays: env.RELINK_COOLDOWN_DAYS,
      });
      await linkRequestStore.deleteById(redemption.requestId);
      // The web tab (if still open) already picks this up live via
      // /api/user/me polling, but this reply is the only cue at all for a
      // user who left EMP to switch to Telegram (esp. on mobile, where
      // Telegram took over the screen) — so it always tells them where to
      // go next, and includes a tappable link back when the site's public
      // URL is configured (Telegram auto-links a bare https:// URL in plain
      // text, no parse_mode needed).
      const returnHint = env.WEB_BASE_URL
        ? `Head back to the EMP site to see your status:\n${env.WEB_BASE_URL}/user`
        : "Head back to the EMP site to see your status.";
      await ctx.reply(
        `You're linked! 📡 You'll get messages here based on the interests you picked.\n\n${returnHint}`,
      );
    } catch (err) {
      if (err instanceof AlreadyBoundError || err instanceof AlreadyLinkedError || err instanceof CooldownActiveError) {
        // Recorded (not just replied) so the web page the user still has
        // open can show the same rejection via GET /api/user/me — the
        // Telegram reply alone is invisible to that tab.
        await prisma.linkRequest.update({
          where: { id: redemption.requestId },
          data: { rejectedReason: err.message, rejectedAt: new Date() },
        });
        await ctx.reply(err.message);
        return;
      }
      throw err;
    }
  });
}
