/**
 * WorkTypeService (TDNB-24).
 *
 * Computed-поля C-G — через `IssuedWork`-view (UNION Work + OtherExpense).
 * Для производительности на Phase 1+ перепишем на агрегирующий SQL, сейчас — просто in-memory.
 */

import { prisma } from "@/lib/db";
import { logActivity, diff } from "@/lib/audit/log";
import { listIssuedWorks } from "@/lib/views/issuedWorks";

export type WorkTypeListRow = {
  id: string;
  name: string;
  segment: string;
  status: string;
  projectNames: string[]; // C — полные названия проектов
  projectCount: number; // D
  projectTypes: string[]; // E — distinct
  estimateSources: string[]; // F — distinct sourceType
  issuedWorkCount: number; // G
  createdAt: Date;
};

export async function listWorkTypes(): Promise<WorkTypeListRow[]> {
  const [workTypes, issued] = await Promise.all([
    prisma.workType.findMany({ orderBy: { name: "asc" } }),
    listIssuedWorks(),
  ]);

  const byTypeId = new Map<string, typeof issued>();
  for (const row of issued) {
    const list = byTypeId.get(row.workTypeId);
    if (list) list.push(row);
    else byTypeId.set(row.workTypeId, [row]);
  }

  return workTypes.map((wt) => {
    const rows = byTypeId.get(wt.id) ?? [];
    const projects = new Map<string, { name: string; type: string }>();
    const sources = new Set<string>();
    for (const r of rows) {
      projects.set(r.projectId, { name: r.projectName, type: r.projectType });
      sources.add(r.sourceType);
    }
    const projectArr = Array.from(projects.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const projectTypes = Array.from(new Set(projectArr.map((p) => p.type))).sort();
    return {
      id: wt.id,
      name: wt.name,
      segment: wt.segment,
      status: wt.status,
      projectNames: projectArr.map((p) => p.name),
      projectCount: projectArr.length,
      projectTypes,
      estimateSources: Array.from(sources).sort(),
      issuedWorkCount: rows.length,
      createdAt: new Date(), // нет в schema; используется для default-сорта, но мы сортируем по имени
    };
  });
}

export type CreateWorkTypeInput = {
  name: string;
  segment: string;
};

export async function createWorkType(input: CreateWorkTypeInput, userId: string) {
  const created = await prisma.workType.create({
    data: {
      name: input.name.trim(),
      segment: input.segment.trim(),
      status: "active",
    },
  });

  await logActivity({
    userId,
    action: "create",
    entityType: "WorkType",
    entityId: created.id,
    entityLabel: created.name,
  });

  return created;
}

export type UpdateWorkTypeInput = {
  name?: string;
  segment?: string;
};

export async function updateWorkType(id: string, patch: UpdateWorkTypeInput, userId: string) {
  const before = await prisma.workType.findUnique({ where: { id } });
  if (!before) throw new Error("WorkType not found");

  const updated = await prisma.workType.update({
    where: { id },
    data: {
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      ...(patch.segment !== undefined && { segment: patch.segment.trim() }),
    },
  });

  const changes = diff(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
  if (Object.keys(changes).length > 0) {
    await logActivity({
      userId,
      action: "update",
      entityType: "WorkType",
      entityId: id,
      entityLabel: updated.name,
      changes,
    });
  }

  return updated;
}

export async function archiveWorkType(id: string, userId: string) {
  const wt = await prisma.workType.findUnique({ where: { id } });
  if (!wt) throw new Error("WorkType not found");
  const updated = await prisma.workType.update({
    where: { id },
    data: { status: "archived" },
  });
  await logActivity({
    userId,
    action: "archive",
    entityType: "WorkType",
    entityId: id,
    entityLabel: updated.name,
  });
  return updated;
}

export async function unarchiveWorkType(id: string, userId: string) {
  const wt = await prisma.workType.findUnique({ where: { id } });
  if (!wt) throw new Error("WorkType not found");
  const updated = await prisma.workType.update({
    where: { id },
    data: { status: "active" },
  });
  await logActivity({
    userId,
    action: "unarchive",
    entityType: "WorkType",
    entityId: id,
    entityLabel: updated.name,
  });
  return updated;
}
