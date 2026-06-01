import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const verifications = await prisma.projectVerification.findMany({
    orderBy: { date: "desc" },
    include: {
      results: {
        include: { project: { select: { id: true, name: true } } },
        orderBy: { project: { name: "asc" } },
      },
    },
  });

  return NextResponse.json(
    verifications.map(v => {
      const total = v.results.length;
      const checked = v.results.filter(r => r.checked).length;
      return {
        id: v.id,
        date: v.date.toISOString(),
        createdAt: v.createdAt.toISOString(),
        totalProjects: total,
        checkedProjects: checked,
        progressPct: total === 0 ? 0 : Math.round((checked / total) * 100),
        results: v.results.map(r => ({
          projectId: r.projectId,
          projectName: r.project.name,
          checked: r.checked,
          comment: r.comment ?? null,
        })),
      };
    })
  );
}

const createSchema = z.object({
  date: z.string(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation" }, { status: 422 });

  const activeProjects = await prisma.project.findMany({
    where: { status: "active" },
    select: { id: true },
  });

  const verification = await prisma.projectVerification.create({
    data: {
      date: new Date(parsed.data.date),
      createdBy: user.id,
      results: {
        create: activeProjects.map(p => ({ projectId: p.id, checked: false })),
      },
    },
  });

  return NextResponse.json({ id: verification.id }, { status: 201 });
}
