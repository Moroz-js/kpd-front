import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, isResponsible } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  cashflowCommentMapKey,
  CASHFLOW_HIGHLIGHT_IDS,
  type CashflowCellMeta,
} from "@/lib/cashflow-comments";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user) && !isResponsible(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (Number.isNaN(year)) return NextResponse.json({ error: "Invalid year" }, { status: 422 });

  const rows = await prisma.cashflowCellComment.findMany({
    where: { year },
    select: { rowKey: true, week: true, text: true, highlight: true },
  });

  const map: Record<string, CashflowCellMeta> = {};
  for (const r of rows) {
    const text = r.text.trim();
    const highlight =
      r.highlight && CASHFLOW_HIGHLIGHT_IDS.includes(r.highlight as (typeof CASHFLOW_HIGHLIGHT_IDS)[number])
        ? (r.highlight as CashflowCellMeta["highlight"])
        : null;
    if (!text && !highlight) continue;
    map[cashflowCommentMapKey(r.rowKey, r.week)] = { text, highlight };
  }
  return NextResponse.json(map);
}

const putSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  week: z.number().int().min(1).max(53),
  rowKey: z.string().min(1).max(200),
  text: z.string().max(5000).optional().default(""),
  highlight: z.enum(CASHFLOW_HIGHLIGHT_IDS).nullable().optional(),
});

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user) && !isResponsible(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation" }, { status: 422 });

  const { year, week, rowKey } = parsed.data;
  const text = (parsed.data.text ?? "").trim();
  const highlight = parsed.data.highlight ?? null;

  if (!text && !highlight) {
    await prisma.cashflowCellComment.deleteMany({
      where: { year, week, rowKey },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.cashflowCellComment.upsert({
    where: { year_week_rowKey: { year, week, rowKey } },
    update: { text, highlight },
    create: { year, week, rowKey, text, highlight, createdById: user.id },
  });

  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  week: z.number().int().min(1).max(53),
  rowKey: z.string().min(1).max(200),
});

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user) && !isResponsible(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation" }, { status: 422 });

  await prisma.cashflowCellComment.deleteMany({
    where: parsed.data,
  });
  return NextResponse.json({ ok: true });
}
