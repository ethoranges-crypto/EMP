import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { loadEnv } from "@emp/config";
import { createLinkRequest, createPrismaLinkRequestStore } from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

const CODE_TTL_MINUTES = 15;

/**
 * SPEC §3.1: the one-time-code step, redeemed by apps/bot's /start handler.
 * Single-use AND time-bound: createLinkRequest invalidates any prior
 * un-redeemed code for this account before issuing a new one, so requesting
 * a fresh link never leaves an old one still valid.
 */
export async function POST() {
  try {
    const { accountId } = await requireRole("user");
    const env = loadEnv();
    const store = createPrismaLinkRequestStore(prisma);

    const { code, expiresAt } = await createLinkRequest(store, { userId: accountId, ttlMinutes: CODE_TTL_MINUTES });

    return NextResponse.json({
      deepLink: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code}`,
      expiresInMinutes: CODE_TTL_MINUTES,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
