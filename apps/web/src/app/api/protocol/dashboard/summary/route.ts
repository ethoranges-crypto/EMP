import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { createPrismaProtocolQueryStore, getProtocolSummary } from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * PRIVACY BOUNDARY — same rule as audience-count/route.ts and
 * campaigns/[id]/metrics/route.ts: this is the dashboard's aggregate summary
 * strip (total campaigns sent, total reach, average click rate), scoped to
 * the caller's own campaigns and computed entirely through @emp/core's
 * protocol-queries chokepoint. Never touch CampaignRecipient/TelegramLink
 * directly here.
 */
export async function GET() {
  try {
    const { accountId } = await requireRole("protocol");

    const store = createPrismaProtocolQueryStore(prisma);
    const summary = await getProtocolSummary(store, accountId);
    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
