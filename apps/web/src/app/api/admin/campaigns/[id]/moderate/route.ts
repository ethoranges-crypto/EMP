import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { EVERYTHING_CATEGORY_NAME } from "@emp/config";
import { approveCampaign, assertTransition, createPrismaSnapshotStore } from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

interface Body {
  decision: "APPROVED" | "REJECTED";
  reason?: string;
}

/**
 * SPEC §4.3 steps 4-5 / CLAUDE.md rule 2 (moderate -> pay -> send): approval
 * snapshots the audience and locks cost (rule 3), landing the campaign in
 * APPROVED — a "ready to pay" state. Opening the payment window (stage 6)
 * and queuing the send (stage 7) are deliberately NOT done here; nothing in
 * this route ever creates a Payment row or moves a campaign past APPROVED.
 * Rejection sends the campaign back to the protocol with the admin's
 * reason, still editable — see updateCompose.ts's EDITABLE_CAMPAIGN_STATUSES
 * and moderation.ts's REJECTED -> IN_REVIEW resubmit transition.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId: adminAddress } = await requireRole("admin");
    const { id: campaignId } = await params;
    const { decision, reason } = (await request.json()) as Body;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { categories: true },
    });
    if (!campaign || campaign.status !== "IN_REVIEW") {
      return NextResponse.json({ error: "Campaign is not awaiting moderation" }, { status: 409 });
    }

    await prisma.moderationReview.create({
      data: { campaignId, adminId: adminAddress, decision, reason },
    });

    if (decision === "REJECTED") {
      assertTransition("IN_REVIEW", "REJECTED");
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: "REJECTED" } });
      return NextResponse.json({ ok: true, status: "REJECTED" });
    }

    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      return NextResponse.json({ error: "Platform cost settings are not configured" }, { status: 500 });
    }

    const everything = await prisma.category.findUnique({ where: { name: EVERYTHING_CATEGORY_NAME } });
    const categoryIds = campaign.categories.map((c) => c.categoryId);
    const includeAll = everything ? categoryIds.includes(everything.id) : false;

    const snapshotStore = createPrismaSnapshotStore(prisma);
    const { snapshotCount, costAmount } = await approveCampaign(snapshotStore, {
      campaignId,
      categoryFilter: { categoryIds, includeAll },
      flatCostPerUser: Number(settings.flatCostPerUser),
    });

    return NextResponse.json({ ok: true, status: "APPROVED", snapshotCount, costAmount });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
