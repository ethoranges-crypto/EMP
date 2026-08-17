import { Bot } from "grammy";

/** One bot instance, shared by apps/bot (linking) and apps/worker (sending). CLAUDE.md: token from env only. */
export function createBotClient(token: string): Bot {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required to create the bot client");
  return new Bot(token);
}
