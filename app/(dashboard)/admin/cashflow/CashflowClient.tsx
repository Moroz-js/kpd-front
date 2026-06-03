"use client";

import React, { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getISOWeek, getISOWeekYear, getISOWeeksInYear } from "@/lib/iso-weeks";
import { CashflowChart } from "./CashflowChart";
import { CashflowCommentCell } from "@/components/ui-custom/CashflowCommentCell";
import {
  cashflowCommentMapKey,
  cashflowHighlightCellClass,
  type CashflowCellMeta,
} from "@/lib/cashflow-comments";

const fetcher = (url: string) => fetch(url).then(r => r.json());

function fmt(n: number) {
  if (n === 0) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function fmtSign(n: number) {
  if (n === 0) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

type WeekHeader = { week: number; month: number; monthName: string };

type SummaryRows = {
  balanceStart: number[];
  incomeFact: number[];
  incomePlanOnly: number[];
  incomePlanFact: number[];
  expensePlanDP: number[];
  balanceEndDP: number[];
  paidFromBudget: number[];
  unpaidFromBudget: number[];
  totalExpenseBudget: number[];
  deltaDP: number[];
  balanceEndBudget: number[];
};

type ProjectRow = {
  id: string;
  name: string;
  type: string;
  plan: number[];
  iw: number[];
  charges: number[];
  cashflow: number[];
};

type Aggregates = {
  projectExpenses: number[];
  nonProjectExpenses: number[];
  taxes: number[];
  motivation: number[];
};

type CashflowData = {
  year: number;
  weeksInYear: number;
  weeks: WeekHeader[];
  openingBalance: number;
  summary: SummaryRows;
  projects: ProjectRow[];
  externalProjects: ProjectRow[];
  internalProjects: ProjectRow[];
  aggregates: Aggregates;
};

type CashflowResponse = CashflowData | { error: string };

type SummaryDef = {
  key: keyof SummaryRows;
  label: string;
  isEditable?: boolean;
  highlight?: boolean;
  signed?: boolean;
  /** Подпись слева, цифры курсивом (строка «Баланс на начало») */
  balanceStartRow?: boolean;
};

const SUMMARY_DEFS: SummaryDef[] = [
  { key: "balanceStart", label: "Баланс на начало", isEditable: true, balanceStartRow: true },
  { key: "incomeFact", label: "Приход (факт)" },
  { key: "incomePlanOnly", label: "Приход (план)" },
  { key: "incomePlanFact", label: "Приход (план+факт)" },
  { key: "expensePlanDP", label: "Расход (план из ДП)" },
  { key: "balanceEndDP", label: "Баланс на конец (из ДП)" },
  { key: "paidFromBudget", label: "Оплачено из смет" },
  { key: "unpaidFromBudget", label: "Неоплачено из смет" },
  { key: "totalExpenseBudget", label: "Общий расход из смет" },
  { key: "balanceEndBudget", label: "Баланс на конец периода из смет" },
];

type AggregateDef = { key: keyof Aggregates; label: string; bold: boolean };
const AGGREGATE_DEFS: AggregateDef[] = [
  { key: "projectExpenses", label: "Проектные расходы", bold: true },
  { key: "nonProjectExpenses", label: "Непроектные расходы", bold: true },
];

function OpeningBalanceInput({
  year,
  initial,
  onSaved,
}: {
  year: number;
  initial: number;
  onSaved: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(initial));

  useEffect(() => {
    setDraft(String(initial));
  }, [initial]);

  async function save() {
    const amount = parseFloat(draft.replace(/\s/g, "").replace(",", "."));
    if (isNaN(amount)) return;
    const res = await fetch("/api/cashflow/opening-balance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, amount }),
    });
    if (res.ok) { onSaved(amount); toast.success("Баланс сохранён"); }
  }

  return (
    <Input
      className="h-7 w-28 text-right text-xs"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={e => e.key === "Enter" && save()}
    />
  );
}

export function CashflowClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "chart">("table");
  const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  const { data, mutate } = useSWR<CashflowResponse>(`/api/cashflow?year=${year}`, fetcher, {
    onSuccess: d => {
      if (!("error" in d)) setOpeningBalance(d.openingBalance);
    },
  });

  const { data: cellMeta, mutate: mutateCellMeta } = useSWR<Record<string, CashflowCellMeta>>(
    `/api/cashflow/comments?year=${year}`,
    fetcher
  );

  async function saveCellMeta(
    rowKey: string,
    week: number,
    payload: { text: string; highlight: string | null }
  ) {
    const res = await fetch("/api/cashflow/comments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, week, rowKey, ...payload }),
    });
    if (!res.ok) {
      toast.error("Не удалось сохранить");
      return;
    }
    await mutateCellMeta();
  }

  function getCellMeta(rowKey: string, week: number): CashflowCellMeta | undefined {
    return cellMeta?.[cashflowCommentMapKey(rowKey, week)];
  }

  const now = new Date();
  const currentISOWeek = getISOWeek(now);
  const currentISOYear = getISOWeekYear(now);

  const [showOldWeeks, setShowOldWeeks] = useState(false);

  const weeks = (data && !("error" in data)) ? data.weeks : [];
  const visibleWeeks = React.useMemo(() => {
    if (!weeks.length || showOldWeeks || year !== currentISOYear) return weeks;
    return weeks.filter((wh) => wh.week >= currentISOWeek - 2);
  }, [weeks, showOldWeeks, year, currentISOYear, currentISOWeek]);

  const visibleWeekIndices = React.useMemo(
    () => visibleWeeks.map((vw) => weeks.findIndex((w) => w.week === vw.week)),
    [visibleWeeks, weeks]
  );

  if (!data) return <div className="p-6 text-sm text-neutral-500">Загрузка…</div>;
  if ("error" in data) return <div className="p-6 text-sm text-neutral-500">{data.error}</div>;

  const { summary, projects, weeksInYear, externalProjects, internalProjects, aggregates } = data;

  const numCls = "px-2 py-1 text-right text-xs tabular-nums whitespace-nowrap border-r border-neutral-100 last:border-0";
  const tdCls = numCls;
  const compactTdCls =
    "px-2 py-0.5 text-right text-[11px] leading-snug tabular-nums whitespace-nowrap border-r border-neutral-100 last:border-0";
  const thCls =
    "px-2 py-0.5 text-center text-xs leading-snug font-medium text-neutral-500 border-r border-neutral-100 whitespace-nowrap";
  const stickyLbl = "sticky left-0 z-10 bg-white px-3 py-1 text-xs border-r border-neutral-200 whitespace-nowrap min-w-[200px] max-w-[240px] shadow-[1px_0_0_0_#e5e7eb]";
  const compactLbl =
    "sticky left-0 z-10 bg-white px-2.5 py-0.5 text-[11px] leading-snug border-r border-neutral-200 whitespace-nowrap min-w-[200px] max-w-[240px] shadow-[1px_0_0_0_#e5e7eb]";
  const stickyHdr = "sticky left-0 z-[15] bg-neutral-50 border-r border-neutral-200 shadow-[1px_0_0_0_#e5e7eb] px-3 py-1 text-xs font-semibold text-neutral-500 tracking-wide uppercase whitespace-nowrap min-w-[200px]";
  const compactHdr =
    "sticky left-0 z-[15] bg-neutral-50 border-r border-neutral-200 shadow-[1px_0_0_0_#e5e7eb] px-2.5 py-0.5 text-[11px] font-semibold text-neutral-500 tracking-wide uppercase whitespace-nowrap min-w-[200px]";
  const isFuture = (wIdx: number) =>
    year > currentISOYear ||
    (year === currentISOYear && (weeks[wIdx]?.week ?? 0) > currentISOWeek);
  const isCurrent = (wIdx: number) =>
    year === currentISOYear && weeks[wIdx]?.week === currentISOWeek;
  const isPast = (wIdx: number) =>
    year < currentISOYear ||
    (year === currentISOYear && (weeks[wIdx]?.week ?? 0) < currentISOWeek);

  function weekCellClass(idx: number, extra?: string, compact?: boolean) {
    return cn(
      compact ? compactTdCls : tdCls,
      isCurrent(idx)
        ? compact
          ? "bg-blue-50/70 font-medium"
          : "bg-blue-50/70 font-semibold"
        : isPast(idx)
          ? "text-neutral-400 bg-neutral-50/30"
          : isFuture(idx)
            ? "bg-neutral-800/5 text-neutral-700"
            : "",
      extra
    );
  }

  function renderWeekCell(
    rowKey: string,
    idx: number,
    content: React.ReactNode,
    extraTdClass?: string,
    compact?: boolean
  ) {
    const week = weeks[idx]?.week;
    if (week == null) return null;
    const meta = getCellMeta(rowKey, week);
    const highlightClass = cashflowHighlightCellClass(meta?.highlight);
    return (
      <td
        key={idx}
        className={weekCellClass(idx, cn(extraTdClass, highlightClass), compact)}
      >
        <CashflowCommentCell
          meta={meta}
          compact={compact}
          onSave={(payload) => saveCellMeta(rowKey, week, payload)}
        >
          {content}
        </CashflowCommentCell>
      </td>
    );
  }

  // Recompute month groups from visible weeks
  const visibleMonthGroups: { label: string; count: number }[] = [];
  for (const wh of visibleWeeks) {
    const label = wh.monthName;
    const last = visibleMonthGroups[visibleMonthGroups.length - 1];
    if (last && last.label === label) last.count++;
    else visibleMonthGroups.push({ label, count: 1 });
  }

  function rowTotal(arr: number[]) { return arr.reduce((a, b) => a + b, 0); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Кэшфлоу проектов</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span>Стартовый баланс:</span>
            <OpeningBalanceInput
              year={year}
              initial={openingBalance ?? 0}
              onSaved={v => { setOpeningBalance(v); mutate(); }}
            />
          </div>
          <Select value={String(year)} onValueChange={v => v && setYear(parseInt(v))}>
            <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-neutral-200">
        <nav className="flex gap-0">
          {(["table", "chart"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
              }`}
            >
              {tab === "table" ? "Таблица" : "График"}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "chart" && (
        <CashflowChart
          weeks={weeks}
          balanceEndDP={summary.balanceEndDP}
          balanceEndBudget={summary.balanceEndBudget}
          projects={[...(externalProjects ?? projects), ...(internalProjects ?? [])]}
          currentISOWeek={currentISOWeek}
          currentISOYear={currentISOYear}
          year={year}
        />
      )}

      {activeTab === "table" && (
      <div className="rounded-lg border border-neutral-200 bg-white">
        {year === currentYear && (
          <div className="px-3 pt-2 pb-0">
            <button
              className="text-xs text-neutral-400 hover:text-neutral-700 hover:underline underline-offset-2"
              onClick={() => setShowOldWeeks((v) => !v)}
            >
              {showOldWeeks
                ? "Скрыть прошлые недели"
                : `Показать ${weeks.length - visibleWeeks.length} прошлых недель`}
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-max border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-neutral-50 border-b border-neutral-100">
                <th className={cn(compactLbl, "z-30 font-medium text-neutral-600 bg-neutral-50 py-0.5")}>
                  Показатель / Проект
                </th>
                {visibleMonthGroups.map((mg, i) => (
                  <th key={i} colSpan={mg.count} className={cn(thCls, "bg-neutral-50")}>
                    {mg.label}
                  </th>
                ))}
                <th className={cn(thCls, "bg-neutral-100 font-semibold")}>Итого</th>
              </tr>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className={cn(stickyLbl, "z-30 text-left font-semibold text-neutral-600 bg-neutral-50")}>
                  Неделя
                </th>
                {visibleWeeks.map((wh, vi) => {
                  const realIdx = visibleWeekIndices[vi]!;
                  return (
                    <th key={wh.week} className={cn(
                      thCls,
                      isCurrent(realIdx) ? "!bg-blue-50 font-semibold text-neutral-900" : isPast(realIdx) ? "text-neutral-400 bg-neutral-50/30" : "bg-neutral-50"
                    )}>
                      {wh.week}
                    </th>
                  );
                })}
                <th className={cn(thCls, "bg-neutral-100")} />
              </tr>
            </thead>
            <tbody>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <td className={compactHdr}>Сводка</td>
                <td colSpan={visibleWeeks.length + 1} className="bg-neutral-50 py-0" />
              </tr>
              {SUMMARY_DEFS.map(def => {
                const arr = summary[def.key];
                const total = rowTotal(arr);
                const valueCls = def.balanceStartRow ? "italic" : undefined;
                return (
                  <tr
                    key={def.key}
                    className={cn(
                      "border-b border-neutral-100 hover:bg-neutral-50",
                      def.highlight ? "bg-neutral-50/50" : ""
                    )}
                  >
                    <td
                      className={cn(
                        compactLbl,
                        def.balanceStartRow ? "text-left font-normal italic text-neutral-600" : "text-right",
                        def.highlight ? "font-medium bg-neutral-50 text-neutral-800" : "font-normal italic text-neutral-500"
                      )}
                    >
                      {def.label}
                    </td>
                    {visibleWeekIndices.map((idx) =>
                      renderWeekCell(
                        `summary:${def.key}`,
                        idx,
                        <span className={valueCls}>
                          {"signed" in def && def.signed ? fmtSign(arr[idx] ?? 0) : fmt(arr[idx] ?? 0)}
                        </span>,
                        cn(valueCls, def.highlight && "font-medium"),
                        true
                      )
                    )}
                    <td className={cn(compactTdCls, "bg-neutral-50", valueCls, def.highlight && "font-medium")}>
                      {"signed" in def && def.signed ? fmtSign(total) : fmt(total)}
                    </td>
                  </tr>
                );
              })}
              {/* Aggregate rows */}
              {aggregates && AGGREGATE_DEFS.map(def => {
                const arr = aggregates[def.key];
                const total = rowTotal(arr);
                return (
                  <tr key={`agg-${def.key}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td
                      className={cn(
                        compactLbl,
                        "text-right",
                        def.bold ? "font-medium bg-neutral-50 text-neutral-800" : "font-normal italic text-neutral-500"
                      )}
                    >
                      {def.label}
                    </td>
                    {visibleWeekIndices.map((idx) =>
                      renderWeekCell(
                        `aggregate:${def.key}`,
                        idx,
                        fmt(arr[idx] ?? 0),
                        def.bold ? "font-medium" : "",
                        true
                      )
                    )}
                    <td className={cn(compactTdCls, "bg-neutral-50", def.bold ? "font-medium" : "")}>
                      {fmt(total)}
                    </td>
                  </tr>
                );
              })}

              {/* Helper: render project block with external/internal separator */}
              {(["plan", "iw", "charges", "cf"] as const).map((blockKey) => {
                const blockLabels = {
                  plan: "План расходов из ДП",
                  iw: "План-факт расходов из работ",
                  charges: "План доходов",
                  cf: "Кэшфлоу по проектам",
                };
                const extProjects = externalProjects ?? projects;
                const intProjects = internalProjects ?? [];
                const allInBlock = [...extProjects, ...intProjects];
                const hasInternal = intProjects.length > 0;

                return (
                  <React.Fragment key={blockKey}>
                    <tr aria-hidden><td colSpan={visibleWeeks.length + 2} className="h-1 bg-neutral-50/60 p-0 border-0" /></tr>
                    <tr className="bg-neutral-50 border-t-2 border-b border-neutral-200">
                      <td className={stickyHdr}>{blockLabels[blockKey]}</td>
                      <td colSpan={visibleWeeks.length + 1} className="bg-neutral-50" />
                    </tr>
                    {extProjects.map(p => {
                      const arr = blockKey === "plan" ? p.plan : blockKey === "iw" ? p.iw : blockKey === "charges" ? p.charges : p.cashflow;
                      const last = arr[arr.length - 1] ?? 0;
                      return (
                        <tr key={`${blockKey}-${p.id}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className={cn(stickyLbl, "font-normal")}>{p.name}</td>
                          {visibleWeekIndices.map((idx) =>
                            renderWeekCell(
                              `project:${p.id}:${blockKey}`,
                              idx,
                              blockKey === "cf" ? fmtSign(arr[idx] ?? 0) : fmt(arr[idx] ?? 0)
                            )
                          )}
                          <td className={cn(tdCls, "bg-neutral-50 font-medium")}>
                            {blockKey === "cf" ? fmtSign(last) : fmt(rowTotal(arr))}
                          </td>
                        </tr>
                      );
                    })}
                    {hasInternal && (
                      <tr>
                        <td colSpan={visibleWeeks.length + 2} className="border-t-2 border-neutral-300 bg-neutral-100 h-0.5 p-0" />
                      </tr>
                    )}
                    {intProjects.map(p => {
                      const arr = blockKey === "plan" ? p.plan : blockKey === "iw" ? p.iw : blockKey === "charges" ? p.charges : p.cashflow;
                      const last = arr[arr.length - 1] ?? 0;
                      return (
                        <tr key={`${blockKey}-${p.id}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className={cn(stickyLbl, "font-normal text-neutral-500")}>{p.name}</td>
                          {visibleWeekIndices.map((idx) =>
                            renderWeekCell(
                              `project:${p.id}:${blockKey}`,
                              idx,
                              blockKey === "cf" ? fmtSign(arr[idx] ?? 0) : fmt(arr[idx] ?? 0),
                              "text-neutral-500"
                            )
                          )}
                          <td className={cn(tdCls, "bg-neutral-50 font-medium text-neutral-500")}>
                            {blockKey === "cf" ? fmtSign(last) : fmt(rowTotal(arr))}
                          </td>
                        </tr>
                      );
                    })}
                    {allInBlock.length === 0 && (
                      <tr><td colSpan={visibleWeeks.length + 2} className={cn(stickyLbl, "text-neutral-400 font-normal")}>Нет данных</td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
