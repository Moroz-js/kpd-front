import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canViewExecutorEstimate, isAdmin, isExecutor } from "@/lib/permissions";
import { createWork, listWorksForExecutor } from "@/lib/services/works";
import { z } from "zod";

const createSchema = z.object({
  projectId: z.string().min(1),
  workTypeId: z.string().min(1),
  executionYear: z.number().int().min(2020).max(2100),
  executionMonth: z.number().int().min(1).max(12),
  techTask: z.string().min(1),
  report: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  volume: z.number().nullable().optional(),
  rate: z.number().nullable().optional(),
  amount: z.number().min(0),
  plannedPayAt: z.string().nullable().optional(),
  filledTechTask: z.string().nullable().optional(),
  filledAct: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executorId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await canViewExecutorEstimate(user, executorId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const works = await listWorksForExecutor(executorId);
  return NextResponse.json(works);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executorId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Только admin или сам исполнитель
  if (!isAdmin(user) && !(isExecutor(user) && user.executorId === executorId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const work = await createWork(executorId, parsed.data, user.id);
  return NextResponse.json(work, { status: 201 });
}
