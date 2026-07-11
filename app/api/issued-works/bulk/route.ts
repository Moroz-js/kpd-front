import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { updateIssuedWork, canReviewIssuedSource } from "@/lib/services/issuedWorks";
import { WORK_STATUSES_SETTABLE } from "@/lib/statuses";
import { listIssuedWorkIds } from "@/lib/views/issuedWorks";
import type { IssuedWorksFilter } from "@/lib/views/issuedWorks";

const filterSchema = z.object({
  yearPlanFact: z.array(z.number()).optional(),
  yearPlanFactHasEmpty: z.boolean().optional(),
  executionYear: z.array(z.number()).optional(),
  executionMonth: z.array(z.number()).optional(),
  weekPlanFact: z.array(z.number()).optional(),
  weekPlanFactHasEmpty: z.boolean().optional(),
  executorId: z.array(z.string()).optional(),
  projectId: z.array(z.string()).optional(),
  workTypeId: z.array(z.string()).optional(),
  workStatus: z.array(z.string()).optional(),
  sourceType: z.array(z.enum(["personal", "other-expense"])).optional(),
});

const bulkSchema = z
  .object({
    ids: z.array(z.string()).optional(),
    selectAll: z.boolean().optional(),
    filter: filterSchema.optional(),
    patch: z.object({
      workStatus: z.enum(WORK_STATUSES_SETTABLE).optional(),
      plannedPayAt: z.string().nullable().optional(),
    }),
  })
  .refine((d) => (d.ids?.length ?? 0) > 0 || d.selectAll === true, {
    message: "Укажите ids или selectAll",
  });

function parseId(id: string): { sourceType: "personal" | "other-expense"; sourceId: string } | null {
  const idx = id.indexOf(":");
  if (idx < 0) return null;
  const sourceType = id.slice(0, idx);
  const sourceId = id.slice(idx + 1);
  if (sourceType !== "personal" && sourceType !== "other-expense") return null;
  if (!sourceId) return null;
  return { sourceType, sourceId };
}

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation", details: parsed.error.flatten() }, { status: 400 });

  const { ids: rawIds, selectAll, filter, patch } = parsed.data;
  if (Object.keys(patch).length === 0) return NextResponse.json({ updated: 0 });

  const admin = isAdmin(me);
  if (!admin && patch.plannedPayAt !== undefined) {
    return NextResponse.json({ error: "Можно менять только статус" }, { status: 403 });
  }

  const ids = selectAll
    ? await listIssuedWorkIds((filter ?? {}) as IssuedWorksFilter)
    : (rawIds ?? []);

  let updated = 0;
  for (const id of ids) {
    const parsedId = parseId(id);
    if (!parsedId) continue;
    try {
      if (!admin && !(await canReviewIssuedSource(me, parsedId.sourceType, parsedId.sourceId))) {
        continue;
      }
      const patchForService = {
        ...patch,
        plannedPayAt: patch.plannedPayAt === undefined
          ? undefined
          : patch.plannedPayAt ? new Date(patch.plannedPayAt) : null,
      };
      await updateIssuedWork(parsedId.sourceType, parsedId.sourceId, patchForService, me.id);
      updated++;
    } catch { /* skip */ }
  }

  return NextResponse.json({ updated });
}
