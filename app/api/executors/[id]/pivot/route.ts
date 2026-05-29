import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canViewExecutorEstimate } from "@/lib/permissions";
import { prisma } from "@/lib/db";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executorId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await canViewExecutorEstimate(user, executorId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const type = searchParams.get("type") ?? "paid"; // paid | debt

  const where =
    type === "paid"
      ? { executorId, executionYear: year, workStatus: "paid" }
      : {
          executorId,
          executionYear: year,
          workStatus: { in: ["submitted", "checked", "rework"] },
        };

  const rows = await prisma.work.groupBy({
    by: ["projectId", "executionMonth"],
    where,
    _sum: { amount: true },
  });

  // Получаем названия проектов
  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Строим pivot: [{projectName, totals, m1..m12}]
  const pivot = projects.map((p) => {
    const monthSums = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const row = rows.find((r) => r.projectId === p.id && r.executionMonth === m);
      return row?._sum.amount ?? 0;
    });
    const total = monthSums.reduce((s, v) => s + v, 0);
    return {
      projectId: p.id,
      projectName: p.name,
      total,
      months: monthSums,
    };
  });

  return NextResponse.json({ year, type, months: MONTH_NAMES, pivot });
}
