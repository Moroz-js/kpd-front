import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { canViewExecutorEstimate, isAdmin } from "@/lib/permissions";
import { updateExecutor } from "@/lib/services/executors";
import { prisma } from "@/lib/db";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const allowed = await canViewExecutorEstimate(me, id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const executor = await prisma.executor.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, fullName: true, isActive: true } },
      responsibleUser: { select: { id: true, fullName: true } },
      defaultBankAccount: { select: { id: true, name: true } },
      executorWorkTypes: { include: { workType: { select: { id: true, name: true, segment: true } } } },
      projectExecutors: {
        include: { project: { select: { id: true, name: true, status: true } } },
        orderBy: { project: { name: "asc" } },
      },
    },
  });

  if (!executor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(executor);
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  companyStatus: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
  contacts: z.string().nullable().optional(),
  requisites: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  inTgChat: z.boolean().optional(),
  contractFile: z.string().nullable().optional(),
  ndaFile: z.string().nullable().optional(),
  recipientTypes: z.array(z.string()).optional(),
  recipientType: z.string().nullable().optional(),
  responsibleUserId: z.string().nullable().optional(),
  defaultBankAccountId: z.string().nullable().optional(),
  oldEstimateUrl: z.string().nullable().optional(),
  entityForm: z.string().nullable().optional(),
  specialties: z.string().nullable().optional(),
  isResponsible: z.boolean().optional(),
  workTypeIds: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const updated = await updateExecutor(id, parsed.data, me.id);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg.startsWith("Нельзя") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
