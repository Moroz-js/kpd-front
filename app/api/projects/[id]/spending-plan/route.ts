import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit/log";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

function canManage(user: Awaited<ReturnType<typeof getSessionUser>>, project: { responsibleUserId: string | null }) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return project.responsibleUserId === user.id;
}

const upsertSchema = z.object({
  executorId: z.string().min(1),
  workTypeId: z.string().min(1),
  year: z.number().int(),
  week: z.number().int().min(1).max(53),
  amount: z.number().min(0),
  sourceType: z.string().nullable().optional(),
});

const deleteSchema = z.object({ id: z.string().min(1) });

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: projectId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { responsibleUserId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManage(user, project)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation", details: parsed.error.flatten() }, { status: 422 });

  const { executorId, workTypeId, year, week, amount, sourceType } = parsed.data;

  // Upsert: один line на (projectId, executorId, workTypeId, year, week)
  const existing = await prisma.spendingPlanLine.findFirst({
    where: { projectId, executorId, workTypeId, year, week },
  });

  let line;
  if (existing) {
    line = await prisma.spendingPlanLine.update({ where: { id: existing.id }, data: { amount } });
  } else {
    // При создании новой строки разрешаем amount=0 (строка-якорь, суммы вносятся инлайн)
    line = await prisma.spendingPlanLine.create({
      data: { projectId, executorId, workTypeId, year, week, amount, sourceType: sourceType ?? null, createdById: user.id },
    });
  }

  const action = !existing ? "create" : "update";
  await logActivity({
    userId: user.id,
    action,
    entityType: "SpendingPlanLine",
    entityId: line?.id ?? existing?.id ?? "",
    entityLabel: `Нед. ${week} / ${year}`,
  });

  return NextResponse.json(line ?? { deleted: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id: projectId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { responsibleUserId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManage(user, project)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation" }, { status: 422 });

  await prisma.spendingPlanLine.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
