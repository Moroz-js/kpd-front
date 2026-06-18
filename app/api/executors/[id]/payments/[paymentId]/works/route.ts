import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { setPaymentWorkLinks } from "@/lib/services/payments";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

type Ctx = { params: Promise<{ id: string; paymentId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: executorId, paymentId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.executorId !== executorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    await setPaymentWorkLinks(executorId, paymentId, parsed.data, user.id);
    const updated = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        bankAccount: { select: { id: true, name: true } },
        works: { select: { id: true, amount: true, workStatus: true, executionYear: true, executionMonth: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось изменить состав выплаты";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
