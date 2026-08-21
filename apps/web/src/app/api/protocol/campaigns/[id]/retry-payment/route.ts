import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import {
  CampaignNotAwaitingPaymentError,
  CampaignNotFoundError,
  CampaignNotOwnedError,
  PaymentWindowStillActiveError,
  createPrismaPaymentWindowRecoveryStore,
  retryPaymentWindow,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * A payment attempt that expired with nothing received, or came back
 * underpaid/wrong-token/duplicate, has no way forward otherwise (CLAUDE.md
 * rule 2: payment gates send, and there's only ever one active window per
 * campaign) — this reverts the campaign to APPROVED so the protocol can
 * pick a chain/token again, opening a fresh window. Only allowed once the
 * *current* payment has already left AWAITING — see
 * paymentWindowRecovery.ts's own doc comment for why.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;

    const store = createPrismaPaymentWindowRecoveryStore(prisma);
    await retryPaymentWindow(store, { campaignId: id, protocolId: accountId });

    return NextResponse.json({ ok: true, status: "APPROVED" });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CampaignNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotOwnedError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotAwaitingPaymentError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof PaymentWindowStillActiveError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
