import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

interface Body {
  decision: "APPROVED" | "REJECTED";
  notes?: string;
}

/** SPEC §4.2: un-approved protocols cannot create or send campaigns. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId: adminAddress } = await requireRole("admin");
    const { id: protocolId } = await params;
    const { decision, notes } = (await request.json()) as Body;

    const protocol = await prisma.protocol.update({
      where: { id: protocolId },
      data: { status: decision, approvalNotes: notes },
    });

    await prisma.adminAction.create({
      data: {
        adminId: adminAddress,
        action: `protocol.${decision.toLowerCase()}`,
        targetType: "Protocol",
        targetId: protocolId,
        metadata: notes ? { notes } : undefined,
      },
    });

    return NextResponse.json({ ok: true, status: protocol.status });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
