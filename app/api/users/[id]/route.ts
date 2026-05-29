import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit/log";

const patchSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email("Некорректный email").optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Проверяем уникальность email если меняется
  if (parsed.data.email && parsed.data.email !== user.email) {
    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.fullName !== undefined && { fullName: parsed.data.fullName }),
      ...(parsed.data.email !== undefined && { email: parsed.data.email.trim().toLowerCase() }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
  });

  await logActivity({
    userId: me.id,
    action: "update",
    entityType: "User",
    entityId: id,
    entityLabel: updated.fullName,
  });

  return NextResponse.json({ ok: true });
}
