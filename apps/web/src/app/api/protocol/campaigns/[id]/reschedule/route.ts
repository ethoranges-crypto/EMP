import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import {
  CampaignNotFoundError,
  CampaignNotOwnedError,
  CampaignNotScheduledError,
  InvalidScheduledSendAtError,
  createPrismaRescheduleCampaignStore,
  rescheduleCampaign,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

interface PatchBody {
  /** ISO-8601 string, or null to cancel the scheduled send (see rescheduleCampaign.ts). */
  scheduledSendAt: string | null;
}

/**
 * A SCHEDULED campaign is already paid — changing its send time, or
 * clearing it outright (cancel), never touches payment/status; see
 * rescheduleCampaign.ts's own doc comment for why there's no separate
 * "cancel" endpoint: passing scheduledSendAt: null *is* cancel, and setting
 * a new value later from that same cleared state *is* the reschedule the
 * MVP spec asks for, with no re-payment and no new campaign.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;
    const { scheduledSendAt } = (await request.json()) as PatchBody;

    const store = createPrismaRescheduleCampaignStore(prisma);
    await rescheduleCampaign(store, { campaignId: id, protocolId: accountId, scheduledSendAt });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CampaignNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotOwnedError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotScheduledError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof InvalidScheduledSendAtError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
