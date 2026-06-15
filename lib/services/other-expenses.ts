import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit/log";
import { nearestPaymentDate } from "@/lib/iso-weeks";
import { assertExecutorEligibleForOtherExpense } from "@/lib/executor-personal-estimate";
import {
  hasOtherExpensePayment,
  workStatusFromPaymentStatus,
} from "@/lib/other-expense-payment";

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
  paymentStatus?: string | null;
};

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listOtherExpenses(opts?: { scopeUserId?: string }) {
  return prisma.otherExpense.findMany({
    where: opts?.scopeUserId
      ? {
          OR: [
            { createdById: opts.scopeUserId },
            { responsibleUserId: opts.scopeUserId },
          ],
        }
      : undefined,
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

const otherExpenseInclude = {
  project: { select: { id: true, name: true, shortName: true } },
  executor: { select: { id: true, name: true } },
  workType: { select: { id: true, name: true, segment: true } },
  responsibleUser: { select: { id: true, fullName: true } },
  bankAccount: { select: { id: true, name: true } },
} as const;

type Existing = Awaited<ReturnType<typeof prisma.otherExpense.findUniqueOrThrow>>;

function assertCanChangeWorkStatus(existing: Existing, patch: UpdateOtherExpenseInput) {
  if (patch.workStatus === undefined) return;
  if (hasOtherExpensePayment(existing.paymentStatus)) {
    throw new Error("Статус работы нельзя менять после создания выплаты");
  }
}

function applyPaymentCascade(
  existing: Existing,
  state: {
    workStatus: string;
    paymentStatus: string | null;
    paymentAmount: number | null;
    plannedPayAt: Date | null;
    paidAt: Date | null;
    checkedAt: Date | null;
  },
  patch: UpdateOtherExpenseInput
) {
  if (patch.plannedPayAt !== undefined) {
    state.plannedPayAt = patch.plannedPayAt ? new Date(patch.plannedPayAt) : null;
  }

  if (patch.paymentAmount !== undefined) {
    state.paymentAmount = patch.paymentAmount;
  }

  if (patch.amount !== undefined && state.paymentAmount != null) {
    state.paymentAmount = patch.amount;
  }

  if (patch.paymentStatus !== undefined) {
    state.paymentStatus = patch.paymentStatus;
    if (patch.paymentStatus === null) {
      return;
    }
    state.workStatus = workStatusFromPaymentStatus(patch.paymentStatus);
    if (patch.paymentStatus === "planned" && existing.paymentStatus === "paid") {
      state.paidAt = null;
    }
    if (patch.paymentStatus === "paid" && !state.paidAt) {
      state.paidAt = existing.paidAt ?? new Date();
    }
  }

  if (patch.paidAt !== undefined) {
    const nextPaidAt = patch.paidAt ? new Date(patch.paidAt) : null;
    state.paidAt = nextPaidAt;

    if (!hasOtherExpensePayment(state.paymentStatus)) return;

    if (nextPaidAt) {
      if (state.paymentStatus !== "paid") {
        state.paymentStatus = "sent";
      }
      state.workStatus = "paid";
    } else if (existing.paidAt) {
      state.paymentStatus = "planned";
      state.workStatus = "checked";
    }
  }

  if (patch.workStatus !== undefined) {
    state.workStatus = patch.workStatus;
    if (patch.workStatus === "checked" && !state.checkedAt) {
      state.checkedAt = new Date();
    }
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createOtherExpense(
  input: CreateOtherExpenseInput,
  userId: string
) {
  await assertExecutorEligibleForOtherExpense(input.executorId);
  const paidAt = input.paidAt ? new Date(input.paidAt) : null;
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
      paymentAmount: paidAt ? (input.paymentAmount ?? input.amount) : null,
      preferredPayMethod: input.preferredPayMethod ?? null,
      plannedPayAt: input.plannedPayAt ? new Date(input.plannedPayAt) : null,
      paidAt,
      checkedAt: paidAt ? new Date() : null,
      comment: input.comment ?? null,
      workStatus: paidAt ? "paid" : "submitted",
      paymentStatus: paidAt ? "paid" : null,
      createdById: userId,
    },
    include: otherExpenseInclude,
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
  if (patch.executorId !== undefined) {
    await assertExecutorEligibleForOtherExpense(patch.executorId);
  }
  assertCanChangeWorkStatus(existing, patch);

  const state = {
    workStatus: existing.workStatus,
    paymentStatus: existing.paymentStatus,
    paymentAmount: existing.paymentAmount,
    plannedPayAt: existing.plannedPayAt,
    paidAt: existing.paidAt,
    checkedAt: existing.checkedAt,
  };

  applyPaymentCascade(existing, state, patch);

  const updated = await prisma.otherExpense.update({
    where: { id },
    include: otherExpenseInclude,
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
      ...(patch.preferredPayMethod !== undefined && { preferredPayMethod: patch.preferredPayMethod }),
      ...(patch.comment !== undefined && { comment: patch.comment }),
      workStatus: state.workStatus,
      paymentStatus: state.paymentStatus,
      paymentAmount: state.paymentAmount,
      plannedPayAt: state.plannedPayAt,
      paidAt: state.paidAt,
      checkedAt: state.checkedAt,
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
  if (hasOtherExpensePayment(existing.paymentStatus)) {
    throw new Error("Выплата уже создана");
  }

  const plannedPayAt = nearestPaymentDate();

  const updated = await prisma.otherExpense.update({
    where: { id },
    include: otherExpenseInclude,
    data: {
      workStatus: "checked",
      checkedAt: new Date(),
      paymentStatus: "planned",
      paymentAmount: existing.amount,
      plannedPayAt,
    },
  });

  await logActivity({
    userId,
    action: "status_change",
    entityType: "OtherExpense",
    entityId: id,
    entityLabel: existing.description,
    changes: {
      workStatus: { from: existing.workStatus, to: "checked" },
      paymentStatus: { from: existing.paymentStatus, to: "planned" },
    },
  });

  return updated;
}

// ─── Clear payment (выплаты: удаление) ───────────────────────────────────────

export async function clearOtherExpensePayment(id: string, userId: string) {
  const existing = await prisma.otherExpense.findUniqueOrThrow({ where: { id } });

  const updated = await prisma.otherExpense.update({
    where: { id },
    include: otherExpenseInclude,
    data: {
      paymentAmount: null,
      plannedPayAt: null,
      paidAt: null,
      bankAccountId: null,
      paymentStatus: null,
      workStatus: existing.workStatus === "paid" ? "checked" : existing.workStatus,
    },
  });

  await logActivity({
    userId,
    action: "delete",
    entityType: "OtherExpense",
    entityId: id,
    entityLabel: `Прочие траты · ${existing.description.slice(0, 40)} (очищена выплата)`,
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
