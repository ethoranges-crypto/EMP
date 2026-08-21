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
      const { campaignId, recipientId, chatId, text, imageBase64, ctas } = job.data;

      const result = await sendCampaignMessage(bot, {
        chatId,
        text,
        imageData: imageBase64 ? Buffer.from(imageBase64, "base64") : undefined,
        ctas,
      });

      await prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: { deliveryStatus: result.status === "SENT" ? "SENT" : result.status === "BLOCKED" ? "BLOCKED" : "FAILED" },
      });
      await bumpDeliveryEvent(campaignId, result.status === "SENT" ? "SENT" : result.status === "BLOCKED" ? "BLOCKED" : "FAILED");

      if (result.status === "FAILED") {
        if (result.retryable) {
          throw new Error(result.error); // lets BullMQ's retry/backoff (SPEC §8) do its job
        }
        // Not retryable — a malformed CTA URL or a non-429 4xx will fail
        // identically every time, so retrying just spends 5 attempts'
        // worth of backoff to reach the same FAILED outcome already
        // recorded above. Log once and let the job resolve as done.
        // eslint-disable-next-line no-console
        console.error(`[worker] Not retrying recipient ${recipientId} (campaign ${campaignId}) — permanent failure: ${result.error}`);
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
