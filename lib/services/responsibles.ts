/**
 * ResponsibleService (TDNB-25).
 *
 * «Ответственный» — это User с role=responsible. Отдельной модели нет.
 * Статус Активный/Архивный = User.isActive.
 *
 * C, D — через relation Project.responsibleUserId.
 */

import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { logActivity, diff } from "@/lib/audit/log";


export type ResponsibleListRow = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  projectCount: number;
  projects: { id: string; name: string }[];
  createdAt: Date;
};

export async function listResponsibles(): Promise<ResponsibleListRow[]> {
  const users = await prisma.user.findMany({
    where: { role: "responsible" },
    orderBy: { fullName: "asc" },
    include: {
      responsibleProjects: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });

  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    isActive: u.isActive,
    projectCount: u.responsibleProjects.length,
    projects: u.responsibleProjects.map((p) => ({ id: p.id, name: p.name })),
    createdAt: u.createdAt,
  }));
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
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before || before.role !== "responsible") throw new Error("Responsible not found");

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
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "responsible") throw new Error("Responsible not found");

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
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "responsible") throw new Error("Responsible not found");
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
  const responsible = await prisma.user.findUnique({ where: { id: responsibleId } });
  if (!responsible || responsible.role !== "responsible") throw new Error("Responsible not found");

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
