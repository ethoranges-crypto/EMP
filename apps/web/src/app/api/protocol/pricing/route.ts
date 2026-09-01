import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * SPEC §4.5/§6: the flat cost-per-user (USD), read-only, for the protocol
 * side — so the cost is visible at campaign creation (before any effort is
 * invested composing/submitting), not only after approval. Same singleton
 * row as /api/admin/settings, just without the write capability — this is
 * platform-wide pricing, not derived from any user row, so it isn't a
 * privacy-boundary concern (contrast with audience-count/campaign-metrics).
 */
export async function GET() {
  try {
    await requireRole("protocol");
    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    return NextResponse.json({ flatCostPerUser: settings?.flatCostPerUser.toString() ?? null });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
