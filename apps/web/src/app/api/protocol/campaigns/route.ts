import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import {
  InvalidTitleError,
  NoCategoriesSelectedError,
  ProtocolNotApprovedError,
  createDraftCampaign,
  createPrismaCreateCampaignStore,
} from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";
import { getProtocolCampaignsList } from "@/lib/protocolCampaignsList";

interface PostBody {
  title: string;
  categoryIds: string[];
}

/**
 * SPEC §4.3 step 1 / §4.2: persists a DRAFT with its target categories —
 * compose (step 2), moderation, snapshot/cost-lock, and payment are all
 * later stages. createDraftCampaign() (in @emp/core) is what actually
 * enforces "only an APPROVED protocol may create a campaign," not this
 * route — see its own doc comment. No chain/token here (SPEC §6) — that's
 * chosen later, at the payment step, once the campaign is APPROVED.
 */
export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole("protocol");
    const { title, categoryIds } = (await request.json()) as PostBody;

    const store = createPrismaCreateCampaignStore(prisma);
    const { campaignId } = await createDraftCampaign(store, {
      protocolId: accountId,
      title,
      categoryIds,
    });

    return NextResponse.json({ ok: true, campaignId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProtocolNotApprovedError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof NoCategoriesSelectedError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof InvalidTitleError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

/**
 * The protocol's own campaign list — its own data about its own campaigns,
 * not privacy-sensitive (Campaign/CampaignCategory carry no wallet/chat_id),
 * so a direct query is fine here. Contrast with audience-count and
 * campaign metrics, which must go through @emp/core's protocol-queries
 * chokepoint because those *do* derive from user data (CLAUDE.md rule 1).
 * getProtocolCampaignsList (@/lib) is the one place this query lives —
 * the CSV export (.../campaigns/export) uses the exact same function.
 */
export async function GET() {
  try {
    const { accountId } = await requireRole("protocol");
    const campaigns = await getProtocolCampaignsList(accountId);
    return NextResponse.json({ campaigns });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
