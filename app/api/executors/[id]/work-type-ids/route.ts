import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: executorId } = await params;

  const rows = await prisma.executorWorkType.findMany({
    where: { executorId },
    select: { workTypeId: true },
  });

  return NextResponse.json(rows.map(r => r.workTypeId));
}
