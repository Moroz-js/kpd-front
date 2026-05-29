import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createOtherExpense, listOtherExpenses } from "@/lib/services/other-expenses";
import { z } from "zod";

function canAccess(user: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!user) return false;
  return user.role === "admin" || user.role === "responsible";
}

const createSchema = z.object({
  projectId: z.string().min(1),
  executorId: z.string().min(1),
  workTypeId: z.string().min(1),
  responsibleUserId: z.string().min(1),
  bankAccountId: z.string().nullable().optional(),
  executionYear: z.number().int().min(2020).max(2100),
  executionMonth: z.number().int().min(1).max(12),
  description: z.string().min(1),
  amount: z.number().min(0),
  paymentAmount: z.number().nullable().optional(),
  preferredPayMethod: z.string().nullable().optional(),
  plannedPayAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !canAccess(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await listOtherExpenses();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !canAccess(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!user.id) return NextResponse.json({ error: "Сессия недействительна" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте обязательные поля", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Responsible может указать только себя как ответственного
  if (!isAdmin(user) && parsed.data.responsibleUserId !== user.id) {
    return NextResponse.json({ error: "Можно назначить только себя ответственным" }, { status: 403 });
  }

  try {
    const expense = await createOtherExpense(parsed.data, user.id);
    return NextResponse.json(expense, { status: 201 });
  } catch (e) {
    console.error("[other-expenses] POST failed:", e);
    const msg = e instanceof Error ? e.message : "Не удалось создать запись";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
