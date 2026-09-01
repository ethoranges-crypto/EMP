import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * Serves a campaign's uploaded image bytes to an authenticated admin, for
 * the moderation preview (reuses the same MessagePreview component the
 * protocol's own compose panel uses — see admin/CampaignsModerationPanel.tsx).
 * No ownership check: unlike the protocol-facing .../campaigns/[id]/image,
 * moderation is an admin-wide capability, not scoped to "your own" campaign.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin");
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { imageData: true, imageMimeType: true },
    });
    if (!campaign || !campaign.imageData || !campaign.imageMimeType) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(campaign.imageData), {
      headers: { "Content-Type": campaign.imageMimeType, "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
