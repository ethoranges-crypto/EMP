import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { createPrismaTelegramLinkStore, unlinkTelegram } from "@emp/core";
import { UnauthorizedError, requireRole } from "@/lib/session";

/** Self-service unlink (SPEC §4.1: "user can ... re-link/unlink Telegram ... at any time"). */
export async function DELETE() {
  try {
    const { accountId } = await requireRole("user");
    const store = createPrismaTelegramLinkStore(prisma);
    const result = await unlinkTelegram(store, { userId: accountId, reason: "USER_UNLINK" });
    return NextResponse.json({ ok: true, unlinked: result !== null });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
