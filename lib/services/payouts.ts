/**
 * PayoutService (TDNB-17).
 *
 * Удаление admin'ом → каскад в источник:
 *   Личная смета (Payment): удаляется Payment; у всех связанных Work
 *     - paymentId = NULL
 *     - paidAt = NULL
 *     - workStatus paid → checked
 *   Прочие траты (OtherExpense): очищаются payment-поля
 *     (paymentAmount, plannedPayAt, paidAt, bankAccountId, paymentStatus = "planned")
 *     workStatus paid → checked
 *
 * Редактирование (§4.5 / §4.6) — back-sync в источник.
 */

import { prisma } from "@/lib/db";
import { logActivity, diff } from "@/lib/audit/log";
import type { PayoutSource } from "@/lib/views/payouts";

export type PayoutPatch = {
  amount?: number;
  paymentStatus?: string;
  paidAt?: Date | null;
  plannedPayAt?: Date | null;
  bankAccountId?: string | null;
  comment?: string | null;
  // только для other-expense
  executorId?: string;
  executionMonth?: number;
  executionYear?: number;
};

export async function updatePayout(
  sourceType: PayoutSource,
  sourceId: string,
  patch: PayoutPatch,
  userId: string
) {
  if (sourceType === "personal") {
    return updatePaymentSource(sourceId, patch, userId);
  }
  return updateOtherSource(sourceId, patch, userId);
}

async function updatePaymentSource(paymentId: string, patch: PayoutPatch, userId: string) {
  const before = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!before) throw new Error("Payment not found");

  const data: Record<string, unknown> = {};
  if (patch.amount !== undefined) data.amount = patch.amount;
  if (patch.paymentStatus !== undefined) data.paymentStatus = patch.paymentStatus;
  if (patch.paidAt !== undefined) data.paidAt = patch.paidAt;
  if (patch.plannedPayAt !== undefined) data.plannedPayAt = patch.plannedPayAt;
  if (patch.bankAccountId !== undefined) data.bankAccountId = patch.bankAccountId;
  if (patch.comment !== undefined) data.comment = patch.comment;

  // Возврат в «Запланировано» → очистить дату оплаты
  if (patch.paymentStatus === "planned" && before.paymentStatus !== "planned") {
    data.paidAt = null;
  }

  const updated = await prisma.payment.update({ where: { id: paymentId }, data });

  // §1.10 каскад: если payment.paidAt становится непустым → у связанных Work проставить paidAt и workStatus=paid
  if (
    patch.paidAt !== undefined &&
    patch.paidAt !== null &&
    !before.paidAt
  ) {
    await prisma.work.updateMany({
      where: { paymentId },
      data: { paidAt: patch.paidAt, workStatus: "paid" },
    });
  } else if ((patch.paidAt === null || patch.paymentStatus === "planned") && before.paidAt) {
    // откат факта оплаты → возвращаем работы в checked
    await prisma.work.updateMany({
      where: { paymentId, workStatus: "paid" },
      data: { paidAt: null, workStatus: "checked" },
    });
  }

  const changes = diff(
    {
      amount: before.amount,
      paymentStatus: before.paymentStatus,
      paidAt: before.paidAt,
      plannedPayAt: before.plannedPayAt,
      bankAccountId: before.bankAccountId,
      comment: before.comment,
    },
    {
      amount: updated.amount,
      paymentStatus: updated.paymentStatus,
      paidAt: updated.paidAt,
      plannedPayAt: updated.plannedPayAt,
      bankAccountId: updated.bankAccountId,
      comment: updated.comment,
    }
  );
  if (Object.keys(changes).length > 0) {
    await logActivity({
      userId,
      action: "update",
      entityType: "Payment",
      entityId: paymentId,
      entityLabel: `Выплата · ${before.periodYear}.${String(before.periodMonth).padStart(2, "0")}`,
      changes,
    });
  }

  return updated;
}

async function updateOtherSource(otherId: string, patch: PayoutPatch, userId: string) {
  const before = await prisma.otherExpense.findUnique({ where: { id: otherId } });
  if (!before) throw new Error("OtherExpense not found");

  const data: Record<string, unknown> = {};
  if (patch.amount !== undefined) data.paymentAmount = patch.amount;
  if (patch.paymentStatus !== undefined) data.paymentStatus = patch.paymentStatus;
  if (patch.paidAt !== undefined) data.paidAt = patch.paidAt;
  if (patch.plannedPayAt !== undefined) data.plannedPayAt = patch.plannedPayAt;
  if (patch.bankAccountId !== undefined) data.bankAccountId = patch.bankAccountId;
  if (patch.comment !== undefined) data.comment = patch.comment;
  if (patch.executorId !== undefined) data.executorId = patch.executorId;
  if (patch.executionMonth !== undefined) data.executionMonth = patch.executionMonth;
  if (patch.executionYear !== undefined) data.executionYear = patch.executionYear;

  // §2.3 каскад: оплата → workStatus = paid; откат оплаты → checked + очистить paidAt
  if (patch.paymentStatus === "paid" && before.paymentStatus !== "paid") {
    data.workStatus = "paid";
  } else if (
    patch.paymentStatus !== undefined &&
    patch.paymentStatus !== "paid" &&
    before.paymentStatus === "paid"
  ) {
    data.workStatus = "checked";
    data.paidAt = null; // возврат в «Запланировано» → сбросить дату оплаты
  }

  const updated = await prisma.otherExpense.update({ where: { id: otherId }, data });

  const changes = diff(
    {
      paymentAmount: before.paymentAmount,
      paymentStatus: before.paymentStatus,
      paidAt: before.paidAt,
      plannedPayAt: before.plannedPayAt,
      bankAccountId: before.bankAccountId,
      comment: before.comment,
      executorId: before.executorId,
      executionMonth: before.executionMonth,
      executionYear: before.executionYear,
      workStatus: before.workStatus,
    },
    {
      paymentAmount: updated.paymentAmount,
      paymentStatus: updated.paymentStatus,
      paidAt: updated.paidAt,
      plannedPayAt: updated.plannedPayAt,
      bankAccountId: updated.bankAccountId,
      comment: updated.comment,
      executorId: updated.executorId,
      executionMonth: updated.executionMonth,
      executionYear: updated.executionYear,
      workStatus: updated.workStatus,
    }
  );
  if (Object.keys(changes).length > 0) {
    await logActivity({
      userId,
      action: "update",
      entityType: "OtherExpense",
      entityId: otherId,
      entityLabel: `Прочие траты · ${before.description.slice(0, 40)}`,
      changes,
    });
  }

  return updated;
}

export async function deletePayout(
  sourceType: PayoutSource,
  sourceId: string,
  userId: string
) {
  if (sourceType === "personal") {
    return deletePaymentSource(sourceId, userId);
  }
  return clearOtherPaymentFields(sourceId, userId);
}

async function deletePaymentSource(paymentId: string, userId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found");

  await prisma.$transaction(async (tx) => {
    // Откатываем работы: paymentId=NULL, paidAt=NULL, paid → checked
    await tx.work.updateMany({
      where: { paymentId, workStatus: "paid" },
      data: { paymentId: null, paidAt: null, workStatus: "checked" },
    });
    await tx.work.updateMany({
      where: { paymentId },
      data: { paymentId: null, paidAt: null },
    });
    await tx.payment.delete({ where: { id: paymentId } });
  });

  await logActivity({
    userId,
    action: "delete",
    entityType: "Payment",
    entityId: paymentId,
    entityLabel: `Выплата · ${payment.periodYear}.${String(payment.periodMonth).padStart(2, "0")}`,
  });

  return { ok: true };
}

async function clearOtherPaymentFields(otherId: string, userId: string) {
  const before = await prisma.otherExpense.findUnique({ where: { id: otherId } });
  if (!before) throw new Error("OtherExpense not found");

  const updated = await prisma.otherExpense.update({
    where: { id: otherId },
    data: {
      paymentAmount: null,
      plannedPayAt: null,
      paidAt: null,
      bankAccountId: null,
      paymentStatus: "planned",
      ...(before.workStatus === "paid" && { workStatus: "checked" }),
    },
  });

  await logActivity({
    userId,
    action: "delete",
    entityType: "OtherExpense",
    entityId: otherId,
    entityLabel: `Прочие траты · ${before.description.slice(0, 40)} (очищена выплата)`,
  });

  return updated;
}
