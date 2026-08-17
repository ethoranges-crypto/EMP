import { loadEnv } from "@emp/config";
import { createPaymentWatchQueue, schedulePaymentWatchTick } from "./queues/paymentWatchQueue.js";
import { createPaymentWatchWorker } from "./processors/watchPayments.js";
import { createTelegramSendWorker } from "./processors/sendMessage.js";

loadEnv(); // fail fast on missing/malformed config before starting any worker

const sendWorker = createTelegramSendWorker();
const paymentWatchWorker = createPaymentWatchWorker();
const paymentWatchQueue = createPaymentWatchQueue();

await schedulePaymentWatchTick(paymentWatchQueue);

// eslint-disable-next-line no-console
console.log("EMP worker started: telegram-send + payment-watch");

for (const worker of [sendWorker, paymentWatchWorker]) {
  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`Job ${job?.id} failed:`, err);
  });
}

async function shutdown(): Promise<void> {
  await Promise.all([sendWorker.close(), paymentWatchWorker.close(), paymentWatchQueue.close()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
