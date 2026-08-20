import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { listInReviewCampaigns } from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * SPEC §4.3 steps 4-5: the moderation queue — every IN_REVIEW campaign,
 * with everything an admin needs to see exactly what a recipient would
 * receive before deciding. listInReviewCampaigns() (in @emp/core) is the
 * query itself, run against a real migrated Postgres by its own
 * integration test — see that file's doc comment.
 *
 * imageUrl is derived here (not in @emp/core) the same way the protocol's
 * own campaign-detail route derives it: a same-origin, cookie-authenticated
 * URL, never the raw bytes inline in this list response.
 */
export async function GET() {
  try {
    await requireRole("admin");
    const campaigns = await listInReviewCampaigns(prisma);
    return NextResponse.json({
      campaigns: campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        protocolName: c.protocolName,
        chain: c.chain,
        token: c.token,
        categoryNames: c.categoryNames,
        bodyText: c.bodyText,
        imageUrl: c.hasImage ? `/api/admin/campaigns/${c.id}/image` : null,
        ctas: c.ctas,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
