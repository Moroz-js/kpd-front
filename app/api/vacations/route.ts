import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isoWeeksInDateRange } from "@/lib/iso-weeks";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const entries = await prisma.vacationEntry.findMany({
    where: {
      status: "approved",
      OR: [
        { startAt: { lte: yearEnd }, endAt: { gte: yearStart } },
        { secondStartAt: { lte: yearEnd }, secondEndAt: { gte: yearStart } },
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
      for (const w of isoWeeksInDateRange(new Date(s), new Date(end), year)) {
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
