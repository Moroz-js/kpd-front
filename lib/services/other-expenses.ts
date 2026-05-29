import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit/log";

// ─── Типы ─────────────────────────────────────────────────────────────────────

export type CreateOtherExpenseInput = {
  projectId: string;
  executorId: string;
  workTypeId: string;
  responsibleUserId: string;
  bankAccountId?: string | null;
  executionYear: number;
  executionMonth: number;
  description: string;
  amount: number;
  paymentAmount?: number | null;
  preferredPayMethod?: string | null;
  plannedPayAt?: string | null;
  paidAt?: string | null;
  comment?: string | null;
};

export type UpdateOtherExpenseInput = Partial<Omit<CreateOtherExpenseInput, "responsibleUserId">> & {
  responsibleUserId?: string;
  workStatus?: string;
  paymentStatus?: string;
};

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listOtherExpenses() {
  return prisma.otherExpense.findMany({
    include: {
      project: { select: { id: true, name: true, shortName: true } },
      executor: { select: { id: true, name: true } },
      workType: { select: { id: true, name: true, segment: true } },
      responsibleUser: { select: { id: true, fullName: true } },
      bankAccount: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createOtherExpense(
  input: CreateOtherExpenseInput,
  userId: string
) {
  const expense = await prisma.otherExpense.create({
    data: {
      projectId: input.projectId,
      executorId: input.executorId,
      workTypeId: input.workTypeId,
      responsibleUserId: input.responsibleUserId,
      bankAccountId: input.bankAccountId ?? null,
      executionYear: input.executionYear,
      executionMonth: input.executionMonth,
      description: input.description,
      amount: input.amount,
      paymentAmount: input.paymentAmount ?? null,
      preferredPayMethod: input.preferredPayMethod ?? null,
      plannedPayAt: input.plannedPayAt ? new Date(input.plannedPayAt) : null,
      paidAt: input.paidAt ? new Date(input.paidAt) : null,
      comment: input.comment ?? null,
      workStatus: "submitted",
      paymentStatus: input.paidAt ? "paid" : "planned",
      createdById: userId,
    },
  });

  await logActivity({
    userId,
    action: "create",
    entityType: "OtherExpense",
    entityId: expense.id,
    entityLabel: expense.description,
  });

  return expense;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateOtherExpense(
  id: string,
  patch: UpdateOtherExpenseInput,
  userId: string
) {
  const existing = await prisma.otherExpense.findUniqueOrThrow({ where: { id } });

  // Каскад: если заполняется paidAt → paid статусы
  let workStatus = patch.workStatus ?? existing.workStatus;
  let paymentStatus = patch.paymentStatus ?? existing.paymentStatus;

  const newPaidAt = patch.paidAt !== undefined
    ? (patch.paidAt ? new Date(patch.paidAt) : null)
    : existing.paidAt;

  if (newPaidAt && !existing.paidAt) {
    workStatus = "paid";
    paymentStatus = "paid";
  }

  // Возврат paymentStatus → planned вручную: сбросить paidAt
  if (patch.paymentStatus === "planned" && existing.paymentStatus === "paid") {
    workStatus = "checked";
    paymentStatus = "planned";
  }

  // Откат: admin убрал paidAt у paid записи
  if (!newPaidAt && existing.paidAt && existing.paymentStatus === "paid" && paymentStatus !== "planned") {
    workStatus = "checked";
    paymentStatus = "planned";
  }

  const updated = await prisma.otherExpense.update({
    where: { id },
    include: {
      project: { select: { id: true, name: true, shortName: true } },
      executor: { select: { id: true, name: true } },
      workType: { select: { id: true, name: true, segment: true } },
      responsibleUser: { select: { id: true, fullName: true } },
      bankAccount: { select: { id: true, name: true } },
    },
    data: {
      ...(patch.projectId !== undefined && { projectId: patch.projectId }),
      ...(patch.executorId !== undefined && { executorId: patch.executorId }),
      ...(patch.workTypeId !== undefined && { workTypeId: patch.workTypeId }),
      ...(patch.responsibleUserId !== undefined && { responsibleUserId: patch.responsibleUserId }),
      ...(patch.bankAccountId !== undefined && { bankAccountId: patch.bankAccountId }),
      ...(patch.executionYear !== undefined && { executionYear: patch.executionYear }),
      ...(patch.executionMonth !== undefined && { executionMonth: patch.executionMonth }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.amount !== undefined && { amount: patch.amount }),
      ...(patch.paymentAmount !== undefined && { paymentAmount: patch.paymentAmount }),
      ...(patch.preferredPayMethod !== undefined && { preferredPayMethod: patch.preferredPayMethod }),
      ...(patch.plannedPayAt !== undefined && { plannedPayAt: patch.plannedPayAt ? new Date(patch.plannedPayAt) : null }),
      ...(patch.comment !== undefined && { comment: patch.comment }),
      paidAt: paymentStatus === "planned" && existing.paymentStatus === "paid" ? null : newPaidAt,
      workStatus,
      paymentStatus,
    },
  });

  await logActivity({
    userId,
    action: "update",
    entityType: "OtherExpense",
    entityId: id,
    entityLabel: existing.description,
  });

  return updated;
}

// ─── Check ────────────────────────────────────────────────────────────────────

export async function checkOtherExpense(id: string, userId: string) {
  const existing = await prisma.otherExpense.findUniqueOrThrow({ where: { id } });

  if (existing.workStatus === "checked" || existing.workStatus === "paid") {
    throw new Error("Работа уже проверена или оплачена");
  }

  const updated = await prisma.otherExpense.update({
    where: { id },
    data: {
      workStatus: "checked",
      checkedAt: new Date(),
      paymentStatus: existing.paymentStatus ?? "planned",
      paymentAmount: existing.paymentAmount ?? existing.amount,
    },
  });

  await logActivity({
    userId,
    action: "status_change",
    entityType: "OtherExpense",
    entityId: id,
    entityLabel: existing.description,
    changes: { workStatus: { from: existing.workStatus, to: "checked" } },
  });

  return updated;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteOtherExpense(id: string, userId: string) {
  const existing = await prisma.otherExpense.findUniqueOrThrow({ where: { id } });

  await prisma.otherExpense.delete({ where: { id } });

  await logActivity({
    userId,
    action: "delete",
    entityType: "OtherExpense",
    entityId: id,
    entityLabel: existing.description,
  });
}
