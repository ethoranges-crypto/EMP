import { prisma } from "@emp/db";
import { assertTransition } from "@emp/core";

/**
 * Flips a campaign SENDING -> COMPLETE once every one of its recipients has
 * had at least one send attempt recorded (see schema.prisma's
 * CampaignRecipient.attemptedAt doc comment for why that's a separate
 * signal from deliveryStatus). Call this after recording each recipient's
 * outcome — it's cheap (one count query) and safe to call redundantly: a
 * campaign that isn't SENDING (already COMPLETE, or anything else) is a
 * silent no-op, and two calls racing to complete the same campaign both
 * just write the same COMPLETE value.
 *
 * Without this, a campaign that finished sending has no way to ever leave
 * SENDING in the UI — this is what apps/web's protocol dashboard polls for.
 */
export async function maybeCompleteCampaign(campaignId: string): Promise<void> {
  const remaining = await prisma.campaignRecipient.count({ where: { campaignId, attemptedAt: null } });
  if (remaining > 0) return;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  if (campaign?.status !== "SENDING") return;

  assertTransition("SENDING", "COMPLETE");
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "COMPLETE" } });
}
