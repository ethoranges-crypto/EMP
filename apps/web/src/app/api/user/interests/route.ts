import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";

export async function GET() {
  try {
    const { accountId } = await requireRole("user");
    const [categories, selected] = await Promise.all([
      prisma.category.findMany({ where: { active: true } }),
      prisma.userInterest.findMany({ where: { userId: accountId }, select: { categoryId: true } }),
    ]);
    const selectedIds = new Set(selected.map((s) => s.categoryId));
    return NextResponse.json({
      categories: categories.map((c) => ({ id: c.id, name: c.name, selected: selectedIds.has(c.id) })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}

interface PutBody {
  categoryIds: string[];
}

export async function PUT(request: Request) {
  try {
    const { accountId } = await requireRole("user");
    const { categoryIds } = (await request.json()) as PutBody;

    await prisma.$transaction([
      prisma.userInterest.deleteMany({ where: { userId: accountId } }),
      prisma.userInterest.createMany({
        data: categoryIds.map((categoryId) => ({ userId: accountId, categoryId })),
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
