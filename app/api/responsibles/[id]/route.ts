import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { updateResponsible } from "@/lib/services/responsibles";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      responsibleProjects: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, status: true },
      },
    },
  });
  if (!user || user.role !== "responsible") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    isActive: user.isActive,
    projects: user.responsibleProjects,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const updated = await updateResponsible(id, parsed.data, me.id);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Email уже занят" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
