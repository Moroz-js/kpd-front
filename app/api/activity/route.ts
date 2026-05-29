import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = 50;
  const entityType = sp.get("entityType") ?? undefined;
  const userId = sp.get("userId") ?? undefined;

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(userId ? { userId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { fullName: true, role: true } } },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}
