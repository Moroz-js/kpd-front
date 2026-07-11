"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Pencil, Trash2, CircleDollarSign, X } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { ConfirmDialog } from "@/components/ui-custom/ConfirmDialog";
import { PAYMENT_STATUSES } from "@/lib/statuses";
import { formatMoney, formatMoneyRub, formatDateShort, weekLabel, monthLabel, MONTHS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { VirtualizedTableBody } from "@/components/ui-custom/VirtualizedTableBody";
import { TablePagination } from "@/components/ui-custom/TablePagination";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui-custom/DateInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead } from "@/components/ui-custom/SortableHead";
import { RowSelectCheckbox } from "@/components/ui-custom/RowSelectCheckbox";
import { useTableRowSelection } from "@/lib/useTableRowSelection";
import { useServerTable } from "@/lib/useServerTable";
import {
  buildPayoutsSearchParams,
  clientFiltersToPayoutsFilter,
} from "@/lib/views/payoutsQuery";
import type { PayoutsSort } from "@/lib/views/payouts";
import { cn } from "@/lib/utils";
import { stickyActionsHead, stickyActionsCell, stickyActionsInner } from "@/lib/table-styles";
import { PayoutEditDialog } from "./PayoutEditDialog";

type Row = {
  sourceType: "personal" | "other-expense";
  sourceId: string;
  periodYear: number;
  periodMonth: number;
  weekPlanFact: number | null;
  yearPlanFact: number | null;
  executorId: string;
  executorName: string;
  amount: number;
  paymentStatus: string;
  plannedPayAt: string | null;
  paidAt: string | null;
  bankAccountId: string | null;
  bankAccountName: string | null;
  comment: string | null;
};
export type PayoutRowDTO = Row;

type ExecutorOption = { id: string; name: string; status: string };
type BankOption = { id: string; name: string; status: string; isDefault?: boolean };

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
  return Array.from({ length: 8 }, (_, i) => current - i + 2).map((y) => ({
    value: String(y),
    label: String(y),
  }));
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

type SortField = PayoutsSort["field"];
type SortDir = PayoutsSort["dir"];

const SMETA_LABEL: Record<Row["sourceType"], string> = {
  personal: "Личная смета",
  "other-expense": "Прочие траты",
};

const compactPeriodHead =
  "text-[10px] leading-tight font-medium whitespace-normal normal-case align-bottom !whitespace-normal";
const periodYearMonthClass = "w-24 max-w-24 px-1";
const weekColClass = "w-18 max-w-18 px-1";
const yearColCell = "text-xs tabular-nums text-left";

function rowKey(r: Row) { return `${r.sourceType}:${r.sourceId}`; }

function toLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type PayoutRowProps = {
  row: Row;
  rowIndex: number;
  checked: boolean;
  onSelect: (index: number, id: string, shiftKey: boolean) => void;
  inlineActive: "plannedPayAt" | "paidAt" | "bankAccountId" | null;
  inlineVal: string;
  activeBanks: BankOption[];
  onInlineValChange: (v: string) => void;
  onStartInline: (row: Row, field: "paidAt" | "plannedPayAt" | "bankAccountId") => void;
  onCommitInline: (row: Row) => void;
  onCancelInline: () => void;
  onPatchInlineStatus: (row: Row, paymentStatus: string) => void;
  onPatchRow: (row: Row, patch: Record<string, unknown>) => Promise<boolean>;
  onEdit: (row: Row) => void;
  onPay: (row: Row) => void;
  onDelete: (row: Row) => void;
};

const PayoutRow = React.memo(function PayoutRow({
  row: r,
  rowIndex,
  checked,
  onSelect,
  inlineActive,
  inlineVal,
  activeBanks,
  onInlineValChange,
  onStartInline,
  onCommitInline,
  onCancelInline,
  onPatchInlineStatus,
  onPatchRow,
  onEdit,
  onPay,
  onDelete,
}: PayoutRowProps) {
  const key = rowKey(r);
  return (
    <TableRow key={key} className={checked ? "bg-blue-50" : undefined}>
      <TableCell className="w-8">
        <RowSelectCheckbox checked={checked} rowIndex={rowIndex} rowId={key} onSelect={onSelect} />
      </TableCell>
      <TableCell className={cn(periodYearMonthClass, yearColCell)}>{r.periodYear}</TableCell>
      <TableCell className={cn(periodYearMonthClass, "text-xs whitespace-nowrap")}>{monthLabel(r.periodMonth)}</TableCell>
      <TableCell className={cn(weekColClass, "text-xs whitespace-nowrap")}>{r.weekPlanFact != null ? weekLabel(r.weekPlanFact) : "—"}</TableCell>
      <TableCell>{r.executorName}</TableCell>
      <TableCell className="max-w-48 truncate" title={r.comment ?? ""}>{r.comment ?? "—"}</TableCell>
      <TableCell>
        <Select value={r.paymentStatus} onValueChange={(v) => v && onPatchInlineStatus(r, v)}>
          <SelectTrigger className="h-6 w-auto min-w-[120px] border-0 bg-transparent shadow-none p-0 focus:ring-0 [&>svg]:hidden">
            <SelectValue><StatusBadge dict={PAYMENT_STATUSES} value={r.paymentStatus} /></SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right tabular-nums font-semibold text-sm">{formatMoney(r.amount)}</TableCell>
      <TableCell
        className="cursor-pointer hover:bg-neutral-50 min-w-[100px]"
        onClick={() => inlineActive !== "plannedPayAt" && onStartInline(r, "plannedPayAt")}
      >
        {inlineActive === "plannedPayAt" ? (
          <input
            autoFocus
            type="date"
            value={inlineVal}
            onChange={(e) => onInlineValChange(e.target.value)}
            onBlur={() => onCommitInline(r)}
            onClick={(e) => { try { (e.target as HTMLInputElement).showPicker(); } catch { /**/ } }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitInline(r);
              if (e.key === "Escape") onCancelInline();
            }}
            className="w-full h-6 rounded border border-blue-300 px-1 text-xs bg-blue-50 focus:outline-none cursor-pointer"
          />
        ) : (
          <span className="text-xs text-neutral-600">{formatDateShort(r.plannedPayAt)}</span>
        )}
      </TableCell>
      <TableCell
        className={cn(
          "cursor-pointer hover:bg-neutral-50 min-w-[100px]",
          (r.paymentStatus === "paid" || r.paymentStatus === "sent") && !r.paidAt && "bg-red-100 text-red-700"
        )}
        onClick={() => inlineActive !== "paidAt" && onStartInline(r, "paidAt")}
      >
        {inlineActive === "paidAt" ? (
          <input
            autoFocus
            type="date"
            value={inlineVal}
            onChange={(e) => onInlineValChange(e.target.value)}
            onBlur={() => onCommitInline(r)}
            onClick={(e) => { try { (e.target as HTMLInputElement).showPicker(); } catch { /**/ } }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitInline(r);
              if (e.key === "Escape") onCancelInline();
            }}
            className="w-full h-6 rounded border border-blue-300 px-1 text-xs bg-blue-50 focus:outline-none cursor-pointer"
          />
        ) : (
          <span className="text-xs text-neutral-600">{formatDateShort(r.paidAt)}</span>
        )}
      </TableCell>
      <TableCell className="min-w-[140px] max-w-[160px] truncate">
        {inlineActive === "bankAccountId" ? (
          <Select
            value={inlineVal || "__none__"}
            onValueChange={(v) => {
              const val = v === "__none__" ? "" : (v ?? "");
              onInlineValChange(val);
              onPatchRow(r, { bankAccountId: val || null }).then(() => onCancelInline());
            }}
            open
            onOpenChange={(o) => !o && onCancelInline()}
          >
            <SelectTrigger className="h-6 text-xs">
              <SelectValue>{inlineVal ? (activeBanks.find(b => b.id === inlineVal)?.name ?? "Счёт") : "— не задан —"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— не задан —</SelectItem>
              {activeBanks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span
            className="text-xs text-neutral-600 cursor-pointer hover:underline truncate block"
            onClick={() => onStartInline(r, "bankAccountId")}
          >
            {r.bankAccountName ?? "—"}
          </span>
        )}
      </TableCell>
      <TableCell>{SMETA_LABEL[r.sourceType]}</TableCell>
      <TableCell className={cn(stickyActionsCell, checked && "bg-blue-50")}>
        <div className={stickyActionsInner}>
          {r.paymentStatus === "planned" && (
            <Button size="sm" variant="ghost" onClick={() => onPay(r)} title="Оплатить" className="text-green-600 hover:text-green-800">
              <CircleDollarSign className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onEdit(r)} title="Редактировать">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(r)} title="Удалить">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export function PayoutsClient() {
  const { page, setPage, pageSize, setPageSize, onFilterChange } = useServerTable();

  const [periodYearFilter, setPeriodYearFilter] = React.useState<string[]>([String(new Date().getFullYear())]);
  const [periodMonthFilter, setPeriodMonthFilter] = React.useState<string[]>([]);
  const [weekFilter, setWeekFilter] = React.useState<string[]>([]);
  const [executorFilter, setExecutorFilter] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [bankFilter, setBankFilter] = React.useState<string[]>([]);
  const [smetaFilter, setSmetaFilter] = React.useState<string[]>([]);

  const [sort, setSort] = React.useState<PayoutsSort[]>([
    { field: "weekPlanFact", dir: "desc" },
    { field: "executorName", dir: "asc" },
    { field: "bankAccountName", dir: "asc" },
  ]);

  const filterState = React.useMemo(
    () => ({
      periodYear: periodYearFilter,
      periodMonth: periodMonthFilter,
      weekPlanFact: weekFilter,
      executorId: executorFilter,
      paymentStatus: statusFilter,
      bankAccountId: bankFilter,
      smetaFilter,
    }),
    [periodYearFilter, periodMonthFilter, weekFilter, executorFilter, statusFilter, bankFilter, smetaFilter]
  );

  const listUrl = React.useMemo(
    () =>
      `/api/payouts?${buildPayoutsSearchParams({ filter: filterState, sort, page, pageSize })}`,
    [filterState, sort, page, pageSize]
  );

  const { data, isLoading, mutate } = useSWR<ListResponse>(listUrl, fetcher);
  const { data: executors } = useSWR<ExecutorOption[]>("/api/executors", fetcher);
  const { data: banks } = useSWR<BankOption[]>("/api/bank-accounts", fetcher);

  const [editing, setEditing] = React.useState<Row | null>(null);
  const [deleting, setDeleting] = React.useState<Row | null>(null);
  const [paying, setPaying] = React.useState<Row | null>(null);
  const [selectAllFiltered, setSelectAllFiltered] = React.useState(false);

  // Bulk
  const [bulkStatus, setBulkStatus] = React.useState("");
  const [bulkPlannedPayAt, setBulkPlannedPayAt] = React.useState("");
  const [bulkPaidAt, setBulkPaidAt] = React.useState("");
  const [bulkBankId, setBulkBankId] = React.useState("");
  const [bulkSaving, setBulkSaving] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Inline edit state
  const [inlineEdit, setInlineEdit] = React.useState<{ key: string; field: "paidAt" | "plannedPayAt" | "bankAccountId" } | null>(null);
  const [inlineVal, setInlineVal] = React.useState("");

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalAmount = data?.totalAmount ?? 0;

  const periodYearOptions = React.useMemo(() => buildYearOptions(), []);
  const weekOptions = React.useMemo(() => buildWeekOptions(), []);

  const executorOptions = React.useMemo(
    () =>
      (executors ?? [])
        .map((e) => ({ value: e.id, label: e.name }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru")),
    [executors]
  );

  const bankOptions = React.useMemo(
    () => [
      { value: "__empty__", label: "Пусто" },
      ...(banks ?? []).map((b) => ({ value: b.id, label: b.name })),
    ],
    [banks]
  );

  const orderedRowIds = React.useMemo(() => rows.map(rowKey), [rows]);
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

  const selectedSum = React.useMemo(() => {
    if (selectAllFiltered) return totalAmount;
    let sum = 0;
    for (const r of rows) {
      if (selectedIds.has(rowKey(r))) sum += r.amount;
    }
    return sum;
  }, [rows, selectedIds, selectAllFiltered, totalAmount]);

  const allPageSelected =
    rows.length > 0 && orderedRowIds.every((id) => selectedIds.has(id));

  const activeBanks = React.useMemo(
    () => (banks ?? []).filter((b) => b.status === "active"),
    [banks]
  );

  async function patchRow(row: Row, patch: Record<string, unknown>) {
    const compositeId = rowKey(row);
    const res = await fetch(`/api/payouts/${compositeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) { toast.error("Ошибка сохранения"); return false; }
    mutate();
    return true;
  }

  async function patchInlineStatus(row: Row, paymentStatus: string) {
    await patchRow(row, { paymentStatus });
  }

  async function commitInlineEdit(row: Row) {
    if (!inlineEdit || inlineEdit.key !== rowKey(row)) return;
    const { field } = inlineEdit;
    let value: string | null = inlineVal || null;
    if ((field === "paidAt" || field === "plannedPayAt") && value) {
      value = new Date(value).toISOString();
    }
    await patchRow(row, { [field]: value });
    setInlineEdit(null);
  }

  function startInline(row: Row, field: "paidAt" | "plannedPayAt" | "bankAccountId") {
    const key = rowKey(row);
    if (field === "paidAt")
      setInlineVal(row.paidAt ? row.paidAt.slice(0, 10) : toLocalDate());
    else if (field === "plannedPayAt")
      setInlineVal(row.plannedPayAt ? row.plannedPayAt.slice(0, 10) : "");
    else
      setInlineVal(row.bankAccountId ?? "");
    setInlineEdit({ key, field });
  }

  async function handleMarkPaid(row: Row, paidAt: string, bankAccountId: string | null) {
    setPaying(null);
    await patchRow(row, {
      paymentStatus: "paid",
      paidAt: new Date(paidAt).toISOString(),
      bankAccountId: bankAccountId || null,
    });
    toast.success("Выплата оплачена");
  }

  async function handleDelete(row: Row) {
    const compositeId = rowKey(row);
    const res = await fetch(`/api/payouts/${compositeId}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Не удалось удалить");
    toast.success(row.sourceType === "personal" ? "Выплата удалена." : "Поля выплаты очищены.");
    mutate();
  }

  async function handleBulkApply() {
    const patch: Record<string, unknown> = {};
    if (bulkStatus) patch.paymentStatus = bulkStatus;
    if (bulkPlannedPayAt) patch.plannedPayAt = new Date(bulkPlannedPayAt).toISOString();
    if (bulkPaidAt) patch.paidAt = new Date(bulkPaidAt).toISOString();
    if (bulkBankId && bulkBankId !== "__none__") patch.bankAccountId = bulkBankId;
    if (Object.keys(patch).length === 0) return toast.error("Выберите хотя бы одно поле для изменения");

    const body = selectAllFiltered
      ? { selectAll: true, filter: clientFiltersToPayoutsFilter(filterState), patch }
      : { ids: Array.from(selectedIds), patch };

    setBulkSaving(true);
    const res = await fetch("/api/payouts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBulkSaving(false);
    if (!res.ok) return toast.error("Ошибка массового обновления");
    const { updated } = await res.json();
    toast.success(`Обновлено ${updated} выплат`);
    resetSelection();
    setBulkStatus("");
    setBulkPlannedPayAt("");
    setBulkPaidAt("");
    setBulkBankId("");
    mutate();
  }

  function handleToggleAll() {
    if (selectAllFiltered) {
      resetSelection();
      return;
    }
    toggleAll(orderedRowIds);
  }

  const patchRowCb = React.useCallback(
    async (row: Row, patch: Record<string, unknown>) => patchRow(row, patch),
    [mutate]
  );
  const patchInlineStatusCb = React.useCallback(
    (row: Row, paymentStatus: string) => patchInlineStatus(row, paymentStatus),
    [mutate]
  );
  const commitInlineEditCb = React.useCallback(
    (row: Row) => commitInlineEdit(row),
    [inlineEdit, inlineVal, mutate]
  );
  const startInlineCb = React.useCallback(startInline, []);
  const cancelInlineCb = React.useCallback(() => setInlineEdit(null), []);
  const onInlineValChangeCb = React.useCallback((v: string) => setInlineVal(v), []);
  const onEditCb = React.useCallback((row: Row) => setEditing(row), []);
  const onPayCb = React.useCallback((row: Row) => setPaying(row), []);
  const onDeleteCb = React.useCallback((row: Row) => setDeleting(row), []);

  const renderRow = React.useCallback(
    (index: number) => {
      const r = rows[index];
      if (!r) return null;
      const key = rowKey(r);
      const inlineActive = inlineEdit?.key === key ? inlineEdit.field : null;
      return (
        <PayoutRow
          key={key}
          row={r}
          rowIndex={index}
          checked={selectedIds.has(key)}
          onSelect={handleRowSelect}
          inlineActive={inlineActive}
          inlineVal={inlineActive ? inlineVal : ""}
          activeBanks={activeBanks}
          onInlineValChange={onInlineValChangeCb}
          onStartInline={startInlineCb}
          onCommitInline={commitInlineEditCb}
          onCancelInline={cancelInlineCb}
          onPatchInlineStatus={patchInlineStatusCb}
          onPatchRow={patchRowCb}
          onEdit={onEditCb}
          onPay={onPayCb}
          onDelete={onDeleteCb}
        />
      );
    },
    [
      rows,
      selectedIds,
      inlineEdit,
      inlineVal,
      activeBanks,
      handleRowSelect,
      onInlineValChangeCb,
      startInlineCb,
      commitInlineEditCb,
      cancelInlineCb,
      patchInlineStatusCb,
      patchRowCb,
      onEditCb,
      onPayCb,
      onDeleteCb,
    ]
  );

  function activeSortField(): SortField { return sort[0]?.field ?? "weekPlanFact"; }
  function activeSortDir(): SortDir { return sort[0]?.dir ?? "desc"; }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] min-h-0">
      <PageHeader title="Выплаты" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MultiSelectFilter label="Год выполнения" options={periodYearOptions} value={periodYearFilter} onChange={(v) => onFilterChange(setPeriodYearFilter, v)} />
        <MultiSelectFilter label="Месяц выполнения" options={MONTHS} value={periodMonthFilter} onChange={(v) => onFilterChange(setPeriodMonthFilter, v)} />
        <MultiSelectFilter label="Неделя план-факт" options={weekOptions} value={weekFilter} onChange={(v) => onFilterChange(setWeekFilter, v)} />
        <MultiSelectFilter label="Исполнитель" options={executorOptions} value={executorFilter} onChange={(v) => onFilterChange(setExecutorFilter, v)} />
        <MultiSelectFilter label="Статус выплаты" options={Object.entries(PAYMENT_STATUSES).map(([value, { label }]) => ({ value, label }))} value={statusFilter} onChange={(v) => onFilterChange(setStatusFilter, v)} />
        <MultiSelectFilter label="Источник оплаты" options={bankOptions} value={bankFilter} onChange={(v) => onFilterChange(setBankFilter, v)} />
        <MultiSelectFilter label="Тип сметы" options={[{ value: "personal", label: "Личная смета" }, { value: "other-expense", label: "Прочие траты" }]} value={smetaFilter} onChange={(v) => onFilterChange(setSmetaFilter, v)} />
      </div>

      {allPageSelected && total > rows.length && !selectAllFiltered && (
        <div className="mb-2 px-1 text-xs text-blue-700">
          Выбраны все записи на странице.{" "}
          <button type="button" className="underline hover:no-underline" onClick={() => setSelectAllFiltered(true)}>
            Выбрать все {total} по фильтру
          </button>
        </div>
      )}

      {/* Bulk toolbar */}
      {(selectedIds.size > 0 || selectAllFiltered) && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
          <span className="text-xs font-medium text-blue-700">{selectAllFiltered ? total : selectedIds.size} выбрано</span>
          <span className="text-xs font-medium tabular-nums text-blue-900">{formatMoneyRub(selectedSum)}</span>
          <Select value={bulkStatus} onValueChange={(v) => v && setBulkStatus(v)}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue>{bulkStatus ? (PAYMENT_STATUSES[bulkStatus as keyof typeof PAYMENT_STATUSES]?.label ?? "Статус") : "Статус"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">Дата план:</span>
            <DateInput className="h-7 text-xs w-36" value={bulkPlannedPayAt} onChange={(e) => setBulkPlannedPayAt(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">Дата оплаты:</span>
            <DateInput className="h-7 text-xs w-36" value={bulkPaidAt} onChange={(e) => setBulkPaidAt(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">Источник оплаты:</span>
            <Select value={bulkBankId || "__none__"} onValueChange={(v) => setBulkBankId(v === "__none__" ? "" : (v ?? ""))}>
              <SelectTrigger className="h-7 w-44 text-xs">
                <SelectValue>{bulkBankId ? (activeBanks.find(b => b.id === bulkBankId)?.name ?? "") : "— не менять —"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— не менять —</SelectItem>
                {activeBanks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-7 text-xs" onClick={handleBulkApply} disabled={bulkSaving}>
            {bulkSaving ? "..." : "Применить"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { resetSelection(); setBulkStatus(""); setBulkPlannedPayAt(""); setBulkPaidAt(""); setBulkBankId(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200">
          <span className="text-xs text-neutral-500">{total} записей</span>
          <span className="text-xs font-medium tabular-nums text-neutral-900">{formatMoneyRub(totalAmount)}</span>
        </div>
      )}

      <Table
        className="min-w-[1420px]"
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
                field="periodYear"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className={cn(periodYearMonthClass, "!whitespace-normal")}
              >
                <span className="block text-[10px] leading-tight font-medium tracking-tight normal-case text-left">
                  Год
                  <br />
                  выполнения
                </span>
              </SortableHead>
              <SortableHead
                field="periodMonth"
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
                className={cn(weekColClass, compactPeriodHead)}
              >
                <span className="block text-left">
                  Неделя
                  <br />
                  оплаты
                </span>
              </SortableHead>
              <SortableHead field="executorName" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort}>Исполнитель</SortableHead>
              <TableHead>Комментарий</TableHead>
              <SortableHead field="paymentStatus" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort}><span className="flex items-center gap-1">Статус <Pencil className="h-3 w-3 text-neutral-400" /></span></SortableHead>
              <SortableHead field="amount" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort} className="text-right">Выплата</SortableHead>
              <TableHead><span className="flex items-center gap-1">Дата оплаты план <Pencil className="h-3 w-3 text-neutral-400" /></span></TableHead>
              <TableHead><span className="flex items-center gap-1">Дата оплаты факт <Pencil className="h-3 w-3 text-neutral-400" /></span></TableHead>
              <SortableHead field="bankAccountName" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort}><span className="flex items-center gap-1">Источник оплаты <Pencil className="h-3 w-3 text-neutral-400" /></span></SortableHead>
              <TableHead>Тип сметы</TableHead>
              <TableHead className={stickyActionsHead} />
            </TableRow>
          </TableHeader>
          <VirtualizedTableBody
            scrollRef={scrollRef}
            rowCount={rows.length}
            colSpan={13}
            isLoading={isLoading}
            loading={
              <TableRow><TableCell colSpan={13} className="text-center text-neutral-500 py-8">Загрузка...</TableCell></TableRow>
            }
            isEmpty={rows.length === 0}
            empty={
              <TableRow><TableCell colSpan={13} className="text-center text-neutral-500 py-12">Нет выплат.</TableCell></TableRow>
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

      {paying && (
        <MarkPaidDialog
          row={paying}
          banks={banks ?? []}
          onClose={() => setPaying(null)}
          onConfirm={(paidAt, bankAccountId) => handleMarkPaid(paying, paidAt, bankAccountId)}
        />
      )}

      {editing && (
        <PayoutEditDialog
          row={editing}
          executors={executors ?? []}
          banks={banks ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); mutate(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting?.sourceType === "personal" ? "Удалить выплату?" : "Очистить данные выплаты?"}
        description={
          deleting?.sourceType === "personal"
            ? "Будет удалён Payment. Работы освобождены, статус откатан."
            : "Поля выплаты очищены. Статус работы откатан."
        }
        confirmLabel={deleting?.sourceType === "personal" ? "Удалить" : "Очистить"}
        destructive
        onConfirm={async () => { if (deleting) await handleDelete(deleting); }}
      />
    </div>
  );
}

// ─── Диалог быстрой оплаты ───────────────────────────────────────────────────

function MarkPaidDialog({
  row, banks, onClose, onConfirm,
}: {
  row: Row; banks: BankOption[];
  onClose: () => void;
  onConfirm: (paidAt: string, bankAccountId: string | null) => void;
}) {
  const [paidAt, setPaidAt] = React.useState(toLocalDate());
  const activeBanks = banks.filter((b) => b.status === "active" || b.id === row.bankAccountId);
  const defaultBank = activeBanks.find((b) => b.isDefault)?.id ?? activeBanks[0]?.id ?? "";
  const [bankAccountId, setBankAccountId] = React.useState(row.bankAccountId ?? defaultBank);
  const ref = React.useRef<HTMLInputElement>(null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Оплатить — {row.executorName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Дата оплаты</Label>
            <div className="relative w-full cursor-pointer" onClick={() => { ref.current?.focus(); try { ref.current?.showPicker(); } catch { /**/ } }}>
              <input ref={ref} type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Источник оплаты</Label>
            <Select value={bankAccountId || "__none__"} onValueChange={(v) => setBankAccountId(v === "__none__" ? "" : (v ?? ""))}>
              <SelectTrigger>
                <SelectValue>{bankAccountId ? (activeBanks.find((b) => b.id === bankAccountId)?.name ?? "—") : "— Не задан —"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Не задан —</SelectItem>
                {activeBanks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button disabled={!paidAt} onClick={() => onConfirm(paidAt, bankAccountId || null)}>Провести оплату</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
