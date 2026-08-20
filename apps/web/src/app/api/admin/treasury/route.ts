import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { getChains, listChainDefinitions } from "@emp/config";
import {
  InvalidTreasuryAddressError,
  InvalidTreasuryChainError,
  createPrismaTreasuryStore,
  setChainTreasuryAddress,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * SPEC §6 / CLAUDE.md Payments: "one EMP treasury address per chain",
 * admin-configurable (DB, not env — env stays for rpcUrl, which can embed a
 * provider secret). Lists every chain EMP knows about (@emp/config's
 * listChainDefinitions) so an admin can set a treasury ahead of a chain's
 * RPC going live, alongside whether each is currently RPC-configured and
 * its current treasury address (if any) — a chain is actually payable
 * (see getPayableChains) only once both are set.
 */
export async function GET() {
  try {
    await requireRole("admin");
    const store = createPrismaTreasuryStore(prisma);
    const [rpcChains, treasuries] = await Promise.all([getChains(), store.listTreasuryAddresses()]);
    const rpcKeys = new Set(rpcChains.map((c) => c.key));

    return NextResponse.json({
      chains: listChainDefinitions().map((def) => ({
        key: def.key,
        displayName: def.displayName,
        rpcConfigured: rpcKeys.has(def.key),
        treasuryAddress: treasuries[def.key] ?? null,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}

interface PutBody {
  chain: string;
  treasuryAddress: string;
}

export async function PUT(request: Request) {
  try {
    const { accountId: adminAddress } = await requireRole("admin");
    const { chain, treasuryAddress } = (await request.json()) as PutBody;

    const store = createPrismaTreasuryStore(prisma);
    await setChainTreasuryAddress(store, {
      chainKey: chain,
      treasuryAddress,
      validChainKeys: listChainDefinitions().map((d) => d.key),
    });

    await prisma.adminAction.create({
      data: {
        adminId: adminAddress,
        action: "treasury.update",
        targetType: "ChainTreasury",
        targetId: chain,
        metadata: { treasuryAddress },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof InvalidTreasuryChainError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof InvalidTreasuryAddressError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
