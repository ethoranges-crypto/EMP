import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { getChains } from "@emp/config";
import {
  CampaignNotApprovedError,
  CampaignNotFoundError,
  CampaignNotOwnedError,
  InvalidPaymentChainError,
  InvalidPaymentTokenError,
  createPrismaSetPaymentMethodStore,
  setCampaignPaymentMethod,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

interface PatchBody {
  chain: string;
  token: string;
}

/**
 * SPEC §6: the payment step — once a campaign is APPROVED, the protocol
 * picks which supported chain and which stablecoin (USDC/USDT) to pay EMP
 * on. setCampaignPaymentMethod() (in @emp/core) enforces ownership, the
 * APPROVED-only gate, and validates chain/token for real — validChainKeys
 * comes from getChains() (@emp/config), the chains EMP actually has an RPC
 * + treasury address configured for, not a hardcoded client list.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId } = await requireRole("protocol");
    const { id } = await params;
    const { chain, token } = (await request.json()) as PatchBody;

    const store = createPrismaSetPaymentMethodStore(prisma);
    await setCampaignPaymentMethod(store, {
      campaignId: id,
      protocolId: accountId,
      chain,
      token,
      validChainKeys: getChains().map((c) => c.key),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CampaignNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotOwnedError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotApprovedError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof InvalidPaymentChainError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof InvalidPaymentTokenError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
