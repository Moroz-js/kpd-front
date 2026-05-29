import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: projectId } = await params;
  const rows = await prisma.projectExecutor.findMany({
    where: { projectId },
    select: { executorId: true },
  });

  return NextResponse.json(rows.map((r) => r.executorId));
}

const putSchema = z.object({
  executorIds: z.array(z.string()),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: projectId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation" }, { status: 422 });

  const { executorIds } = parsed.data;

  await prisma.$transaction([
    prisma.projectExecutor.deleteMany({ where: { projectId } }),
    prisma.projectExecutor.createMany({
      data: executorIds.map((executorId) => ({ projectId, executorId })),
      skipDuplicates: true,
    }),
  ]);

  return NextResponse.json({ ok: true });
}
