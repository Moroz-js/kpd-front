import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";

function isAmountFilled(amount: number | null): boolean {
  return amount !== null && Number.isFinite(amount);
}

export async function GET(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reconciliations = await prisma.bankAccountReconciliation.findMany({
    orderBy: { date: "desc" },
    include: {
      results: {
        include: { bankAccount: { select: { id: true, name: true } } },
        orderBy: { bankAccount: { name: "asc" } },
      },
    },
  });

  return NextResponse.json(
    reconciliations.map((v) => {
      const total = v.results.length;
      const filled = v.results.filter((r) => isAmountFilled(r.amount)).length;
      return {
        id: v.id,
        date: v.date.toISOString(),
        createdAt: v.createdAt.toISOString(),
        totalAccounts: total,
        filledAccounts: filled,
        progressPct: total === 0 ? 0 : Math.round((filled / total) * 100),
        results: v.results.map((r) => ({
          bankAccountId: r.bankAccountId,
          bankAccountName: r.bankAccount.name,
          amount: r.amount,
          comment: r.comment ?? null,
        })),
      };
    })
  );
}

const createSchema = z.object({
  date: z.string(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation" }, { status: 422 });

  const activeAccounts = await prisma.bankAccount.findMany({
    where: { status: "active" },
    select: { id: true },
  });

  const reconciliation = await prisma.bankAccountReconciliation.create({
    data: {
      date: new Date(parsed.data.date),
      createdBy: user.id,
      results: {
        create: activeAccounts.map((a) => ({ bankAccountId: a.id, amount: null })),
      },
    },
  });

  return NextResponse.json({ id: reconciliation.id }, { status: 201 });
}
