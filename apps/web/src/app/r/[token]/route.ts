import { NextResponse } from "next/server";
import { prisma } from "@emp/db";

/**
 * SPEC §3.4 / §8: the only reliable engagement signal. Every CTA a
 * recipient sees is rewritten to point here first — logs the click, then
 * 302s to the real URL.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const clickToken = await prisma.clickToken.findUnique({ where: { token }, include: { cta: true } });
  if (!clickToken) {
    return NextResponse.json({ error: "Unknown link" }, { status: 404 });
  }

  await prisma.clickEvent.create({
    data: { ctaId: clickToken.ctaId, campaignId: clickToken.campaignId, recipientId: clickToken.recipientId },
  });

  return NextResponse.redirect(clickToken.cta.targetUrl, { status: 302 });
}
