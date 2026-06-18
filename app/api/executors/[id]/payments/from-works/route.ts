import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createPaymentFromWorks } from "@/lib/services/payments";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.union([
  z.object({ scope: z.literal("all-checked") }),
  z.object({ workIds: z.array(z.string()).min(1) }),
]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: executorId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation", details: parsed.error.flatten() }, { status: 422 });
  }

  let workIds: string[];
  if ("scope" in parsed.data) {
    const checked = await prisma.work.findMany({
      where: { executorId, workStatus: "checked", paymentId: null },
      select: { id: true },
    });
    workIds = checked.map((w) => w.id);
  } else {
    workIds = parsed.data.workIds;
  }

  if (workIds.length === 0) {
    return NextResponse.json({ error: "Нет проверенных работ для формирования выплаты" }, { status: 400 });
  }

  try {
    const payment = await createPaymentFromWorks(executorId, workIds, user.id);
    return NextResponse.json(payment, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось сформировать выплату";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
