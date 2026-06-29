import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canCheckOtherExpense } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { checkOtherExpense } from "@/lib/services/other-expenses";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.otherExpense.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canCheckOtherExpense(user, row)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const updated = await checkOtherExpense(id, user.id);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка" }, { status: 400 });
  }
}
