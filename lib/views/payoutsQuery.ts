import {
  parseCsvIntParam,
  parseCsvParam,
  parsePositiveInt,
  DEFAULT_PAGE_SIZE,
} from "@/lib/pagination";
import type {
  PayoutsFilter,
  PayoutsListQuery,
  PayoutsSort,
  PayoutsSortField,
  SortDir,
} from "@/lib/views/payouts";

const SORT_FIELDS = new Set<PayoutsSortField>([
  "weekPlanFact",
  "executorName",
  "bankAccountName",
  "amount",
  "paymentStatus",
  "periodYear",
  "periodMonth",
]);

export function parsePayoutsFilter(sp: URLSearchParams): PayoutsFilter {
  const wpf = parseCsvParam(sp.get("weekPlanFact"));
  const bank = parseCsvParam(sp.get("bankAccountId"));
  const source = parseCsvParam(sp.get("sourceType"));

  return {
    periodYear: parseCsvIntParam(sp.get("periodYear")),
    periodMonth: parseCsvIntParam(sp.get("periodMonth")),
    weekPlanFact: wpf
      .filter((v) => v !== "__empty__")
      .map(Number)
      .filter((n) => Number.isFinite(n)),
    weekPlanFactHasEmpty: wpf.includes("__empty__"),
    executorId: parseCsvParam(sp.get("executorId")),
    paymentStatus: parseCsvParam(sp.get("paymentStatus")),
    bankAccountId: bank.filter((v) => v !== "__empty__"),
    bankAccountIdHasEmpty: bank.includes("__empty__"),
    sourceType: source.filter(
      (v): v is "personal" | "other-expense" => v === "personal" || v === "other-expense"
    ),
  };
}

export function parsePayoutsSort(sp: URLSearchParams): PayoutsSort[] {
  const raw = sp.get("sort");
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => {
      const [field, dir] = part.split(":");
      if (!field || !SORT_FIELDS.has(field as PayoutsSortField)) return null;
      return { field: field as PayoutsSortField, dir: (dir === "asc" ? "asc" : "desc") as SortDir };
    })
    .filter((x): x is PayoutsSort => x !== null);
}

export function parsePayoutsListQuery(sp: URLSearchParams): PayoutsListQuery {
  return {
    filter: parsePayoutsFilter(sp),
    sort: parsePayoutsSort(sp),
    page: parsePositiveInt(sp.get("page"), 1),
    pageSize: parsePositiveInt(sp.get("pageSize"), DEFAULT_PAGE_SIZE),
  };
}

export function clientFiltersToPayoutsFilter(filter: {
  periodYear: string[];
  periodMonth: string[];
  weekPlanFact: string[];
  executorId: string[];
  paymentStatus: string[];
  bankAccountId: string[];
  smetaFilter: string[];
}): PayoutsFilter {
  const wpf = filter.weekPlanFact;
  const bank = filter.bankAccountId;
  const source = filter.smetaFilter;
  return {
    periodYear: filter.periodYear.map(Number).filter((n) => Number.isFinite(n)),
    periodMonth: filter.periodMonth.map(Number).filter((n) => Number.isFinite(n)),
    weekPlanFact: wpf
      .filter((v) => v !== "__empty__")
      .map(Number)
      .filter((n) => Number.isFinite(n)),
    weekPlanFactHasEmpty: wpf.includes("__empty__"),
    executorId: filter.executorId.length ? filter.executorId : undefined,
    paymentStatus: filter.paymentStatus.length ? filter.paymentStatus : undefined,
    bankAccountId: bank.filter((v) => v !== "__empty__"),
    bankAccountIdHasEmpty: bank.includes("__empty__"),
    sourceType: source.filter(
      (v): v is "personal" | "other-expense" => v === "personal" || v === "other-expense"
    ),
  };
}

export function buildPayoutsSearchParams(opts: {
  filter: {
    periodYear: string[];
    periodMonth: string[];
    weekPlanFact: string[];
    executorId: string[];
    paymentStatus: string[];
    bankAccountId: string[];
    smetaFilter: string[];
  };
  sort: PayoutsSort[];
  page: number;
  pageSize: number;
}): string {
  const p = new URLSearchParams();
  p.set("page", String(opts.page));
  p.set("pageSize", String(opts.pageSize));
  if (opts.filter.periodYear.length) p.set("periodYear", opts.filter.periodYear.join(","));
  if (opts.filter.periodMonth.length) p.set("periodMonth", opts.filter.periodMonth.join(","));
  if (opts.filter.weekPlanFact.length) p.set("weekPlanFact", opts.filter.weekPlanFact.join(","));
  if (opts.filter.executorId.length) p.set("executorId", opts.filter.executorId.join(","));
  if (opts.filter.paymentStatus.length) p.set("paymentStatus", opts.filter.paymentStatus.join(","));
  if (opts.filter.bankAccountId.length) p.set("bankAccountId", opts.filter.bankAccountId.join(","));
  if (opts.filter.smetaFilter.length) p.set("sourceType", opts.filter.smetaFilter.join(","));
  if (opts.sort.length) p.set("sort", opts.sort.map((s) => `${s.field}:${s.dir}`).join(","));
  return p.toString();
}
