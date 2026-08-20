import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { loadEnv } from "@emp/config";
import {
  CampaignCostNotLockedError,
  CampaignNotApprovedError,
  CampaignNotFoundError,
  CampaignNotOwnedError,
  InvalidPaymentChainError,
  InvalidPaymentTokenError,
  createPrismaSetPaymentMethodStore,
  createPrismaTreasuryStore,
  getPayableChains,
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
 * APPROVED-only gate, validates chain/token for real, and immediately opens
 * the payment window (creates the AWAITING Payment row, moves the campaign
 * to AWAITING_PAYMENT) — validChainKeys comes from getPayableChains()
 * (@emp/core), the chains EMP actually has an RPC (env) + admin-set
 * treasury (DB) for, not a hardcoded client list. fromAddress is the
 * protocol's own authenticated wallet (the SIWE session address) — the
 * automated on-chain watcher (apps/worker) keys off it, never a
 * protocol-chosen value.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId, address } = await requireRole("protocol");
    const { id } = await params;
    const { chain, token } = (await request.json()) as PatchBody;

    const store = createPrismaSetPaymentMethodStore(prisma);
    const treasuryStore = createPrismaTreasuryStore(prisma);
    const payableChains = await getPayableChains(treasuryStore);

    await setCampaignPaymentMethod(store, {
      campaignId: id,
      protocolId: accountId,
      protocolWallet: address,
      chain,
      token,
      validChainKeys: payableChains.map((c) => c.key),
      paymentWindowMinutes: loadEnv().PAYMENT_WINDOW_MINUTES,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CampaignNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotOwnedError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof CampaignNotApprovedError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof CampaignCostNotLockedError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof InvalidPaymentChainError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof InvalidPaymentTokenError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
