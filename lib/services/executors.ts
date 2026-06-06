/**
 * ExecutorService (TDNB-18).
 *
 * Типы: permanent | external | service | bank
 *  - permanent → User (login) + Executor
 *  - external / service / bank → Executor без логина (legacy external-person с userId сохраняется)
 */

import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { logActivity, diff } from "@/lib/audit/log";
import { seedOnboardingTasks } from "@/lib/services/tasks";
import { assertCanUnsetResponsible } from "@/lib/services/responsibles";
import { parseRecipientTypes, serializeRecipientTypes } from "@/lib/executor-recipient-type";
import {
  canBeResponsible,
  formatNameForExecutorType,
  normalizeExecutorType,
} from "@/lib/executor-type";
import type { ExecutorType } from "@/lib/statuses";


export type ExecutorListRow = {
  id: string;
  name: string; // A
  companyStatus: string | null; // B
  type: string; // D
  workTypeIds: string[]; // E (raw ids)
  workTypeNames: string[]; // E (resolved labels)
  projectNames: string[]; // F (из плана расходов, как plan-projects)
  responsibleUserId: string | null;
  responsibleName: string | null; // G
  defaultBankAccountId: string | null;
  defaultBankAccountName: string | null; // H
  recipientTypes: string[]; // I (из recipientType JSON / legacy)
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
  const [executors, planLines] = await Promise.all([
    prisma.executor.findMany({
      orderBy: [{ name: "asc" }],
      include: {
        user: { select: { id: true, email: true } },
        responsibleUser: { select: { id: true, fullName: true } },
        defaultBankAccount: { select: { id: true, name: true } },
        executorWorkTypes: { include: { workType: { select: { id: true, name: true } } } },
        payments: {
          where: { paymentStatus: "paid" },
          orderBy: { paidAt: "desc" },
          take: 1,
          select: { paidAt: true },
        },
      },
    }),
    prisma.spendingPlanLine.findMany({
      select: {
        executorId: true,
        projectId: true,
        project: { select: { name: true, status: true } },
      },
    }),
  ]);

  const planByExecutorId = new Map<string, Map<string, string>>();
  for (const line of planLines) {
    if (line.project.status === "archived") continue;
    let byProject = planByExecutorId.get(line.executorId);
    if (!byProject) {
      byProject = new Map();
      planByExecutorId.set(line.executorId, byProject);
    }
    byProject.set(line.projectId, line.project.name);
  }

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
    const projects = Array.from(planByExecutorId.get(e.id)?.values() ?? []).sort((a, b) =>
      a.localeCompare(b, "ru")
    );

    return {
      id: e.id,
      name: e.name,
      companyStatus: e.companyStatus,
      type: e.type,
      workTypeIds: workTypes.map((wt) => wt.id),
      workTypeNames: workTypes.map((wt) => wt.name).sort((a, b) => a.localeCompare(b, "ru")),
      projectNames: projects,
      responsibleUserId: e.responsibleUserId,
      responsibleName: e.responsibleUser?.fullName ?? null,
      defaultBankAccountId: e.defaultBankAccountId,
      defaultBankAccountName: e.defaultBankAccount?.name ?? null,
      recipientTypes: parseRecipientTypes(e.recipientType),
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
      type: "permanent";
      firstName: string;
      lastName: string;
      email: string;
      password?: string;
      companyStatus?: string | null;
      responsibleUserId?: string | null;
      specialty?: string | null;
      defaultBankAccountId?: string | null;
      recipientTypes?: string[];
      recipientType?: string | null;
    }
  | {
      type: "external" | "service" | "bank";
      name: string;
      responsibleUserId?: string | null;
      recipientTypes?: string[];
      recipientType?: string | null;
      defaultBankAccountId?: string | null;
    };

function recipientTypeForCreate(input: {
  recipientTypes?: string[];
  recipientType?: string | null;
}): string | null {
  if (input.recipientTypes !== undefined) {
    return serializeRecipientTypes(input.recipientTypes);
  }
  if (input.recipientType) {
    return serializeRecipientTypes(parseRecipientTypes(input.recipientType));
  }
  return null;
}

export function executorDisplayName(input: CreateExecutorInput): string {
  if (input.type === "permanent") {
    return `${input.lastName.trim()} ${input.firstName.trim()}`;
  }
  return formatNameForExecutorType(input.type, input.name);
}

export async function createExecutor(input: CreateExecutorInput, userId: string) {
  const name = executorDisplayName(input);

  const created = await prisma.$transaction(async (tx) => {
    let userIdToLink: string | null = null;

    if (input.type === "permanent") {
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
        companyStatus: input.type === "permanent" ? input.companyStatus ?? null : null,
        recipientType: recipientTypeForCreate(input),
        specialty: input.type === "permanent" ? input.specialty ?? null : null,
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

  if (input.type === "permanent") {
    await seedOnboardingTasks(created.id, userId);
  }

  return created;
}

export type UpdateExecutorInput = {
  type?: ExecutorType;
  name?: string;
  email?: string;
  password?: string;
  companyStatus?: string | null;
  specialty?: string | null;
  contacts?: string | null;
  requisites?: string | null;
  note?: string | null;
  inTgChat?: boolean;
  contractFile?: string | null;
  ndaFile?: string | null;
  recipientTypes?: string[];
  recipientType?: string | null;
  responsibleUserId?: string | null;
  defaultBankAccountId?: string | null;
  oldEstimateUrl?: string | null;
  specialties?: string | null;
  isResponsible?: boolean;
  workTypeIds?: string[];
};

export async function updateExecutor(id: string, patch: UpdateExecutorInput, userId: string) {
  const before = await prisma.executor.findUnique({
    where: { id },
    include: { executorWorkTypes: true },
  });
  if (!before) throw new Error("Executor not found");

  const nextType = patch.type ?? normalizeExecutorType(before.type);

  if (patch.isResponsible === true && before.status === "archived") {
    throw new Error("Нельзя назначить ответственным архивного исполнителя");
  }

  if (patch.isResponsible === true && !canBeResponsible(nextType)) {
    throw new Error("Ответственным может быть только исполнитель типа «Постоянный»");
  }

  if (patch.isResponsible === false && before.isResponsible) {
    if (!before.userId) {
      throw new Error("Нельзя снять роль ответственного: у исполнителя нет учётной записи");
    }
    await assertCanUnsetResponsible(before.userId);
  }

  const needsAccount = nextType === "permanent" && !before.userId;
  if (needsAccount) {
    const email = patch.email?.trim().toLowerCase();
    if (!email) {
      throw new Error("Укажите email для создания учётной записи");
    }
    const password = patch.password ?? "Welcome2026!";
    if (password.length < 6) {
      throw new Error("Пароль не короче 6 символов");
    }
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

    const resolvedName =
      patch.name !== undefined
        ? formatNameForExecutorType(nextType, patch.name)
        : undefined;

    const clearResponsible =
      patch.type !== undefined && !canBeResponsible(nextType) && before.isResponsible;

    let linkedUserId: string | undefined;
    if (needsAccount) {
      const email = patch.email!.trim().toLowerCase();
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        throw new Error("Пользователь с таким email уже существует");
      }
      const displayName = resolvedName ?? before.name;
      const user = await tx.user.create({
        data: {
          email,
          password: await hash(patch.password ?? "Welcome2026!", 10),
          fullName: displayName,
          role: "executor",
          isActive: true,
        },
      });
      linkedUserId = user.id;
    }

    return tx.executor.update({
      where: { id },
      data: {
        ...(linkedUserId && { userId: linkedUserId, accessRevokedAt: null }),
        ...(patch.type !== undefined && { type: nextType }),
        ...(resolvedName !== undefined && { name: resolvedName }),
        ...(patch.type !== undefined &&
          nextType !== "permanent" && { companyStatus: null }),
        ...(patch.companyStatus !== undefined && { companyStatus: patch.companyStatus }),
        ...(patch.specialty !== undefined && { specialty: patch.specialty }),
        ...(patch.contacts !== undefined && { contacts: patch.contacts }),
        ...(patch.requisites !== undefined && { requisites: patch.requisites }),
        ...(patch.note !== undefined && { note: patch.note }),
        ...(patch.inTgChat !== undefined && { inTgChat: patch.inTgChat }),
        ...(patch.contractFile !== undefined && { contractFile: patch.contractFile }),
        ...(patch.ndaFile !== undefined && { ndaFile: patch.ndaFile }),
        ...(patch.recipientTypes !== undefined && {
          recipientType: serializeRecipientTypes(patch.recipientTypes),
        }),
        ...(patch.recipientType !== undefined &&
          patch.recipientTypes === undefined && {
            recipientType: patch.recipientType
              ? serializeRecipientTypes(parseRecipientTypes(patch.recipientType))
              : null,
          }),
        ...(patch.responsibleUserId !== undefined && { responsibleUserId: patch.responsibleUserId }),
        ...(patch.defaultBankAccountId !== undefined && {
          defaultBankAccountId: patch.defaultBankAccountId,
        }),
        ...(patch.oldEstimateUrl !== undefined && { oldEstimateUrl: patch.oldEstimateUrl }),
        ...(patch.specialties !== undefined && { specialties: patch.specialties }),
        ...(clearResponsible && { isResponsible: false }),
        ...(patch.isResponsible !== undefined && {
          isResponsible: canBeResponsible(nextType) ? patch.isResponsible : false,
          ...(patch.isResponsible && canBeResponsible(nextType) && { responsibleActive: true }),
        }),
      },
    });
  });

  const changes = diff(
    {
      type: before.type,
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
      type: updated.type,
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

  if (needsAccount) {
    await seedOnboardingTasks(id, userId);
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
