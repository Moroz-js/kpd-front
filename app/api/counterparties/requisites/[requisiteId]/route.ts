import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { deleteRequisite, updateRequisite } from "@/lib/services/counterparties";
import { COUNTERPARTY_PAYMENT_METHODS } from "@/lib/statuses";

const patchSchema = z.object({
  paymentMethod: z
    .enum(Object.keys(COUNTERPARTY_PAYMENT_METHODS) as [string, ...string[]])
    .optional(),
  taxId: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  cardNumber: z.string().nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
  comment: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ requisiteId: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { requisiteId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    return NextResponse.json(await updateRequisite(requisiteId, parsed.data, me.id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ requisiteId: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { requisiteId } = await ctx.params;
  try {
    await deleteRequisite(requisiteId, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
