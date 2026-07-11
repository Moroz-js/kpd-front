import {
  parseCsvIntParam,
  parseCsvParam,
  parsePositiveInt,
  DEFAULT_PAGE_SIZE,
} from "@/lib/pagination";
import type { ChargesFilter, ChargesListQuery } from "@/lib/services/charges";

export function parseChargesFilter(sp: URLSearchParams): ChargesFilter {
  const client = parseCsvParam(sp.get("clientId"));
  const project = parseCsvParam(sp.get("projectId"));
  const payWeek = parseCsvParam(sp.get("payWeek"));

  return {
    bankAccountId: parseCsvParam(sp.get("bankAccountId")),
    orderId: parseCsvParam(sp.get("orderId")),
    status: parseCsvParam(sp.get("status")),
    clientId: client.filter((v) => v !== "__empty__"),
    clientIdHasEmpty: client.includes("__empty__"),
    projectId: project.filter((v) => v !== "__empty__"),
    projectIdHasEmpty: project.includes("__empty__"),
    payWeek: payWeek.length ? payWeek : undefined,
    hidePaid: sp.get("hidePaid") === "1",
  };
}

export function parseChargesListQuery(sp: URLSearchParams): ChargesListQuery {
  return {
    filter: parseChargesFilter(sp),
    page: parsePositiveInt(sp.get("page"), 1),
    pageSize: parsePositiveInt(sp.get("pageSize"), DEFAULT_PAGE_SIZE),
  };
}

export function clientFiltersToChargesFilter(filter: {
  bankAccountId: string[];
  orderId: string[];
  status: string[];
  clientId: string[];
  projectId: string[];
  payWeek: string[];
  hidePaid: boolean;
}): ChargesFilter {
  const client = filter.clientId;
  const project = filter.projectId;
  return {
    bankAccountId: filter.bankAccountId.length ? filter.bankAccountId : undefined,
    orderId: filter.orderId.length ? filter.orderId : undefined,
    status: filter.status.length ? filter.status : undefined,
    clientId: client.filter((v) => v !== "__empty__"),
    clientIdHasEmpty: client.includes("__empty__"),
    projectId: project.filter((v) => v !== "__empty__"),
    projectIdHasEmpty: project.includes("__empty__"),
    payWeek: filter.payWeek.length ? filter.payWeek : undefined,
    hidePaid: filter.hidePaid,
  };
}

export function buildChargesSearchParams(opts: {
  filter: {
    bankAccountId: string[];
    orderId: string[];
    status: string[];
    clientId: string[];
    projectId: string[];
    payWeek: string[];
    hidePaid: boolean;
  };
  page: number;
  pageSize: number;
}): string {
  const p = new URLSearchParams();
  p.set("page", String(opts.page));
  p.set("pageSize", String(opts.pageSize));
  if (opts.filter.bankAccountId.length) p.set("bankAccountId", opts.filter.bankAccountId.join(","));
  if (opts.filter.orderId.length) p.set("orderId", opts.filter.orderId.join(","));
  if (opts.filter.status.length) p.set("status", opts.filter.status.join(","));
  if (opts.filter.clientId.length) p.set("clientId", opts.filter.clientId.join(","));
  if (opts.filter.projectId.length) p.set("projectId", opts.filter.projectId.join(","));
  if (opts.filter.payWeek.length) p.set("payWeek", opts.filter.payWeek.join(","));
  if (opts.filter.hidePaid) p.set("hidePaid", "1");
  return p.toString();
}
