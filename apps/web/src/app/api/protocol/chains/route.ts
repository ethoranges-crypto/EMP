import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { createPrismaTreasuryStore, getPayableChains } from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * SPEC §6: which chains a protocol can pick to pay EMP on, at the payment
 * step — sourced from getPayableChains() (@emp/core), i.e. only chains EMP
 * has both an RPC url (env, @emp/config) AND an admin-configured treasury
 * address (DB) for, not a hardcoded client-side list that could drift from
 * what's really watchable/payable.
 *
 * Every failure path below returns real JSON, never a bare `throw` — an
 * unhandled exception here previously surfaced to the client as a
 * non-JSON 500 body ("Unexpected end of JSON input" in PaymentPanel.tsx),
 * which a malformed chain env var (or any other unexpected error) could
 * trigger. getChains() itself no longer throws on a single bad chain's env
 * (see chains.ts), but this still guards against any other failure mode.
 */
export async function GET() {
  try {
    await requireRole("protocol");
    const store = createPrismaTreasuryStore(prisma);
    const chains = await getPayableChains(store);
    return NextResponse.json({
      chains: chains.map((c) => ({ key: c.key, displayName: c.displayName })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[api/protocol/chains] failed to resolve payable chains:", err);
    return NextResponse.json({ error: "Could not load payment chains. Try again shortly." }, { status: 500 });
  }
}
