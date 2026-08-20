import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import {
  CampaignImageTooLargeError,
  CampaignNotEditableError,
  CampaignNotFoundError,
  CampaignNotOwnedError,
  InvalidCampaignImageTypeError,
  createPrismaCampaignImageStore,
  saveCampaignImage,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * Serves a campaign's uploaded image bytes — same-origin, cookie-
 * authenticated, so a plain <img src="..."> from the compose/preview UI
 * just works. Not a public URL: only the owning protocol can read it
 * (mirrors GET .../campaigns/[id]'s own scoping — see its comment on why
 * a direct query is fine here, no user data is ever involved).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { protocolId: true, imageData: true, imageMimeType: true },
    });
    if (!campaign || campaign.protocolId !== accountId || !campaign.imageData || !campaign.imageMimeType) {
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

/**
 * SPEC §4.3 step 2 / §8: upload a DRAFT campaign's image — a real file,
 * not a pasted URL, so the protocol never has to host the image itself.
 * saveCampaignImage() (in @emp/core) enforces ownership, DRAFT-only
 * editability, and Telegram's real direct-upload size cap
 * (packages/config's CAMPAIGN_IMAGE_MAX_BYTES) plus the accepted-format
 * allow-list.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }
    const data = new Uint8Array(await file.arrayBuffer());

    const store = createPrismaCampaignImageStore(prisma);
    await saveCampaignImage(store, { campaignId: id, protocolId: accountId, data, mimeType: file.type });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CampaignNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotOwnedError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotEditableError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof CampaignImageTooLargeError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof InvalidCampaignImageTypeError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

/** Removes a DRAFT campaign's image — always a valid state, SPEC §8's image is optional. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;

    const store = createPrismaCampaignImageStore(prisma);
    await saveCampaignImage(store, { campaignId: id, protocolId: accountId, data: null, mimeType: null });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CampaignNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotOwnedError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotEditableError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
