import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import {
  CampaignNotEditableError,
  CampaignNotFoundError,
  CampaignNotOwnedError,
  InvalidCtaError,
  MessageTooLongError,
  TooManyCtasError,
  createPrismaComposeStore,
  saveCampaignCompose,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * One campaign's full detail, including compose content — the protocol's
 * own data about its own campaign (no user data anywhere on Campaign/Cta),
 * so a direct query is fine here, same reasoning as the campaigns list GET.
 *
 * Deliberately does NOT include each CTA's redirect token/URL — the
 * protocol doesn't need to see it to know a link works, and not putting it
 * in the response at all is stronger than just not rendering it client-side.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { categories: { include: { category: true } }, ctas: true },
    });
    if (!campaign || campaign.protocolId !== accountId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: campaign.id,
      status: campaign.status,
      chain: campaign.chain,
      token: campaign.token,
      categoryNames: campaign.categories.map((c) => c.category.name),
      bodyText: campaign.bodyText,
      imageUrl: campaign.imageUrl,
      ctas: campaign.ctas.map((cta) => ({ id: cta.id, label: cta.label, targetUrl: cta.targetUrl })),
      createdAt: campaign.createdAt,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}

interface PatchBody {
  bodyText: string | null;
  imageUrl: string | null;
  ctas: Array<{ label: string; targetUrl: string }>;
}

/**
 * SPEC §4.3 step 2 / §8: save a DRAFT campaign's message text, optional
 * image, and CTAs. saveCampaignCompose() (in @emp/core) is what actually
 * enforces ownership, DRAFT-only editability, Telegram's real text/caption
 * limits, and the CTA count/label caps — wraps every CTA URL in a fresh
 * redirect token, which this route never echoes back (see GET's comment).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;
    const { bodyText, imageUrl, ctas } = (await request.json()) as PatchBody;

    const store = createPrismaComposeStore(prisma);
    await saveCampaignCompose(store, {
      campaignId: id,
      protocolId: accountId,
      bodyText: bodyText?.trim() || null,
      imageUrl: imageUrl?.trim() || null,
      ctas: ctas ?? [],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CampaignNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotOwnedError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotEditableError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof InvalidCtaError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof MessageTooLongError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof TooManyCtasError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
