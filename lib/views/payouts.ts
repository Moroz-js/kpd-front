/**
 * `Payout` (TDNB-17) — view-провайдер: UNION выплат из Личных смет (Payment)
 * и Прочих трат (OtherExpense — поле `paymentAmount`).
 *
 * Не таблица в БД. Изменения в Выплатах → обратно в источник (см. TDNB-17).
 */

import { prisma } from "@/lib/db";
import { getISOWeek, getISOWeekYear } from "@/lib/iso-weeks";
import { paginateSlice, type PaginatedResult } from "@/lib/pagination";

export type PayoutsSortField =
  | "weekPlanFact"
  | "executorName"
  | "bankAccountName"
  | "amount"
  | "paymentStatus"
  | "periodYear"
  | "periodMonth";

export type SortDir = "asc" | "desc";
export type PayoutsSort = { field: PayoutsSortField; dir: SortDir };

export type PayoutSource = "personal" | "other-expense";

export type PayoutRow = {
  sourceType: PayoutSource;
  sourceId: string;

  periodYear: number;
  periodMonth: number;
  weekPlanFact: number | null;
  yearPlanFact: number | null;

  executorId: string;
  executorName: string;

  amount: number;
  paymentStatus: string | null;
  plannedPayAt: Date | null;
  paidAt: Date | null;
  bankAccountId: string | null;
  bankAccountName: string | null;
  comment: string | null;
  updatedAt: Date;
};

export type PayoutsFilter = {
  yearPlanFact?: number[];
  yearPlanFactHasEmpty?: boolean;
  periodYear?: number[];
  periodMonth?: number[];
  weekPlanFact?: number[];
  weekPlanFactHasEmpty?: boolean;
  executorId?: string[];
  paymentStatus?: string[];
  bankAccountId?: string[];
  bankAccountIdHasEmpty?: boolean;
  sourceType?: PayoutSource[];
};

export type PayoutsListQuery = {
  filter?: PayoutsFilter;
  sort?: PayoutsSort[];
  page?: number;
  pageSize?: number;
};

function comparePayoutRows(a: PayoutRow, b: PayoutRow, sort: PayoutsSort[]): number {
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

function planFactWeek(plannedPayAt: Date | null, paidAt: Date | null) {
  const d = paidAt ?? plannedPayAt;
  if (!d) return { week: null, year: null };
  return { week: getISOWeek(d), year: getISOWeekYear(d) };
}

export async function listPayouts(filter: PayoutsFilter = {}): Promise<PayoutRow[]> {
  return applyFilter(await fetchAllPayoutRows(), filter);
}

async function fetchAllPayoutRows(): Promise<PayoutRow[]> {
  const [payments, otherExpenses] = await Promise.all([
    prisma.payment.findMany({
      include: {
        executor: { select: { id: true, name: true } },
        bankAccount: { select: { id: true, name: true } },
      },
    }),
    prisma.otherExpense.findMany({
      where: { paymentAmount: { not: null } },
      include: {
        executor: { select: { id: true, name: true } },
        bankAccount: { select: { id: true, name: true } },
      },
    }),
  ]);

  const personal: PayoutRow[] = payments.map((p) => {
    const pf = planFactWeek(p.plannedPayAt, p.paidAt);
    return {
      sourceType: "personal",
      sourceId: p.id,
      periodYear: p.periodYear,
      periodMonth: p.periodMonth,
      weekPlanFact: pf.week,
      yearPlanFact: pf.year,
      executorId: p.executorId,
      executorName: p.executor.name,
      amount: p.amount,
      paymentStatus: p.paymentStatus,
      plannedPayAt: p.plannedPayAt,
      paidAt: p.paidAt,
      bankAccountId: p.bankAccountId,
      bankAccountName: p.bankAccount?.name ?? null,
      comment: p.comment,
      updatedAt: p.updatedAt,
    };
  });

  const other: PayoutRow[] = otherExpenses.map((o) => {
    const pf = planFactWeek(o.plannedPayAt, o.paidAt);
    return {
      sourceType: "other-expense",
      sourceId: o.id,
      periodYear: o.executionYear,
      periodMonth: o.executionMonth,
      weekPlanFact: pf.week,
      yearPlanFact: pf.year,
      executorId: o.executorId,
      executorName: o.executor.name,
      amount: o.paymentAmount ?? 0,
      paymentStatus: o.paymentStatus,
      plannedPayAt: o.plannedPayAt,
      paidAt: o.paidAt,
      bankAccountId: o.bankAccountId,
      bankAccountName: o.bankAccount?.name ?? null,
      comment: o.comment,
      updatedAt: o.updatedAt,
    };
  });

  return [...personal, ...other];
}

export async function listPayoutsPage(
  query: PayoutsListQuery = {}
): Promise<PaginatedResult<PayoutRow> & { totalAmount: number }> {
  const filter = query.filter ?? {};
  const sort = query.sort?.length
    ? query.sort
    : [
        { field: "weekPlanFact" as const, dir: "desc" as const },
        { field: "executorName" as const, dir: "asc" as const },
        { field: "bankAccountName" as const, dir: "asc" as const },
      ];
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 100;

  const filtered = applyFilter(await fetchAllPayoutRows(), filter);
  const sorted = [...filtered].sort((a, b) => comparePayoutRows(a, b, sort));
  const totalAmount = sorted.reduce((s, r) => s + r.amount, 0);
  return { ...paginateSlice(sorted, page, pageSize), totalAmount };
}

export async function listPayoutIds(filter: PayoutsFilter = {}): Promise<string[]> {
  const rows = await listPayouts(filter);
  return rows.map((r) => `${r.sourceType}:${r.sourceId}`);
}

function applyFilter(rows: PayoutRow[], f: PayoutsFilter): PayoutRow[] {
  return rows.filter((r) => {
    if (f.yearPlanFact?.length || f.yearPlanFactHasEmpty) {
      const token = r.yearPlanFact === null ? "__empty__" : String(r.yearPlanFact);
      const allowed = [
        ...(f.yearPlanFact?.map(String) ?? []),
        ...(f.yearPlanFactHasEmpty ? ["__empty__"] : []),
      ];
      if (!allowed.includes(token)) return false;
    }
    if (f.periodYear?.length && !f.periodYear.includes(r.periodYear)) return false;
    if (f.periodMonth?.length && !f.periodMonth.includes(r.periodMonth)) return false;
    if (f.weekPlanFact?.length || f.weekPlanFactHasEmpty) {
      const token = r.weekPlanFact === null ? "__empty__" : String(r.weekPlanFact);
      const allowed = [
        ...(f.weekPlanFact?.map(String) ?? []),
        ...(f.weekPlanFactHasEmpty ? ["__empty__"] : []),
      ];
      if (!allowed.includes(token)) return false;
    }
    if (f.executorId?.length && !f.executorId.includes(r.executorId)) return false;
    if (f.paymentStatus?.length && !f.paymentStatus.includes(r.paymentStatus ?? "")) return false;
    if (f.bankAccountId?.length || f.bankAccountIdHasEmpty) {
      const token = r.bankAccountId ?? "__empty__";
      const allowed = [
        ...(f.bankAccountId ?? []),
        ...(f.bankAccountIdHasEmpty ? ["__empty__"] : []),
      ];
      if (!allowed.includes(token)) return false;
    }
    if (f.sourceType?.length && !f.sourceType.includes(r.sourceType)) return false;
    return true;
  });
}
