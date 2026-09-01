import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

/** Reverses POST /api/user/pause — see that route's own comment. */
export async function POST() {
  try {
    const { accountId } = await requireRole("user");
    await prisma.user.update({ where: { id: accountId }, data: { paused: false } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
