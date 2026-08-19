import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;

/**
 * Self-service status for the protocol journey UI (SPEC §4.2). Mirrors
 * /api/user/me's shape/role: this is the caller's own application, not a
 * protocol-facing view of other data, so the privacy boundary (CLAUDE.md
 * rule 1) doesn't apply here.
 */
export async function GET() {
  try {
    const { accountId } = await requireRole("protocol");
    const protocol = await prisma.protocol.findUniqueOrThrow({ where: { id: accountId } });
    return NextResponse.json({
      wallet: protocol.wallet,
      accountType: protocol.accountType,
      safeAddress: protocol.safeAddress,
      name: protocol.name,
      status: protocol.status,
      approvalNotes: protocol.approvalNotes,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}

interface PostBody {
  name: string;
}

/**
 * Submit (or resubmit after rejection) the application. SPEC §4.2's actual
 * approval proof is out-of-band (a DM confirming the wallet address the
 * SIWE signature already proved ownership of) — this is just the display
 * name an admin sees next to that wallet in the pending queue, so there's
 * nothing else to collect here.
 *
 * Resubmitting after a rejection puts the protocol back in PENDING and
 * clears the old rejection notes — a fresh attempt, not an appeal. Once a
 * decision has been made the other direction (APPROVED) or the protocol has
 * been SUSPENDED, this isn't the right path for changing the name — refuse
 * rather than silently reopening a decided application.
 */
export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole("protocol");
    const { name } = (await request.json()) as PostBody;
    const trimmed = typeof name === "string" ? name.trim() : "";

    if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.` },
        { status: 400 },
      );
    }

    const protocol = await prisma.protocol.findUniqueOrThrow({ where: { id: accountId } });
    if (protocol.status === "APPROVED" || protocol.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Your application has already been decided. Contact EMP to change your details." },
        { status: 409 },
      );
    }

    const updated = await prisma.protocol.update({
      where: { id: accountId },
      data: { name: trimmed, status: "PENDING", approvalNotes: null },
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
