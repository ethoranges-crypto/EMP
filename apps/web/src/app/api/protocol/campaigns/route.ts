import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import {
  InvalidTitleError,
  NoCategoriesSelectedError,
  ProtocolNotApprovedError,
  createDraftCampaign,
  createPrismaCreateCampaignStore,
  createPrismaProtocolQueryStore,
  getCampaignMetrics,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

interface PostBody {
  title: string;
  categoryIds: string[];
}

/**
 * SPEC §4.3 step 1 / §4.2: persists a DRAFT with its target categories —
 * compose (step 2), moderation, snapshot/cost-lock, and payment are all
 * later stages. createDraftCampaign() (in @emp/core) is what actually
 * enforces "only an APPROVED protocol may create a campaign," not this
 * route — see its own doc comment. No chain/token here (SPEC §6) — that's
 * chosen later, at the payment step, once the campaign is APPROVED.
 */
export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole("protocol");
    const { title, categoryIds } = (await request.json()) as PostBody;

    const store = createPrismaCreateCampaignStore(prisma);
    const { campaignId } = await createDraftCampaign(store, {
      protocolId: accountId,
      title,
      categoryIds,
    });

    return NextResponse.json({ ok: true, campaignId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProtocolNotApprovedError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof NoCategoriesSelectedError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof InvalidTitleError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

/**
 * The protocol's own campaign list — its own data about its own campaigns,
 * not privacy-sensitive (Campaign/CampaignCategory carry no wallet/chat_id),
 * so a direct query is fine here. Contrast with audience-count and
 * campaign metrics, which must go through @emp/core's protocol-queries
 * chokepoint because those *do* derive from user data (CLAUDE.md rule 1).
 */
export async function GET() {
  try {
    const { accountId } = await requireRole("protocol");
    const campaigns = await prisma.campaign.findMany({
      where: { protocolId: accountId },
      orderBy: { createdAt: "desc" },
      include: {
        categories: { include: { category: true } },
        _count: { select: { ctas: true } },
        // Only the single most recent review is ever relevant for display —
        // if it was a REJECTED decision and the campaign is still (or again)
        // REJECTED, that's the reason shown; a later resubmission moves
        // status off REJECTED entirely, so the row below just won't surface it.
        moderationReviews: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    // Metrics (delivered %, click %) go through @emp/core's protocol-queries
    // chokepoint, same rule as audience-count — only fetched for COMPLETE
    // campaigns (typically zero or one at a time in this list), not on
    // every row, since it's the confirmation a protocol actually wants once
    // a campaign is done, not something meaningful mid-send.
    const metricsStore = createPrismaProtocolQueryStore(prisma);
    const metricsByCampaignId = new Map(
      await Promise.all(
        campaigns
          .filter((c) => c.status === "COMPLETE")
          .map(async (c) => [c.id, await getCampaignMetrics(metricsStore, c.id)] as const),
      ),
    );

    return NextResponse.json({
      campaigns: campaigns.map((c) => {
        const metrics = metricsByCampaignId.get(c.id);
        return {
          id: c.id,
          title: c.title,
          status: c.status,
          chain: c.chain,
          token: c.token,
          categoryNames: c.categories.map((cc) => cc.category.name),
          hasComposeContent: c.bodyText !== null,
          ctaCount: c._count.ctas,
          snapshotCount: c.snapshotCount,
          costAmount: c.costAmount?.toString() ?? null,
          rejectionReason: c.status === "REJECTED" ? (c.moderationReviews[0]?.reason ?? null) : null,
          createdAt: c.createdAt,
          metrics: metrics
            ? {
                delivered: metrics.delivered,
                clicks: { total: metrics.clicks.total, ratePct: metrics.clicks.ratePct },
              }
            : null,
        };
      }),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
