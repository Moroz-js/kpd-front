import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { assertAdmin, forbidden, unauthorized } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try { assertAdmin(user); } catch { return forbidden(); }

  const role = req.nextUrl.searchParams.get("role");
  const where = role ? { role } : {};

  const users = await prisma.user.findMany({
    where,
    select: { id: true, fullName: true, email: true, role: true, isActive: true },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json(users);
}
