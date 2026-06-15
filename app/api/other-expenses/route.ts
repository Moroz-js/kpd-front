import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, isResponsible, canAccessOtherExpenses } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { createOtherExpense, listOtherExpenses } from "@/lib/services/other-expenses";
import { prismaErrorMessage } from "@/lib/prisma-errors";
import { z } from "zod";

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
  if (!user || !canAccessOtherExpenses(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Постоянный исполнитель видит только свои строки (создатель/ответственный).
  const scopeUserId = isAdmin(user) || isResponsible(user) ? undefined : user.id;
  const data = await listOtherExpenses({ scopeUserId });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !canAccessOtherExpenses(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!user.id) return NextResponse.json({ error: "Сессия недействительна" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте обязательные поля", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // PM (ответственный) может указать только себя. Постоянный исполнитель
  // ответственным не является — выбирает ответственного из списка.
  if (!isAdmin(user) && isResponsible(user) && parsed.data.responsibleUserId !== user.id) {
    return NextResponse.json({ error: "Можно назначить только себя ответственным" }, { status: 403 });
  }

  const responsibleExists = await prisma.user.findUnique({
    where: { id: parsed.data.responsibleUserId },
    select: { id: true },
  });
  if (!responsibleExists) {
    return NextResponse.json({ error: "Выбранный ответственный не найден в системе" }, { status: 422 });
  }

  try {
    const expense = await createOtherExpense(parsed.data, user.id);
    return NextResponse.json(expense, { status: 201 });
  } catch (e) {
    console.error("[other-expenses] POST failed:", e);
    return NextResponse.json(
      { error: prismaErrorMessage(e, "Не удалось создать запись") },
      { status: 500 },
    );
  }
}
