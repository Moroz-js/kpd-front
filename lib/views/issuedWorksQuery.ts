import {
  parseCsvIntParam,
  parseCsvParam,
  parsePositiveInt,
  DEFAULT_PAGE_SIZE,
} from "@/lib/pagination";
import type {
  IssuedWorksFilter,
  IssuedWorksListQuery,
  IssuedWorksSort,
  IssuedWorksSortField,
  SortDir,
} from "@/lib/views/issuedWorks";

const SORT_FIELDS = new Set<IssuedWorksSortField>([
  "weekPlanFact",
  "projectName",
  "executorName",
  "executionMonth",
  "executionYear",
  "workTypeName",
  "amount",
  "workStatus",
]);

export function parseIssuedWorksFilter(sp: URLSearchParams): IssuedWorksFilter {
  const ypf = parseCsvParam(sp.get("yearPlanFact"));
  const wpf = parseCsvParam(sp.get("weekPlanFact"));
  const source = parseCsvParam(sp.get("sourceType"));

  return {
    yearPlanFact: ypf
      .filter((v) => v !== "__empty__")
      .map(Number)
      .filter((n) => Number.isFinite(n)),
    yearPlanFactHasEmpty: ypf.includes("__empty__"),
    weekPlanFact: wpf
      .filter((v) => v !== "__empty__")
      .map(Number)
      .filter((n) => Number.isFinite(n)),
    weekPlanFactHasEmpty: wpf.includes("__empty__"),
    executionYear: parseCsvIntParam(sp.get("executionYear")),
    executionMonth: parseCsvIntParam(sp.get("executionMonth")),
    executorId: parseCsvParam(sp.get("executorId")),
    projectId: parseCsvParam(sp.get("projectId")),
    workTypeId: parseCsvParam(sp.get("workTypeId")),
    workStatus: parseCsvParam(sp.get("workStatus")),
    sourceType: source.filter(
      (v): v is "personal" | "other-expense" => v === "personal" || v === "other-expense"
    ),
  };
}

export function parseIssuedWorksSort(sp: URLSearchParams): IssuedWorksSort[] {
  const raw = sp.get("sort");
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => {
      const [field, dir] = part.split(":");
      if (!field || !SORT_FIELDS.has(field as IssuedWorksSortField)) return null;
      const direction: SortDir = dir === "asc" ? "asc" : "desc";
      return { field: field as IssuedWorksSortField, dir: direction };
    })
    .filter((x): x is IssuedWorksSort => x !== null);
}

export function parseIssuedWorksListQuery(sp: URLSearchParams): IssuedWorksListQuery {
  return {
    filter: parseIssuedWorksFilter(sp),
    sort: parseIssuedWorksSort(sp),
    page: parsePositiveInt(sp.get("page"), 1),
    pageSize: parsePositiveInt(sp.get("pageSize"), DEFAULT_PAGE_SIZE),
  };
}

export function clientFiltersToIssuedWorksFilter(filter: {
  yearPlanFact: string[];
  executionYear: string[];
  executionMonth: string[];
  weekPlanFact: string[];
  executorId: string[];
  projectId: string[];
  workTypeId: string[];
  workStatus: string[];
  smetaFilter: string[];
}): IssuedWorksFilter {
  const ypf = filter.yearPlanFact;
  const wpf = filter.weekPlanFact;
  const source = filter.smetaFilter;
  return {
    yearPlanFact: ypf
      .filter((v) => v !== "__empty__")
      .map(Number)
      .filter((n) => Number.isFinite(n)),
    yearPlanFactHasEmpty: ypf.includes("__empty__"),
    executionYear: filter.executionYear.map(Number).filter((n) => Number.isFinite(n)),
    executionMonth: filter.executionMonth.map(Number).filter((n) => Number.isFinite(n)),
    weekPlanFact: wpf
      .filter((v) => v !== "__empty__")
      .map(Number)
      .filter((n) => Number.isFinite(n)),
    weekPlanFactHasEmpty: wpf.includes("__empty__"),
    executorId: filter.executorId.length ? filter.executorId : undefined,
    projectId: filter.projectId.length ? filter.projectId : undefined,
    workTypeId: filter.workTypeId.length ? filter.workTypeId : undefined,
    workStatus: filter.workStatus.length ? filter.workStatus : undefined,
    sourceType: source.filter(
      (v): v is "personal" | "other-expense" => v === "personal" || v === "other-expense"
    ),
  };
}

export function buildIssuedWorksSearchParams(opts: {
  filter: {
    yearPlanFact: string[];
    executionYear: string[];
    executionMonth: string[];
    weekPlanFact: string[];
    executorId: string[];
    projectId: string[];
    workTypeId: string[];
    workStatus: string[];
    smetaFilter: string[];
  };
  sort: IssuedWorksSort[];
  page: number;
  pageSize: number;
}): string {
  const p = new URLSearchParams();
  p.set("page", String(opts.page));
  p.set("pageSize", String(opts.pageSize));
  if (opts.filter.yearPlanFact.length) p.set("yearPlanFact", opts.filter.yearPlanFact.join(","));
  if (opts.filter.executionYear.length) p.set("executionYear", opts.filter.executionYear.join(","));
  if (opts.filter.executionMonth.length) p.set("executionMonth", opts.filter.executionMonth.join(","));
  if (opts.filter.weekPlanFact.length) p.set("weekPlanFact", opts.filter.weekPlanFact.join(","));
  if (opts.filter.executorId.length) p.set("executorId", opts.filter.executorId.join(","));
  if (opts.filter.projectId.length) p.set("projectId", opts.filter.projectId.join(","));
  if (opts.filter.workTypeId.length) p.set("workTypeId", opts.filter.workTypeId.join(","));
  if (opts.filter.workStatus.length) p.set("workStatus", opts.filter.workStatus.join(","));
  if (opts.filter.smetaFilter.length) p.set("sourceType", opts.filter.smetaFilter.join(","));
  if (opts.sort.length) {
    p.set("sort", opts.sort.map((s) => `${s.field}:${s.dir}`).join(","));
  }
  return p.toString();
}
