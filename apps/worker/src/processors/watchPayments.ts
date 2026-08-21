import { Worker } from "bullmq";
import { getPayableChains, loadEnv } from "@emp/config";
import { assertTransition } from "@emp/core";
import { EvmTreasuryWatcher, type PendingPayment } from "@emp/payments";
import { isTelegramCompatibleUrl } from "@emp/telegram";
import { prisma } from "@emp/db";
import { getRedisConnection } from "../redis.js";
import { PAYMENT_WATCH_QUEUE_NAME } from "../queues/paymentWatchQueue.js";
import { createTelegramSendQueue, type TelegramSendJobData } from "../queues/telegramSendQueue.js";

/**
 * On each tick: for every payable chain (RPC-configured AND
 * treasury-configured, both env — see @emp/config's getPayableChains, the
 * same source the Pay panel's API reads, so there's no separate copy that
 * can drift), check that chain's AWAITING payments against on-chain
 * activity (EvmTreasuryWatcher — SPEC §6 MVP verification). A VERIFIED
 * payment is the only thing allowed to move a campaign into SENDING
 * (CLAUDE.md rule 2: payment gates send). Fully automated — no manual admin
 * verification step.
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
    include: { recipients: true, ctas: true },
  });

  assertTransition("AWAITING_PAYMENT", "SENDING");
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "SENDING" } });

  const env = loadEnv();
  const ctas = campaign.ctas.map((cta) => ({
    label: cta.label,
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
        "localhost/http. Fix the env var and restart the worker; this campaign will stay marked SENDING " +
        "with 0 delivered until it's resent manually.",
    );
    await prisma.deliveryEvent.upsert({
      where: { campaignId_status: { campaignId, status: "FAILED" } },
      create: { campaignId, status: "FAILED", count: campaign.recipients.length },
      update: { count: { increment: campaign.recipients.length } },
    });
    await prisma.campaignRecipient.updateMany({ where: { campaignId }, data: { deliveryStatus: "FAILED" } });
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
}
