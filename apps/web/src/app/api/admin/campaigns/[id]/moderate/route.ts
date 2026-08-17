import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { EVERYTHING_CATEGORY_NAME, loadEnv } from "@emp/config";
import { approveCampaign, assertTransition, createPrismaSnapshotStore } from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

interface Body {
  decision: "APPROVED" | "REJECTED";
  reason?: string;
}

/**
 * SPEC §4.3 steps 4-6 / CLAUDE.md rule 2 (moderate -> pay -> send): approval
 * snapshots the audience and locks cost (rule 3), then opens the payment
 * window. Nothing here ever queues a send — that only happens once
 * apps/worker's payment watcher verifies payment (see rule 2).
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

    const env = loadEnv();
    assertTransition("APPROVED", "AWAITING_PAYMENT");
    const protocol = await prisma.protocol.findUniqueOrThrow({ where: { id: campaign.protocolId } });

    await prisma.$transaction([
      prisma.campaign.update({ where: { id: campaignId }, data: { status: "AWAITING_PAYMENT" } }),
      prisma.payment.create({
        data: {
          campaignId,
          chain: campaign.chain,
          token: campaign.token,
          amount: costAmount,
          // SPEC §6 assumption 5: verification keys off the protocol's authenticated wallet.
          fromAddress: protocol.wallet,
          status: "AWAITING",
          windowExpiresAt: new Date(Date.now() + env.PAYMENT_WINDOW_MINUTES * 60 * 1000),
        },
      }),
    ]);

    return NextResponse.json({ ok: true, status: "AWAITING_PAYMENT", snapshotCount, costAmount });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
