/**
 * BankOperationService — банковские транзакции («Робот»).
 *
 * Пока источник данных — мок из сида: страница и модель проверяются до того,
 * как появится реальный импорт выписок. Поэтому здесь нет парсинга и правил —
 * только чтение, ручная правка и привязка пополнений к начислениям.
 *
 * Особенности:
 * - Внутренний перевод — пара операций (списание + поступление). Обе строки
 *   ссылаются друг на друга через pairedOperationId, в списке пара сворачивается
 *   в одну строку (см. collapseTransferPairs на клиенте).
 * - «Запоминание» после ручной правки контрагента: правил ещё нет, поэтому
 *   выбранный признак пишется в трассировку — она и объясняет, откуда значение.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity, diff } from "@/lib/audit/log";

export type BankOperationChargeLink = {
  chargeId: string;
  chargeNumber: string;
  invoiceNumber: string | null;
  chargeAmount: number;
  chargeStatus: string;
  projectName: string | null;
  /** Сколько из операции отнесено на это начисление (null — вся сумма). */
  amount: number | null;
  link: string; // suggested | confirmed
  reason: string | null;
};

export type BankOperationRow = {
  id: string;
  bankAccountId: string;
  bankAccountName: string;
  currency: string;
  transferSource: string | null;
  amount: number;
  date: Date;
  month: number;
  year: number;
  kind: string;
  isInternalTransfer: boolean;
  pairedOperationId: string | null;
  /** Счёт второй операции пары — для строки «со счёта → на счёт». */
  pairedAccountName: string | null;
  counterpartyName: string | null;
  counterpartyType: string | null;
  projectId: string | null;
  projectName: string | null;
  workTypeId: string | null;
  workTypeName: string | null;
  workDescription: string | null;
  paymentOrder: string | null;
  paymentPurpose: string | null;
  basis: string | null;
  status: string;
  chargeMatch: string | null;
  comment: string | null;
  confirmedAt: Date | null;
  confirmedByName: string | null;
  raw: {
    docNumber: string | null;
    date: string | null;
    amount: string | null;
    currency: string | null;
    operationType: string | null;
    counterparty: string | null;
    inn: string | null;
    account: string | null;
    bik: string | null;
    purpose: string | null;
    category: string | null;
  };
  trace: {
    counterparty: string | null;
    project: string | null;
    workType: string | null;
  };
  charges: BankOperationChargeLink[];
};

const OPERATION_INCLUDE = {
  bankAccount: { select: { name: true, currency: true } },
  project: { select: { name: true } },
  workType: { select: { name: true } },
  pairedOperation: { select: { bankAccount: { select: { name: true } } } },
  pairedWith: { select: { bankAccount: { select: { name: true } } } },
  charges: {
    include: {
      charge: {
        select: {
          chargeNumber: true,
          invoiceNumber: true,
          amount: true,
          status: true,
          order: { select: { project: { select: { name: true } } } },
        },
      },
    },
  },
} as const;

type OperationWithRelations = Prisma.BankOperationGetPayload<{
  include: typeof OPERATION_INCLUDE;
}>;

function toRow(op: OperationWithRelations): BankOperationRow {
  return {
    id: op.id,
    bankAccountId: op.bankAccountId,
    bankAccountName: op.bankAccount.name,
    currency: op.bankAccount.currency,
    transferSource: op.transferSource,
    amount: op.amount,
    date: op.date,
    month: op.month,
    year: op.year,
    kind: op.kind,
    isInternalTransfer: op.isInternalTransfer,
    pairedOperationId: op.pairedOperationId,
    pairedAccountName:
      op.pairedOperation?.bankAccount.name ?? op.pairedWith?.bankAccount.name ?? null,
    counterpartyName: op.counterpartyName,
    counterpartyType: op.counterpartyType,
    projectId: op.projectId,
    projectName: op.project?.name ?? null,
    workTypeId: op.workTypeId,
    workTypeName: op.workType?.name ?? null,
    workDescription: op.workDescription,
    paymentOrder: op.paymentOrder,
    paymentPurpose: op.paymentPurpose,
    basis: op.basis,
    status: op.status,
    chargeMatch: op.chargeMatch,
    comment: op.comment,
    confirmedAt: op.confirmedAt,
    confirmedByName: op.confirmedByName,
    raw: {
      docNumber: op.rawDocNumber,
      date: op.rawDate,
      amount: op.rawAmount,
      currency: op.rawCurrency,
      operationType: op.rawOperationType,
      counterparty: op.rawCounterparty,
      inn: op.rawInn,
      account: op.rawAccount,
      bik: op.rawBik,
      purpose: op.rawPurpose,
      category: op.rawCategory,
    },
    trace: {
      counterparty: op.traceCounterparty,
      project: op.traceProject,
      workType: op.traceWorkType,
    },
    charges: op.charges.map((c) => ({
      chargeId: c.chargeId,
      chargeNumber: c.charge.chargeNumber,
      invoiceNumber: c.charge.invoiceNumber,
      chargeAmount: c.charge.amount,
      chargeStatus: c.charge.status,
      projectName: c.charge.order?.project.name ?? null,
      amount: c.amount,
      link: c.link,
      reason: c.reason,
    })),
  };
}

export async function listBankOperations(): Promise<BankOperationRow[]> {
  const operations = await prisma.bankOperation.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: OPERATION_INCLUDE,
  });
  return operations.map(toRow);
}

/** Начисления для привязки пополнения: всё, что ещё не закрыто полностью. */
export type ChargeCandidate = {
  id: string;
  chargeNumber: string;
  invoiceNumber: string | null;
  projectName: string | null;
  bankAccountName: string | null;
  amount: number;
  linkedAmount: number;
  status: string;
  issuedAt: Date | null;
  paidPlanAt: Date | null;
  paymentPurpose: string | null;
};

export async function listChargeCandidates(): Promise<ChargeCandidate[]> {
  const charges = await prisma.charge.findMany({
    orderBy: [{ paidPlanAt: "asc" }, { chargeNumber: "asc" }],
    include: {
      bankAccount: { select: { name: true } },
      order: { select: { project: { select: { name: true } } } },
      operationLinks: { select: { amount: true, bankOperation: { select: { amount: true } } } },
    },
  });

  return charges.map((c) => ({
    id: c.id,
    chargeNumber: c.chargeNumber,
    invoiceNumber: c.invoiceNumber,
    projectName: c.order?.project.name ?? null,
    bankAccountName: c.bankAccount?.name ?? null,
    amount: c.amount,
    linkedAmount: c.operationLinks.reduce(
      (sum, link) => sum + (link.amount ?? link.bankOperation.amount),
      0
    ),
    status: c.status,
    issuedAt: c.issuedAt,
    paidPlanAt: c.paidPlanAt,
    paymentPurpose: c.paymentPurpose,
  }));
}

/** Признак, по которому контрагента узнавать в следующих выписках. */
export type RememberBy = "name" | "account" | "inn";

const REMEMBER_LABELS: Record<RememberBy, string> = {
  name: "имени в выписке",
  account: "номеру счёта",
  inn: "ИНН",
};

export type UpdateBankOperationInput = {
  counterpartyName?: string | null;
  counterpartyType?: string | null;
  projectId?: string | null;
  workTypeId?: string | null;
  workDescription?: string | null;
  paymentOrder?: string | null;
  paymentPurpose?: string | null;
  basis?: string | null;
  kind?: string;
  isInternalTransfer?: boolean;
  status?: string;
  comment?: string | null;
  /** Выбран в блоке «запоминать по» — уходит в трассировку контрагента. */
  rememberBy?: RememberBy | null;
};

export async function updateBankOperation(
  id: string,
  patch: UpdateBankOperationInput,
  userId: string
) {
  const before = await prisma.bankOperation.findUnique({ where: { id } });
  if (!before) throw new Error("Bank operation not found");

  const { rememberBy, ...fields } = patch;

  const data: Record<string, unknown> = { ...fields };

  // Контрагента поправили руками — трассировка должна это показывать.
  if (fields.counterpartyName !== undefined && fields.counterpartyName !== before.counterpartyName) {
    const rememberValue =
      rememberBy === "name"
        ? before.rawCounterparty
        : rememberBy === "account"
          ? before.rawAccount
          : rememberBy === "inn"
            ? before.rawInn
            : null;
    data.traceCounterparty = rememberBy
      ? `привязан вручную, дальше узнаём по ${REMEMBER_LABELS[rememberBy]}${rememberValue ? ` ${rememberValue}` : ""}`
      : "привязан вручную, разово";
  }

  if (fields.projectId !== undefined && fields.projectId !== before.projectId) {
    data.traceProject = fields.projectId ? "проставлен вручную" : null;
  }
  if (fields.workTypeId !== undefined && fields.workTypeId !== before.workTypeId) {
    data.traceWorkType = fields.workTypeId ? "проставлен вручную" : null;
  }

  if (fields.status === "confirmed") {
    data.confirmedAt = new Date();
    data.confirmedByName = await resolveUserName(userId);
  } else if (fields.status !== undefined && before.status === "confirmed") {
    data.confirmedAt = null;
    data.confirmedByName = null;
  }

  const updated = await prisma.bankOperation.update({ where: { id }, data });

  const changes = diff(
    before as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  );
  if (Object.keys(changes).length > 0) {
    await logActivity({
      userId,
      action: "update",
      entityType: "BankOperation",
      entityId: id,
      entityLabel: operationLabel(updated),
      changes,
    });
  }

  return updated;
}

export type BulkBankOperationPatch = {
  status?: string;
  projectId?: string | null;
  workTypeId?: string | null;
  isInternalTransfer?: boolean;
};

export async function bulkUpdateBankOperations(
  ids: string[],
  patch: BulkBankOperationPatch,
  userId: string
): Promise<number> {
  if (!ids.length) return 0;

  const before = await prisma.bankOperation.findMany({ where: { id: { in: ids } } });
  const data: Record<string, unknown> = { ...patch };

  if (patch.status === "confirmed") {
    data.confirmedAt = new Date();
    data.confirmedByName = await resolveUserName(userId);
  }
  if (patch.projectId !== undefined) data.traceProject = patch.projectId ? "проставлен вручную" : null;
  if (patch.workTypeId !== undefined) data.traceWorkType = patch.workTypeId ? "проставлен вручную" : null;

  const result = await prisma.bankOperation.updateMany({ where: { id: { in: ids } }, data });

  for (const row of before) {
    await logActivity({
      userId,
      action: patch.status ? "status_change" : "update",
      entityType: "BankOperation",
      entityId: row.id,
      entityLabel: operationLabel(row),
      changes: diff(row as unknown as Record<string, unknown>, data),
    });
  }

  return result.count;
}

export type ChargeLinkInput = {
  chargeId: string;
  amount?: number | null;
};

/**
 * Полностью переписывает привязку операции к начислениям.
 * Пустой список = «без начисления» (chargeMatch = no_charge задаётся отдельно).
 */
export async function setBankOperationCharges(
  operationId: string,
  links: ChargeLinkInput[],
  userId: string
) {
  const before = await prisma.bankOperation.findUnique({
    where: { id: operationId },
    include: { charges: true },
  });
  if (!before) throw new Error("Bank operation not found");

  await prisma.$transaction(async (tx) => {
    await tx.bankOperationCharge.deleteMany({ where: { bankOperationId: operationId } });
    if (links.length) {
      await tx.bankOperationCharge.createMany({
        data: links.map((l) => ({
          bankOperationId: operationId,
          chargeId: l.chargeId,
          amount: l.amount ?? null,
          link: "confirmed",
        })),
      });
    }
    await tx.bankOperation.update({
      where: { id: operationId },
      data: { chargeMatch: links.length ? "confirmed" : "not_linked" },
    });
  });

  await logActivity({
    userId,
    action: "update",
    entityType: "BankOperation",
    entityId: operationId,
    entityLabel: operationLabel(before),
    changes: {
      charges: {
        from: before.charges.map((c) => c.chargeId),
        to: links.map((l) => l.chargeId),
      },
    },
  });

  return prisma.bankOperation.findUnique({
    where: { id: operationId },
    include: OPERATION_INCLUDE,
  });
}

/** «Без начисления» — операция не должна попадать в сверку. */
export async function markBankOperationWithoutCharge(operationId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.bankOperationCharge.deleteMany({ where: { bankOperationId: operationId } });
    await tx.bankOperation.update({
      where: { id: operationId },
      data: { chargeMatch: "no_charge" },
    });
  });

  await logActivity({
    userId,
    action: "update",
    entityType: "BankOperation",
    entityId: operationId,
    entityLabel: "Банковская операция",
    changes: { chargeMatch: { from: null, to: "no_charge" } },
  });
}

async function resolveUserName(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  return user?.fullName ?? null;
}

function operationLabel(op: { amount: number; date: Date; counterpartyName: string | null }): string {
  const date = op.date.toISOString().slice(0, 10);
  return `${date} · ${op.amount.toFixed(2)} · ${op.counterpartyName ?? "без контрагента"}`;
}
