/**
 * IssuedWorkService (TDNB-14).
 *
 * Это не отдельная таблица, а сервис обратной записи в источник (Work или OtherExpense)
 * для редактирования view-строки и процедуры «Проверки».
 *
 * §3.7 (Личная смета): обновляются Project, WorkType, plannedPayAt (Дата оплаты план)
 * §3.8 (Прочие траты): обновляются Project, WorkType, executionMonth, executionYear, Executor
 * Удаление в view запрещено — только в источнике.
 * Смена статуса на «Проверено» → checkedAt = now() в источнике.
 */

import { prisma } from "@/lib/db";
import { logActivity, diff } from "@/lib/audit/log";
import type { IssuedWorkSource } from "@/lib/views/issuedWorks";

export type IssuedWorkPatch = {
  projectId?: string;
  workTypeId?: string;
  plannedPayAt?: Date | null;
  executionMonth?: number;
  executionYear?: number;
  executorId?: string;
  workStatus?: string;
};

export async function updateIssuedWork(
  sourceType: IssuedWorkSource,
  sourceId: string,
  patch: IssuedWorkPatch,
  userId: string
) {
  if (sourceType === "personal") {
    return updatePersonal(sourceId, patch, userId);
  }
  return updateOther(sourceId, patch, userId);
}

async function updatePersonal(workId: string, patch: IssuedWorkPatch, userId: string) {
  const before = await prisma.work.findUnique({ where: { id: workId } });
  if (!before) throw new Error("Work not found");

  // §3.7 разрешённые: project, workType, plannedPayAt, status
  const data: Record<string, unknown> = {};
  if (patch.projectId !== undefined) data.projectId = patch.projectId;
  if (patch.workTypeId !== undefined) data.workTypeId = patch.workTypeId;
  if (patch.plannedPayAt !== undefined) data.plannedPayAt = patch.plannedPayAt;
  if (patch.workStatus !== undefined) {
    data.workStatus = patch.workStatus;
    if (patch.workStatus === "checked" && before.workStatus !== "checked") {
      data.checkedAt = new Date();
    }
  }

  const updated = await prisma.work.update({ where: { id: workId }, data });

  const changes = diff(
    {
      projectId: before.projectId,
      workTypeId: before.workTypeId,
      plannedPayAt: before.plannedPayAt,
      workStatus: before.workStatus,
    },
    {
      projectId: updated.projectId,
      workTypeId: updated.workTypeId,
      plannedPayAt: updated.plannedPayAt,
      workStatus: updated.workStatus,
    }
  );
  if (Object.keys(changes).length > 0) {
    await logActivity({
      userId,
      action: patch.workStatus === "checked" ? "status_change" : "update",
      entityType: "Work",
      entityId: workId,
      entityLabel: `Личная смета · ${before.executionYear}.${String(before.executionMonth).padStart(2, "0")}`,
      changes,
    });
  }

  return updated;
}

async function updateOther(otherId: string, patch: IssuedWorkPatch, userId: string) {
  const before = await prisma.otherExpense.findUnique({ where: { id: otherId } });
  if (!before) throw new Error("OtherExpense not found");

  // §3.8 разрешённые: project, workType, executionMonth, executionYear, executor, status
  const data: Record<string, unknown> = {};
  if (patch.projectId !== undefined) data.projectId = patch.projectId;
  if (patch.workTypeId !== undefined) data.workTypeId = patch.workTypeId;
  if (patch.executionMonth !== undefined) data.executionMonth = patch.executionMonth;
  if (patch.executionYear !== undefined) data.executionYear = patch.executionYear;
  if (patch.executorId !== undefined) data.executorId = patch.executorId;
  if (patch.workStatus !== undefined) {
    data.workStatus = patch.workStatus;
    if (patch.workStatus === "checked" && before.workStatus !== "checked") {
      data.checkedAt = new Date();
    }
  }

  const updated = await prisma.otherExpense.update({ where: { id: otherId }, data });

  const changes = diff(
    {
      projectId: before.projectId,
      workTypeId: before.workTypeId,
      executionMonth: before.executionMonth,
      executionYear: before.executionYear,
      executorId: before.executorId,
      workStatus: before.workStatus,
    },
    {
      projectId: updated.projectId,
      workTypeId: updated.workTypeId,
      executionMonth: updated.executionMonth,
      executionYear: updated.executionYear,
      executorId: updated.executorId,
      workStatus: updated.workStatus,
    }
  );
  if (Object.keys(changes).length > 0) {
    await logActivity({
      userId,
      action: patch.workStatus === "checked" ? "status_change" : "update",
      entityType: "OtherExpense",
      entityId: otherId,
      entityLabel: `Прочие траты · ${before.description.slice(0, 40)}`,
      changes,
    });
  }

  return updated;
}
