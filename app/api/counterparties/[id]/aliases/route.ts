import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { addAlias } from "@/lib/services/counterparties";
import { COUNTERPARTY_ALIAS_SOURCES } from "@/lib/statuses";

const createSchema = z.object({
  value: z.string().min(1, "Введите написание из выписки"),
  source: z.enum(Object.keys(COUNTERPARTY_ALIAS_SOURCES) as [string, ...string[]]).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const created = await addAlias(id, parsed.data.value, parsed.data.source ?? "manual", me.id);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
    // Написание уже висит на другом контрагенте — автоопределение получило бы два ответа.
    if (msg.startsWith("Написание")) return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
