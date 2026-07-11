import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { listChargeIds } from "@/lib/services/charges";
import type { ChargesFilter } from "@/lib/services/charges";

const filterSchema = z.object({
  bankAccountId: z.array(z.string()).optional(),
  orderId: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  clientId: z.array(z.string()).optional(),
  clientIdHasEmpty: z.boolean().optional(),
  projectId: z.array(z.string()).optional(),
  projectIdHasEmpty: z.boolean().optional(),
  payWeek: z.array(z.string()).optional(),
  hidePaid: z.boolean().optional(),
});

const schema = z
  .object({
    ids: z.array(z.string()).optional(),
    selectAll: z.boolean().optional(),
    filter: filterSchema.optional(),
    patch: z.object({
      status: z.string().optional(),
    }),
  })
  .refine((d) => (d.ids?.length ?? 0) > 0 || d.selectAll === true, {
    message: "Укажите ids или selectAll",
  });

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation", details: parsed.error.flatten() }, { status: 400 });
  }

  const { ids: rawIds, selectAll, filter, patch } = parsed.data;
  const data: Record<string, unknown> = {};
  if (patch.status) data.status = patch.status;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const ids = selectAll
    ? await listChargeIds((filter ?? {}) as ChargesFilter)
    : (rawIds ?? []);

  const result = await prisma.charge.updateMany({
    where: { id: { in: ids } },
    data,
  });

  return NextResponse.json({ updated: result.count });
}
