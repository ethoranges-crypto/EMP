import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";
import { prismaErrorCode } from "@/lib/prismaErrors";

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 40;

/** SPEC §7: the admin-configured interest taxonomy. Includes inactive categories too, unlike /api/protocol/categories — an admin needs to see them to reactivate. */
export async function GET() {
  try {
    await requireRole("admin");
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({
      categories: categories.map((c) => ({ id: c.id, name: c.name, active: c.active })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}

interface PostBody {
  name: string;
}

export async function POST(request: Request) {
  try {
    const { accountId: adminAddress } = await requireRole("admin");
    const { name } = (await request.json()) as PostBody;
    const trimmed = typeof name === "string" ? name.trim() : "";

    if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.` },
        { status: 400 },
      );
    }

    let category;
    try {
      category = await prisma.category.create({ data: { name: trimmed, active: true } });
    } catch (err) {
      if (prismaErrorCode(err) === "P2002") {
        return NextResponse.json({ error: `A category named "${trimmed}" already exists.` }, { status: 409 });
      }
      throw err;
    }

    await prisma.adminAction.create({
      data: { adminId: adminAddress, action: "category.create", targetType: "Category", targetId: category.id },
    });

    return NextResponse.json({ id: category.id, name: category.name, active: category.active }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
