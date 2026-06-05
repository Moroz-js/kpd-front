"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Pencil, CheckCircle2, X } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { WORK_STATUSES, WORK_STATUSES_SETTABLE } from "@/lib/statuses";
import { formatMoney, formatMoneyRub, formatDate, formatDateShort, weekLabel, monthLabel, MONTHS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulkSelectTableBody } from "@/components/ui-custom/BulkSelectTableBody";
import { SortableHead } from "@/components/ui-custom/SortableHead";
import { RowSelectCheckbox } from "@/components/ui-custom/RowSelectCheckbox";
import { useTableRowSelection } from "@/lib/useTableRowSelection";
import { cn } from "@/lib/utils";
import { IssuedWorkEditDialog, type SmetaType } from "./IssuedWorkEditDialog";

const compactPeriodHead =
  "text-[10px] leading-tight font-medium whitespace-normal normal-case align-bottom !whitespace-normal";

const periodYearMonthClass = "w-24 max-w-24 px-1";
const weekPayClass = "w-18 max-w-18 px-1";

type Row = {
  sourceType: "personal" | "other-expense";
  sourceId: string;
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
  amount: number;
  workStatus: string;
  checkedAt: string | null;
  paidAt: string | null;
  plannedPayAt: string | null;
};
export type IssuedWorkRowDTO = Row;

type ProjectOption = { id: string; name: string; status: string };
type ExecutorOption = { id: string; name: string; status: string };
type WorkTypeOption = { id: string; name: string; status: string };

const fetcher = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<T>;
  });

type SortField =
  | "weekPlanFact"
  | "projectName"
  | "executorName"
  | "executionMonth"
  | "executionYear"
  | "workTypeName"
  | "amount"
  | "workStatus";
type SortDir = "asc" | "desc";

const SMETA_LABEL: Record<SmetaType, string> = {
  personal: "Личная смета",
  "other-expense": "Прочие траты",
};

export function IssuedWorksClient() {
  const { data, isLoading, mutate } = useSWR<Row[]>("/api/issued-works", fetcher);
  const { data: projects } = useSWR<ProjectOption[]>("/api/projects/options", fetcher);
  const { data: executors } = useSWR<ExecutorOption[]>("/api/executors", fetcher);
  const { data: workTypes } = useSWR<WorkTypeOption[]>("/api/work-types", fetcher);

  const [yearPlanFactFilter, setYearPlanFactFilter] = React.useState<string[]>([String(new Date().getFullYear())]);
  const [executionYearFilter, setExecutionYearFilter] = React.useState<string[]>([]);
  const [executionMonthFilter, setExecutionMonthFilter] = React.useState<string[]>([]);
  const [weekFilter, setWeekFilter] = React.useState<string[]>([]);
  const [executorFilter, setExecutorFilter] = React.useState<string[]>([]);
  const [projectFilter, setProjectFilter] = React.useState<string[]>([]);
  const [workTypeFilter, setWorkTypeFilter] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [smetaFilter, setSmetaFilter] = React.useState<string[]>([]);

  const [sort, setSort] = React.useState<{ field: SortField; dir: SortDir }[]>([
    { field: "weekPlanFact", dir: "desc" },
    { field: "projectName", dir: "asc" },
    { field: "executorName", dir: "asc" },
    { field: "executionMonth", dir: "desc" },
  ]);

  const [editing, setEditing] = React.useState<Row | null>(null);

  // Bulk
  const [bulkStatus, setBulkStatus] = React.useState("");
  const [bulkPlannedPayAt, setBulkPlannedPayAt] = React.useState("");
  const [bulkSaving, setBulkSaving] = React.useState(false);

  function rowId(r: Row) { return `${r.sourceType}:${r.sourceId}`; }

  function compareRows(a: Row, b: Row): number {
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

  function handleSort(field: string, dir: SortDir) {
    setSort([{ field: field as SortField, dir }]);
  }

  const allRows = data ?? [];

  const yearOptions = React.useMemo(() => {
    const opts = Array.from(
      new Set(allRows.map((r) => r.yearPlanFact).filter((v): v is number => v != null))
    ).sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) }));
    const hasEmpty = allRows.some((r) => r.yearPlanFact === null);
    return hasEmpty ? [{ value: "__empty__", label: "Пусто" }, ...opts] : opts;
  }, [allRows]);
  const execYearOptions = React.useMemo(
    () =>
      Array.from(new Set(allRows.map((r) => r.executionYear)))
        .sort((a, b) => b - a)
        .map((y) => ({ value: String(y), label: String(y) })),
    [allRows]
  );
  const monthOptions = MONTHS;
  const weekOptions = React.useMemo(() => {
    const opts = Array.from(
      new Set(allRows.map((r) => r.weekPlanFact).filter((v): v is number => v != null))
    ).sort((a, b) => a - b).map((w) => ({ value: String(w), label: weekLabel(w) }));
    const hasEmpty = allRows.some((r) => r.weekPlanFact === null);
    return hasEmpty ? [{ value: "__empty__", label: "Пусто" }, ...opts] : opts;
  }, [allRows]);
  const executorOptions = React.useMemo(
    () =>
      Array.from(new Map(allRows.map((r) => [r.executorId, r.executorName])).entries())
        .sort((a, b) => a[1].localeCompare(b[1], "ru"))
        .map(([value, label]) => ({ value, label })),
    [allRows]
  );
  const projectOptions = React.useMemo(
    () =>
      Array.from(new Map(allRows.map((r) => [r.projectId, r.projectName])).entries())
        .sort((a, b) => a[1].localeCompare(b[1], "ru"))
        .map(([value, label]) => ({ value, label })),
    [allRows]
  );
  const workTypeOptions = React.useMemo(() => {
    const map = new Map<string, { label: string; group: string }>();
    for (const r of allRows) {
      if (!map.has(r.workTypeId)) {
        map.set(r.workTypeId, { label: r.workTypeName, group: r.workTypeSegment ?? "" });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) =>
        (a[1].group ?? "").localeCompare(b[1].group ?? "", "ru") ||
        a[1].label.localeCompare(b[1].label, "ru")
      )
      .map(([value, { label, group }]) => ({ value, label, group }));
  }, [allRows]);

  const rows = React.useMemo(() => {
    let list = allRows;
    if (yearPlanFactFilter.length)
      list = list.filter((r) => yearPlanFactFilter.includes(r.yearPlanFact === null ? "__empty__" : String(r.yearPlanFact)));
    if (executionYearFilter.length)
      list = list.filter((r) => executionYearFilter.includes(String(r.executionYear)));
    if (executionMonthFilter.length)
      list = list.filter((r) => executionMonthFilter.includes(String(r.executionMonth)));
    if (weekFilter.length) list = list.filter((r) => weekFilter.includes(r.weekPlanFact === null ? "__empty__" : String(r.weekPlanFact)));
    if (executorFilter.length) list = list.filter((r) => executorFilter.includes(r.executorId));
    if (projectFilter.length) list = list.filter((r) => projectFilter.includes(r.projectId));
    if (workTypeFilter.length) list = list.filter((r) => workTypeFilter.includes(r.workTypeId));
    if (statusFilter.length) list = list.filter((r) => statusFilter.includes(r.workStatus));
    if (smetaFilter.length) list = list.filter((r) => smetaFilter.includes(r.sourceType));
    return [...list].sort(compareRows);
  }, [
    allRows,
    yearPlanFactFilter,
    executionYearFilter,
    executionMonthFilter,
    weekFilter,
    executorFilter,
    projectFilter,
    workTypeFilter,
    statusFilter,
    smetaFilter,
    sort,
  ]);

  const orderedRowIds = React.useMemo(() => rows.map(rowId), [rows]);
  const { selectedIds, handleRowSelect, toggleAll, clearSelection } = useTableRowSelection(orderedRowIds);

  async function handleBulkApply() {
    const ids = Array.from(selectedIds);
    const patch: Record<string, unknown> = {};
    if (bulkStatus) patch.workStatus = bulkStatus;
    if (bulkPlannedPayAt) patch.plannedPayAt = new Date(bulkPlannedPayAt).toISOString();
    if (Object.keys(patch).length === 0) return toast.error("Выберите хотя бы одно поле");
    setBulkSaving(true);
    const res = await fetch("/api/issued-works/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, patch }),
    });
    setBulkSaving(false);
    if (!res.ok) return toast.error("Ошибка массового обновления");
    const { updated } = await res.json() as { updated: number };
    toast.success(`Обновлено ${updated} записей`);
    clearSelection();
    setBulkStatus("");
    setBulkPlannedPayAt("");
    mutate();
  }

  async function handleCheck(row: Row) {
    const compositeId = `${row.sourceType}:${row.sourceId}`;
    const res = await fetch(`/api/issued-works/${compositeId}/check`, { method: "POST" });
    if (!res.ok) return toast.error("Не удалось проставить «Проверено»");
    toast.success("Работа проверена");
    mutate();
  }

  function activeSortField(): SortField {
    return sort[0]?.field ?? "weekPlanFact";
  }

  function activeSortDir(): SortDir {
    return sort[0]?.dir ?? "desc";
  }

  const displayRows = selectedIds.size > 0
    ? rows.filter(r => selectedIds.has(rowId(r)))
    : rows;
  const displaySum = displayRows.reduce((s, r) => s + r.amount, 0);
  const displayCount = displayRows.length;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] min-h-0">
      <PageHeader title="Выставленные работы" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MultiSelectFilter
          label="Год оплаты план-факт"
          options={yearOptions}
          value={yearPlanFactFilter}
          onChange={setYearPlanFactFilter}
        />
        <MultiSelectFilter
          label="Год выполнения"
          options={execYearOptions}
          value={executionYearFilter}
          onChange={setExecutionYearFilter}
        />
        <MultiSelectFilter
          label="Месяц"
          options={monthOptions}
          value={executionMonthFilter}
          onChange={setExecutionMonthFilter}
        />
        <MultiSelectFilter
          label="Неделя"
          options={weekOptions}
          value={weekFilter}
          onChange={setWeekFilter}
        />
        <MultiSelectFilter
          label="Исполнитель"
          options={executorOptions}
          value={executorFilter}
          onChange={setExecutorFilter}
        />
        <MultiSelectFilter
          label="Проект"
          options={projectOptions}
          value={projectFilter}
          onChange={setProjectFilter}
        />
        <MultiSelectFilter
          label="Вид работ"
          options={workTypeOptions}
          value={workTypeFilter}
          onChange={setWorkTypeFilter}
        />
        <MultiSelectFilter
          label="Статус"
          options={Object.entries(WORK_STATUSES).map(([value, { label }]) => ({ value, label }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <MultiSelectFilter
          label="Тип сметы"
          options={[
            { value: "personal", label: "Личная смета" },
            { value: "other-expense", label: "Прочие траты" },
          ]}
          value={smetaFilter}
          onChange={setSmetaFilter}
        />
      </div>

      {(rows.length > 0 || selectedIds.size > 0) && (
        <div className="flex items-center gap-4 px-1 py-1.5 text-xs text-neutral-500">
          <span>{displayCount} {selectedIds.size > 0 ? "выбрано" : "записей"}</span>
          <span className="text-xs font-medium tabular-nums text-neutral-800">
            {formatMoneyRub(displaySum)}
          </span>
        </div>
      )}

      {/* Bulk toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
          <span className="text-xs font-medium text-blue-700">{selectedIds.size} выбрано</span>
          <Select value={bulkStatus} onValueChange={(v) => v && setBulkStatus(v)}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue>{bulkStatus ? (WORK_STATUSES[bulkStatus as keyof typeof WORK_STATUSES]?.label ?? "Статус") : "Статус"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {WORK_STATUSES_SETTABLE.map((k) => (
                <SelectItem key={k} value={k}>{WORK_STATUSES[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">Дата план:</span>
            <Input type="date" className="h-7 text-xs w-36" value={bulkPlannedPayAt} onChange={(e) => setBulkPlannedPayAt(e.target.value)} />
          </div>
          <Button size="sm" className="h-7 text-xs" onClick={handleBulkApply} disabled={bulkSaving}>
            {bulkSaving ? "..." : "Применить"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { clearSelection(); setBulkStatus(""); setBulkPlannedPayAt(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <Table
        className="min-w-[1200px]"
        containerClassName="rounded-md border bg-white flex-1 min-h-0 overflow-auto"
      >
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={selectedIds.size === rows.length && rows.length > 0} onCheckedChange={() => toggleAll(orderedRowIds)} />
              </TableHead>
              <SortableHead
                field="executionYear"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className={cn(periodYearMonthClass, "text-left !whitespace-normal")}
              >
                <span className="block text-[10px] leading-tight font-medium tracking-tight normal-case text-left">
                  Год
                  <br />
                  выполнения
                </span>
              </SortableHead>
              <SortableHead
                field="executionMonth"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className={cn(periodYearMonthClass, compactPeriodHead)}
              >
                <span className="block text-left">
                  Месяц
                  <br />
                  выполнения
                </span>
              </SortableHead>
              <SortableHead
                field="weekPlanFact"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className={cn(weekPayClass, compactPeriodHead)}
              >
                <span className="block text-left">
                  Неделя
                  <br />
                  оплаты
                </span>
              </SortableHead>
              <SortableHead
                field="executorName"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
              >
                Исполнитель
              </SortableHead>
              <SortableHead
                field="projectName"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
              >
                Проект
              </SortableHead>
              <SortableHead
                field="workTypeName"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
              >
                Вид работ
              </SortableHead>
              <SortableHead
                field="amount"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className="text-right"
              >
                Сумма
              </SortableHead>
              <SortableHead
                field="workStatus"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
              >
                Статус
              </SortableHead>
              <TableHead>Дата проверки</TableHead>
              <TableHead>Дата оплаты план</TableHead>
              <TableHead>Дата оплаты факт</TableHead>
              <TableHead>Тип сметы</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <BulkSelectTableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-neutral-500 py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-neutral-500 py-12">
                  Пока нет ни одной работы. Они появятся после создания строк в Личных сметах
                  и Прочих тратах (Phase 3).
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, rowIndex) => (
                <TableRow key={`${r.sourceType}:${r.sourceId}`} className={`${selectedIds.has(rowId(r)) ? "bg-blue-50" : ""} ${r.workStatus === "archived" ? "bg-neutral-50 text-neutral-400" : ""}`.trim()}>
                  <TableCell>
                    <RowSelectCheckbox
                      checked={selectedIds.has(rowId(r))}
                      rowIndex={rowIndex}
                      rowId={rowId(r)}
                      onSelect={handleRowSelect}
                    />
                  </TableCell>
                  <TableCell className={cn("text-xs tabular-nums text-left", periodYearMonthClass)}>
                    {r.executionYear}
                  </TableCell>
                  <TableCell className={cn("text-xs whitespace-nowrap", periodYearMonthClass)}>
                    {monthLabel(r.executionMonth)}
                  </TableCell>
                  <TableCell className={cn("text-xs whitespace-nowrap", weekPayClass)}>
                    {r.weekPlanFact != null ? weekLabel(r.weekPlanFact) : "—"}
                  </TableCell>
                  <TableCell>{r.executorName}</TableCell>
                  <TableCell>{r.projectName}</TableCell>
                  <TableCell>{r.workTypeName}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-sm">{formatMoney(r.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge dict={WORK_STATUSES} value={r.workStatus} />
                  </TableCell>
                  <TableCell>{formatDateShort(r.checkedAt)}</TableCell>
                  <TableCell>{formatDateShort(r.plannedPayAt)}</TableCell>
                  <TableCell>{formatDateShort(r.paidAt)}</TableCell>
                  <TableCell className="text-sm">{SMETA_LABEL[r.sourceType]}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)} title="Редактировать">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {r.workStatus === "submitted" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCheck(r)}
                        title="Проставить «Проверено»"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </BulkSelectTableBody>
        </Table>

      {editing && (
        <IssuedWorkEditDialog
          row={editing}
          projects={projects ?? []}
          executors={executors ?? []}
          workTypes={workTypes ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}
