import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireAccount } from "@/lib/session";

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;
const X_HANDLE_MIN_LENGTH = 2;
const X_HANDLE_MAX_LENGTH = 16; // X's own handle length cap, excluding the "@"

/**
 * Self-service status for the protocol journey UI (SPEC §4.2). Mirrors
 * /api/user/me's shape/role: this is the caller's own application, not a
 * protocol-facing view of other data, so the privacy boundary (CLAUDE.md
 * rule 1) doesn't apply here.
 */
export async function GET() {
  try {
    const { account: protocol } = await requireAccount("protocol", (id) =>
      prisma.protocol.findUniqueOrThrow({ where: { id } }),
    );
    return NextResponse.json({
      wallet: protocol.wallet,
      accountType: protocol.accountType,
      safeAddress: protocol.safeAddress,
      name: protocol.name,
      xHandle: protocol.xHandle,
      status: protocol.status,
      approvalNotes: protocol.approvalNotes,
      approvedBannerDismissed: protocol.approvedBannerDismissed,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}

interface PostBody {
  name: string;
  xHandle: string;
}

/**
 * Submit (or resubmit after rejection) the application. SPEC §4.2's actual
 * approval proof is out-of-band (a DM confirming the wallet address the
 * SIWE signature already proved ownership of) — name and xHandle are just
 * what an admin sees next to that wallet in the pending queue to
 * cross-reference against that DM, so there's nothing else to collect here.
 *
 * Resubmitting after a rejection puts the protocol back in PENDING and
 * clears the old rejection notes — a fresh attempt, not an appeal. Once a
 * decision has been made the other direction (APPROVED) or the protocol has
 * been SUSPENDED, this isn't the right path for changing these fields —
 * refuse rather than silently reopening a decided application.
 */
export async function POST(request: Request) {
  try {
    const { account: protocol, accountId } = await requireAccount("protocol", (id) =>
      prisma.protocol.findUniqueOrThrow({ where: { id } }),
    );
    const { name, xHandle } = (await request.json()) as PostBody;
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedHandle = typeof xHandle === "string" ? xHandle.trim().replace(/^@+/, "") : "";

    if (trimmedName.length < NAME_MIN_LENGTH || trimmedName.length > NAME_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.` },
        { status: 400 },
      );
    }

    if (trimmedHandle.length < X_HANDLE_MIN_LENGTH || trimmedHandle.length > X_HANDLE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `X handle must be between ${X_HANDLE_MIN_LENGTH} and ${X_HANDLE_MAX_LENGTH} characters.` },
        { status: 400 },
      );
    }

    if (protocol.status === "APPROVED" || protocol.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Your application has already been decided. Contact EMP to change your details." },
        { status: 409 },
      );
    }

    const updated = await prisma.protocol.update({
      where: { id: accountId },
      data: {
        name: trimmedName,
        xHandle: `@${trimmedHandle}`,
        status: "PENDING",
        approvalNotes: null,
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
