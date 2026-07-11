import {
  parseCsvIntParam,
  parseCsvParam,
  parsePositiveInt,
  DEFAULT_PAGE_SIZE,
} from "@/lib/pagination";
import type { OtherExpensesFilter, OtherExpensesListQuery } from "@/lib/services/other-expenses";

export function parseOtherExpensesFilter(sp: URLSearchParams): OtherExpensesFilter {
  const responsible = parseCsvParam(sp.get("responsibleExecutorId"));
  const payStatus = parseCsvParam(sp.get("paymentStatus"));

  return {
    executionYear: parseCsvIntParam(sp.get("executionYear")),
    executionMonth: parseCsvIntParam(sp.get("executionMonth")),
    projectId: parseCsvParam(sp.get("projectId")),
    executorId: parseCsvParam(sp.get("executorId")),
    workTypeId: parseCsvParam(sp.get("workTypeId")),
    responsibleExecutorId: responsible.filter((v) => v !== "__empty__"),
    responsibleExecutorIdHasEmpty: responsible.includes("__empty__"),
    workStatus: parseCsvParam(sp.get("workStatus")),
    paymentStatus: payStatus.filter((v) => v !== "__empty__"),
    paymentStatusHasEmpty: payStatus.includes("__empty__"),
  };
}

export function parseOtherExpensesListQuery(sp: URLSearchParams): OtherExpensesListQuery {
  return {
    filter: parseOtherExpensesFilter(sp),
    page: parsePositiveInt(sp.get("page"), 1),
    pageSize: parsePositiveInt(sp.get("pageSize"), DEFAULT_PAGE_SIZE),
  };
}

export function clientFiltersToOtherExpensesFilter(filter: {
  executionYear: string[];
  executionMonth: string[];
  projectId: string[];
  executorId: string[];
  workTypeId: string[];
  responsibleExecutorId: string[];
  workStatus: string[];
  paymentStatus: string[];
}): OtherExpensesFilter {
  const responsible = filter.responsibleExecutorId;
  const payStatus = filter.paymentStatus;
  return {
    executionYear: filter.executionYear.map(Number).filter((n) => Number.isFinite(n)),
    executionMonth: filter.executionMonth.map(Number).filter((n) => Number.isFinite(n)),
    projectId: filter.projectId.length ? filter.projectId : undefined,
    executorId: filter.executorId.length ? filter.executorId : undefined,
    workTypeId: filter.workTypeId.length ? filter.workTypeId : undefined,
    responsibleExecutorId: responsible.filter((v) => v !== "__empty__"),
    responsibleExecutorIdHasEmpty: responsible.includes("__empty__"),
    workStatus: filter.workStatus.length ? filter.workStatus : undefined,
    paymentStatus: payStatus.filter((v) => v !== "__empty__"),
    paymentStatusHasEmpty: payStatus.includes("__empty__"),
  };
}

export function buildOtherExpensesSearchParams(opts: {
  filter: {
    executionYear: string[];
    executionMonth: string[];
    projectId: string[];
    executorId: string[];
    workTypeId: string[];
    responsibleExecutorId: string[];
    workStatus: string[];
    paymentStatus: string[];
  };
  page: number;
  pageSize: number;
}): string {
  const p = new URLSearchParams();
  p.set("page", String(opts.page));
  p.set("pageSize", String(opts.pageSize));
  if (opts.filter.executionYear.length) p.set("executionYear", opts.filter.executionYear.join(","));
  if (opts.filter.executionMonth.length) p.set("executionMonth", opts.filter.executionMonth.join(","));
  if (opts.filter.projectId.length) p.set("projectId", opts.filter.projectId.join(","));
  if (opts.filter.executorId.length) p.set("executorId", opts.filter.executorId.join(","));
  if (opts.filter.workTypeId.length) p.set("workTypeId", opts.filter.workTypeId.join(","));
  if (opts.filter.responsibleExecutorId.length) {
    p.set("responsibleExecutorId", opts.filter.responsibleExecutorId.join(","));
  }
  if (opts.filter.workStatus.length) p.set("workStatus", opts.filter.workStatus.join(","));
  if (opts.filter.paymentStatus.length) p.set("paymentStatus", opts.filter.paymentStatus.join(","));
  return p.toString();
}
