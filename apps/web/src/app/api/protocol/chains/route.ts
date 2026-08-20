import { NextResponse } from "next/server";
import { getChains } from "@emp/config";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * SPEC §6: which chains a protocol can pick to pay EMP on, at the payment
 * step — sourced from getChains() (@emp/config), i.e. only chains EMP
 * actually has an RPC URL + treasury address configured for, not a
 * hardcoded client-side list that could drift from what's really watchable.
 */
export async function GET() {
  try {
    await requireRole("protocol");
    return NextResponse.json({
      chains: getChains().map((c) => ({ key: c.key, displayName: c.displayName })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
