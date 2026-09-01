import { NextResponse } from "next/server";
import { UnauthorizedError, requireRole } from "@/lib/session";
import { getProtocolCampaignsList } from "@/lib/protocolCampaignsList";
import { buildCampaignsCsv } from "@/lib/campaignsCsv";

/**
 * Aggregate-only CSV of the protocol's own campaigns — title, categories,
 * status, created/sent time, audience size, cost, delivered count + %,
 * click count + %. Uses the exact same getProtocolCampaignsList() the JSON
 * list route does (which itself only ever touches user-derived data via
 * @emp/core's protocol-queries chokepoint, never a raw query) — there is no
 * separate query here that could drift and pull a user-level field. See
 * campaignsCsv.test.ts for the regression test pinning that the CSV
 * builder only ever serializes these 11 named fields.
 */
export async function GET() {
  try {
    const { accountId } = await requireRole("protocol");
    const campaigns = await getProtocolCampaignsList(accountId);
    const csv = buildCampaignsCsv(campaigns);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="emp-campaigns.csv"',
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
