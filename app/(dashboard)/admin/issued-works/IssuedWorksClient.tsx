"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Pencil, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { WORK_STATUSES, EXECUTOR_TYPES, PROJECT_TYPES } from "@/lib/statuses";
import { formatMoney, formatDate, weekLabel, monthLabel, MONTHS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/components/ui-custom/SortableHead";
import { IssuedWorkEditDialog, type SmetaType } from "./IssuedWorkEditDialog";

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
  | "yearPlanFact"
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

  const [yearPlanFactFilter, setYearPlanFactFilter] = React.useState<string[]>([]);
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

  const yearOptions = React.useMemo(
    () =>
      Array.from(
        new Set(allRows.map((r) => r.yearPlanFact).filter((v): v is number => v != null))
      )
        .sort((a, b) => b - a)
        .map((y) => ({ value: String(y), label: String(y) })),
    [allRows]
  );
  const execYearOptions = React.useMemo(
    () =>
      Array.from(new Set(allRows.map((r) => r.executionYear)))
        .sort((a, b) => b - a)
        .map((y) => ({ value: String(y), label: String(y) })),
    [allRows]
  );
  const monthOptions = MONTHS;
  const weekOptions = React.useMemo(
    () =>
      Array.from(
        new Set(allRows.map((r) => r.weekPlanFact).filter((v): v is number => v != null))
      )
        .sort((a, b) => a - b)
        .map((w) => ({ value: String(w), label: weekLabel(w) })),
    [allRows]
  );
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
  const workTypeOptions = React.useMemo(
    () =>
      Array.from(new Map(allRows.map((r) => [r.workTypeId, r.workTypeName])).entries())
        .sort((a, b) => a[1].localeCompare(b[1], "ru"))
        .map(([value, label]) => ({ value, label })),
    [allRows]
  );

  const rows = React.useMemo(() => {
    let list = allRows;
    if (yearPlanFactFilter.length)
      list = list.filter((r) => yearPlanFactFilter.includes(String(r.yearPlanFact ?? "")));
    if (executionYearFilter.length)
      list = list.filter((r) => executionYearFilter.includes(String(r.executionYear)));
    if (executionMonthFilter.length)
      list = list.filter((r) => executionMonthFilter.includes(String(r.executionMonth)));
    if (weekFilter.length) list = list.filter((r) => weekFilter.includes(String(r.weekPlanFact ?? "")));
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

  return (
    <>
      <PageHeader
        title="Выставленные работы"
        description="Все выставленные работы."
      />

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

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table className="min-w-[1700px]">
          <TableHeader>
            <TableRow>
              <SortableHead
                field="yearPlanFact"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
              >
                Год план-факт
              </SortableHead>
              <SortableHead
                field="executionYear"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
              >
                Год выполн.
              </SortableHead>
              <SortableHead
                field="executionMonth"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
              >
                Месяц
              </SortableHead>
              <SortableHead
                field="weekPlanFact"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className="border-r-2 border-neutral-300"
              >
                Неделя
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
                className="border-r-2 border-neutral-300"
              >
                Статус
              </SortableHead>
              <TableHead>Дата проверки</TableHead>
              <TableHead>Дата оплаты</TableHead>
              <TableHead className="border-r-2 border-neutral-300">Дата оплаты — план</TableHead>
              <TableHead>Тип проекта</TableHead>
              <TableHead>Сегмент работ</TableHead>
              <TableHead>Тип исполнителя</TableHead>
              <TableHead>Тип сметы</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center text-neutral-500 py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center text-neutral-500 py-12">
                  Пока нет ни одной работы. Они появятся после создания строк в Личных сметах
                  и Прочих тратах (Phase 3).
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={`${r.sourceType}:${r.sourceId}`}>
                  <TableCell className="text-sm tabular-nums">{r.yearPlanFact ?? "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{r.executionYear}</TableCell>
                  <TableCell className="text-sm">{monthLabel(r.executionMonth)}</TableCell>
                  <TableCell className="border-r-2 border-neutral-300 text-sm">
                    {r.weekPlanFact != null ? weekLabel(r.weekPlanFact) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.executorName}</TableCell>
                  <TableCell className="text-sm">{r.projectName}</TableCell>
                  <TableCell className="text-sm">{r.workTypeName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.amount)}</TableCell>
                  <TableCell className="border-r-2 border-neutral-300">
                    <StatusBadge dict={WORK_STATUSES} value={r.workStatus} />
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(r.checkedAt)}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.paidAt)}</TableCell>
                  <TableCell className="border-r-2 border-neutral-300 text-sm">
                    {formatDate(r.plannedPayAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {PROJECT_TYPES[r.projectType as keyof typeof PROJECT_TYPES] ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.workTypeSegment}</TableCell>
                  <TableCell className="text-sm">
                    {EXECUTOR_TYPES[r.executorType as keyof typeof EXECUTOR_TYPES] ?? r.executorType}
                  </TableCell>
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
          </TableBody>
        </Table>
      </div>

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
    </>
  );
}
