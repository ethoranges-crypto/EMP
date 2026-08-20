import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * SPEC §4.2: persists the "you're approved" banner's dismissal on the
 * protocol record itself, so it stays gone across future logins — a
 * client-only (React state) dismiss reappears on every fresh session,
 * which is the bug this closes.
 */
export async function POST() {
  try {
    const { accountId } = await requireRole("protocol");
    await prisma.protocol.update({ where: { id: accountId }, data: { approvedBannerDismissed: true } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
