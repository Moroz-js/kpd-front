/**
 * POST /api/users/me/password
 *
 * Самостоятельная смена пароля авторизованным пользователем.
 * Body: { currentPassword: string, newPassword: string }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit/log";
import bcrypt from "bcryptjs";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Минимальная длина пароля — 6 символов" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!ok) return NextResponse.json({ error: "Текущий пароль неверен" }, { status: 400 });

  const hash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: me.id }, data: { password: hash } });

  await logActivity({
    userId: me.id,
    action: "password_reset",
    entityType: "User",
    entityId: me.id,
    entityLabel: user.fullName,
  });

  return NextResponse.json({ ok: true });
}
