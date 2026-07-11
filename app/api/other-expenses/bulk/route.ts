import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { updateOtherExpense, listOtherExpenseIds } from "@/lib/services/other-expenses";
import type { OtherExpensesFilter } from "@/lib/services/other-expenses";

const filterSchema = z.object({
  executionYear: z.array(z.number()).optional(),
  executionMonth: z.array(z.number()).optional(),
  projectId: z.array(z.string()).optional(),
  executorId: z.array(z.string()).optional(),
  workTypeId: z.array(z.string()).optional(),
  responsibleExecutorId: z.array(z.string()).optional(),
  responsibleExecutorIdHasEmpty: z.boolean().optional(),
  workStatus: z.array(z.string()).optional(),
  paymentStatus: z.array(z.string()).optional(),
  paymentStatusHasEmpty: z.boolean().optional(),
});

const bulkSchema = z
  .object({
    ids: z.array(z.string()).optional(),
    selectAll: z.boolean().optional(),
    filter: filterSchema.optional(),
    patch: z.object({
      workStatus: z.enum(["submitted", "checked", "paid", "rework"]).optional(),
      paymentStatus: z.enum(["planned", "sent", "paid"]).optional(),
      plannedPayAt: z.string().nullable().optional(),
      paidAt: z.string().nullable().optional(),
      bankAccountId: z.string().nullable().optional(),
    }),
  })
  .refine((d) => (d.ids?.length ?? 0) > 0 || d.selectAll === true, {
    message: "Укажите ids или selectAll",
  });

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation", details: parsed.error.flatten() }, { status: 400 });

  const { ids: rawIds, selectAll, filter, patch } = parsed.data;
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ updated: 0 });

  const ids = selectAll
    ? await listOtherExpenseIds((filter ?? {}) as OtherExpensesFilter)
    : (rawIds ?? []);

  let updated = 0;
  for (const id of ids) {
    try {
      await updateOtherExpense(id, patch, user.id);
      updated++;
    } catch { /* skip */ }
  }

  return NextResponse.json({ updated });
}
