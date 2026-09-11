import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { listRecognitionRules, upsertRecognitionRule } from "@/lib/services/recognitionRules";
import { RULE_MATCH_FIELDS, RULE_TARGETS } from "@/lib/statuses";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(await listRecognitionRules());
}

const createSchema = z.object({
  target: z.enum(Object.keys(RULE_TARGETS) as [string, ...string[]]),
  matchField: z.enum(Object.keys(RULE_MATCH_FIELDS) as [string, ...string[]]),
  matchValue: z.string().min(1, "Введите значение признака"),
  counterpartyId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  workTypeId: z.string().nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  comment: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const rule = await upsertRecognitionRule(parsed.data, me.id);
    return NextResponse.json(rule, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.startsWith("Правило") || msg.startsWith("Пустое")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
