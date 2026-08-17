import { loadEnv } from "@emp/config";
import { createBotClient } from "@emp/telegram";
import { registerStartHandler } from "./handlers/start.js";

const env = loadEnv();
const bot = createBotClient(env.TELEGRAM_BOT_TOKEN);

registerStartHandler(bot);

bot.catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled bot error:", err);
});

bot.start();
// eslint-disable-next-line no-console
console.log(`EMP bot (@${env.TELEGRAM_BOT_USERNAME}) started.`);
