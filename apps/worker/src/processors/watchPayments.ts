import { randomUUID } from "node:crypto";
import { Worker } from "bullmq";
import { getPayableChains, loadEnv, type PayableChainConfig } from "@emp/config";
import { assertTransition } from "@emp/core";
import { EvmTreasuryWatcher, matchPayment, type ObservedTransfer, type PendingPayment, type TokenSymbol } from "@emp/payments";
import { isTelegramCompatibleUrl } from "@emp/telegram";
import { prisma } from "@emp/db";
import { getRedisConnection } from "../redis.js";
import { PAYMENT_WATCH_QUEUE_NAME } from "../queues/paymentWatchQueue.js";
import { createTelegramSendQueue, type TelegramSendJobData } from "../queues/telegramSendQueue.js";
import { maybeCompleteCampaign } from "../campaignCompletion.js";

/**
 * On each tick: for every payable chain (RPC-configured AND
 * treasury-configured, both env — see @emp/config's getPayableChains, the
 * same source the Pay panel's API reads, so there's no separate copy that
 * can drift), check that chain's AWAITING payments against on-chain
 * activity (EvmTreasuryWatcher — SPEC §6 MVP verification). A VERIFIED
 * payment is the only thing allowed to move a campaign past AWAITING_PAYMENT
 * (CLAUDE.md rule 2: payment gates send) — either straight to SENDING, or to
 * SCHEDULED if the protocol chose a future send time (scheduled sending).
 * Fully automated — no manual admin verification step.
 *
 * RPC volume note: this fetches on-chain activity exactly ONCE per chain
 * per tick (checkChainPayments), then matches every AWAITING payment on
 * that chain against the same in-memory result via the pure matchPayment
 * function — not once per payment, which is what made this expensive
 * enough to hit a free RPC tier's rate limit with even a single campaign.
 * See evmTreasuryWatcher.ts's EvmTreasuryWatcher doc comment for expected
 * call volume per tick.
 *
 * The same tick also scans for SCHEDULED campaigns whose time has arrived
 * (fireDueScheduledCampaigns) — a plain DB query rather than a BullMQ
 * delayed job, so it self-heals on a worker restart with no job-id
 * bookkeeping: a scheduled send that was due while the worker was down just
 * gets picked up by the next tick once it's back, same as a payment that
 * cleared while the worker was offline already does.
 */
export function createPaymentWatchWorker(): Worker {
  const sendQueue = createTelegramSendQueue();

  return new Worker(
    PAYMENT_WATCH_QUEUE_NAME,
    async () => {
      const env = loadEnv();

      for (const chain of getPayableChains()) {
        // One chain's RPC failure (provider outage, still-exhausted rate
        // limit despite the retry/backoff below, whatever) must never take
        // down every other chain's tick.
        try {
          await checkChainPayments(sendQueue, chain, env);
        } catch (err) {
          console.error(`[worker] payment-watch tick failed for chain ${chain.key}:`, err);
        }
      }

      await pruneObservedTransfers(env.PAYMENT_WINDOW_MINUTES);
      await fireDueScheduledCampaigns(sendQueue);
    },
    { connection: getRedisConnection() },
  );
}

/**
 * One chain's worth of a tick: advance that chain's scan cursor by fetching
 * only the new-since-last-time block range (EvmTreasuryWatcher.fetchNewTransfers),
 * cache whatever it finds (ObservedTransfer — a transfer observed in one
 * tick's small delta range must stay matchable in later ticks too, since an
 * AWAITING payment can still be open when the matching transfer arrives, or
 * arrive several ticks after it), then match every AWAITING payment on this
 * chain against the full cached window with the pure matchPayment function
 * — zero extra RPC calls per payment.
 */
async function checkChainPayments(
  sendQueue: ReturnType<typeof createTelegramSendQueue>,
  chain: PayableChainConfig,
  env: ReturnType<typeof loadEnv>,
): Promise<void> {
  const cursor = await prisma.chainScanCursor.findUnique({ where: { chain: chain.key } });
  const watcher = new EvmTreasuryWatcher({
    chain,
    maxLookbackBlocks: BigInt(env.PAYMENT_WATCH_MAX_LOOKBACK_BLOCKS),
    scanNativeTransfers: env.PAYMENT_WATCH_SCAN_NATIVE_TRANSFERS,
    rpcRetryCount: env.PAYMENT_WATCH_RPC_RETRY_COUNT,
    rpcRetryDelayMs: env.PAYMENT_WATCH_RPC_RETRY_DELAY_MS,
  });

  const { transfers, scannedToBlock } = await watcher.fetchNewTransfers(cursor?.lastScannedBlock ?? null);

  if (transfers.length > 0) {
    await prisma.observedTransfer.createMany({
      data: transfers.map((t) => ({
        chain: chain.key,
        token: t.token,
        amount: t.amount,
        fromAddress: t.fromAddress,
        txHash: t.txHash,
        occurredAt: t.occurredAt,
      })),
      // A transfer already cached from an earlier tick's overlap (fromBlock
      // is exclusive of the last scanned block, so overlap shouldn't
      // normally happen, but a chain reorg or a retried tick could still
      // hand back the same txHash twice) is a no-op, not an error.
      skipDuplicates: true,
    });
  }

  await prisma.chainScanCursor.upsert({
    where: { chain: chain.key },
    create: { chain: chain.key, lastScannedBlock: scannedToBlock },
    update: { lastScannedBlock: scannedToBlock },
  });

  const awaiting = await prisma.payment.findMany({ where: { chain: chain.key, status: "AWAITING" } });
  if (awaiting.length === 0) return;

  const cached = await prisma.observedTransfer.findMany({ where: { chain: chain.key } });
  const observed: ObservedTransfer[] = cached.map((c) => ({
    token: c.token as TokenSymbol,
    amount: c.amount,
    fromAddress: c.fromAddress,
    txHash: c.txHash,
    occurredAt: c.occurredAt,
  }));

  for (const payment of awaiting) {
    const pending: PendingPayment = {
      id: payment.id,
      campaignId: payment.campaignId,
      chainKey: payment.chain,
      token: payment.token,
      expectedAmount: payment.amount.toString(),
      fromAddress: payment.fromAddress,
      windowExpiresAt: payment.windowExpiresAt,
    };

    // One payment's failure (a bad campaign/CTA config, whatever) must
    // never take down the rest of this chain's payments this tick.
    try {
      const result = matchPayment({ expected: pending, observed, alreadyConsumedTxHashes: new Set() });
      if (result.status === "AWAITING") continue;

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: result.status,
          txHash: result.txHash,
          verifiedAt: result.status === "VERIFIED" ? new Date() : undefined,
        },
      });

      if (result.status === "VERIFIED") {
        await sendCampaignOnPaymentVerified(sendQueue, payment.campaignId);
      }
    } catch (err) {
      console.error(`[worker] payment-watch tick failed for payment ${payment.id} (campaign ${payment.campaignId}):`, err);
    }
  }
}

/**
 * A cached ObservedTransfer only needs to outlive every payment window it
 * could still match — once it's older than the longest a payment can stay
 * AWAITING (PAYMENT_WINDOW_MINUTES) plus a small buffer for tick-interval
 * slack, no currently-open or future payment can legitimately match it
 * (matchPayment rejects anything past a payment's own windowExpiresAt, and
 * a payment's window always starts at-or-after its own createdAt, which is
 * always >= now). Runs once per tick, across all chains — cheap, indexed on
 * (chain, occurredAt).
 */
async function pruneObservedTransfers(paymentWindowMinutes: number): Promise<void> {
  const cutoff = new Date(Date.now() - (paymentWindowMinutes + 10) * 60_000);
  await prisma.observedTransfer.deleteMany({ where: { occurredAt: { lt: cutoff } } });
}

async function sendCampaignOnPaymentVerified(
  sendQueue: ReturnType<typeof createTelegramSendQueue>,
  campaignId: string,
): Promise<void> {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { scheduledSendAt: true },
  });

  // No schedule chosen, or the chosen time has already passed by the time
  // payment cleared ("paid late") — both send right away, exactly the
  // behaviour that existed before scheduled sending. Paid-late is
  // deliberately NOT held or flagged for manual attention: SPEC's fully
  // automated payment->send path has no admin-in-the-loop step anywhere
  // else, and a protocol that's already paid has no way to "pay later" to
  // fix a schedule that slipped — sending immediately is the only outcome
  // that doesn't strand a paid campaign. The late case is still logged, so
  // it's visible in the worker's own output if it ever needs investigating.
  if (campaign.scheduledSendAt === null || campaign.scheduledSendAt.getTime() <= Date.now()) {
    if (campaign.scheduledSendAt !== null) {
      console.warn(
        `[worker] Campaign ${campaignId} was scheduled to send at ${campaign.scheduledSendAt.toISOString()}, ` +
          `but payment only cleared at ${new Date().toISOString()} — sending immediately instead of holding.`,
      );
    }
    assertTransition("AWAITING_PAYMENT", "SENDING");
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "SENDING", sentAt: new Date() } });
    await sendCampaignNow(sendQueue, campaignId);
    return;
  }

  assertTransition("AWAITING_PAYMENT", "SCHEDULED");
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "SCHEDULED" } });
}

/**
 * Picks up every SCHEDULED campaign whose scheduledSendAt has arrived and
 * fires it — see this file's top comment for why a periodic scan (not a
 * BullMQ delayed job) is what survives a worker restart here. Reschedules
 * and cancellations (rescheduleCampaign.ts) are plain updates to
 * scheduledSendAt, so this query always sees the campaign's current
 * intended send time with no separate job to keep in sync.
 */
async function fireDueScheduledCampaigns(sendQueue: ReturnType<typeof createTelegramSendQueue>): Promise<void> {
  const due = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledSendAt: { lte: new Date() } },
    select: { id: true },
  });

  for (const campaign of due) {
    try {
      assertTransition("SCHEDULED", "SENDING");
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SENDING", sentAt: new Date() } });
      await sendCampaignNow(sendQueue, campaign.id);
    } catch (err) {
      console.error(`[worker] scheduled-send tick failed for campaign ${campaign.id}:`, err);
    }
  }
}

/**
 * Builds and enqueues every recipient's send job for a campaign that's
 * already been moved to SENDING by the caller (sendCampaignOnPaymentVerified
 * for an immediate/paid-late send, fireDueScheduledCampaigns for one whose
 * scheduled time arrived) — the two callers differ only in *when* they
 * decide to send, not in how the actual send is built.
 */
async function sendCampaignNow(sendQueue: ReturnType<typeof createTelegramSendQueue>, campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { recipients: true, ctas: true },
  });

  const env = loadEnv();

  // Every CTA shares the same REDIRECT_BASE_URL, so if one fails Telegram's
  // "public HTTPS only" rule they all do — checking once here, against a
  // sample path, avoids enqueueing one doomed job per recipient (each of
  // which would fail identically; see @emp/telegram's sendCampaignMessage,
  // which also checks this defensively per-job). Marks every recipient
  // FAILED up front instead of leaving the campaign looking like it's still
  // sending.
  const sampleRedirectUrl = `${env.REDIRECT_BASE_URL}/sample-token`;
  if (campaign.ctas.length > 0 && !isTelegramCompatibleUrl(sampleRedirectUrl)) {
    console.error(
      `[worker] Campaign ${campaignId}: REDIRECT_BASE_URL ("${env.REDIRECT_BASE_URL}") produces a CTA URL ` +
        `Telegram will reject (e.g. "${sampleRedirectUrl}") — it must be a public HTTPS host, not ` +
        "localhost/http. Fix the env var and restart the worker before sending another campaign with CTAs; " +
        "this one is now COMPLETE with 0 delivered.",
    );
    await prisma.deliveryEvent.upsert({
      where: { campaignId_status: { campaignId, status: "FAILED" } },
      create: { campaignId, status: "FAILED", count: campaign.recipients.length },
      update: { count: { increment: campaign.recipients.length } },
    });
    await prisma.campaignRecipient.updateMany({
      where: { campaignId },
      data: { deliveryStatus: "FAILED", attemptedAt: new Date() },
    });
    await maybeCompleteCampaign(campaignId);
    return;
  }

  // One ClickToken per (recipient, CTA) pair, minted here at send time — this
  // is what makes a click attributable to a specific recipient (see
  // ClickEvent.recipientId's doc comment in schema.prisma). Never reused
  // across recipients, unlike the old campaign-wide Cta.redirectToken.
  const clickTokenRows = campaign.recipients.flatMap((recipient) =>
    campaign.ctas.map((cta) => ({
      campaignId,
      ctaId: cta.id,
      recipientId: recipient.id,
      token: randomUUID(),
    })),
  );
  if (clickTokenRows.length > 0) {
    await prisma.clickToken.createMany({ data: clickTokenRows });
  }
  const tokenByRecipientAndCta = new Map(clickTokenRows.map((row) => [`${row.recipientId}:${row.ctaId}`, row.token]));

  const jobs: Array<{ name: string; data: TelegramSendJobData }> = campaign.recipients.map((recipient) => ({
    name: "send",
    data: {
      campaignId,
      recipientId: recipient.id,
      chatId: recipient.chatId,
      text: campaign.bodyText ?? "",
      imageBase64: campaign.imageData ? Buffer.from(campaign.imageData).toString("base64") : undefined,
      ctas: campaign.ctas.map((cta) => ({
        label: cta.label,
        targetUrl: cta.targetUrl,
        redirectUrl: `${env.REDIRECT_BASE_URL}/${tokenByRecipientAndCta.get(`${recipient.id}:${cta.id}`)}`,
      })),
    },
  }));

  await sendQueue.addBulk(jobs);

  // Handles the zero-recipient edge case (an approved campaign whose
  // audience snapshot was empty) — no jobs get enqueued, so nothing would
  // otherwise ever trigger the completion check.
  await maybeCompleteCampaign(campaignId);
}
