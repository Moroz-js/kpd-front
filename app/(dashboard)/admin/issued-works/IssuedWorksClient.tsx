"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, CheckCircle2, X } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { WORK_STATUSES, WORK_STATUSES_SETTABLE } from "@/lib/statuses";
import { formatMoney, formatMoneyRub, formatDateShort, weekLabel, monthLabel, MONTHS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui-custom/DateInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VirtualizedTableBody } from "@/components/ui-custom/VirtualizedTableBody";
import { TablePagination } from "@/components/ui-custom/TablePagination";
import { SortableHead } from "@/components/ui-custom/SortableHead";
import { RowSelectCheckbox } from "@/components/ui-custom/RowSelectCheckbox";
import { useTableRowSelection } from "@/lib/useTableRowSelection";
import { useServerTable } from "@/lib/useServerTable";
import {
  buildIssuedWorksSearchParams,
  clientFiltersToIssuedWorksFilter,
} from "@/lib/views/issuedWorksQuery";
import type { IssuedWorksSort } from "@/lib/views/issuedWorks";
import { cn } from "@/lib/utils";
import { stickyActionsHead, stickyActionsCell, stickyActionsInner, compactTable, compactHead, compactPeriodHead, compactCell, compactCellClip } from "@/lib/table-styles";
import { IssuedWorkEditDialog, type SmetaType } from "./IssuedWorkEditDialog";

const periodYearMonthClass = "w-20 max-w-20 px-1";
const weekPayClass = "w-20 max-w-20 px-1";

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
  responsibleExecutorId: string | null;
  responsibleExecutorName: string | null;
  amount: number;
  workStatus: string;
  checkedAt: string | null;
  paidAt: string | null;
  plannedPayAt: string | null;
};
export type IssuedWorkRowDTO = Row;

type ProjectOption = { id: string; name: string; status: string };
type ExecutorOption = { id: string; name: string; status: string };
type WorkTypeOption = { id: string; name: string; status: string; segment?: string };

const fetcher = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<T>;
  });

type ListResponse = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  totalAmount: number;
};

function buildYearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => current - i + 2);
  return [
    { value: "__empty__", label: "Пусто" },
    ...years.map((y) => ({ value: String(y), label: String(y) })),
  ];
}

function buildWeekOptions(): { value: string; label: string }[] {
  return [
    { value: "__empty__", label: "Пусто" },
    ...Array.from({ length: 53 }, (_, i) => {
      const w = i + 1;
      return { value: String(w), label: weekLabel(w) };
    }),
  ];
}
type SortField = IssuedWorksSort["field"];
type SortDir = IssuedWorksSort["dir"];

const SMETA_LABEL: Record<SmetaType, string> = {
  personal: "Личная смета",
  "other-expense": "Прочие траты",
};

function smetaTypeCell(row: Row) {
  if (row.sourceType === "personal") {
    return (
      <Link
        href={`/admin/executors/${row.executorId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
        title="Открыть личную смету"
      >
        {SMETA_LABEL.personal}
      </Link>
    );
  }
  return SMETA_LABEL["other-expense"];
}

function issuedWorkRowId(r: Row) {
  return `${r.sourceType}:${r.sourceId}`;
}

type IssuedWorkRowProps = {
  row: Row;
  rowIndex: number;
  checked: boolean;
  onSelect: (index: number, id: string, shiftKey: boolean) => void;
  onEdit: (row: Row) => void;
  onCheck: (row: Row) => void;
};

const IssuedWorkRow = React.memo(function IssuedWorkRow({
  row: r,
  rowIndex,
  checked,
  onSelect,
  onEdit,
  onCheck,
}: IssuedWorkRowProps) {
  const id = issuedWorkRowId(r);
  return (
    <TableRow
      className={`${checked ? "bg-blue-50" : ""} ${r.workStatus === "archived" ? "bg-neutral-50 text-neutral-400" : ""}`.trim()}
    >
      <TableCell>
        <RowSelectCheckbox
          checked={checked}
          rowIndex={rowIndex}
          rowId={id}
          onSelect={onSelect}
        />
      </TableCell>
      <TableCell className={cn(compactCell, "tabular-nums text-left", periodYearMonthClass)}>
        {r.executionYear}
      </TableCell>
      <TableCell className={cn(compactCell, "whitespace-nowrap", periodYearMonthClass)}>
        {monthLabel(r.executionMonth)}
      </TableCell>
      <TableCell className={cn(compactCell, "whitespace-nowrap", weekPayClass)}>
        {r.weekPlanFact != null ? weekLabel(r.weekPlanFact) : "—"}
      </TableCell>
      <TableCell className={cn(compactCell, compactCellClip, "whitespace-normal")}>{r.executorName}</TableCell>
      <TableCell className={cn(compactCell, compactCellClip, "whitespace-normal")}>
        {r.responsibleExecutorName ?? "—"}
      </TableCell>
      <TableCell className={cn(compactCell, compactCellClip, "whitespace-normal")}>{r.projectName}</TableCell>
      <TableCell className={cn(compactCell, compactCellClip, "whitespace-normal")}>{r.workTypeName}</TableCell>
      <TableCell className={cn(compactCell, "text-right tabular-nums font-semibold")}>{formatMoney(r.amount)}</TableCell>
      <TableCell className={compactCell}>
        <StatusBadge dict={WORK_STATUSES} value={r.workStatus} />
      </TableCell>
      <TableCell className={compactCell}>{formatDateShort(r.checkedAt)}</TableCell>
      <TableCell className={compactCell}>{formatDateShort(r.plannedPayAt)}</TableCell>
      <TableCell className={cn(compactCell, r.workStatus === "paid" && !r.paidAt && "bg-red-100 text-red-700")}>
        {formatDateShort(r.paidAt)}
      </TableCell>
      <TableCell className={compactCell}>{smetaTypeCell(r)}</TableCell>
      <TableCell
        className={cn(
          stickyActionsCell,
          checked && "bg-blue-50",
          r.workStatus === "archived" && "bg-neutral-50"
        )}
      >
        <div className={stickyActionsInner}>
          <Button size="sm" variant="ghost" onClick={() => onEdit(r)} title="Редактировать">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {r.workStatus === "submitted" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCheck(r)}
              title="Проставить «Проверено»"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

export function IssuedWorksClient() {
  const { page, setPage, pageSize, setPageSize, onFilterChange } = useServerTable();

  const [yearPlanFactFilter, setYearPlanFactFilter] = React.useState<string[]>([String(new Date().getFullYear())]);
  const [executionYearFilter, setExecutionYearFilter] = React.useState<string[]>([]);
  const [executionMonthFilter, setExecutionMonthFilter] = React.useState<string[]>([]);
  const [weekFilter, setWeekFilter] = React.useState<string[]>([]);
  const [executorFilter, setExecutorFilter] = React.useState<string[]>([]);
  const [projectFilter, setProjectFilter] = React.useState<string[]>([]);
  const [workTypeFilter, setWorkTypeFilter] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [smetaFilter, setSmetaFilter] = React.useState<string[]>([]);

  const [sort, setSort] = React.useState<IssuedWorksSort[]>([
    { field: "weekPlanFact", dir: "desc" },
    { field: "projectName", dir: "asc" },
    { field: "executorName", dir: "asc" },
    { field: "executionMonth", dir: "desc" },
  ]);

  const filterState = React.useMemo(
    () => ({
      yearPlanFact: yearPlanFactFilter,
      executionYear: executionYearFilter,
      executionMonth: executionMonthFilter,
      weekPlanFact: weekFilter,
      executorId: executorFilter,
      projectId: projectFilter,
      workTypeId: workTypeFilter,
      workStatus: statusFilter,
      smetaFilter,
    }),
    [
      yearPlanFactFilter,
      executionYearFilter,
      executionMonthFilter,
      weekFilter,
      executorFilter,
      projectFilter,
      workTypeFilter,
      statusFilter,
      smetaFilter,
    ]
  );

  const listUrl = React.useMemo(
    () =>
      `/api/issued-works?${buildIssuedWorksSearchParams({
        filter: filterState,
        sort,
        page,
        pageSize,
      })}`,
    [filterState, sort, page, pageSize]
  );

  const { data, isLoading, mutate } = useSWR<ListResponse>(listUrl, fetcher);
  const { data: projects } = useSWR<ProjectOption[]>("/api/projects/options", fetcher);
  const { data: executors } = useSWR<ExecutorOption[]>("/api/executors", fetcher);
  const { data: workTypes } = useSWR<WorkTypeOption[]>("/api/work-types", fetcher);

  const [editing, setEditing] = React.useState<Row | null>(null);
  const [selectAllFiltered, setSelectAllFiltered] = React.useState(false);

  // Bulk
  const [bulkStatus, setBulkStatus] = React.useState("");
  const [bulkPlannedPayAt, setBulkPlannedPayAt] = React.useState("");
  const [bulkSaving, setBulkSaving] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalAmount = data?.totalAmount ?? 0;

  const yearOptions = React.useMemo(() => buildYearOptions(), []);
  const execYearOptions = yearOptions;
  const monthOptions = MONTHS;
  const weekOptions = React.useMemo(() => buildWeekOptions(), []);

  const executorOptions = React.useMemo(
    () =>
      (executors ?? [])
        .map((e) => ({ value: e.id, label: e.name }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru")),
    [executors]
  );
  const projectOptions = React.useMemo(
    () =>
      (projects ?? [])
        .map((p) => ({ value: p.id, label: p.name }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru")),
    [projects]
  );
  const workTypeOptions = React.useMemo(
    () =>
      (workTypes ?? [])
        .map((wt) => ({
          value: wt.id,
          label: wt.name,
          group: wt.segment ?? "",
        }))
        .sort(
          (a, b) =>
            (a.group ?? "").localeCompare(b.group ?? "", "ru") ||
            a.label.localeCompare(b.label, "ru")
        ),
    [workTypes]
  );

  const orderedRowIds = React.useMemo(() => rows.map(issuedWorkRowId), [rows]);
  const { selectedIds, handleRowSelect, toggleAll, clearSelection } = useTableRowSelection(orderedRowIds);

  React.useEffect(() => {
    clearSelection();
    setSelectAllFiltered(false);
  }, [listUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetSelection() {
    clearSelection();
    setSelectAllFiltered(false);
  }

  function handleSort(field: string, dir: SortDir) {
    setSort([{ field: field as SortField, dir }]);
    setPage(1);
    resetSelection();
  }

  const { displayCount, displaySum } = React.useMemo(() => {
    if (selectAllFiltered) {
      return { displayCount: total, displaySum: totalAmount };
    }
    if (selectedIds.size === 0) {
      return { displayCount: total, displaySum: totalAmount };
    }
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      if (selectedIds.has(issuedWorkRowId(r))) {
        sum += r.amount;
        count += 1;
      }
    }
    return { displayCount: count, displaySum: sum };
  }, [rows, selectedIds, total, totalAmount, selectAllFiltered]);

  const handleEdit = React.useCallback((row: Row) => setEditing(row), []);

  const handleCheckRow = React.useCallback(
    async (row: Row) => {
      const compositeId = `${row.sourceType}:${row.sourceId}`;
      const res = await fetch(`/api/issued-works/${compositeId}/check`, { method: "POST" });
      if (!res.ok) return toast.error("Не удалось проставить «Проверено»");
      toast.success("Работа проверена");
      mutate();
    },
    [mutate]
  );

  const renderRow = React.useCallback(
    (index: number) => {
      const r = rows[index];
      if (!r) return null;
      const id = issuedWorkRowId(r);
      return (
        <IssuedWorkRow
          key={id}
          row={r}
          rowIndex={index}
          checked={selectedIds.has(id)}
          onSelect={handleRowSelect}
          onEdit={handleEdit}
          onCheck={handleCheckRow}
        />
      );
    },
    [rows, selectedIds, handleRowSelect, handleEdit, handleCheckRow]
  );

  async function handleBulkApply() {
    const patch: Record<string, unknown> = {};
    if (bulkStatus) patch.workStatus = bulkStatus;
    if (bulkPlannedPayAt) patch.plannedPayAt = new Date(bulkPlannedPayAt).toISOString();
    if (Object.keys(patch).length === 0) return toast.error("Выберите хотя бы одно поле");

    const body = selectAllFiltered
      ? {
          selectAll: true,
          filter: clientFiltersToIssuedWorksFilter(filterState),
          patch,
        }
      : { ids: Array.from(selectedIds), patch };

    setBulkSaving(true);
    const res = await fetch("/api/issued-works/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBulkSaving(false);
    if (!res.ok) return toast.error("Ошибка массового обновления");
    const { updated } = await res.json() as { updated: number };
    toast.success(`Обновлено ${updated} записей`);
    resetSelection();
    setBulkStatus("");
    setBulkPlannedPayAt("");
    mutate();
  }

  function handleToggleAll() {
    if (selectAllFiltered) {
      resetSelection();
      return;
    }
    toggleAll(orderedRowIds);
  }

  const allPageSelected =
    rows.length > 0 && orderedRowIds.every((id) => selectedIds.has(id));

  function activeSortField(): SortField {
    return sort[0]?.field ?? "weekPlanFact";
  }

  function activeSortDir(): SortDir {
    return sort[0]?.dir ?? "desc";
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] min-h-0">
      <PageHeader title="Выставленные работы" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MultiSelectFilter
          label="Год оплаты план-факт"
          options={yearOptions}
          value={yearPlanFactFilter}
          onChange={(v) => onFilterChange(setYearPlanFactFilter, v)}
        />
        <MultiSelectFilter
          label="Год выполнения"
          options={execYearOptions}
          value={executionYearFilter}
          onChange={(v) => onFilterChange(setExecutionYearFilter, v)}
        />
        <MultiSelectFilter
          label="Месяц"
          options={monthOptions}
          value={executionMonthFilter}
          onChange={(v) => onFilterChange(setExecutionMonthFilter, v)}
        />
        <MultiSelectFilter
          label="Неделя"
          options={weekOptions}
          value={weekFilter}
          onChange={(v) => onFilterChange(setWeekFilter, v)}
        />
        <MultiSelectFilter
          label="Исполнитель"
          options={executorOptions}
          value={executorFilter}
          onChange={(v) => onFilterChange(setExecutorFilter, v)}
        />
        <MultiSelectFilter
          label="Проект"
          options={projectOptions}
          value={projectFilter}
          onChange={(v) => onFilterChange(setProjectFilter, v)}
        />
        <MultiSelectFilter
          label="Вид работ"
          options={workTypeOptions}
          value={workTypeFilter}
          onChange={(v) => onFilterChange(setWorkTypeFilter, v)}
        />
        <MultiSelectFilter
          label="Статус"
          options={Object.entries(WORK_STATUSES).map(([value, { label }]) => ({ value, label }))}
          value={statusFilter}
          onChange={(v) => onFilterChange(setStatusFilter, v)}
        />
        <MultiSelectFilter
          label="Тип сметы"
          options={[
            { value: "personal", label: "Личная смета" },
            { value: "other-expense", label: "Прочие траты" },
          ]}
          value={smetaFilter}
          onChange={(v) => onFilterChange(setSmetaFilter, v)}
        />
      </div>

      {(total > 0 || selectedIds.size > 0 || selectAllFiltered) && (
        <div className="flex items-center gap-4 px-1 py-1.5 text-xs text-neutral-500">
          <span>
            {displayCount}{" "}
            {selectAllFiltered || selectedIds.size > 0 ? "выбрано" : "записей"}
          </span>
          <span className="text-xs font-medium tabular-nums text-neutral-800">
            {formatMoneyRub(displaySum)}
          </span>
        </div>
      )}

      {allPageSelected && total > rows.length && !selectAllFiltered && (
        <div className="mb-2 px-1 text-xs text-blue-700">
          Выбраны все записи на странице.{" "}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => setSelectAllFiltered(true)}
          >
            Выбрать все {total} по фильтру
          </button>
        </div>
      )}

      {/* Bulk toolbar */}
      {(selectedIds.size > 0 || selectAllFiltered) && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
          <span className="text-xs font-medium text-blue-700">
            {selectAllFiltered ? total : selectedIds.size} выбрано
          </span>
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
            <DateInput className="h-7 text-xs w-36" value={bulkPlannedPayAt} onChange={(e) => setBulkPlannedPayAt(e.target.value)} />
          </div>
          <Button size="sm" className="h-7 text-xs" onClick={handleBulkApply} disabled={bulkSaving}>
            {bulkSaving ? "..." : "Применить"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { resetSelection(); setBulkStatus(""); setBulkPlannedPayAt(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <Table
        className={cn(compactTable, "min-w-[1680px]")}
        containerClassName="rounded-md border bg-white flex-1 min-h-0 overflow-auto"
        containerRef={scrollRef}
      >
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={selectAllFiltered || (allPageSelected && rows.length > 0)}
                  onCheckedChange={handleToggleAll}
                />
              </TableHead>
              <SortableHead
                field="executionYear"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className={cn(periodYearMonthClass, compactPeriodHead, "text-left")}
              >
                <span className="block text-left">
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
                className={cn(compactHead, "w-32 max-w-32")}
              >
                Исполнитель
              </SortableHead>
              <TableHead className={cn(compactHead, "w-32 max-w-32")}>Ответственный</TableHead>
              <SortableHead
                field="projectName"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className={cn(compactHead, "w-44 max-w-44")}
              >
                Проект
              </SortableHead>
              <SortableHead
                field="workTypeName"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className={cn(compactHead, "w-32 max-w-32")}
              >
                Вид работ
              </SortableHead>
              <SortableHead
                field="amount"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className={cn(compactHead, "text-right w-28")}
              >
                Сумма
              </SortableHead>
              <SortableHead
                field="workStatus"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className={cn(compactHead, "w-32")}
              >
                Статус
              </SortableHead>
              <TableHead className={cn(compactHead, "w-28")}>Дата проверки</TableHead>
              <TableHead className={cn(compactHead, "w-28")}>Дата оплаты план</TableHead>
              <TableHead className={cn(compactHead, "w-28")}>Дата оплаты факт</TableHead>
              <TableHead className={cn(compactHead, "w-32")}>Тип сметы</TableHead>
              <TableHead className={stickyActionsHead} />
            </TableRow>
          </TableHeader>
          <VirtualizedTableBody
            scrollRef={scrollRef}
            rowCount={rows.length}
            colSpan={15}
            isLoading={isLoading}
            loading={
              <TableRow>
                <TableCell colSpan={15} className="text-center text-neutral-500 py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            }
            isEmpty={rows.length === 0}
            empty={
              <TableRow>
                <TableCell colSpan={15} className="text-center text-neutral-500 py-12">
                  Пока нет ни одной работы. Они появятся после создания строк в Личных сметах
                  и Прочих тратах (Phase 3).
                </TableCell>
              </TableRow>
            }
            renderRow={renderRow}
          />
        </Table>

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

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
