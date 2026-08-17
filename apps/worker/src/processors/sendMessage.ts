import { Worker, type Job } from "bullmq";
import { prisma } from "@emp/db";
import { createBotClient, sendCampaignMessage } from "@emp/telegram";
import { loadEnv } from "@emp/config";
import { getRedisConnection } from "../redis.js";
import { TELEGRAM_SEND_QUEUE_NAME, type TelegramSendJobData } from "../queues/telegramSendQueue.js";

/** Bumps the aggregate DeliveryEvent counter for (campaign, status) by one — the only shape protocol dashboards ever read (see @emp/core's protocol-queries). */
async function bumpDeliveryEvent(campaignId: string, status: "SENT" | "FAILED" | "BLOCKED"): Promise<void> {
  await prisma.deliveryEvent.upsert({
    where: { campaignId_status: { campaignId, status } },
    create: { campaignId, status, count: 1 },
    update: { count: { increment: 1 } },
  });
}

export function createTelegramSendWorker(): Worker<TelegramSendJobData> {
  const env = loadEnv();
  const bot = createBotClient(env.TELEGRAM_BOT_TOKEN);

  return new Worker<TelegramSendJobData>(
    TELEGRAM_SEND_QUEUE_NAME,
    async (job: Job<TelegramSendJobData>) => {
      const { campaignId, recipientId, chatId, text, imageUrl, ctas } = job.data;

      const result = await sendCampaignMessage(bot, { chatId, text, imageUrl, ctas });

      await prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: { deliveryStatus: result.status === "SENT" ? "SENT" : result.status === "BLOCKED" ? "BLOCKED" : "FAILED" },
      });
      await bumpDeliveryEvent(campaignId, result.status === "SENT" ? "SENT" : result.status === "BLOCKED" ? "BLOCKED" : "FAILED");

      if (result.status === "FAILED") {
        throw new Error(result.error); // lets BullMQ's retry/backoff (SPEC §8) do its job
      }
    },
    {
      connection: getRedisConnection(),
      // Global throttle — SPEC §8's ~30 msg/s. Per-chat throttling isn't
      // needed here since each chat_id only ever appears once per campaign.
      limiter: { max: 30, duration: 1000 },
    },
  );
}
