import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

/**
 * Read-only taxonomy for the campaign-targeting UI (SPEC §7: protocols
 * target by the same admin-configured category list users pick from). Just
 * category id/name — no user data anywhere near this table, so no privacy
 * boundary concern here (contrast with audience-count, which is).
 */
export async function GET() {
  try {
    await requireRole("protocol");
    const categories = await prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ categories: categories.map((c) => ({ id: c.id, name: c.name })) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
