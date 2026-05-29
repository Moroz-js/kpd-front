import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { updateOtherExpense, deleteOtherExpense } from "@/lib/services/other-expenses";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  projectId: z.string().optional(),
  executorId: z.string().optional(),
  workTypeId: z.string().optional(),
  responsibleUserId: z.string().optional(),
  bankAccountId: z.string().nullable().optional(),
  executionYear: z.number().int().min(2020).max(2100).optional(),
  executionMonth: z.number().int().min(1).max(12).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  paymentAmount: z.number().nullable().optional(),
  preferredPayMethod: z.string().nullable().optional(),
  plannedPayAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  workStatus: z.enum(["submitted", "checked", "paid", "rework"]).optional(),
  paymentStatus: z.enum(["planned", "paid"]).optional(),
  comment: z.string().nullable().optional(),
});

function canEdit(user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>, row: { workStatus: string; createdById: string; responsibleUserId: string }) {
  if (user.role === "admin") return true;
  if (row.workStatus === "checked") return false; // только admin
  // responsible — если создатель или текущий ответственный
  return row.createdById === user.id || row.responsibleUserId === user.id;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "responsible")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.otherExpense.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(user, row)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation", details: parsed.error.flatten() }, { status: 422 });

  // Responsible не может менять ответственного на другого
  if (!isAdmin(user) && parsed.data.responsibleUserId && parsed.data.responsibleUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await updateOtherExpense(id, parsed.data, user.id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "responsible")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.otherExpense.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(user, row)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await deleteOtherExpense(id, user.id);
  return NextResponse.json({ ok: true });
}
