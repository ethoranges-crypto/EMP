import { getChains, getPayableChains, loadEnv, loadRootEnvFile } from "@emp/config";
import { createPaymentWatchQueue, schedulePaymentWatchTick } from "./queues/paymentWatchQueue.js";
import { createPaymentWatchWorker } from "./processors/watchPayments.js";
import { createTelegramSendWorker } from "./processors/sendMessage.js";

// Explicit and first, same as packages/db's CLI scripts and apps/web's
// next.config.js — this app is a long-running daemon with no per-request
// entrypoint to hang an implicit load off of, so it gets its own explicit
// call rather than relying on it happening as a side effect of the first
// loadEnv()/getChains() call somewhere inside a processor.
loadRootEnvFile();

loadEnv(); // fail fast on missing/malformed config before starting any worker

const sendWorker = createTelegramSendWorker();
const paymentWatchWorker = createPaymentWatchWorker();
const paymentWatchQueue = createPaymentWatchQueue();

await schedulePaymentWatchTick(paymentWatchQueue);

// eslint-disable-next-line no-console
console.log("EMP worker started: telegram-send + payment-watch");

// Chain config is the single most common worker misconfiguration (a blank
// or malformed *_RPC_URL / *_TREASURY_ADDRESS silently drops a chain — see
// chains.ts) — logging it here surfaces that at boot instead of only ever
// showing up indirectly, buried in a payment-watch tick's job-failure log.
const rpcChains = getChains();
const payableChains = getPayableChains();
if (rpcChains.length === 0) {
  console.warn(
    "[worker] No chains are RPC-configured — the payment watcher has nothing to watch. Set at least one {CHAIN}_RPC_URL in the root .env.",
  );
} else {
  const payableKeys = new Set(payableChains.map((c) => c.key));
  for (const chain of rpcChains) {
    console.log(
      `[worker] Chain ${chain.key} (${chain.displayName}): RPC configured` +
        (payableKeys.has(chain.key) ? ", treasury configured -> payable" : ", NO treasury address -> not payable"),
    );
  }
}

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
