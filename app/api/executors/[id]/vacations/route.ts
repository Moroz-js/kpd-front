import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canViewExecutorEstimate, isAdmin, isExecutor } from "@/lib/permissions";
import { createVacation, listVacationsForExecutor } from "@/lib/services/vacations";
import { z } from "zod";

const createSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  secondStartAt: z.string().nullable().optional(),
  secondEndAt: z.string().nullable().optional(),
  substituteContacts: z.string().nullable().optional(),
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

  const entries = await listVacationsForExecutor(executorId);
  return NextResponse.json(entries);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executorId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  try {
    const entry = await createVacation(executorId, parsed.data, user.id);
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
