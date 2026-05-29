/**
 * GET /api/projects/options
 * Лёгкий список проектов для дропдаунов/назначений.
 * Возвращает id, name, status, responsibleUserId.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      responsibleUserId: true,
    },
  });

  return NextResponse.json(projects);
}
