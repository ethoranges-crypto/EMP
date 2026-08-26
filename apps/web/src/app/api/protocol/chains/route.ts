import { NextResponse } from "next/server";
import { getPayableChains } from "@emp/config";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * SPEC §6: which chains a protocol can pick to pay EMP on, at the payment
 * step — sourced from getPayableChains() (@emp/config), i.e. only chains EMP
 * has both an RPC url AND a treasury address configured for, both env-only
 * (see chains.ts's ChainConfig doc comment for why treasury isn't
 * DB/admin-configurable), not a hardcoded client-side list that could drift
 * from what's really watchable/payable. Same source the worker's payment
 * watcher reads, so there's no separate copy to fall out of sync.
 *
 * Every failure path below returns real JSON, never a bare `throw` — an
 * unhandled exception here previously surfaced to the client as a
 * non-JSON 500 body ("Unexpected end of JSON input" in PaymentScreen.tsx).
 * getChains() itself no longer throws on a single bad chain's env (see
 * chains.ts), but this still guards against any other failure mode.
 */
export async function GET() {
  try {
    await requireRole("protocol");
    const chains = getPayableChains();
    return NextResponse.json({
      chains: chains.map((c) => ({ key: c.key, displayName: c.displayName })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[api/protocol/chains] failed to resolve payable chains:", err);
    return NextResponse.json({ error: "Could not load payment chains. Try again shortly." }, { status: 500 });
  }
}
