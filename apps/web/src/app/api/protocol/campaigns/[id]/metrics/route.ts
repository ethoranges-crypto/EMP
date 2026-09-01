import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { createPrismaProtocolQueryStore, getCampaignMetrics } from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/** PRIVACY BOUNDARY — see audience-count/route.ts's file comment; the same rule applies here. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id: campaignId } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { protocolId: true },
    });
    if (!campaign || campaign.protocolId !== accountId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const store = createPrismaProtocolQueryStore(prisma);
    const metrics = await getCampaignMetrics(store, campaignId);
    return NextResponse.json(metrics);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
