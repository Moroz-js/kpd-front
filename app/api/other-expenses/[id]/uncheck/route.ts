import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessOtherExpenses, canRevertOtherExpenseCheck } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { revertOtherExpenseCheck } from "@/lib/services/other-expenses";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  targetStatus: z.enum(["submitted", "rework"]),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !canAccessOtherExpenses(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.otherExpense.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canRevertOtherExpenseCheck(user, row)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const updated = await revertOtherExpenseCheck(id, parsed.data.targetStatus, user.id);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось откатить";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
