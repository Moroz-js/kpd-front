import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import {
  setBankOperationCharges,
  markBankOperationWithoutCharge,
} from "@/lib/services/bankOperations";

const putSchema = z.object({
  /** Пустой список = снять привязку. */
  charges: z.array(z.object({ chargeId: z.string(), amount: z.number().nullable().optional() })),
  /** true = операция не участвует в сверке («Без начисления»). */
  withoutCharge: z.boolean().optional(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.withoutCharge) {
      await markBankOperationWithoutCharge(id, me.id);
      return NextResponse.json({ ok: true });
    }
    const updated = await setBankOperationCharges(id, parsed.data.charges, me.id);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("not found")) {
      return NextResponse.json({ error: "Операция не найдена" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
