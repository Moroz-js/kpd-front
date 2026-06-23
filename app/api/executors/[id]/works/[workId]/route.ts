import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, isExecutor } from "@/lib/permissions";
import { updateWork, deleteWork } from "@/lib/services/works";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  projectId: z.string().optional(),
  workTypeId: z.string().optional(),
  executionYear: z.number().int().min(2020).max(2100).optional(),
  executionMonth: z.number().int().min(1).max(12).optional(),
  techTask: z.string().optional(),
  report: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  volume: z.number().nullable().optional(),
  rate: z.number().nullable().optional(),
  amount: z.number().positive().optional(),
  plannedPayAt: z.string().nullable().optional(),
  responsibleExecutorId: z.string().nullable().optional(),
  workStatus: z.enum(["submitted", "checked", "rework"]).optional(),
  comment: z.string().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string; workId: string }> };

async function resolveWork(workId: string) {
  return prisma.work.findUnique({ where: { id: workId } });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id: executorId, workId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const work = await resolveWork(workId);
  if (!work || work.executorId !== executorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // checked-работы — только admin
  if (work.workStatus === "checked" && !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isAdmin(user) && !(isExecutor(user) && user.executorId === executorId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const updated = await updateWork(workId, parsed.data, user.id);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id: executorId, workId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const work = await resolveWork(workId);
  if (!work || work.executorId !== executorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // checked-работы — только admin
  if (work.workStatus === "checked" && !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isAdmin(user) && !(isExecutor(user) && user.executorId === executorId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteWork(workId, user.id);
  return NextResponse.json({ ok: true });
}
