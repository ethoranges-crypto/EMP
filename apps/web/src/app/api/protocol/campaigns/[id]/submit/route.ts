import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import {
  CampaignNotComposedError,
  CampaignNotFoundError,
  CampaignNotOwnedError,
  CampaignNotSubmittableError,
  createPrismaSubmitForReviewStore,
  submitCampaignForReview,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * SPEC §4.3 step 3: moves a composed DRAFT (or a fixed-up REJECTED
 * campaign) into IN_REVIEW. submitCampaignForReview() (in @emp/core) is
 * what actually enforces ownership, that the campaign is in a submittable
 * status, and that it has a message — this route just wires it up.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;

    const store = createPrismaSubmitForReviewStore(prisma);
    await submitCampaignForReview(store, { campaignId: id, protocolId: accountId });

    return NextResponse.json({ ok: true, status: "IN_REVIEW" });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CampaignNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotOwnedError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotSubmittableError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof CampaignNotComposedError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
