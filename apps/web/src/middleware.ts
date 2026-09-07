import { NextResponse, type NextRequest } from "next/server";

/**
 * Partner-branded landing pages, keyed by the subdomain they're served on.
 * Each entry's root ("/") gets internally rewritten to its own route —
 * every other path (notably /user, the standard registration flow every
 * partner page's CTA sends people into) passes through untouched on every
 * hostname, since this is one Next.js deployment serving all of them.
 *
 * Add a new partner by adding one entry here plus its route under
 * src/app/<slug>/page.tsx — no other wiring needed. The main domain
 * (emp-protocol.xyz) matches nothing here and keeps the normal EMP landing.
 */
const PARTNER_LANDING_BY_HOST: Record<string, string> = {
  "alchemix.emp-protocol.xyz": "/alchemix",
  // Local-dev-only alias so this can be exercised without real DNS — see
  // the README/PR description for the exact curl command.
  "alchemix.localhost": "/alchemix",
};

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") return NextResponse.next();

  // Host header includes a port in local dev ("alchemix.localhost:3000") —
  // strip it before matching, same reasoning as Node's own URL parsing.
  const hostname = (request.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
  const partnerPath = PARTNER_LANDING_BY_HOST[hostname];
  if (!partnerPath) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = partnerPath;
  return NextResponse.rewrite(url);
}

// Deliberately just "/" — every other path (including /user, /api/*, /r/*)
// must never go through this rewrite check, on any hostname.
export const config = {
  matcher: "/",
};
