import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { approveVacation } from "@/lib/services/vacations";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; vacationId: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id: executorId, vacationId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const entry = await prisma.vacationEntry.findUnique({ where: { id: vacationId } });
  if (!entry || entry.executorId !== executorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await approveVacation(vacationId, user.id);
  return NextResponse.json(updated);
}
