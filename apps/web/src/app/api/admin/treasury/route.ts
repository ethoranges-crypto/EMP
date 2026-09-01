import { NextResponse } from "next/server";
import { getChains, listChainDefinitions } from "@emp/config";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * SPEC §6 / CLAUDE.md Payments: "one EMP treasury address per chain" — env
 * only, deliberately NOT admin/DB-configurable. It's the single
 * highest-value config in the system: redirect it and every protocol
 * payment reroutes to whoever made the change, so changing it requires
 * server/deploy access (env), not just an admin session that could be
 * phished or otherwise compromised. This route is read-only — it exists so
 * an admin can *verify* what's currently configured, never to change it.
 * Lists every chain EMP knows about (@emp/config's listChainDefinitions),
 * alongside whether each is RPC-configured and its treasury address (if
 * any) — a chain is actually payable (see getPayableChains) only once both
 * are set, both read from the exact same env vars the worker's payment
 * watcher uses, so there's no separate copy that can drift out of sync.
 */
export async function GET() {
  try {
    await requireRole("admin");
    const rpcChains = getChains();
    const byKey = new Map(rpcChains.map((c) => [c.key, c]));

    return NextResponse.json({
      chains: listChainDefinitions().map((def) => ({
        key: def.key,
        displayName: def.displayName,
        rpcConfigured: byKey.has(def.key),
        treasuryAddress: byKey.get(def.key)?.treasuryAddress ?? null,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
