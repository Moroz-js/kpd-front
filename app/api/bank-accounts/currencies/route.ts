import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.bankAccount.findMany({
    select: { currency: true },
    distinct: ["currency"],
    orderBy: { currency: "asc" },
  });

  return NextResponse.json(rows.map((r) => r.currency));
}
