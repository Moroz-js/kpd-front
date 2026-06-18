import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { checkWork } from "@/lib/services/works";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; workId: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id: executorId, workId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Проверку может делать только admin
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work || work.executorId !== executorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (work.workStatus === "checked") {
    return NextResponse.json({ error: "Уже проверено" }, { status: 409 });
  }

  const updated = await checkWork(workId, user.id);

  // KPD-284 §2: автосоздание выплат отключено — выплаты формируются вручную.

  return NextResponse.json(updated);
}
