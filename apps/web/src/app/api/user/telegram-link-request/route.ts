import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { loadEnv } from "@emp/config";
import { UnauthorizedError, requireRole } from "@/lib/session";

const CODE_TTL_MINUTES = 15;

/** SPEC §3.1: the one-time-code step, redeemed by apps/bot's /start handler. */
export async function POST() {
  try {
    const { accountId } = await requireRole("user");
    const env = loadEnv();
    const code = randomBytes(9).toString("base64url");

    await prisma.linkRequest.create({
      data: {
        userId: accountId,
        code,
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
      },
    });

    return NextResponse.json({
      deepLink: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code}`,
      expiresInMinutes: CODE_TTL_MINUTES,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
