"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { WORK_STATUSES, WORK_STATUSES_SETTABLE } from "@/lib/statuses";
import { formatMoney, formatDateShort, monthLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulkSelectTableBody } from "@/components/ui-custom/BulkSelectTableBody";
import { cn } from "@/lib/utils";
import { stickyActionsHead, stickyActionsCell, stickyActionsInner } from "@/lib/table-styles";

type ReviewRow = {
  sourceType: "personal" | "other-expense";
  sourceId: string;
  executionYear: number;
  executionMonth: number;
  executorId: string;
  executorName: string;
  projectId: string;
  projectName: string;
  workTypeId: string;
  workTypeName: string;
  responsibleExecutorId: string | null;
  responsibleExecutorName: string | null;
  amount: number;
  workStatus: string;
  comment: string | null;
  checkedAt: string | null;
  paidAt: string | null;
  plannedPayAt: string | null;
};

type ExecutorRef = { id: string; name: string };

const fetcher = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<T>;
  });

function rowId(r: ReviewRow) {
  return `${r.sourceType}:${r.sourceId}`;
}

const PAID = new Set(["paid"]);

/**
 * Переиспользуемая таблица «работ на проверку» (KPD-287 дашборд проекта,
 * KPD-288 личная смета). Позволяет рецензенту менять статус, ответственного и
 * комментарий, массово «Проверить все», фильтровать по исполнителю и сворачивать
 * оплаченные работы. Сортировка по месяцу выполнения.
 */
export function WorksReviewTable({
  fetchUrl,
  emptyText = "Работ пока нет.",
  showProjectColumn = true,
  showExecutorFilter = true,
}: {
  fetchUrl: string;
  emptyText?: string;
  showProjectColumn?: boolean;
  showExecutorFilter?: boolean;
}) {
  const { data, isLoading, mutate } = useSWR<ReviewRow[]>(fetchUrl, fetcher);
  const { data: permanentExecutors } = useSWR<ExecutorRef[]>(
    "/api/executors/active-permanent",
    fetcher
  );

  const [executorFilter, setExecutorFilter] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [hidePaid, setHidePaid] = React.useState(false);
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);

  const allRows = React.useMemo(() => data ?? [], [data]);

  const executorOptions = React.useMemo(
    () =>
      Array.from(new Map(allRows.map((r) => [r.executorId, r.executorName])).entries())
        .sort((a, b) => a[1].localeCompare(b[1], "ru"))
        .map(([value, label]) => ({ value, label })),
    [allRows]
  );

  const rows = React.useMemo(() => {
    let list = allRows;
    if (executorFilter.length) list = list.filter((r) => executorFilter.includes(r.executorId));
    if (statusFilter.length) list = list.filter((r) => statusFilter.includes(r.workStatus));
    if (hidePaid) list = list.filter((r) => !PAID.has(r.workStatus));
    return [...list].sort((a, b) =>
      a.executionYear !== b.executionYear
        ? b.executionYear - a.executionYear
        : b.executionMonth - a.executionMonth
    );
  }, [allRows, executorFilter, statusFilter, hidePaid]);

  const checkableRows = rows.filter((r) => r.workStatus === "submitted" || r.workStatus === "rework");

  async function patchRow(r: ReviewRow, body: Record<string, unknown>) {
    const id = rowId(r);
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/issued-works/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Ошибка");
      }
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleCheckAll() {
    if (checkableRows.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/issued-works/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: checkableRows.map(rowId), patch: { workStatus: "checked" } }),
      });
      if (!res.ok) throw new Error();
      const { updated } = (await res.json()) as { updated: number };
      toast.success(`Проверено работ: ${updated}`);
      await mutate();
    } catch {
      toast.error("Не удалось проверить работы");
    } finally {
      setBulkBusy(false);
    }
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const colSpan = showProjectColumn ? 11 : 10;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleCheckAll}
          disabled={bulkBusy || checkableRows.length === 0}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
          Проверить все{checkableRows.length > 0 ? ` (${checkableRows.length})` : ""}
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer select-none">
            <Checkbox checked={hidePaid} onCheckedChange={(v) => setHidePaid(Boolean(v))} />
            Свернуть оплаченные
          </label>
          {showExecutorFilter && (
            <MultiSelectFilter
              label="Исполнитель"
              options={executorOptions}
              value={executorFilter}
              onChange={setExecutorFilter}
            />
          )}
          <MultiSelectFilter
            label="Статус"
            options={Object.entries(WORK_STATUSES).map(([value, { label }]) => ({ value, label }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex items-center gap-4 px-1 text-xs text-neutral-500">
          <span>{rows.length} записей</span>
          <span className="font-medium tabular-nums text-neutral-800">{formatMoney(total)} ₽</span>
        </div>
      )}

      <Table
        className="min-w-[1100px]"
        containerClassName="rounded-md border bg-white max-h-[60vh] overflow-auto"
      >
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-[10px]">Год</TableHead>
            <TableHead className="w-20 text-[10px]">Месяц</TableHead>
            <TableHead>Исполнитель</TableHead>
            {showProjectColumn && <TableHead>Проект</TableHead>}
            <TableHead>Вид работ</TableHead>
            <TableHead className="min-w-[150px]">Ответственный</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
            <TableHead className="min-w-[150px]">Статус</TableHead>
            <TableHead className="min-w-[160px]">Комментарий</TableHead>
            <TableHead className="whitespace-nowrap">Дата оплаты план-факт</TableHead>
            <TableHead className={stickyActionsHead} />
          </TableRow>
        </TableHeader>
        <BulkSelectTableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={colSpan + 1} className="text-center text-neutral-500 py-8">
                Загрузка...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan + 1} className="text-center text-neutral-500 py-10">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const id = rowId(r);
              const busy = busyIds.has(id);
              const isPaid = PAID.has(r.workStatus);
              return (
                <TableRow key={id} className={cn(isPaid && "bg-neutral-50 text-neutral-400")}>
                  <TableCell className="text-xs tabular-nums">{r.executionYear}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{monthLabel(r.executionMonth)}</TableCell>
                  <TableCell className="text-sm">{r.executorName}</TableCell>
                  {showProjectColumn && <TableCell className="text-sm">{r.projectName}</TableCell>}
                  <TableCell className="text-sm">{r.workTypeName}</TableCell>
                  <TableCell>
                    <Select
                      value={r.responsibleExecutorId ?? ""}
                      onValueChange={(v) => v && patchRow(r, { responsibleExecutorId: v })}
                      disabled={busy || isPaid}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue>{r.responsibleExecutorName ?? "—"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(permanentExecutors ?? []).map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-sm">{formatMoney(r.amount)}</TableCell>
                  <TableCell>
                    {isPaid ? (
                      <StatusBadge dict={WORK_STATUSES} value={r.workStatus} />
                    ) : (
                      <Select
                        value={r.workStatus}
                        onValueChange={(v) => v && v !== r.workStatus && patchRow(r, { workStatus: v })}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue>
                            {WORK_STATUSES[r.workStatus as keyof typeof WORK_STATUSES]?.label ?? r.workStatus}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_STATUSES_SETTABLE.map((k) => (
                            <SelectItem key={k} value={k}>{WORK_STATUSES[k].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <CommentCell value={r.comment ?? ""} disabled={busy || isPaid} onSave={(v) => patchRow(r, { comment: v || null })} />
                  </TableCell>
                  <TableCell className={cn("text-xs whitespace-nowrap", r.workStatus === "paid" && !r.paidAt && "bg-red-100 text-red-700")}>
                    {r.paidAt ? (
                      <span className="inline-flex items-center gap-1.5">
                        {formatDateShort(r.paidAt)}
                        <span className="text-[10px] font-medium text-green-600">факт</span>
                      </span>
                    ) : r.plannedPayAt ? (
                      <span className="inline-flex items-center gap-1.5">
                        {formatDateShort(r.plannedPayAt)}
                        <span className="text-[10px] font-medium text-neutral-400">план</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className={stickyActionsCell}>
                    <div className={stickyActionsInner}>
                      {(r.workStatus === "submitted" || r.workStatus === "rework") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => patchRow(r, { workStatus: "checked" })}
                          title="Проставить «Проверено»"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </BulkSelectTableBody>
      </Table>
    </div>
  );
}

function CommentCell({ value, disabled, onSave }: { value: string; disabled?: boolean; onSave: (v: string) => void }) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => setLocal(value), [value]);
  if (disabled) {
    return <span className="text-xs text-neutral-500">{value || "—"}</span>;
  }
  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onSave(local); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setLocal(value); e.currentTarget.blur(); } }}
      placeholder="—"
      className="h-7 text-xs"
    />
  );
}
