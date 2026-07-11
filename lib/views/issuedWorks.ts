/**
 * `IssuedWork` (TDNB-14) — view-провайдер: UNION работ из Личных смет (Work)
 * и Прочих трат (OtherExpense).
 *
 * Это **не таблица в БД**, а функция-фасад. Возвращает унифицированную форму строки.
 * Изменения в Выставленных работах → обратно в источник (см. TDNB-14 §3.7/3.8).
 */

import { prisma } from "@/lib/db";
import { getISOWeek } from "@/lib/iso-weeks";
import { paginateSlice, type PaginatedResult } from "@/lib/pagination";

export type IssuedWorksSortField =
  | "weekPlanFact"
  | "projectName"
  | "executorName"
  | "executionMonth"
  | "executionYear"
  | "workTypeName"
  | "amount"
  | "workStatus";

export type SortDir = "asc" | "desc";

export type IssuedWorksSort = { field: IssuedWorksSortField; dir: SortDir };

export type IssuedWorkSource = "personal" | "other-expense";

export type IssuedWorkRow = {
  sourceType: IssuedWorkSource;
  sourceId: string; // id Work.id или OtherExpense.id

  executionYear: number;
  executionMonth: number;
  weekPlanFact: number | null;
  yearPlanFact: number | null;

  executorId: string;
  executorName: string;
  executorType: string;
  projectId: string;
  projectName: string;
  projectType: string;
  workTypeId: string;
  workTypeName: string;
  workTypeSegment: string;

  responsibleExecutorId: string | null;
  responsibleExecutorName: string | null;

  amount: number;
  techTask: string | null;
  rate: number | null;
  workStatus: string;
  comment: string | null;
  checkedAt: Date | null;
  paidAt: Date | null;
  plannedPayAt: Date | null;
  updatedAt: Date;
};

export type IssuedWorksFilter = {
  yearPlanFact?: number[];
  yearPlanFactHasEmpty?: boolean;
  executionYear?: number[];
  executionMonth?: number[];
  weekPlanFact?: number[];
  weekPlanFactHasEmpty?: boolean;
  executorId?: string[];
  projectId?: string[];
  workTypeId?: string[];
  workStatus?: string[];
  projectType?: string[];
  workTypeSegment?: string[];
  executorType?: string[];
  sourceType?: IssuedWorkSource[];
  responsibleExecutorId?: string[];
};

export type IssuedWorksListQuery = {
  filter?: IssuedWorksFilter;
  sort?: IssuedWorksSort[];
  page?: number;
  pageSize?: number;
};

function compareIssuedRows(a: IssuedWorkRow, b: IssuedWorkRow, sort: IssuedWorksSort[]): number {
  for (const s of sort) {
    const av = a[s.field];
    const bv = b[s.field];
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av ?? "").localeCompare(String(bv ?? ""), "ru");
    const signed = s.dir === "asc" ? cmp : -cmp;
    if (signed !== 0) return signed;
  }
  return 0;
}

async function fetchAllIssuedWorkRows(): Promise<IssuedWorkRow[]> {
  const [works, otherExpenses] = await Promise.all([
    prisma.work.findMany({
      include: {
        executor: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true, type: true } },
        workType: { select: { id: true, name: true, segment: true } },
        responsibleExecutor: { select: { id: true, name: true } },
      },
    }),
    prisma.otherExpense.findMany({
      include: {
        executor: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true, type: true } },
        workType: { select: { id: true, name: true, segment: true } },
        responsibleExecutor: { select: { id: true, name: true } },
      },
    }),
  ]);

  const personal: IssuedWorkRow[] = works.map((w) => {
    const pf = planFactWeek(w.plannedPayAt, w.paidAt);
    return {
      sourceType: "personal",
      sourceId: w.id,
      executionYear: w.executionYear,
      executionMonth: w.executionMonth,
      weekPlanFact: pf.week,
      yearPlanFact: pf.year,
      executorId: w.executorId,
      executorName: w.executor.name,
      executorType: w.executor.type,
      projectId: w.projectId,
      projectName: w.project.name,
      projectType: w.project.type,
      workTypeId: w.workTypeId,
      workTypeName: w.workType.name,
      workTypeSegment: w.workType.segment,
      responsibleExecutorId: w.responsibleExecutorId,
      responsibleExecutorName: w.responsibleExecutor?.name ?? null,
      amount: w.amount,
      techTask: w.techTask,
      rate: w.rate,
      workStatus: w.workStatus,
      comment: w.comment,
      checkedAt: w.checkedAt,
      paidAt: w.paidAt,
      plannedPayAt: w.plannedPayAt,
      updatedAt: w.updatedAt,
    };
  });

  const other: IssuedWorkRow[] = otherExpenses.map((o) => {
    const pf = planFactWeek(o.plannedPayAt, o.paidAt);
    return {
      sourceType: "other-expense",
      sourceId: o.id,
      executionYear: o.executionYear,
      executionMonth: o.executionMonth,
      weekPlanFact: pf.week,
      yearPlanFact: pf.year,
      executorId: o.executorId,
      executorName: o.executor.name,
      executorType: o.executor.type,
      projectId: o.projectId,
      projectName: o.project.name,
      projectType: o.project.type,
      workTypeId: o.workTypeId,
      workTypeName: o.workType.name,
      workTypeSegment: o.workType.segment,
      responsibleExecutorId: o.responsibleExecutorId,
      responsibleExecutorName: o.responsibleExecutor?.name ?? null,
      amount: o.amount,
      techTask: null,
      rate: null,
      workStatus: o.workStatus,
      comment: o.comment,
      checkedAt: o.checkedAt,
      paidAt: o.paidAt,
      plannedPayAt: o.plannedPayAt,
      updatedAt: o.updatedAt,
    };
  });

  return [...personal, ...other];
}

/** Извлечь даты (неделя/год план-факт) — facto если есть, иначе по plan. */
function planFactWeek(plannedPayAt: Date | null, paidAt: Date | null): { week: number | null; year: number | null } {
  const d = paidAt ?? plannedPayAt;
  if (!d) return { week: null, year: null };
  return { week: getISOWeek(d), year: d.getFullYear() };
}

function applyFilter(rows: IssuedWorkRow[], f: IssuedWorksFilter): IssuedWorkRow[] {
  return rows.filter((r) => {
    if (f.yearPlanFact?.length || f.yearPlanFactHasEmpty) {
      const token = r.yearPlanFact === null ? "__empty__" : String(r.yearPlanFact);
      const allowed = [
        ...(f.yearPlanFact?.map(String) ?? []),
        ...(f.yearPlanFactHasEmpty ? ["__empty__"] : []),
      ];
      if (!allowed.includes(token)) return false;
    }
    if (f.executionYear?.length && !f.executionYear.includes(r.executionYear)) return false;
    if (f.executionMonth?.length && !f.executionMonth.includes(r.executionMonth)) return false;
    if (f.weekPlanFact?.length || f.weekPlanFactHasEmpty) {
      const token = r.weekPlanFact === null ? "__empty__" : String(r.weekPlanFact);
      const allowed = [
        ...(f.weekPlanFact?.map(String) ?? []),
        ...(f.weekPlanFactHasEmpty ? ["__empty__"] : []),
      ];
      if (!allowed.includes(token)) return false;
    }
    if (f.executorId?.length && !f.executorId.includes(r.executorId)) return false;
    if (f.projectId?.length && !f.projectId.includes(r.projectId)) return false;
    if (f.workTypeId?.length && !f.workTypeId.includes(r.workTypeId)) return false;
    if (f.workStatus?.length && !f.workStatus.includes(r.workStatus)) return false;
    if (f.projectType?.length && !f.projectType.includes(r.projectType)) return false;
    if (f.workTypeSegment?.length && !f.workTypeSegment.includes(r.workTypeSegment)) return false;
    if (f.executorType?.length && !f.executorType.includes(r.executorType)) return false;
    if (f.sourceType?.length && !f.sourceType.includes(r.sourceType)) return false;
    if (f.responsibleExecutorId?.length && (r.responsibleExecutorId == null || !f.responsibleExecutorId.includes(r.responsibleExecutorId))) return false;
    return true;
  });
}

export async function listIssuedWorks(filter: IssuedWorksFilter = {}): Promise<IssuedWorkRow[]> {
  return applyFilter(await fetchAllIssuedWorkRows(), filter);
}

export async function listIssuedWorksPage(
  query: IssuedWorksListQuery = {}
): Promise<PaginatedResult<IssuedWorkRow> & { totalAmount: number }> {
  const filter = query.filter ?? {};
  const sort = query.sort?.length
    ? query.sort
    : [
        { field: "weekPlanFact" as const, dir: "desc" as const },
        { field: "projectName" as const, dir: "asc" as const },
        { field: "executorName" as const, dir: "asc" as const },
        { field: "executionMonth" as const, dir: "desc" as const },
      ];
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 100;

  const filtered = applyFilter(await fetchAllIssuedWorkRows(), filter);
  const sorted = [...filtered].sort((a, b) => compareIssuedRows(a, b, sort));
  const totalAmount = sorted.reduce((s, r) => s + r.amount, 0);
  const slice = paginateSlice(sorted, page, pageSize);
  return { ...slice, totalAmount };
}

export async function listIssuedWorkIds(filter: IssuedWorksFilter = {}): Promise<string[]> {
  const rows = await listIssuedWorks(filter);
  return rows.map((r) => `${r.sourceType}:${r.sourceId}`);
}
