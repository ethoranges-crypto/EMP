import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import {
  CampaignNotCancellableError,
  CampaignNotFoundError,
  CampaignNotOwnedError,
  cancelCampaign,
  createPrismaCancelCampaignStore,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * Gives up on an IN_REVIEW or APPROVED campaign — the two statuses where
 * nothing has ever been paid (a Payment row only starts to exist once a
 * chain/token is picked, setPaymentMethod.ts). cancelCampaign() (in
 * @emp/core) enforces that, plus a direct check that no verified payment
 * exists regardless of what the status label says — this route just turns
 * its errors into the right status codes. AWAITING_PAYMENT and later have
 * their own separate cancel path (.../cancel-payment, only after a payment
 * attempt has already failed) — this route deliberately does not handle it.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;

    const store = createPrismaCancelCampaignStore(prisma);
    await cancelCampaign(store, { campaignId: id, protocolId: accountId });

    return NextResponse.json({ ok: true, status: "CANCELLED" });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CampaignNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotOwnedError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotCancellableError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
