import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * Self-service opt-out ("Signal paused"). Takes effect immediately: the
 * audience-count/snapshot chokepoints (countMessageableUsers,
 * listMessageableChatIds in packages/core) both exclude paused:true, so a
 * campaign approved after this call — or one whose count a protocol checks
 * right now — simply never includes this user, with no separate step.
 * Interests and the Telegram link are untouched; resuming (POST
 * /api/user/resume) is the only way back.
 */
export async function POST() {
  try {
    const { accountId } = await requireRole("user");
    await prisma.user.update({ where: { id: accountId }, data: { paused: true } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
