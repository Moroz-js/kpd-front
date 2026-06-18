import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, isResponsible } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { listIssuedWorks } from "@/lib/views/issuedWorks";

type Ctx = { params: Promise<{ id: string }> };

// Все работы проекта (Личные сметы + Прочие траты) для таблицы на дашборде (KPD-287).
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, responsibleUserId: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isAdmin(user) && !(isResponsible(user) && project.responsibleUserId === user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await listIssuedWorks({ projectId: [id] });
  return NextResponse.json(rows);
}
