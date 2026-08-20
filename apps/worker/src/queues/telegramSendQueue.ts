import { Queue } from "bullmq";
import { getRedisConnection } from "../redis.js";

export interface TelegramSendJobData {
  campaignId: string;
  recipientId: string;
  chatId: string;
  text: string;
  /** base64, not a raw Buffer — BullMQ JSON-serializes job data, which a Buffer wouldn't survive round-trip. */
  imageBase64?: string;
  ctas: Array<{ label: string; redirectUrl: string }>;
}

export const TELEGRAM_SEND_QUEUE_NAME = "telegram-send";

/** ~30 msg/s global throttle (SPEC §8) via BullMQ's queue-level limiter. */
export function createTelegramSendQueue(): Queue<TelegramSendJobData> {
  return new Queue<TelegramSendJobData>(TELEGRAM_SEND_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
}
