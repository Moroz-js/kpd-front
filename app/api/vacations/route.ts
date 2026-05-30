import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function weeksInRange(start: Date, end: Date): number[] {
  const weeks = new Set<number>();
  const cur = new Date(start);
  while (cur <= end) {
    weeks.add(isoWeek(cur));
    cur.setDate(cur.getDate() + 7);
  }
  weeks.add(isoWeek(end));
  return Array.from(weeks).sort((a, b) => a - b);
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const entries = await prisma.vacationEntry.findMany({
    where: {
      status: "approved",
      OR: [
        { startAt: { gte: yearStart, lte: yearEnd } },
        { endAt: { gte: yearStart, lte: yearEnd } },
        { secondStartAt: { gte: yearStart, lte: yearEnd } },
        { secondEndAt: { gte: yearStart, lte: yearEnd } },
      ],
    },
    include: {
      executor: { select: { id: true, name: true } },
    },
    orderBy: [{ executor: { name: "asc" } }, { startAt: "asc" }],
  });

  const byExecutor = new Map<string, { name: string; weeks: Set<number> }>();

  for (const e of entries) {
    if (!byExecutor.has(e.executorId)) {
      byExecutor.set(e.executorId, { name: e.executor.name, weeks: new Set() });
    }
    const row = byExecutor.get(e.executorId)!;
    const periods: [Date | null, Date | null][] = [
      [e.startAt, e.endAt],
      [e.secondStartAt, e.secondEndAt],
    ];
    for (const [s, end] of periods) {
      if (!s || !end) continue;
      for (const w of weeksInRange(new Date(s), new Date(end))) {
        row.weeks.add(w);
      }
    }
  }

  const result = Array.from(byExecutor.entries()).map(([executorId, { name, weeks }]) => ({
    executorId,
    executorName: name,
    weeks: Array.from(weeks).sort((a, b) => a - b),
  }));

  return NextResponse.json(result);
}
