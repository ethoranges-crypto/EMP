import { Worker, type Job } from "bullmq";
import { prisma } from "@emp/db";
import { createBotClient, sendCampaignMessage } from "@emp/telegram";
import { loadEnv } from "@emp/config";
import { getRedisConnection } from "../redis.js";
import { TELEGRAM_SEND_QUEUE_NAME, type TelegramSendJobData } from "../queues/telegramSendQueue.js";
import { maybeCompleteCampaign } from "../campaignCompletion.js";

/**
 * Records a recipient's *final* outcome — deliveryStatus, the aggregate
 * DeliveryEvent counter (the only shape protocol dashboards ever read, see
 * @emp/core's protocol-queries), and attemptedAt (see schema.prisma's own
 * doc comment — what tells maybeCompleteCampaign this recipient is done).
 * Called exactly once per recipient: either from the processor below, once
 * a result stops being retryable, or from the worker's 'failed' handler if
 * every retry attempt is exhausted without ever reaching that point. Never
 * called for an attempt that's still going to be retried — recording a
 * FAILED here that a later retry then overwrites to SENT would leave a
 * phantom +1 in the FAILED bucket forever, since nothing ever decrements it.
 */
async function recordOutcome(campaignId: string, recipientId: string, status: "SENT" | "FAILED" | "BLOCKED"): Promise<void> {
  await prisma.campaignRecipient.update({
    where: { id: recipientId },
    data: { deliveryStatus: status, attemptedAt: new Date() },
  });
  await prisma.deliveryEvent.upsert({
    where: { campaignId_status: { campaignId, status } },
    create: { campaignId, status, count: 1 },
    update: { count: { increment: 1 } },
  });
  await maybeCompleteCampaign(campaignId);
}

export function createTelegramSendWorker(): Worker<TelegramSendJobData> {
  const env = loadEnv();
  const bot = createBotClient(env.TELEGRAM_BOT_TOKEN);

  const worker = new Worker<TelegramSendJobData>(
    TELEGRAM_SEND_QUEUE_NAME,
    async (job: Job<TelegramSendJobData>) => {
      const { campaignId, recipientId, chatId, text, imageBase64, ctas } = job.data;

      const result = await sendCampaignMessage(bot, {
        chatId,
        text,
        imageData: imageBase64 ? Buffer.from(imageBase64, "base64") : undefined,
        ctas,
      });

      if (result.status === "FAILED" && result.retryable) {
        // Not final yet — nothing recorded until this recipient's outcome
        // actually settles (see the 'failed' handler below for what
        // happens if every retry attempt runs out first).
        throw new Error(result.error); // lets BullMQ's retry/backoff (SPEC §8) do its job
      }

      await recordOutcome(campaignId, recipientId, result.status === "SENT" ? "SENT" : result.status === "BLOCKED" ? "BLOCKED" : "FAILED");

      if (result.status === "FAILED") {
        // Not retryable — a malformed CTA URL or a non-429 4xx will fail
        // identically every time, so retrying just spends 5 attempts'
        // worth of backoff to reach the same FAILED outcome already
        // recorded above.
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

  worker.on("failed", (job) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return; // more retries still coming — the processor will record this once it settles
    // Every retry attempt is used up and the processor above never reached
    // recordOutcome (it kept throwing) — record it now so this recipient
    // isn't invisible to delivery counts and doesn't block the campaign
    // from ever completing.
    void recordOutcome(job.data.campaignId, job.data.recipientId, "FAILED").catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[worker] Failed to record exhausted-retry outcome for recipient ${job.data.recipientId}:`, err);
    });
  });

  return worker;
}
