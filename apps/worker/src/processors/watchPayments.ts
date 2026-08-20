import { Worker } from "bullmq";
import { loadEnv } from "@emp/config";
import { assertTransition, createPrismaTreasuryStore, getPayableChains } from "@emp/core";
import { EvmTreasuryWatcher, type PendingPayment } from "@emp/payments";
import { prisma } from "@emp/db";
import { getRedisConnection } from "../redis.js";
import { PAYMENT_WATCH_QUEUE_NAME } from "../queues/paymentWatchQueue.js";
import { createTelegramSendQueue, type TelegramSendJobData } from "../queues/telegramSendQueue.js";

/**
 * On each tick: for every payable chain (RPC-configured via env, AND
 * treasury-configured via the admin-set DB row — see getPayableChains),
 * check that chain's AWAITING payments against on-chain activity
 * (EvmTreasuryWatcher — SPEC §6 MVP verification). A VERIFIED payment is
 * the only thing allowed to move a campaign into SENDING (CLAUDE.md rule 2:
 * payment gates send). Fully automated — no manual admin verification step.
 */
export function createPaymentWatchWorker(): Worker {
  const sendQueue = createTelegramSendQueue();
  const treasuryStore = createPrismaTreasuryStore(prisma);

  return new Worker(
    PAYMENT_WATCH_QUEUE_NAME,
    async () => {
      for (const chain of await getPayableChains(treasuryStore)) {
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
