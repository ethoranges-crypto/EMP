import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * SPEC §4.5/§6: the flat cost-per-user (in USD) that campaign approval
 * locks a cost against (approveCampaign() in @emp/core). A singleton row —
 * see schema.prisma's PlatformSettings comment. Returns null when it's
 * never been set, which is exactly why campaign approval currently fails
 * with "Platform cost settings are not configured" until an admin sets it
 * here.
 */
export async function GET() {
  try {
    await requireRole("admin");
    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    return NextResponse.json({ flatCostPerUser: settings?.flatCostPerUser.toString() ?? null });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}

interface PutBody {
  flatCostPerUser: number;
}

/**
 * SPEC §6: USDC/USDT are the only accepted tokens (both USD-pegged 1:1),
 * so acceptedTokens is always the full pair here — there's no meaningful
 * subset to choose, unlike flatCostPerUser which is a real admin decision.
 */
export async function PUT(request: Request) {
  try {
    const { accountId: adminAddress } = await requireRole("admin");
    const { flatCostPerUser } = (await request.json()) as PutBody;

    if (typeof flatCostPerUser !== "number" || !Number.isFinite(flatCostPerUser) || flatCostPerUser <= 0) {
      return NextResponse.json({ error: "Flat cost per user must be a positive number." }, { status: 400 });
    }

    const settings = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", flatCostPerUser, acceptedTokens: ["USDC", "USDT"] },
      update: { flatCostPerUser, acceptedTokens: ["USDC", "USDT"] },
    });

    await prisma.adminAction.create({
      data: {
        adminId: adminAddress,
        action: "settings.update",
        targetType: "PlatformSettings",
        targetId: "singleton",
        metadata: { flatCostPerUser },
      },
    });

    return NextResponse.json({ flatCostPerUser: settings.flatCostPerUser.toString() });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
