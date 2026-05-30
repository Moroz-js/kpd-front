import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const verification = await prisma.projectVerification.findUnique({
    where: { id },
    include: {
      results: {
        include: { project: { select: { id: true, name: true } } },
        orderBy: { project: { name: "asc" } },
      },
    },
  });

  if (!verification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const creator = await prisma.user.findUnique({
    where: { id: verification.createdBy },
    select: { fullName: true },
  });

  const total = verification.results.length;
  const checked = verification.results.filter(r => r.checked).length;

  return NextResponse.json({
    id: verification.id,
    date: verification.date.toISOString(),
    createdByName: creator?.fullName ?? verification.createdBy,
    results: verification.results.map(r => ({
      projectId: r.projectId,
      projectName: r.project.name,
      checked: r.checked,
    })),
    totalProjects: total,
    checkedProjects: checked,
    progressPct: total === 0 ? 0 : Math.round((checked / total) * 100),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.projectVerification.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
