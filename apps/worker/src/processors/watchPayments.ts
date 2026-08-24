import { Worker } from "bullmq";
import { getPayableChains, loadEnv } from "@emp/config";
import { assertTransition } from "@emp/core";
import { EvmTreasuryWatcher, type PendingPayment } from "@emp/payments";
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
      for (const chain of getPayableChains()) {
        const watcher = new EvmTreasuryWatcher({ chain });
        const awaiting = await prisma.payment.findMany({
          where: { chain: chain.key, status: "AWAITING" },
        });

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

          // One payment's failure (a bad campaign/CTA config, a transient
          // RPC hiccup on the checkPayment call, whatever) must never take
          // down the rest of this tick — every other AWAITING payment on
          // this chain still deserves a check.
          try {
            const result = await watcher.checkPayment(pending);
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

      await fireDueScheduledCampaigns(sendQueue);
    },
    { connection: getRedisConnection() },
  );
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
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "SENDING" } });
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
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SENDING" } });
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
  const ctas = campaign.ctas.map((cta) => ({
    label: cta.label,
    targetUrl: cta.targetUrl,
    redirectUrl: `${env.REDIRECT_BASE_URL}/${cta.redirectToken}`,
  }));

  // Every CTA shares the same REDIRECT_BASE_URL, so if one fails Telegram's
  // "public HTTPS only" rule they all do — checking once here, for the
  // whole campaign, avoids enqueueing one doomed job per recipient (each of
  // which would fail identically; see @emp/telegram's sendCampaignMessage,
  // which also checks this defensively per-job). Marks every recipient
  // FAILED up front instead of leaving the campaign looking like it's still
  // sending.
  const invalidCta = ctas.find((cta) => !isTelegramCompatibleUrl(cta.redirectUrl));
  if (invalidCta) {
    console.error(
      `[worker] Campaign ${campaignId}: REDIRECT_BASE_URL ("${env.REDIRECT_BASE_URL}") produces a CTA URL ` +
        `Telegram will reject (e.g. "${invalidCta.redirectUrl}") — it must be a public HTTPS host, not ` +
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

  const jobs: Array<{ name: string; data: TelegramSendJobData }> = campaign.recipients.map((recipient) => ({
    name: "send",
    data: {
      campaignId,
      recipientId: recipient.id,
      chatId: recipient.chatId,
      text: campaign.bodyText ?? "",
      imageBase64: campaign.imageData ? Buffer.from(campaign.imageData).toString("base64") : undefined,
      ctas,
    },
  }));

  await sendQueue.addBulk(jobs);

  // Handles the zero-recipient edge case (an approved campaign whose
  // audience snapshot was empty) — no jobs get enqueued, so nothing would
  // otherwise ever trigger the completion check.
  await maybeCompleteCampaign(campaignId);
}
