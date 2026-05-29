import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, isExecutor } from "@/lib/permissions";
import { updateVacation, deleteVacation } from "@/lib/services/vacations";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  secondStartAt: z.string().nullable().optional(),
  secondEndAt: z.string().nullable().optional(),
  substituteContacts: z.string().nullable().optional(),
  status: z.enum(["need_approval", "approved"]).optional(),
});

type Ctx = { params: Promise<{ id: string; vacationId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id: executorId, vacationId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.vacationEntry.findUnique({ where: { id: vacationId } });
  if (!entry || entry.executorId !== executorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // approved-запись: только admin может редактировать
  if (entry.status === "approved" && !isAdmin(user)) {
    return NextResponse.json(
      { error: "Нельзя редактировать согласованный отпуск" },
      { status: 403 }
    );
  }

  if (!isAdmin(user) && !(isExecutor(user) && user.executorId === executorId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Только admin может менять статус
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  if (parsed.data.status && !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const updated = await updateVacation(vacationId, parsed.data, user.id);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id: executorId, vacationId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.vacationEntry.findUnique({ where: { id: vacationId } });
  if (!entry || entry.executorId !== executorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (entry.status === "approved" && !isAdmin(user)) {
    return NextResponse.json(
      { error: "Нельзя удалить согласованный отпуск" },
      { status: 403 }
    );
  }

  if (!isAdmin(user) && !(isExecutor(user) && user.executorId === executorId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteVacation(vacationId, user.id);
  return NextResponse.json({ ok: true });
}
