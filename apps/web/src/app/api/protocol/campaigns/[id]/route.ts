import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { getChain } from "@emp/config";
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
 * Explicitly `select`s (rather than a blanket fetch) so the image's actual
 * bytes (imageData, up to 10MB) never get pulled into memory just to load
 * this detail view — only imageMimeType is read, to know whether one
 * exists at all; the bytes themselves are only ever read by .../image.
 *
 * Deliberately does NOT include each CTA's redirect token/URL — the
 * protocol doesn't need to see it to know a link works, and not putting it
 * in the response at all is stronger than just not rendering it client-side.
 *
 * Once a payment window is open (AWAITING_PAYMENT or later), also includes
 * the most recent Payment row plus the resolved treasury address to pay —
 * this is what the protocol pays into; the automated on-chain watcher
 * (apps/worker) is what flips `payment.status` to VERIFIED, never this route.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        protocolId: true,
        title: true,
        status: true,
        chain: true,
        token: true,
        bodyText: true,
        imageMimeType: true,
        snapshotCount: true,
        costAmount: true,
        createdAt: true,
        categories: { select: { category: { select: { name: true } } } },
        ctas: { select: { id: true, label: true, targetUrl: true } },
        // Same "only the latest review matters" reasoning as the campaigns list GET.
        moderationReviews: { orderBy: { createdAt: "desc" }, take: 1, select: { reason: true } },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { chain: true, token: true, amount: true, status: true, windowExpiresAt: true },
        },
      },
    });
    if (!campaign || campaign.protocolId !== accountId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Only surface the payment while it's actually current — once a
    // payment attempt didn't pan out and the protocol retries (back to
    // APPROVED), campaign.payments[0] is still that old LATE/UNDERPAID/etc.
    // row until a new one is opened; showing it here would make the Pay
    // panel display a stale failure instead of the fresh chain/token picker.
    const showPayment = campaign.status === "AWAITING_PAYMENT" || campaign.status === "SENDING" || campaign.status === "COMPLETE";
    const latestPayment = showPayment ? (campaign.payments[0] ?? null) : null;
    const treasuryAddress = latestPayment ? (getChain(latestPayment.chain)?.treasuryAddress ?? null) : null;

    return NextResponse.json({
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      chain: campaign.chain,
      token: campaign.token,
      categoryNames: campaign.categories.map((c) => c.category.name),
      bodyText: campaign.bodyText,
      imageUrl: campaign.imageMimeType ? `/api/protocol/campaigns/${campaign.id}/image` : null,
      ctas: campaign.ctas.map((cta) => ({ id: cta.id, label: cta.label, targetUrl: cta.targetUrl })),
      snapshotCount: campaign.snapshotCount,
      costAmount: campaign.costAmount?.toString() ?? null,
      rejectionReason: campaign.status === "REJECTED" ? (campaign.moderationReviews[0]?.reason ?? null) : null,
      createdAt: campaign.createdAt,
      payment: latestPayment
        ? {
            chain: latestPayment.chain,
            token: latestPayment.token,
            amount: latestPayment.amount.toString(),
            status: latestPayment.status,
            windowExpiresAt: latestPayment.windowExpiresAt,
            treasuryAddress,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}

interface PatchBody {
  bodyText: string | null;
  ctas: Array<{ label: string; targetUrl: string }>;
}

/**
 * SPEC §4.3 step 2 / §8: save a DRAFT campaign's message text and CTAs.
 * The image is a separate upload (see .../image's own POST/DELETE) — not
 * part of this body — so an empty/absent image can never block this save;
 * saveCampaignCompose() (in @emp/core) reads whether one is attached only
 * to pick the right text-length limit. It's also what actually enforces
 * ownership, DRAFT-only editability, and the CTA count/label caps — wraps
 * every CTA URL in a fresh redirect token, which this route never echoes
 * back (see GET's comment).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;
    const { bodyText, ctas } = (await request.json()) as PatchBody;

    const store = createPrismaComposeStore(prisma);
    await saveCampaignCompose(store, {
      campaignId: id,
      protocolId: accountId,
      bodyText: bodyText?.trim() || null,
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
