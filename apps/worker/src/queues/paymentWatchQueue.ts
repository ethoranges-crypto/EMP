import { Queue } from "bullmq";
import { getRedisConnection } from "../redis.js";

export const PAYMENT_WATCH_QUEUE_NAME = "payment-watch";
const TICK_JOB_NAME = "tick";
const POLL_INTERVAL_MS = 30_000;

export function createPaymentWatchQueue(): Queue {
  return new Queue(PAYMENT_WATCH_QUEUE_NAME, { connection: getRedisConnection() });
}

/** Schedules the repeatable poll tick — idempotent, safe to call on every worker boot. */
export async function schedulePaymentWatchTick(queue: Queue): Promise<void> {
  await queue.add(
    TICK_JOB_NAME,
    {},
    { repeat: { every: POLL_INTERVAL_MS }, jobId: "payment-watch-tick" },
  );
}
