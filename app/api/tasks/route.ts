import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tasks = await prisma.task.findMany({
    include: {
      executor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}
