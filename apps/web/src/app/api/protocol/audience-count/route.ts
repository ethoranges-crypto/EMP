import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { EVERYTHING_CATEGORY_NAME } from "@emp/config";
import { createPrismaProtocolQueryStore, getAudienceCount } from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

interface Body {
  categoryIds: string[];
}

/**
 * PRIVACY BOUNDARY: this route — and the campaign-metrics route next to it —
 * are the only protocol-facing endpoints allowed to touch anything derived
 * from user data, and they may only do so through @emp/core's
 * protocol-queries module, which returns a count. Never import `prisma`
 * here to query User/TelegramLink/CampaignRecipient directly (CLAUDE.md
 * rule 1). SPEC §4.3 step 1: this count is the *only* audience data a
 * protocol ever sees.
 */
export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole("protocol");
    const protocol = await prisma.protocol.findUniqueOrThrow({ where: { id: accountId } });
    if (protocol.status !== "APPROVED") {
      return NextResponse.json({ error: "Protocol is not approved" }, { status: 403 });
    }

    const { categoryIds } = (await request.json()) as Body;
    const everything = await prisma.category.findUnique({ where: { name: EVERYTHING_CATEGORY_NAME } });
    const includeAll = everything ? categoryIds.includes(everything.id) : false;

    const store = createPrismaProtocolQueryStore(prisma);
    const count = await getAudienceCount(store, { categoryIds, includeAll });

    return NextResponse.json({ audienceCount: count });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
