/**
 * ResponsibleService (TDNB-25).
 *
 * Ответственный = исполнитель с `isResponsible = true` (и привязанный User для проектов).
 * Статус ответственного: `Executor.responsibleActive` (активный/архивный в UI).
 * Статус исполнителя: `Executor.status` — независим.
 *
 * Учётные записи только с role=responsible (без Executor) — legacy, архив через User.isActive.
 */

import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { logActivity, diff } from "@/lib/audit/log";

export type ResponsibleListRow = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  executorId: string | null;
  projectCount: number;
  projects: { id: string; name: string }[];
  createdAt: Date;
};

function mapExecutorRow(
  e: {
    id: string;
    responsibleActive: boolean;
    createdAt: Date;
    user: { id: string; fullName: string; email: string } | null;
    userId: string | null;
  },
  projects: { id: string; name: string }[]
): ResponsibleListRow | null {
  if (!e.userId || !e.user) return null;
  return {
    id: e.user.id,
    fullName: e.user.fullName,
    email: e.user.email,
    isActive: e.responsibleActive,
    executorId: e.id,
    projectCount: projects.length,
    projects,
    createdAt: e.createdAt,
  };
}

export async function listResponsibles(): Promise<ResponsibleListRow[]> {
  const [fromExecutors, legacyUsers] = await Promise.all([
    prisma.executor.findMany({
      where: { isResponsible: true, userId: { not: null } },
      orderBy: { name: "asc" },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "responsible", executor: null },
      orderBy: { fullName: "asc" },
      include: {
        responsibleProjects: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    }),
  ]);

  const userIds = fromExecutors.map((e) => e.userId!).filter(Boolean);
  const projectsByUser = new Map<string, { id: string; name: string }[]>();
  if (userIds.length) {
    const projects = await prisma.project.findMany({
      where: { responsibleUserId: { in: userIds } },
      select: { id: true, name: true, responsibleUserId: true },
      orderBy: { name: "asc" },
    });
    for (const p of projects) {
      if (!p.responsibleUserId) continue;
      const list = projectsByUser.get(p.responsibleUserId) ?? [];
      list.push({ id: p.id, name: p.name });
      projectsByUser.set(p.responsibleUserId, list);
    }
  }

  const rows: ResponsibleListRow[] = [];
  for (const e of fromExecutors) {
    const mapped = mapExecutorRow(e, projectsByUser.get(e.userId!) ?? []);
    if (mapped) rows.push(mapped);
  }
  for (const u of legacyUsers) {
    rows.push({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      isActive: u.isActive,
      executorId: null,
      projectCount: u.responsibleProjects.length,
      projects: u.responsibleProjects.map((p) => ({ id: p.id, name: p.name })),
      createdAt: u.createdAt,
    });
  }

  return rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
}

export type ResponsibleUnsetBlockers = {
  projects: number;
  otherExpenses: number;
  executorsAsResponsible: number;
};

/** Связи, из‑за которых нельзя снять флаг «ответственный». */
export async function getResponsibleUnsetBlockers(
  userId: string
): Promise<ResponsibleUnsetBlockers> {
  const [projects, otherExpenses, executorsAsResponsible] = await Promise.all([
    prisma.project.count({ where: { responsibleUserId: userId } }),
    prisma.otherExpense.count({ where: { responsibleUserId: userId } }),
    prisma.executor.count({ where: { responsibleUserId: userId } }),
  ]);
  return { projects, otherExpenses, executorsAsResponsible };
}

export async function assertCanUnsetResponsible(userId: string): Promise<void> {
  const b = await getResponsibleUnsetBlockers(userId);
  if (b.projects === 0 && b.otherExpenses === 0 && b.executorsAsResponsible === 0) {
    return;
  }
  const parts: string[] = [];
  if (b.projects > 0) {
    parts.push(
      `${b.projects} ${b.projects === 1 ? "проект" : b.projects < 5 ? "проекта" : "проектов"} под руководством`
    );
  }
  if (b.otherExpenses > 0) {
    parts.push(
      `${b.otherExpenses} ${b.otherExpenses === 1 ? "запись" : b.otherExpenses < 5 ? "записи" : "записей"} в прочих тратах`
    );
  }
  if (b.executorsAsResponsible > 0) {
    parts.push(
      `${b.executorsAsResponsible} ${b.executorsAsResponsible === 1 ? "исполнитель" : b.executorsAsResponsible < 5 ? "исполнителя" : "исполнителей"}, за которых он ответственен`
    );
  }
  throw new Error(`Нельзя снять роль руководителя проекта: ${parts.join("; ")}.`);
}

async function findResponsibleTarget(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { executor: true },
  });
  if (!user) return null;
  if (user.executor?.isResponsible) return { user, executor: user.executor };
  if (user.role === "responsible") return { user, executor: null };
  return null;
}

export type CreateResponsibleInput = {
  fullName: string;
  email: string;
  password: string;
};

export async function createResponsible(input: CreateResponsibleInput, userId: string) {
  const passwordHash = await hash(input.password, 10);
  const created = await prisma.user.create({
    data: {
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      password: passwordHash,
      role: "responsible",
      isActive: true,
    },
  });

  await logActivity({
    userId,
    action: "create",
    entityType: "User",
    entityId: created.id,
    entityLabel: created.fullName,
  });

  return created;
}

export type UpdateResponsibleInput = {
  fullName?: string;
  email?: string;
};

export async function updateResponsible(id: string, patch: UpdateResponsibleInput, userId: string) {
  const target = await findResponsibleTarget(id);
  if (!target) throw new Error("Responsible not found");

  const before = target.user;
  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(patch.fullName !== undefined && { fullName: patch.fullName.trim() }),
      ...(patch.email !== undefined && { email: patch.email.trim().toLowerCase() }),
    },
  });

  const changes = diff(
    { fullName: before.fullName, email: before.email },
    { fullName: updated.fullName, email: updated.email }
  );
  if (Object.keys(changes).length > 0) {
    await logActivity({
      userId,
      action: "update",
      entityType: "User",
      entityId: id,
      entityLabel: updated.fullName,
      changes,
    });
  }

  return updated;
}

export async function archiveResponsible(id: string, userId: string) {
  const target = await findResponsibleTarget(id);
  if (!target) throw new Error("Responsible not found");

  if (target.executor) {
    const updated = await prisma.executor.update({
      where: { id: target.executor.id },
      data: { responsibleActive: false },
    });
    await logActivity({
      userId,
      action: "archive",
      entityType: "Executor",
      entityId: updated.id,
      entityLabel: updated.name,
      changes: { responsibleActive: { from: true, to: false } },
    });
    return target.user;
  }

  const updated = await prisma.user.update({ where: { id }, data: { isActive: false } });
  await logActivity({
    userId,
    action: "archive",
    entityType: "User",
    entityId: id,
    entityLabel: updated.fullName,
  });
  return updated;
}

export async function unarchiveResponsible(id: string, userId: string) {
  const target = await findResponsibleTarget(id);
  if (!target) throw new Error("Responsible not found");

  if (target.executor) {
    const updated = await prisma.executor.update({
      where: { id: target.executor.id },
      data: { responsibleActive: true },
    });
    await logActivity({
      userId,
      action: "unarchive",
      entityType: "Executor",
      entityId: updated.id,
      entityLabel: updated.name,
      changes: { responsibleActive: { from: false, to: true } },
    });
    return target.user;
  }

  const updated = await prisma.user.update({ where: { id }, data: { isActive: true } });
  await logActivity({
    userId,
    action: "unarchive",
    entityType: "User",
    entityId: id,
    entityLabel: updated.fullName,
  });
  return updated;
}

/**
 * Массово выставляет responsibleUserId по списку projectIds (включая снятие с тех, кого нет в списке).
 */
export async function assignResponsibleProjects(
  responsibleId: string,
  projectIds: string[],
  userId: string
) {
  const target = await findResponsibleTarget(responsibleId);
  if (!target) throw new Error("Responsible not found");

  const responsible = target.user;
  const idSet = new Set(projectIds);

  await prisma.$transaction(async (tx) => {
    const currentlyAssigned = await tx.project.findMany({
      where: { responsibleUserId: responsibleId },
      select: { id: true },
    });
    const currentIds = new Set(currentlyAssigned.map((p) => p.id));

    const toRemove = [...currentIds].filter((id) => !idSet.has(id));
    const toAdd = projectIds.filter((id) => !currentIds.has(id));

    if (toRemove.length) {
      await tx.project.updateMany({
        where: { id: { in: toRemove } },
        data: { responsibleUserId: null },
      });
    }
    if (toAdd.length) {
      await tx.project.updateMany({
        where: { id: { in: toAdd } },
        data: { responsibleUserId: responsibleId },
      });
    }
  });

  await logActivity({
    userId,
    action: "update",
    entityType: "User",
    entityId: responsibleId,
    entityLabel: responsible.fullName,
    changes: { projectIds: { from: null, to: projectIds } },
  });
}

/** Активные ответственные для dropdown (не архивные как PM). */
export async function listActiveResponsibleUsers() {
  const rows = await listResponsibles();
  return rows
    .filter((r) => r.isActive)
    .map((r) => ({ id: r.id, fullName: r.fullName }));
}
