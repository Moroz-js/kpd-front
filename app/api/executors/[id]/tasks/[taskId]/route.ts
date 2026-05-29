import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, isExecutor } from "@/lib/permissions";
import { updateTask, deleteTask } from "@/lib/services/tasks";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(["pending", "in_progress", "paused", "review", "done"]).optional(),
  plannedDoneAt: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string; taskId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id: executorId, taskId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.executorId !== executorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Admin может всё; executor — только status/result/comment, не title/plannedDoneAt
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

  // Executor не может менять title и plannedDoneAt
  if (!isAdmin(user)) {
    if (parsed.data.title !== undefined || parsed.data.plannedDoneAt !== undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const updated = await updateTask(taskId, parsed.data, user.id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id: executorId, taskId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.executorId !== executorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteTask(taskId, user.id);
  return NextResponse.json({ ok: true });
}
