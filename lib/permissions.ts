/**
 * Permissions — единый набор проверок прав.
 *
 * Принципы (см. TZ §Глобальные правила, TDNB-15, TDNB-29):
 * - admin — всегда «да».
 * - responsible (PM) — только в проектах, где `Project.responsibleUserId = currentUser.id`.
 * - executor — только свои данные (`Work.executorId === user.executorId` и т.п.).
 * - Доступ executor отзывается через `Executor.accessRevokedAt`.
 */

import { prisma } from "@/lib/db";

export type SessionLike = {
  id: string;
  role: string;
  executorId?: string | null;
  isResponsible?: boolean;
  responsibleActive?: boolean;
};

export type ProjectLike = { responsibleUserId: string | null };
export type WorkLike = { executorId: string; projectId: string };

// ────────────────────── Базовые ─────────────────────────────

export function isAdmin(user: SessionLike | null | undefined): boolean {
  return user?.role === "admin";
}

export function isResponsible(user: SessionLike | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "responsible") return user.responsibleActive !== false;
  return (
    user.role === "executor" &&
    user.isResponsible === true &&
    user.responsibleActive !== false
  );
}

export function isExecutor(user: SessionLike | null | undefined): boolean {
  return user?.role === "executor";
}

// ────────────────────── Проекты ─────────────────────────────

export function canViewProject(user: SessionLike, project: ProjectLike): boolean {
  if (isAdmin(user)) return true;
  if (isResponsible(user)) return project.responsibleUserId === user.id;
  return false;
}

export function canManageSpendingPlan(user: SessionLike, project: ProjectLike): boolean {
  if (isAdmin(user)) return true;
  return isResponsible(user) && project.responsibleUserId === user.id;
}

// ────────────────────── Работы ─────────────────────────────

export function canViewWork(
  user: SessionLike,
  work: WorkLike,
  project: ProjectLike
): boolean {
  if (isAdmin(user)) return true;
  if (isResponsible(user)) return project.responsibleUserId === user.id;
  if (isExecutor(user)) return !!user.executorId && work.executorId === user.executorId;
  return false;
}

export function canEditWork(
  user: SessionLike,
  work: { executorId: string; workStatus: string }
): boolean {
  if (isAdmin(user)) return true;
  if (work.workStatus === "checked") return false; // только admin
  if (isExecutor(user)) return !!user.executorId && work.executorId === user.executorId;
  return false;
}

// ────────────────────── Исполнители ─────────────────────────

/**
 * Может ли user смотреть Личную смету исполнителя `executorId`.
 * Требует обращения в БД (для проверки ProjectExecutor связи у PM и accessRevokedAt у executor).
 */
export async function canViewExecutorEstimate(
  user: SessionLike,
  executorId: string
): Promise<boolean> {
  if (isAdmin(user)) return true;

  if (isExecutor(user)) {
    if (user.executorId !== executorId) return false;
    const exec = await prisma.executor.findUnique({
      where: { id: executorId },
      select: { accessRevokedAt: true, status: true },
    });
    return !!exec && exec.accessRevokedAt == null && exec.status === "active";
  }

  if (isResponsible(user)) {
    const projectExecutor = await prisma.projectExecutor.findFirst({
      where: {
        executorId,
        project: { responsibleUserId: user.id, status: "active" },
      },
    });
    return !!projectExecutor;
  }

  return false;
}

// ────────────────────── Прочие траты ────────────────────────

export function canEditOtherExpenseRow(
  user: SessionLike,
  row: { createdById: string; responsibleUserId: string; workStatus: string }
): boolean {
  if (isAdmin(user)) return true;
  if (row.workStatus === "checked") return false; // только admin
  if (isResponsible(user)) {
    return row.createdById === user.id || row.responsibleUserId === user.id;
  }
  return false;
}

// ────────────────────── Утилиты ─────────────────────────────

export function assertAdmin(user: SessionLike | null | undefined): void {
  if (!isAdmin(user)) throw new Error("403: Forbidden");
}

export function assertOwnsExecutor(user: SessionLike | null | undefined, executorId: string): void {
  if (!user) throw new Error("401: Unauthorized");
  if (isAdmin(user)) return;
  if (user.executorId !== executorId) throw new Error("403: Forbidden");
}

export function forbidden(): Response {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
