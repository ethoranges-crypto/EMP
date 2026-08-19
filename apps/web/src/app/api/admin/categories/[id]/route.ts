import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { UnauthorizedError, requireRole } from "@/lib/session";
import { prismaErrorCode } from "@/lib/prismaErrors";

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 40;

interface PatchBody {
  name?: string;
  active?: boolean;
}

/** Rename and/or activate/deactivate a category (SPEC §7 — admin-configured, not hardcoded). Deactivating doesn't delete: past campaigns/interests keep referencing it, it just stops being offered as a choice going forward (see the active:true filters on /api/protocol/categories and /api/user/interests). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accountId: adminAddress } = await requireRole("admin");
    const { id } = await params;
    const { name, active } = (await request.json()) as PatchBody;

    const data: { name?: string; active?: boolean } = {};
    if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.` },
          { status: 400 },
        );
      }
      data.name = trimmed;
    }
    if (active !== undefined) data.active = active;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update — pass name and/or active." }, { status: 400 });
    }

    let category;
    try {
      category = await prisma.category.update({ where: { id }, data });
    } catch (err) {
      const code = prismaErrorCode(err);
      if (code === "P2002") {
        return NextResponse.json({ error: `A category named "${data.name}" already exists.` }, { status: 409 });
      }
      if (code === "P2025") {
        return NextResponse.json({ error: "Category not found." }, { status: 404 });
      }
      throw err;
    }

    await prisma.adminAction.create({
      data: { adminId: adminAddress, action: "category.update", targetType: "Category", targetId: id, metadata: data },
    });

    return NextResponse.json({ id: category.id, name: category.name, active: category.active });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
