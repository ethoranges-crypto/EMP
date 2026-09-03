import { Queue } from "bullmq";
import { getRedisConnection } from "../redis.js";

export const PAYMENT_WATCH_QUEUE_NAME = "payment-watch";
const TICK_JOB_NAME = "tick";

export function createPaymentWatchQueue(): Queue {
  return new Queue(PAYMENT_WATCH_QUEUE_NAME, { connection: getRedisConnection() });
}

/**
 * Schedules the repeatable poll tick — idempotent, safe to call on every
 * worker boot. `pollIntervalMs` is env-configurable (PAYMENT_WATCH_POLL_SECONDS,
 * see @emp/config) rather than hardcoded, so it can be tuned for a given RPC
 * provider's free-tier limits without a code change — see
 * evmTreasuryWatcher.ts's per-tick call-volume doc comment for the tradeoff.
 *
 * Note: BullMQ keys a repeatable schedule by jobId + its repeat options
 * together, so changing PAYMENT_WATCH_POLL_SECONDS and restarting adds a
 * *second* schedule at the new interval rather than replacing the old one —
 * both would then fire forever. If you retune this, clear the old schedule
 * once (`queue.getRepeatableJobs()` / `removeRepeatableByKey` from a
 * one-off script, or Bull Board's UI) after deploying the new value.
 */
export async function schedulePaymentWatchTick(queue: Queue, pollIntervalMs: number): Promise<void> {
  await queue.add(
    TICK_JOB_NAME,
    {},
    { repeat: { every: pollIntervalMs }, jobId: "payment-watch-tick" },
  );
}
