"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ChevronLeft, Plus, Pencil, Check, TrendingUp, CreditCard, AlertTriangle, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { buttonVariants, Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  weekLabel,
  getISOWeeksInYear,
  getISOWeek,
  firstVisibleDashboardWeek,
} from "@/lib/iso-weeks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ProjectCashflowChart } from "@/components/ui-custom/ProjectCashflowChart";

const fetcher = (url: string) => fetch(url).then(r => r.json());

function fmt(n: number) {
  if (n === 0) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function fmtSign(n: number) {
  if (n === 0) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

/** Перерасход: минус — экономия (зелёный), плюс — превышение (красный) */
function overspendValueClass(v: number): string {
  if (v === 0) return "";
  if (v < 0) return "text-green-600 font-medium";
  return "text-red-600 font-medium";
}

type WeekHeader = { week: number; month: number; monthName: string };

type SummaryKey = "cashflow" | "incomePlanFact" | "incomeFact" | "incomePlan" | "incomeCumulative" | "marginPct" | "expenses" | "expensePlan" | "overspend";

const SUMMARY_DEFS: { key: SummaryKey; label: string; signed?: boolean; highlight?: boolean }[] = [
  { key: "cashflow",         label: "Кэшфлоу (нараст.)", highlight: true },
  { key: "incomePlanFact",   label: "Доход, факт+план" },
  { key: "incomeFact",       label: "Доход, факт" },
  { key: "incomePlan",       label: "Доход, план" },
  { key: "incomeCumulative", label: "Доход накоп. итогом" },
  { key: "marginPct",        label: "Маржа в моменте %" },
  { key: "expenses",         label: "Расходы (факт+долг+план)" },
];

type PlanLineRow = {
  id: string;
  executorId: string;
  executorName: string;
  executorHasPersonalSmeta: boolean;
  workTypeId: string;
  workTypeName: string;
  sourceType: string | null;
  weeks: (string | null)[];
  lineIds: (string | null)[];
};

type DashboardData = {
  project: { id: string; name: string; status: string; client: string | null; responsible: string | null };
  year: number;
  weeks: WeekHeader[];
  summary: Record<SummaryKey | "expensePlan" | "overspend", number[]>;
  workTypes: { id: string; name: string; weeks: number[] }[];
  planLines: PlanLineRow[];
  executors: { id: string; name: string; workTypeIds: string[] }[];
  availableWorkTypes: { id: string; name: string }[];
};

type EditingCell = {
  executorId: string;
  executorName: string;
  workTypeId: string;
  workTypeName: string;
  weekIdx: number;
  value: string;
  lineId: string | null;
};

function AddPlanLineDialog({
  open,
  onClose,
  projectId,
  year,
  executors,
  workTypes,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  year: number;
  executors: { id: string; name: string; workTypeIds: string[] }[];
  workTypes: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [workTypeId, setWorkTypeId] = useState<string | null>(null);
  const [executorId, setExecutorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredExecutors = workTypeId
    ? executors.filter(e => e.workTypeIds.includes(workTypeId))
    : executors;

  function handleWorkTypeChange(id: string) {
    setWorkTypeId(id);
    setExecutorId(null);
  }

  async function handleSave() {
    if (!executorId || !workTypeId) { toast.error("Выберите вид работ и исполнителя"); return; }
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/spending-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executorId, workTypeId, year, week: 1, amount: 0 }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Не удалось создать строку");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Добавить строку плана</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Вид работ</Label>
            <Select value={workTypeId ?? ""} onValueChange={v => v && handleWorkTypeChange(v)}>
              <SelectTrigger className="mt-1 w-full" data-placeholder={!workTypeId || undefined}>
                <SelectValue>
                  {workTypeId
                    ? (workTypes.find(w => w.id === workTypeId)?.name ?? workTypeId)
                    : <span className="text-muted-foreground">Выберите вид работ…</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {workTypes.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>
              Исполнитель
              {workTypeId && filteredExecutors.length === 0 && (
                <span className="ml-2 text-xs text-amber-600 font-normal">Нет исполнителей с этим видом работ</span>
              )}
              {workTypeId && filteredExecutors.length > 0 && (
                <span className="ml-2 text-xs text-neutral-400 font-normal">{filteredExecutors.length} доступно</span>
              )}
            </Label>
            <Select value={executorId ?? ""} onValueChange={v => v && setExecutorId(v)}>
              <SelectTrigger className="mt-1 w-full" data-placeholder={!executorId || undefined}>
                <SelectValue>
                  {executorId
                    ? (executors.find(e => e.id === executorId)?.name ?? executorId)
                    : <span className="text-muted-foreground">Выберите исполнителя…</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filteredExecutors.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "…" : "Добавить"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Editable cell for SpendingPlanLine
function PlanCell({
  value,
  lineId,
  projectId,
  executorId,
  workTypeId,
  year,
  week,
  onUpdate,
}: {
  value: string | null;
  lineId: string | null;
  projectId: string;
  executorId: string;
  workTypeId: string;
  year: number;
  week: number;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const amount = parseFloat(draft.replace(/\s/g, "").replace(",", "."));
    if (isNaN(amount)) { setEditing(false); return; }
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/spending-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executorId, workTypeId, year, week, amount }),
    });
    setSaving(false);
    if (res.ok) { onUpdate(); }
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-6 w-full text-right text-xs p-1"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
      />
    );
  }

  const num = value !== null ? parseFloat(value) : null;
  const display = num !== null ? (num === 0 ? "—" : fmt(num)) : "·";

  return (
    <div
      className={cn(
        "w-full h-full min-h-[22px] flex items-center justify-end px-1 cursor-pointer tabular-nums select-none",
        saving && "opacity-50",
        num !== null && num !== 0 ? "text-neutral-800" : "text-neutral-300",
        "hover:bg-neutral-100/70"
      )}
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
    >
      {display}
    </div>
  );
}

export function ProjectDashboardClient({ projectId, isAdmin, canManagePlan }: { projectId: string; isAdmin: boolean; canManagePlan?: boolean }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmRow, setConfirmRow] = useState<PlanLineRow | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [showOldWeeks, setShowOldWeeks] = useState(false);

  async function deletePlanRow(pl: PlanLineRow) {
    const ids = pl.lineIds.filter((id): id is string => id !== null);
    if (ids.length === 0) { setConfirmRow(null); return; }
    setDeletingRowId(pl.id);
    setConfirmRow(null);
    await Promise.all(
      ids.map(id =>
        fetch(`/api/projects/${projectId}/spending-plan`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
      )
    );
    setDeletingRowId(null);
    mutate();
    toast.success("Строка плана удалена");
  }

  const { data, mutate } = useSWR<DashboardData>(
    `/api/projects/${projectId}/dashboard?year=${year}`,
    fetcher
  );

  const weeksCount = data?.weeks.length ?? getISOWeeksInYear(year);
  const currentISOWeek = getISOWeek(new Date());

  const visibleWeeks = React.useMemo(() => {
    if (!data) return [];
    if (showOldWeeks || year !== currentYear) return data.weeks;
    const fromWeek = firstVisibleDashboardWeek(currentISOWeek);
    return data.weeks.filter((wh) => wh.week >= fromWeek);
  }, [data, showOldWeeks, year, currentYear, currentISOWeek]);

  const visibleWeekIndices = React.useMemo(
    () => visibleWeeks.map((vw) => (data?.weeks ?? []).findIndex((w) => w.week === vw.week)),
    [visibleWeeks, data]
  );

  const YEARS = [currentYear - 1, currentYear, currentYear + 1];

  if (!data) return <div className="p-6 text-sm text-neutral-500">Загрузка…</div>;

  const { project, weeks, summary, workTypes, planLines, executors, availableWorkTypes } = data;

  // Group month headers
  const monthGroups: { label: string; count: number }[] = [];
  for (const wh of visibleWeeks) {
    const last = monthGroups[monthGroups.length - 1];
    const label = wh.monthName;
    if (last && last.label === label) last.count++;
    else monthGroups.push({ label, count: 1 });
  }

  // Row totals
  function rowTotal(arr: number[]) {
    return arr.reduce((a, b) => a + b, 0);
  }

  const tdCls = "px-2 py-1 text-right text-xs tabular-nums whitespace-nowrap border-r border-neutral-100 last:border-0";
  const thCls = "px-2 py-1 text-right text-xs font-medium text-neutral-600 border-r border-neutral-100 last:border-0 bg-neutral-50 whitespace-nowrap";
  const stickyLbl = "sticky left-0 z-10 bg-white px-3 py-1 text-xs font-medium text-neutral-700 border-r border-neutral-200 whitespace-nowrap min-w-[160px] max-w-[200px] shadow-[1px_0_0_0_#e5e7eb]";
  const stickyHdr = "sticky left-0 z-[15] bg-neutral-50 border-r border-neutral-200 shadow-[1px_0_0_0_#e5e7eb] px-3 py-1 text-xs font-semibold text-neutral-500 tracking-wide uppercase whitespace-nowrap min-w-[160px]";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={isAdmin ? "/admin/projects" : "/responsible/projects"}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> К списку
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{project.name}</h1>
            <p className="text-sm text-neutral-500">
              {project.responsible ?? "Без ответственного"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={v => v && setYear(parseInt(v))}>
            <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs mb-1"><TrendingUp className="h-3.5 w-3.5" />Приход</div>
          <p className="text-lg font-semibold">{rowTotal(summary.incomeFact).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs mb-1"><CreditCard className="h-3.5 w-3.5" />Расходы</div>
          <p className="text-lg font-semibold">{rowTotal(summary.expenses).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs mb-1">Кэшфлоу</div>
          <p className="text-lg font-semibold">
            {fmtSign(summary.cashflow[summary.cashflow.length - 1])} ₽
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs mb-1"><AlertTriangle className="h-3.5 w-3.5" />Перерасход</div>
          <p className="text-lg font-semibold">
            {fmtSign(rowTotal(summary.overspend ?? []))} ₽
          </p>
        </div>
      </div>

      <ProjectCashflowChart
        weeks={visibleWeeks}
        cashflow={visibleWeekIndices.map((i) => summary.cashflow[i] ?? 0)}
        expensePlan={visibleWeekIndices.map((i) => summary.expensePlan[i] ?? 0)}
        incomePlanFact={visibleWeekIndices.map((i) => summary.incomePlanFact[i] ?? 0)}
      />

      {/* Main grid */}
      <div className="rounded-lg border border-neutral-200 bg-white">
        {year === currentYear && (
          <div className="px-3 pt-2 pb-0">
            <button
              className="text-xs text-neutral-400 hover:text-neutral-700 hover:underline underline-offset-2"
              onClick={() => setShowOldWeeks((v) => !v)}
            >
              {showOldWeeks
                ? "Скрыть прошлые недели"
                : `Показать ${(data?.weeks.length ?? 0) - visibleWeeks.length} прошлых недель`}
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-max border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              {/* Month row */}
              <tr className="bg-neutral-50 border-b border-neutral-100">
                <th className={cn(stickyLbl, "z-30 font-semibold text-neutral-600 bg-neutral-50")} rowSpan={2}>Показатель</th>
                {monthGroups.map((mg, i) => (
                  <th key={i} colSpan={mg.count} className="px-2 py-1 text-center text-xs font-medium text-neutral-500 border-r border-neutral-100 bg-neutral-50">
                    {mg.label}
                  </th>
                ))}
                <th className={cn(thCls, "bg-neutral-100 font-semibold")}>Итого</th>
              </tr>
              {/* Week row */}
              <tr className="bg-neutral-50 border-b border-neutral-200">
                {visibleWeeks.map(wh => (
                  <th key={wh.week} className={cn(thCls, "bg-neutral-50", wh.week === currentISOWeek && year === currentYear ? "!bg-blue-50 font-semibold" : wh.week < currentISOWeek && year === currentYear ? "text-neutral-400" : "")}>
                    {wh.week}
                  </th>
                ))}
                <th className={cn(thCls, "bg-neutral-100")}></th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <td className={stickyHdr}>Сводка</td>
                <td colSpan={visibleWeeks.length + 1} className="bg-neutral-50" />
              </tr>
              {SUMMARY_DEFS.map(({ key, label, signed, highlight }) => {
                const arr = summary[key] ?? [];
                const total = key === "marginPct"
                  ? (rowTotal(summary.incomeCumulative ?? []) === 0 ? 0 : (summary.cashflow[summary.cashflow.length - 1] ?? 0) / rowTotal(summary.incomeCumulative ?? []))
                  : rowTotal(arr);
                const cellVal = (v: number) =>
                  key === "marginPct"
                    ? (v === 0 ? "—" : `${(v * 100).toFixed(0)}%`)
                    : signed ? fmtSign(v) : fmt(v);
                return (
                  <tr key={key} className={cn(
                    "hover:bg-neutral-50 border-b border-neutral-100",
                    highlight && "bg-blue-50/30 font-semibold"
                  )}>
                    <td className={cn(stickyLbl, !highlight && "font-normal italic text-neutral-500")}>{label}</td>
                    {visibleWeekIndices.map((idx, vi) => {
                      const v = arr[idx] ?? 0;
                      const wh = visibleWeeks[vi];
                      return (
                        <td key={idx} className={cn(tdCls,
                          wh?.week === currentISOWeek && year === currentYear ? "bg-blue-50/70 font-semibold" : wh?.week < currentISOWeek && year === currentYear ? "text-neutral-400 bg-neutral-50/40" : "",
                        )}>
                          {cellVal(v)}
                        </td>
                      );
                    })}
                    <td className={cn(tdCls, "bg-neutral-50 font-medium")}>
                      {cellVal(total)}
                    </td>
                  </tr>
                );
              })}

              {/* Block 2: Work by type */}
              <tr className="bg-neutral-50 border-t-2 border-b border-neutral-200">
                <td className={stickyHdr}>Расходы по видам работ</td>
                <td colSpan={weeks.length + 1} className="bg-neutral-50" />
              </tr>
              {workTypes.length === 0 && (
                <tr>
                  <td className={stickyLbl}>—</td>
                  {visibleWeeks.map((_, i) => <td key={i} className={tdCls}>—</td>)}
                  <td className={tdCls}>—</td>
                </tr>
              )}
              {workTypes.map(wt => (
                <tr key={wt.id} className="hover:bg-neutral-50 border-b border-neutral-100">
                  <td className={cn(stickyLbl, "font-normal")}>{wt.name}</td>
                  {visibleWeekIndices.map((idx, vi) => {
                    const wh = visibleWeeks[vi];
                    const v = wt.weeks[idx] ?? 0;
                    return (
                      <td key={idx} className={cn(tdCls, wh?.week === currentISOWeek && year === currentYear ? "bg-blue-50/70 font-semibold" : wh?.week < currentISOWeek && year === currentYear ? "text-neutral-400 bg-neutral-50/40" : "")}>
                        {fmt(v)}
                      </td>
                    );
                  })}
                  <td className={cn(tdCls, "bg-neutral-50 font-medium")}>{fmt(rowTotal(wt.weeks))}</td>
                </tr>
              ))}

              {/* Block 3: Overspend (row41 = expenses − expensePlan) */}
              <tr className="bg-neutral-50 border-t-2 border-b border-neutral-200">
                <td className={cn(stickyLbl, "bg-neutral-50 font-medium text-neutral-800")}>Перерасход</td>
                {visibleWeekIndices.map((idx, vi) => {
                  const wh = visibleWeeks[vi];
                  const v = (summary.overspend ?? [])[idx] ?? 0;
                  return (
                    <td
                      key={idx}
                      className={cn(
                        tdCls,
                        "bg-neutral-50",
                        overspendValueClass(v),
                        wh?.week === currentISOWeek && year === currentYear
                          ? "!bg-blue-50/70 font-semibold"
                          : wh?.week < currentISOWeek && year === currentYear && v === 0
                            ? "text-neutral-400"
                            : ""
                      )}
                    >
                      {v === 0 ? "—" : fmtSign(v)}
                    </td>
                  );
                })}
                <td
                  className={cn(
                    tdCls,
                    "bg-neutral-50 font-medium",
                    overspendValueClass(rowTotal(summary.overspend ?? []))
                  )}
                >
                  {rowTotal(summary.overspend ?? []) === 0 ? "—" : fmtSign(rowTotal(summary.overspend ?? []))}
                </td>
              </tr>

              {/* Block 4: SpendingPlan (row42 = итог; rows 43+ = строки) */}
              <tr className="bg-neutral-50 border-t-2 border-b border-neutral-200">
                <td className={stickyHdr}>План расходов</td>
                <td colSpan={visibleWeeks.length + 1} className="bg-neutral-50" />
              </tr>
              {/* Row 42: итог плана */}
              <tr className="border-b border-neutral-200 bg-neutral-50/50 font-semibold">
                <td className={cn(stickyLbl, "bg-neutral-50/80")}>Итого план</td>
                {visibleWeekIndices.map((idx, vi) => {
                  const wh = visibleWeeks[vi];
                  const v = (summary.expensePlan ?? [])[idx] ?? 0;
                  return (
                    <td key={idx} className={cn(tdCls, "bg-neutral-50/50", wh?.week === currentISOWeek && year === currentYear ? "bg-blue-50/70" : "")}>
                      {fmt(v)}
                    </td>
                  );
                })}
                <td className={cn(tdCls, "bg-neutral-50 font-semibold")}>{fmt(rowTotal(summary.expensePlan ?? []))}</td>
              </tr>
              {planLines.length === 0 && !canManagePlan && (
                <tr className="border-b border-neutral-100">
                  <td className={cn(stickyLbl, "font-normal text-neutral-400")}>Нет строк плана</td>
                  {visibleWeeks.map((_, i) => (
                    <td key={i} className={tdCls}>—</td>
                  ))}
                  <td className={cn(tdCls, "bg-neutral-50")}>—</td>
                </tr>
              )}
              {planLines.map(pl => {
                const weekAmounts = pl.weeks.map(v => (v ? parseFloat(v) : 0));
                const isDeleting = deletingRowId === pl.id;
                return (
                  <tr key={pl.id} className={cn("group hover:bg-neutral-50 border-b border-neutral-100", isDeleting && "opacity-40 pointer-events-none")}>
                    <td className={cn(stickyLbl, "font-normal")}>
                      <div className="flex items-center gap-1 min-w-0">
                        <div className="flex flex-col leading-tight min-w-0 flex-1">
                          <span className="truncate font-medium text-neutral-900">{pl.workTypeName}</span>
                          {pl.executorHasPersonalSmeta ? (
                            <Link
                              href={`/admin/executors/${pl.executorId}?fromProject=${projectId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:underline truncate max-w-full"
                              title="Открыть личную смету"
                            >
                              <span className="truncate">{pl.executorName}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                            </Link>
                          ) : (
                            <span className="text-neutral-400 text-[11px] truncate">{pl.executorName}</span>
                          )}
                        </div>
                        {canManagePlan && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-red-500 hover:bg-red-50"
                            onClick={() => setConfirmRow(pl)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                    {visibleWeekIndices.map((idx, vi) => {
                      const wh = visibleWeeks[vi];
                      const v = pl.weeks[idx] ?? null;
                      return (
                        <td key={idx} className={cn("p-0 text-right border-r border-neutral-100 last:border-0", wh?.week === currentISOWeek && year === currentYear ? "bg-blue-50/70" : wh?.week < currentISOWeek && year === currentYear ? "bg-neutral-50/40" : "")}>
                          {canManagePlan ? (
                            <PlanCell
                              value={v}
                              lineId={pl.lineIds[idx]}
                              projectId={projectId}
                              executorId={pl.executorId}
                              workTypeId={pl.workTypeId}
                              year={year}
                              week={visibleWeeks[vi]?.week ?? idx + 1}
                              onUpdate={() => mutate()}
                            />
                          ) : (
                            <span className="text-xs tabular-nums">{v ? fmt(parseFloat(v)) : "·"}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className={cn(tdCls, "bg-neutral-50 font-medium")}>{fmt(rowTotal(weekAmounts))}</td>
                  </tr>
                );
              })}
              {canManagePlan && (
                <tr className="border-b border-neutral-100 hover:bg-neutral-50/50">
                  <td className={cn(stickyLbl, "font-normal py-1.5")}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 -ml-2 text-xs font-normal text-neutral-600 hover:text-neutral-900"
                      onClick={() => setAddOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-0.5 shrink-0" />
                      строка плана
                    </Button>
                  </td>
                  {visibleWeeks.map((wh, i) => (
                    <td
                      key={i}
                      className={cn(
                        tdCls,
                        wh?.week === currentISOWeek && year === currentYear ? "bg-blue-50/70" : ""
                      )}
                    />
                  ))}
                  <td className={cn(tdCls, "bg-neutral-50")} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <AddPlanLineDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          projectId={projectId}
          year={year}
          executors={executors}
          workTypes={availableWorkTypes}
          onCreated={() => mutate()}
        />
      )}

      <AlertDialog open={!!confirmRow} onOpenChange={open => { if (!open) setConfirmRow(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить строку плана?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRow && (
                <>
                  <span className="font-medium">{confirmRow.executorName}</span>
                  {" / "}{confirmRow.workTypeName}
                  <br />
                  Будут удалены все {confirmRow.lineIds.filter(Boolean).length} записей по неделям для этой строки. Действие необратимо.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={() => confirmRow && deletePlanRow(confirmRow)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
