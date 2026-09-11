import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { deleteRecognitionRule, updateRecognitionRule } from "@/lib/services/recognitionRules";

const patchSchema = z.object({
  matchValue: z.string().min(1).optional(),
  counterpartyId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  workTypeId: z.string().nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
  comment: z.string().nullable().optional(),
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
      { status: 422 }
    );
  }

  try {
    return NextResponse.json(await updateRecognitionRule(id, parsed.data, me.id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Правило с таким признаком уже есть" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    await deleteRecognitionRule(id, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
