import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";

const schema = z.object({
  ids: z.array(z.string()).min(1),
  patch: z.object({
    status: z.string().optional(),
  }),
});

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation", details: parsed.error.flatten() }, { status: 400 });
  }

  const { ids, patch } = parsed.data;
  const data: Record<string, unknown> = {};
  if (patch.status) data.status = patch.status;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await prisma.charge.updateMany({
    where: { id: { in: ids } },
    data,
  });

  return NextResponse.json({ updated: result.count });
}
