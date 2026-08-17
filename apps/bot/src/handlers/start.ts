import type { Bot } from "grammy";
import { loadEnv } from "@emp/config";
import {
  AlreadyBoundError,
  AlreadyLinkedError,
  CooldownActiveError,
  attemptLink,
  createPrismaTelegramLinkStore,
} from "@emp/core";
import { prisma } from "@emp/db";

/**
 * `/start <code>` — the only way a chat_id ever gets bound (SPEC §3.1). The
 * code comes from a deep link the EMP web app generates
 * (t.me/<bot>?start=<code>) after the user requests to link Telegram.
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

    const request = await prisma.linkRequest.findFirst({
      where: { code, expiresAt: { gt: new Date() } },
    });
    if (!request) {
      await ctx.reply("That link code is invalid or has expired. Generate a new one from the EMP website.");
      return;
    }

    const chatId = String(ctx.chat.id);
    const env = loadEnv();
    const store = createPrismaTelegramLinkStore(prisma);

    try {
      await attemptLink(store, {
        userId: request.userId,
        chatId,
        cooldownDays: env.RELINK_COOLDOWN_DAYS,
      });
      await prisma.linkRequest.delete({ where: { id: request.id } });
      await ctx.reply("You're linked! You'll get messages here based on the interests you picked.");
    } catch (err) {
      if (err instanceof AlreadyBoundError || err instanceof AlreadyLinkedError || err instanceof CooldownActiveError) {
        await ctx.reply(err.message);
        return;
      }
      throw err;
    }
  });
}
