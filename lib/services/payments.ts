/**
 * PaymentService — создание/редактирование выплат (TDNB-15).
 *
 * §1.7  tryCreatePaymentForPeriod — автоматическое создание при проверке
 * §1.7* createManualPayment       — ручное создание
 * §1.10 markPaymentPaid           — проставление даты оплаты
 * §1.12 propagatePlanDate         — каскад «Дата оплаты план»
 */
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit/log";
import { nearestPaymentDate } from "@/lib/iso-weeks";

// Возвращает defaultBankAccountId исполнителя → глобальный дефолт → null
async function resolveDefaultBank(executorId: string): Promise<string | null> {
  const exec = await prisma.executor.findUnique({
    where: { id: executorId },
    select: { defaultBankAccountId: true },
  });
  if (exec?.defaultBankAccountId) return exec.defaultBankAccountId;

  const global = await prisma.bankAccount.findFirst({
    where: { isDefault: true, status: "active" },
    select: { id: true },
  });
  return global?.id ?? null;
}

// ─── §1.7 Авто-создание ────────────────────────────────────────────────────

/**
 * Пытается создать Payment для «хвоста» (работы без paymentId).
 * Условие: все работы хвоста имеют workStatus = "checked".
 */
export async function tryCreatePaymentForPeriod(
  executorId: string,
  year: number,
  month: number,
  userId: string
): Promise<void> {
  const tail = await prisma.work.findMany({
    where: { executorId, executionYear: year, executionMonth: month, paymentId: null },
    select: { id: true, amount: true, workStatus: true },
  });

  if (tail.length === 0) return;
  if (!tail.every((w) => w.workStatus === "checked")) return;

  const amount = tail.reduce((s, w) => s + w.amount, 0);
  const bankAccountId = await resolveDefaultBank(executorId);

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        executorId,
        periodYear: year,
        periodMonth: month,
        amount,
        paymentStatus: "planned",
        bankAccountId,
        plannedPayAt: nearestPaymentDate(),
      },
    });

    await tx.work.updateMany({
      where: { id: { in: tail.map((w) => w.id) } },
      data: { paymentId: p.id },
    });

    return p;
  });

  await logActivity({
    userId,
    action: "create",
    entityType: "Payment",
    entityId: payment.id,
    entityLabel: `Авто-выплата ${month}/${year}`,
  });
}

// ─── §1.7* Ручное создание ─────────────────────────────────────────────────

export type CreateManualPaymentInput = {
  executorId: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  paymentStatus?: string;
  bankAccountId?: string | null;
  plannedPayAt?: string | null;
  paidAt?: string | null;
  comment?: string | null;
};

export async function createManualPayment(
  input: CreateManualPaymentInput,
  userId: string
) {
  const bankAccountId =
    input.bankAccountId !== undefined
      ? input.bankAccountId
      : await resolveDefaultBank(input.executorId);

  const payment = await prisma.payment.create({
    data: {
      executorId: input.executorId,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      amount: input.amount,
      paymentStatus: input.paymentStatus ?? "planned",
      bankAccountId,
      plannedPayAt: input.plannedPayAt
        ? new Date(input.plannedPayAt)
        : nearestPaymentDate(),
      paidAt: input.paidAt ? new Date(input.paidAt) : null,
      comment: input.comment ?? null,
    },
  });

  await logActivity({
    userId,
    action: "create",
    entityType: "Payment",
    entityId: payment.id,
    entityLabel: `Выплата ${input.periodMonth}/${input.periodYear}`,
  });

  return payment;
}

// ─── Редактирование (без смены статуса на paid) ───────────────────────────

export type UpdatePaymentInput = {
  amount?: number;
  paymentStatus?: string;
  bankAccountId?: string | null;
  plannedPayAt?: string | null;
  paidAt?: string | null;
  comment?: string | null;
  periodYear?: number;
  periodMonth?: number;
};

export async function updatePayment(
  paymentId: string,
  patch: UpdatePaymentInput,
  userId: string
) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

  // Если проставляется paidAt — делаем через markPaymentPaid для каскада
  if (patch.paidAt !== undefined && patch.paidAt && !payment.paidAt) {
    await markPaymentPaid(paymentId, new Date(patch.paidAt), userId);
    // Остальные поля (если есть) — применим отдельно
    const { paidAt: _, ...rest } = patch;
    if (Object.keys(rest).length > 0) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          ...(rest.amount !== undefined && { amount: rest.amount }),
          ...(rest.bankAccountId !== undefined && { bankAccountId: rest.bankAccountId }),
          ...(rest.comment !== undefined && { comment: rest.comment }),
          ...(rest.periodYear !== undefined && { periodYear: rest.periodYear }),
          ...(rest.periodMonth !== undefined && { periodMonth: rest.periodMonth }),
        },
      });
    }
    return;
  }

  // Если проставляется plannedPayAt — делаем через propagatePlanDate для каскада
  if (patch.plannedPayAt !== undefined) {
    const planDate = patch.plannedPayAt ? new Date(patch.plannedPayAt) : null;
    await propagatePlanDate(paymentId, planDate, userId);
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      ...(patch.amount !== undefined && { amount: patch.amount }),
      ...(patch.paymentStatus !== undefined && { paymentStatus: patch.paymentStatus }),
      ...(patch.bankAccountId !== undefined && { bankAccountId: patch.bankAccountId }),
      ...(patch.paidAt !== undefined && { paidAt: patch.paidAt ? new Date(patch.paidAt) : null }),
      ...(patch.comment !== undefined && { comment: patch.comment }),
      ...(patch.periodYear !== undefined && { periodYear: patch.periodYear }),
      ...(patch.periodMonth !== undefined && { periodMonth: patch.periodMonth }),
    },
  });

  await logActivity({
    userId,
    action: "update",
    entityType: "Payment",
    entityId: paymentId,
    entityLabel: `Выплата ${payment.periodMonth}/${payment.periodYear}`,
  });

  return updated;
}

// ─── §1.10 Оплата выплаты ──────────────────────────────────────────────────

export async function markPaymentPaid(
  paymentId: string,
  paidAt: Date,
  userId: string
) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { paymentStatus: "paid", paidAt },
    });

    // Проверяем, остались ли неоплаченные выплаты за этот период
    const openPayments = await tx.payment.count({
      where: {
        executorId: payment.executorId,
        periodYear: payment.periodYear,
        periodMonth: payment.periodMonth,
        id: { not: paymentId },
        paymentStatus: { not: "paid" },
      },
    });

    if (openPayments === 0) {
      // Все выплаты за период оплачены → каскад на работы
      await tx.work.updateMany({
        where: {
          executorId: payment.executorId,
          executionYear: payment.periodYear,
          executionMonth: payment.periodMonth,
          paymentId: { not: null },
          workStatus: "checked",
        },
        data: { workStatus: "paid", paidAt },
      });
    }
  });

  await logActivity({
    userId,
    action: "status_change",
    entityType: "Payment",
    entityId: paymentId,
    entityLabel: `Выплата ${payment.periodMonth}/${payment.periodYear}`,
    changes: { paymentStatus: { from: payment.paymentStatus, to: "paid" } },
  });
}

// ─── §1.12 Смена плана выплаты ─────────────────────────────────────────────

export async function propagatePlanDate(
  paymentId: string,
  plannedPayAt: Date | null,
  userId: string
) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: paymentId }, data: { plannedPayAt } });

    // §1.12 — каскад на все связанные работы (по paymentId), кроме оплаченных
    await tx.work.updateMany({
      where: { paymentId, workStatus: { not: "paid" } },
      data: { plannedPayAt },
    });
  });

  await logActivity({
    userId,
    action: "update",
    entityType: "Payment",
    entityId: paymentId,
    entityLabel: `Выплата ${payment.periodMonth}/${payment.periodYear}`,
    changes: { plannedPayAt: { from: payment.plannedPayAt, to: plannedPayAt } },
  });
}

// ─── Удаление выплаты (только admin, через TDNB-17) ───────────────────────

export async function deletePaymentForExecutor(paymentId: string, userId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

  await prisma.$transaction(async (tx) => {
    // Снять paymentId у связанных работ + откатить статус paid→checked
    await tx.work.updateMany({
      where: { paymentId },
      data: { paymentId: null, workStatus: "submitted", paidAt: null },
    });

    await tx.payment.delete({ where: { id: paymentId } });
  });

  await logActivity({
    userId,
    action: "delete",
    entityType: "Payment",
    entityId: paymentId,
    entityLabel: `Выплата ${payment.periodMonth}/${payment.periodYear}`,
  });
}
