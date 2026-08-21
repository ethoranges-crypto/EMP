import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import {
  CampaignNotAwaitingPaymentError,
  CampaignNotFoundError,
  CampaignNotOwnedError,
  PaymentWindowStillActiveError,
  cancelPaymentWindow,
  createPrismaPaymentWindowRecoveryStore,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * Terminal — the protocol is giving up on this campaign rather than
 * retrying payment after an attempt that expired/underpaid/etc. Only
 * allowed once the *current* payment has already left AWAITING — see
 * paymentWindowRecovery.ts's own doc comment for why.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;

    const store = createPrismaPaymentWindowRecoveryStore(prisma);
    await cancelPaymentWindow(store, { campaignId: id, protocolId: accountId });

    return NextResponse.json({ ok: true, status: "CANCELLED" });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CampaignNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotOwnedError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotAwaitingPaymentError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof PaymentWindowStillActiveError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
