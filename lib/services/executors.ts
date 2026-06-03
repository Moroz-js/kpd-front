/**
 * ExecutorService (TDNB-18).
 *
 * Создание — wizard:
 *  - permanent / external-person → создаём `User` (login) + `Executor`
 *  - external-legal / service / bank → только `Executor` (userId = null)
 *
 * Имя (A) формируется по типу:
 *  - permanent / external-person: "Фамилия Имя"
 *  - external-legal: "Название ТипЮрлица" (например, "Рога и Копыта ООО")
 *  - service: UPPER CASE
 *  - bank: как есть
 */

import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { logActivity, diff } from "@/lib/audit/log";
import { seedOnboardingTasks } from "@/lib/services/tasks";
import { assertCanUnsetResponsible } from "@/lib/services/responsibles";


export type ExecutorListRow = {
  id: string;
  name: string; // A
  companyStatus: string | null; // B
  workOpsCount: number; // C: works + otherExpenses
  type: string; // D
  workTypeIds: string[]; // E (raw ids)
  workTypeNames: string[]; // E (resolved labels)
  projectNames: string[]; // F (через ProjectExecutor)
  responsibleUserId: string | null;
  responsibleName: string | null; // G
  defaultBankAccountId: string | null;
  defaultBankAccountName: string | null; // H
  recipientType: string | null; // I
  requisites: string | null; // J
  contacts: string | null; // K
  userId: string | null;
  email: string | null;
  inTgChat: boolean; // L
  specialty: string | null; // M
  note: string | null; // N
  contractFile: string | null; // O
  ndaFile: string | null; // P
  hasAccess: boolean; // S
  status: string; // T
  lastPaidAt: Date | null; // U
  legalForm: string | null;
  createdAt: Date;
};

export async function listExecutors(): Promise<ExecutorListRow[]> {
  const executors = await prisma.executor.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      user: { select: { id: true, email: true } },
      responsibleUser: { select: { id: true, fullName: true } },
      defaultBankAccount: { select: { id: true, name: true } },
      executorWorkTypes: { include: { workType: { select: { id: true, name: true } } } },
      projectExecutors: { include: { project: { select: { name: true } } } },
      _count: { select: { works: true, otherExpenses: true } },
      payments: {
        where: { paymentStatus: "paid" },
        orderBy: { paidAt: "desc" },
        take: 1,
        select: { paidAt: true },
      },
    },
  });

  // Доп: последняя дата выплаты также может быть через OtherExpense.paymentDate (paid).
  const otherPayments = await prisma.otherExpense.groupBy({
    by: ["executorId"],
    where: { paymentStatus: "paid", paidAt: { not: null } },
    _max: { paidAt: true },
  });
  const otherPaymentMap = new Map(
    otherPayments.map((o) => [o.executorId, o._max?.paidAt ?? null])
  );

  return executors.map((e) => {
    const lastFromPayments = e.payments[0]?.paidAt ?? null;
    const lastFromOther = otherPaymentMap.get(e.id) ?? null;
    const lastPaidAt =
      lastFromPayments && lastFromOther
        ? lastFromPayments > lastFromOther
          ? lastFromPayments
          : lastFromOther
        : lastFromPayments ?? lastFromOther;

    const workTypes = e.executorWorkTypes.map((ewt) => ewt.workType);
    const projects = e.projectExecutors
      .map((pe) => pe.project.name)
      .sort((a, b) => a.localeCompare(b, "ru"));

    return {
      id: e.id,
      name: e.name,
      companyStatus: e.companyStatus,
      workOpsCount: e._count.works + e._count.otherExpenses,
      type: e.type,
      workTypeIds: workTypes.map((wt) => wt.id),
      workTypeNames: workTypes.map((wt) => wt.name).sort((a, b) => a.localeCompare(b, "ru")),
      projectNames: projects,
      responsibleUserId: e.responsibleUserId,
      responsibleName: e.responsibleUser?.fullName ?? null,
      defaultBankAccountId: e.defaultBankAccountId,
      defaultBankAccountName: e.defaultBankAccount?.name ?? null,
      recipientType: e.recipientType,
      requisites: e.requisites,
      contacts: e.contacts,
      userId: e.user?.id ?? null,
      email: e.user?.email ?? null,
      inTgChat: e.inTgChat,
      specialty: e.specialty,
      note: e.note,
      contractFile: e.contractFile,
      ndaFile: e.ndaFile,
      hasAccess: e.accessRevokedAt == null && e.userId != null,
      status: e.status,
      lastPaidAt,
      legalForm: e.legalForm,
      createdAt: e.createdAt,
    };
  });
}

export type CreateExecutorInput =
  | {
      type: "permanent" | "external-person";
      firstName: string;
      lastName: string;
      email: string;
      password?: string;
      companyStatus?: string | null;
      responsibleUserId?: string | null;
      specialty?: string | null;
      defaultBankAccountId?: string | null;
      recipientType?: string | null;
    }
  | {
      type: "external-legal";
      legalName: string;
      legalForm: string;
      responsibleUserId?: string | null;
      recipientType?: string | null;
      defaultBankAccountId?: string | null;
    }
  | {
      type: "service";
      legalName: string;
      responsibleUserId?: string | null;
      recipientType?: string | null;
      defaultBankAccountId?: string | null;
    };

export function executorDisplayName(input: CreateExecutorInput): string {
  if (input.type === "permanent" || input.type === "external-person") {
    return `${input.lastName.trim()} ${input.firstName.trim()}`;
  }
  if (input.type === "external-legal") {
    return `${input.legalName.trim()} ${input.legalForm.trim()}`;
  }
  return (input as { legalName: string }).legalName.trim().toUpperCase();
}

export async function createExecutor(input: CreateExecutorInput, userId: string) {
  const name = executorDisplayName(input);

  const created = await prisma.$transaction(async (tx) => {
    let userIdToLink: string | null = null;

    if (input.type === "permanent" || input.type === "external-person") {
      const passwordHash = await hash(input.password ?? "Welcome2026!", 10);
      const user = await tx.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          password: passwordHash,
          fullName: name,
          role: "executor",
          isActive: true,
        },
      });
      userIdToLink = user.id;
    }

    return tx.executor.create({
      data: {
        name,
        type: input.type,
        userId: userIdToLink,
        companyStatus: "companyStatus" in input ? input.companyStatus ?? null : null,
        legalForm: input.type === "external-legal" ? input.legalForm : null,
        recipientType: input.recipientType ?? null,
        specialty: "specialty" in input ? input.specialty ?? null : null,
        responsibleUserId: input.responsibleUserId ?? null,
        defaultBankAccountId: input.defaultBankAccountId ?? null,
        status: "active",
      },
    });
  });

  await logActivity({
    userId,
    action: "create",
    entityType: "Executor",
    entityId: created.id,
    entityLabel: created.name,
  });

  // Онбординг — только для исполнителей с учёткой (permanent / external-person)
  if (input.type === "permanent" || input.type === "external-person") {
    await seedOnboardingTasks(created.id, userId);
  }

  return created;
}

export type UpdateExecutorInput = {
  name?: string;
  companyStatus?: string | null;
  specialty?: string | null;
  contacts?: string | null;
  requisites?: string | null;
  note?: string | null;
  inTgChat?: boolean;
  contractFile?: string | null;
  ndaFile?: string | null;
  recipientType?: string | null;
  responsibleUserId?: string | null;
  defaultBankAccountId?: string | null;
  oldEstimateUrl?: string | null;
  entityForm?: string | null;
  specialties?: string | null;
  isResponsible?: boolean;
  workTypeIds?: string[]; // полная замена
};

export async function updateExecutor(id: string, patch: UpdateExecutorInput, userId: string) {
  const before = await prisma.executor.findUnique({
    where: { id },
    include: { executorWorkTypes: true },
  });
  if (!before) throw new Error("Executor not found");

  if (patch.isResponsible === true && before.status === "archived") {
    throw new Error("Нельзя назначить ответственным архивного исполнителя");
  }

  if (patch.isResponsible === false && before.isResponsible) {
    if (!before.userId) {
      throw new Error("Нельзя снять роль ответственного: у исполнителя нет учётной записи");
    }
    await assertCanUnsetResponsible(before.userId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (patch.workTypeIds) {
      await tx.executorWorkType.deleteMany({ where: { executorId: id } });
      if (patch.workTypeIds.length > 0) {
        await tx.executorWorkType.createMany({
          data: patch.workTypeIds.map((wtId) => ({ executorId: id, workTypeId: wtId })),
        });
      }
    }

    return tx.executor.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name.trim() }),
        ...(patch.companyStatus !== undefined && { companyStatus: patch.companyStatus }),
        ...(patch.specialty !== undefined && { specialty: patch.specialty }),
        ...(patch.contacts !== undefined && { contacts: patch.contacts }),
        ...(patch.requisites !== undefined && { requisites: patch.requisites }),
        ...(patch.note !== undefined && { note: patch.note }),
        ...(patch.inTgChat !== undefined && { inTgChat: patch.inTgChat }),
        ...(patch.contractFile !== undefined && { contractFile: patch.contractFile }),
        ...(patch.ndaFile !== undefined && { ndaFile: patch.ndaFile }),
        ...(patch.recipientType !== undefined && { recipientType: patch.recipientType }),
        ...(patch.responsibleUserId !== undefined && { responsibleUserId: patch.responsibleUserId }),
        ...(patch.defaultBankAccountId !== undefined && {
          defaultBankAccountId: patch.defaultBankAccountId,
        }),
        ...(patch.oldEstimateUrl !== undefined && { oldEstimateUrl: patch.oldEstimateUrl }),
        ...(patch.entityForm !== undefined && { entityForm: patch.entityForm }),
        ...(patch.specialties !== undefined && { specialties: patch.specialties }),
        ...(patch.isResponsible !== undefined && {
          isResponsible: patch.isResponsible,
          ...(patch.isResponsible && { responsibleActive: true }),
        }),
      },
    });
  });

  const changes = diff(
    {
      name: before.name,
      companyStatus: before.companyStatus,
      specialty: before.specialty,
      contacts: before.contacts,
      requisites: before.requisites,
      note: before.note,
      inTgChat: before.inTgChat,
      contractFile: before.contractFile,
      ndaFile: before.ndaFile,
      recipientType: before.recipientType,
      responsibleUserId: before.responsibleUserId,
      defaultBankAccountId: before.defaultBankAccountId,
    },
    {
      name: updated.name,
      companyStatus: updated.companyStatus,
      specialty: updated.specialty,
      contacts: updated.contacts,
      requisites: updated.requisites,
      note: updated.note,
      inTgChat: updated.inTgChat,
      contractFile: updated.contractFile,
      ndaFile: updated.ndaFile,
      recipientType: updated.recipientType,
      responsibleUserId: updated.responsibleUserId,
      defaultBankAccountId: updated.defaultBankAccountId,
    }
  );
  if (Object.keys(changes).length > 0) {
    await logActivity({
      userId,
      action: "update",
      entityType: "Executor",
      entityId: id,
      entityLabel: updated.name,
      changes,
    });
  }

  return updated;
}

export type ArchiveExecutorPrecheck = {
  openWorks: number;
  pendingPayments: number;
};

export async function archiveExecutorPrecheck(id: string): Promise<ArchiveExecutorPrecheck> {
  const [openWorks, pendingPayments] = await Promise.all([
    prisma.work.count({
      where: { executorId: id, workStatus: { in: ["submitted", "checked", "rework"] } },
    }),
    prisma.payment.count({
      where: { executorId: id, paymentStatus: "planned" },
    }),
  ]);
  return { openWorks, pendingPayments };
}

export async function archiveExecutor(id: string, userId: string) {
  const exec = await prisma.executor.findUnique({ where: { id } });
  if (!exec) throw new Error("Executor not found");
  const updated = await prisma.executor.update({
    where: { id },
    data: { status: "archived", accessRevokedAt: new Date() },
  });
  await logActivity({
    userId,
    action: "archive",
    entityType: "Executor",
    entityId: id,
    entityLabel: updated.name,
  });
  return updated;
}

export async function unarchiveExecutor(id: string, userId: string) {
  const exec = await prisma.executor.findUnique({ where: { id } });
  if (!exec) throw new Error("Executor not found");
  const updated = await prisma.executor.update({
    where: { id },
    data: { status: "active" },
  });
  await logActivity({
    userId,
    action: "unarchive",
    entityType: "Executor",
    entityId: id,
    entityLabel: updated.name,
  });
  return updated;
}

/**
 * S=true: даёт доступ к смете.
 * - Снимает accessRevokedAt
 * - Если onboardingSeeded=false → сеет онбординг-задачи (см. TDNB-15) — реализация в TDNB-15.
 */
export async function grantExecutorAccess(id: string, userId: string) {
  const exec = await prisma.executor.findUnique({ where: { id } });
  if (!exec) throw new Error("Executor not found");
  if (!exec.userId) throw new Error("Cannot grant access — у исполнителя нет учётной записи");

  const updated = await prisma.executor.update({
    where: { id },
    data: { accessRevokedAt: null },
  });

  await logActivity({
    userId,
    action: "access_grant",
    entityType: "Executor",
    entityId: id,
    entityLabel: updated.name,
  });

  return updated;
}

export async function revokeExecutorAccess(id: string, userId: string) {
  const exec = await prisma.executor.findUnique({ where: { id } });
  if (!exec) throw new Error("Executor not found");
  const updated = await prisma.executor.update({
    where: { id },
    data: { accessRevokedAt: new Date() },
  });
  await logActivity({
    userId,
    action: "access_revoke",
    entityType: "Executor",
    entityId: id,
    entityLabel: updated.name,
  });
  return updated;
}
