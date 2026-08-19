import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * Minimum viable admin view (SPEC §4.2's approval gate) — the pending
 * queue an admin cross-references against each protocol's out-of-band
 * proof (wallet address confirmed via DM). requireRole("admin") is the
 * real gate; this isn't the privacy boundary CLAUDE.md rule 1 protects —
 * that's about protocols never seeing individual *users*. A protocol's own
 * wallet/name is the thing an admin is here to look at.
 */
export async function GET() {
  try {
    await requireRole("admin");
    const protocols = await prisma.protocol.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, wallet: true, accountType: true, safeAddress: true, createdAt: true },
    });
    return NextResponse.json({ protocols });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
