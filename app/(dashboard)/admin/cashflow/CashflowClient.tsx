"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getISOWeeksInYear } from "@/lib/iso-weeks";

const fetcher = (url: string) => fetch(url).then(r => r.json());

function fmt(n: number) {
  if (n === 0) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function fmtSign(n: number) {
  if (n === 0) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
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
  plan: number[];
  iw: number[];
  charges: number[];
  cashflow: number[];
};

type CashflowData = {
  year: number;
  weeksInYear: number;
  weeks: WeekHeader[];
  openingBalance: number;
  summary: SummaryRows;
  projects: ProjectRow[];
};

type CashflowResponse = CashflowData | { error: string };

type SummaryDef = {
  key: keyof SummaryRows;
  label: string;
  isEditable?: boolean;
  highlight?: boolean;
  signed?: boolean;
};

const SUMMARY_DEFS: SummaryDef[] = [
  { key: "balanceStart", label: "Баланс на начало", isEditable: true },
  { key: "incomeFact", label: "Приход (факт)" },
  { key: "incomePlanOnly", label: "Приход (план)" },
  { key: "incomePlanFact", label: "Приход (план+факт)" },
  { key: "expensePlanDP", label: "Расход (план из ДП)" },
  { key: "balanceEndDP", label: "Баланс на конец (из ДП)", highlight: true },
  { key: "paidFromBudget", label: "Оплачено из смет" },
  { key: "unpaidFromBudget", label: "Неоплачено из смет" },
  { key: "totalExpenseBudget", label: "Общий расход из смет" },
  { key: "deltaDP", label: "Несхождение смет с ДП", signed: true },
  { key: "balanceEndBudget", label: "Баланс из смет", highlight: true },
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
  const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  const { data, mutate } = useSWR<CashflowResponse>(`/api/cashflow?year=${year}`, fetcher, {
    onSuccess: d => {
      if (!("error" in d)) setOpeningBalance(d.openingBalance);
    },
  });

  const now = new Date();
  // Compute current ISO week inline
  const currentISOWeek = (() => {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  })();

  if (!data) return <div className="p-6 text-sm text-neutral-500">Загрузка…</div>;
  if ("error" in data) return <div className="p-6 text-sm text-neutral-500">{data.error}</div>;

  const { weeks, summary, projects, weeksInYear } = data;

  // Month groups
  const monthGroups: { label: string; count: number }[] = [];
  for (const wh of weeks) {
    const label = `${String(wh.month).padStart(2, "0")}-${wh.monthName}`;
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) last.count++;
    else monthGroups.push({ label, count: 1 });
  }

  const tdCls = "px-2 py-1 text-right text-xs tabular-nums whitespace-nowrap border-r border-neutral-100 last:border-0";
  const thCls = "px-2 py-1 text-center text-xs font-medium text-neutral-500 border-r border-neutral-100 whitespace-nowrap";
  const stickyLbl = "sticky left-0 z-10 bg-white px-3 py-1 text-xs border-r border-neutral-200 whitespace-nowrap min-w-[200px] max-w-[240px] shadow-[1px_0_0_0_#e5e7eb]";
  const stickyHdr = "sticky left-0 z-[15] bg-neutral-50 border-r border-neutral-200 shadow-[1px_0_0_0_#e5e7eb] px-3 py-1 text-xs font-semibold text-neutral-500 tracking-wide uppercase whitespace-nowrap min-w-[200px]";
  const isFuture = (wIdx: number) => weeks[wIdx]?.week > currentISOWeek && year === currentYear;

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

      <div className="rounded-lg border border-neutral-200 bg-white">
        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
          <table className="min-w-max border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-neutral-50 border-b border-neutral-100">
                <th className={cn(stickyLbl, "z-30 font-semibold text-neutral-600 bg-neutral-50")} rowSpan={2}>Показатель / Проект</th>
                {monthGroups.map((mg, i) => (
                  <th key={i} colSpan={mg.count} className="px-2 py-1 text-center text-xs font-medium text-neutral-500 border-r border-neutral-100 bg-neutral-50">
                    {mg.label}
                  </th>
                ))}
                <th className={cn(thCls, "bg-neutral-100 font-semibold")}>Итого</th>
              </tr>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                {weeks.map((wh, i) => (
                  <th key={wh.week} className={cn(thCls, "bg-neutral-50", wh.week === currentISOWeek && year === currentYear ? "!bg-blue-50" : "", isFuture(i) ? "text-neutral-300" : "")}>
                    {wh.week}
                  </th>
                ))}
                <th className={cn(thCls, "bg-neutral-100")}></th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <td className={stickyHdr}>Сводка</td>
                <td colSpan={weeksInYear + 1} className="bg-neutral-50" />
              </tr>
              {SUMMARY_DEFS.map(def => {
                const arr = summary[def.key];
                const total = rowTotal(arr);
                return (
                  <tr key={def.key} className={cn("border-b border-neutral-100 hover:bg-neutral-50", def.highlight ? "font-semibold bg-neutral-50/50" : "")}>
                    <td className={cn(stickyLbl, def.highlight ? "font-semibold bg-neutral-50" : "font-normal")}>{def.label}</td>
                    {arr.map((v, i) => (
                      <td key={i} className={cn(tdCls,
                        isFuture(i) ? "text-neutral-300 bg-neutral-50/30" : "",
                        weeks[i]?.week === currentISOWeek && year === currentYear ? "bg-blue-50/40" : "",
                      )}>
                        {"signed" in def && def.signed ? fmtSign(v) : fmt(v)}
                      </td>
                    ))}
                    <td className={cn(tdCls, "bg-neutral-50")}>
                      {"signed" in def && def.signed ? fmtSign(total) : fmt(total)}
                    </td>
                  </tr>
                );
              })}

              {/* Block 2.1: Plan from dashboards */}
              <tr className="bg-neutral-50 border-t-2 border-b border-neutral-200">
                <td className={stickyHdr}>План расходов из ДП</td>
                <td colSpan={weeksInYear + 1} className="bg-neutral-50" />
              </tr>
              {projects.map(p => (
                <tr key={`plan-${p.id}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className={cn(stickyLbl, "font-normal")}>{p.name}</td>
                  {p.plan.map((v, i) => (
                    <td key={i} className={cn(tdCls, isFuture(i) ? "text-neutral-300 bg-neutral-50/30" : "", weeks[i]?.week === currentISOWeek && year === currentYear ? "bg-blue-50/40" : "")}>
                      {fmt(v)}
                    </td>
                  ))}
                  <td className={cn(tdCls, "bg-neutral-50 font-medium")}>{fmt(rowTotal(p.plan))}</td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={weeksInYear + 2} className={cn(stickyLbl, "text-neutral-400 font-normal")}>Нет данных</td></tr>
              )}

              {/* Block 2.2: IssuedWork */}
              <tr className="bg-neutral-50 border-t-2 border-b border-neutral-200">
                <td className={stickyHdr}>План-факт расходов из работ</td>
                <td colSpan={weeksInYear + 1} className="bg-neutral-50" />
              </tr>
              {projects.map(p => (
                <tr key={`iw-${p.id}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className={cn(stickyLbl, "font-normal")}>{p.name}</td>
                  {p.iw.map((v, i) => (
                    <td key={i} className={cn(tdCls, isFuture(i) ? "text-neutral-300 bg-neutral-50/30" : "", weeks[i]?.week === currentISOWeek && year === currentYear ? "bg-blue-50/40" : "")}>
                      {fmt(v)}
                    </td>
                  ))}
                  <td className={cn(tdCls, "bg-neutral-50 font-medium")}>{fmt(rowTotal(p.iw))}</td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={weeksInYear + 2} className={cn(stickyLbl, "text-neutral-400 font-normal")}>Нет данных</td></tr>
              )}

              {/* Block 2.3: Charges (income) */}
              <tr className="bg-neutral-50 border-t-2 border-b border-neutral-200">
                <td className={stickyHdr}>План доходов</td>
                <td colSpan={weeksInYear + 1} className="bg-neutral-50" />
              </tr>
              {projects.map(p => (
                <tr key={`charges-${p.id}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className={cn(stickyLbl, "font-normal")}>{p.name}</td>
                  {p.charges.map((v, i) => (
                    <td key={i} className={cn(tdCls, isFuture(i) ? "text-neutral-300 bg-neutral-50/30" : "", weeks[i]?.week === currentISOWeek && year === currentYear ? "bg-blue-50/40" : "")}>
                      {fmt(v)}
                    </td>
                  ))}
                  <td className={cn(tdCls, "bg-neutral-50 font-medium")}>{fmt(rowTotal(p.charges))}</td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={weeksInYear + 2} className={cn(stickyLbl, "text-neutral-400 font-normal")}>Нет данных</td></tr>
              )}

              {/* Block 2.4: Rolling cashflow */}
              <tr className="bg-neutral-50 border-t-2 border-b border-neutral-200">
                <td className={stickyHdr}>Кэшфлоу по проектам</td>
                <td colSpan={weeksInYear + 1} className="bg-neutral-50" />
              </tr>
              {projects.map(p => {
                const last = p.cashflow[p.cashflow.length - 1] ?? 0;
                return (
                  <tr key={`cf-${p.id}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className={cn(stickyLbl, "font-normal")}>{p.name}</td>
                    {p.cashflow.map((v, i) => (
                      <td key={i} className={cn(tdCls, isFuture(i) ? "text-neutral-300 bg-neutral-50/30" : "", weeks[i]?.week === currentISOWeek && year === currentYear ? "bg-blue-50/40" : "")}>
                        {fmtSign(v)}
                      </td>
                    ))}
                    <td className={cn(tdCls, "bg-neutral-50 font-medium")}>
                      {fmtSign(last)}
                    </td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr><td colSpan={weeksInYear + 2} className={cn(stickyLbl, "text-neutral-400 font-normal")}>Нет данных</td></tr>
              )}

              {/* Block 2.5: Delta */}
              <tr className="bg-neutral-50 border-t-2 border-b border-neutral-200">
                <td className={stickyHdr}>Несхождение смет с ДП</td>
                <td colSpan={weeksInYear + 1} className="bg-neutral-50" />
              </tr>
              {projects.map(p => (
                <tr key={`delta-${p.id}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className={cn(stickyLbl, "font-normal")}>{p.name}</td>
                  {p.iw.map((v, i) => {
                    const delta = v - p.plan[i];
                    return (
                      <td key={i} className={cn(tdCls, isFuture(i) ? "text-neutral-300 bg-neutral-50/30" : "", weeks[i]?.week === currentISOWeek && year === currentYear ? "bg-blue-50/40" : "")}>
                        {fmtSign(delta)}
                      </td>
                    );
                  })}
                  <td className={cn(tdCls, "bg-neutral-50 font-medium")}>
                    {fmtSign(rowTotal(p.iw) - rowTotal(p.plan))}
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={weeksInYear + 2} className={cn(stickyLbl, "text-neutral-400 font-normal")}>Нет данных</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
