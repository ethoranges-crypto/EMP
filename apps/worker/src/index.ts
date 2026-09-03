import { getChains, getPayableChains, loadEnv, loadRootEnvFile } from "@emp/config";
import { checkRedirectBaseUrlReachable, isLikelyDevTunnelUrl, isTelegramCompatibleUrl } from "@emp/telegram";
import { startPaymentWatchLoop } from "./processors/watchPayments.js";
import { createTelegramSendWorker } from "./processors/sendMessage.js";

// Explicit and first, same as packages/db's CLI scripts and apps/web's
// next.config.js — this app is a long-running daemon with no per-request
// entrypoint to hang an implicit load off of, so it gets its own explicit
// call rather than relying on it happening as a side effect of the first
// loadEnv()/getChains() call somewhere inside a processor.
loadRootEnvFile();

const env = loadEnv(); // fail fast on missing/malformed config before starting any worker

const sendWorker = createTelegramSendWorker();
// A plain interval, not a BullMQ queue/worker — see startPaymentWatchLoop's
// doc comment for why (Redis command volume).
const paymentWatchLoop = startPaymentWatchLoop(env.PAYMENT_WATCH_POLL_SECONDS * 1000);

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

// Same reasoning as the chain diagnostics above, for the other common
// misconfiguration: Telegram rejects an inline keyboard button URL that
// isn't a public HTTPS address (see @emp/telegram's isTelegramCompatibleUrl)
// — every CTA's redirect URL is built from this one var, so a bad value
// here would otherwise only surface per-recipient, buried in send-job
// failures, once a campaign with CTAs actually reaches SENDING.
if (!isTelegramCompatibleUrl(`${env.REDIRECT_BASE_URL}/sample-token`)) {
  console.warn(
    `[worker] REDIRECT_BASE_URL ("${env.REDIRECT_BASE_URL}") isn't a public HTTPS address — Telegram will ` +
      "reject any CTA button built from it. Campaigns with no CTAs still send fine; anything with a CTA will " +
      "fail for every recipient until this points at a real HTTPS host (a public tunnel like ngrok/cloudflared " +
      "works for local testing — see the README).",
  );
} else {
  // Syntactically fine (real HTTPS host, not localhost) doesn't mean the
  // domain actually exists — a "branded" domain typed into .env before
  // it's purchased/pointed at anything passes the check above and then
  // fails as DNS_PROBE_FINISHED_NXDOMAIN in a recipient's browser the
  // first time someone taps a CTA. Make an actual network request here so
  // that failure shows up now, in a log, instead of then.
  const reachability = await checkRedirectBaseUrlReachable(env.REDIRECT_BASE_URL);
  if (!reachability.reachable) {
    console.warn(
      `[worker] REDIRECT_BASE_URL ("${env.REDIRECT_BASE_URL}") looks like a valid HTTPS URL but isn't actually ` +
        `reachable: ${reachability.reason} Campaigns with no CTAs still send fine; anything with a CTA will ` +
        "hit DNS_PROBE_FINISHED_NXDOMAIN (or similar) in the recipient's browser until this points at a domain " +
        "that's actually live — a public tunnel (ngrok/cloudflared) for local testing, or your real branded " +
        "domain once it's purchased and DNS is pointed at it in production. See the README.",
    );
  } else if (isLikelyDevTunnelUrl(env.REDIRECT_BASE_URL)) {
    // A separate, softer nudge: this URL *works* (real HTTPS, actually
    // reachable), but a randomized ngrok/cloudflared-style subdomain reads
    // as exactly the kind of unfamiliar link a wary recipient is right to
    // distrust (see the CTA-link-trust discussion this fix came out of).
    // Fine for local testing; swap in a real branded domain before sending
    // to real users.
    console.warn(
      `[worker] REDIRECT_BASE_URL ("${env.REDIRECT_BASE_URL}") looks like a temporary dev tunnel — fine for local ` +
        "testing, but recipients will see this domain on every CTA button. Point it at a real, stable domain you " +
        "control before sending to real users.",
    );
  }
}

// Only sendWorker is a BullMQ Worker now — the payment-watch loop logs its
// own failures directly (see startPaymentWatchLoop) rather than emitting a
// 'failed' job event.
sendWorker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`Job ${job?.id} failed:`, err);
});

async function shutdown(): Promise<void> {
  await Promise.all([sendWorker.close(), paymentWatchLoop.stop()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
