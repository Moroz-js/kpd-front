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
import { formatMoney, formatDateShort, weekLabel, monthLabel, MONTHS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead } from "@/components/ui-custom/SortableHead";
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

type SortField =
  | "weekPlanFact" | "executorName" | "bankAccountName"
  | "amount" | "paymentStatus" | "periodYear" | "periodMonth";
type SortDir = "asc" | "desc";

const SMETA_LABEL: Record<Row["sourceType"], string> = {
  personal: "Личная смета",
  "other-expense": "Прочие траты",
};

function rowKey(r: Row) { return `${r.sourceType}:${r.sourceId}`; }

function toLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PayoutsClient() {
  const { data, isLoading, mutate } = useSWR<Row[]>("/api/payouts", fetcher);
  const { data: executors } = useSWR<ExecutorOption[]>("/api/executors", fetcher);
  const { data: banks } = useSWR<BankOption[]>("/api/bank-accounts", fetcher);

  const [periodYearFilter, setPeriodYearFilter] = React.useState<string[]>([String(new Date().getFullYear())]);
  const [periodMonthFilter, setPeriodMonthFilter] = React.useState<string[]>([]);
  const [weekFilter, setWeekFilter] = React.useState<string[]>([]);
  const [executorFilter, setExecutorFilter] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [bankFilter, setBankFilter] = React.useState<string[]>([]);
  const [smetaFilter, setSmetaFilter] = React.useState<string[]>([]);

  const [sort, setSort] = React.useState<{ field: SortField; dir: SortDir }[]>([
    { field: "weekPlanFact", dir: "desc" },
    { field: "executorName", dir: "asc" },
    { field: "bankAccountName", dir: "asc" },
  ]);

  const [editing, setEditing] = React.useState<Row | null>(null);
  const [deleting, setDeleting] = React.useState<Row | null>(null);
  const [paying, setPaying] = React.useState<Row | null>(null);

  // Bulk
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = React.useState("");
  const [bulkPlannedPayAt, setBulkPlannedPayAt] = React.useState("");
  const [bulkPaidAt, setBulkPaidAt] = React.useState("");
  const [bulkBankId, setBulkBankId] = React.useState("");
  const [bulkSaving, setBulkSaving] = React.useState(false);

  // Inline edit state
  const [inlineEdit, setInlineEdit] = React.useState<{ key: string; field: "paidAt" | "plannedPayAt" | "bankAccountId" } | null>(null);
  const [inlineVal, setInlineVal] = React.useState("");

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

  const periodYearOptions = React.useMemo(
    () => Array.from(new Set(allRows.map((r) => r.periodYear))).sort((a, b) => b - a)
      .map((y) => ({ value: String(y), label: String(y) })),
    [allRows]
  );
  const weekOptions = React.useMemo(
    () => Array.from(new Set(allRows.map((r) => r.weekPlanFact).filter((v): v is number => v != null)))
      .sort((a, b) => a - b).map((w) => ({ value: String(w), label: weekLabel(w) })),
    [allRows]
  );
  const executorOptions = React.useMemo(
    () => Array.from(new Map(allRows.map((r) => [r.executorId, r.executorName])).entries())
      .sort((a, b) => a[1].localeCompare(b[1], "ru")).map(([value, label]) => ({ value, label })),
    [allRows]
  );
  const bankOptions = React.useMemo(
    () => Array.from(new Map(
      allRows.filter((r) => r.bankAccountId).map((r) => [r.bankAccountId as string, r.bankAccountName ?? "—"])
    ).entries()).map(([value, label]) => ({ value, label })),
    [allRows]
  );

  const rows = React.useMemo(() => {
    let list = allRows;
    if (periodYearFilter.length) list = list.filter((r) => periodYearFilter.includes(String(r.periodYear)));
    if (periodMonthFilter.length) list = list.filter((r) => periodMonthFilter.includes(String(r.periodMonth)));
    if (weekFilter.length) list = list.filter((r) => weekFilter.includes(String(r.weekPlanFact ?? "")));
    if (executorFilter.length) list = list.filter((r) => executorFilter.includes(r.executorId));
    if (statusFilter.length) list = list.filter((r) => statusFilter.includes(r.paymentStatus));
    if (bankFilter.length) list = list.filter((r) => bankFilter.includes(r.bankAccountId ?? ""));
    if (smetaFilter.length) list = list.filter((r) => smetaFilter.includes(r.sourceType));
    return [...list].sort(compareRows);
  }, [allRows, periodYearFilter, periodMonthFilter, weekFilter, executorFilter, statusFilter, bankFilter, smetaFilter, sort]);

  const activeBanks = React.useMemo(
    () => (banks ?? []).filter((b) => b.status === "active"),
    [banks]
  );

  // Aggregations by status
  const aggregations = React.useMemo(() => {
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.paymentStatus] = (byStatus[r.paymentStatus] ?? 0) + r.amount;
    }
    return { total, byStatus };
  }, [rows]);

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
    const ids = Array.from(selectedIds);
    const patch: Record<string, unknown> = {};
    if (bulkStatus) patch.paymentStatus = bulkStatus;
    if (bulkPlannedPayAt) patch.plannedPayAt = new Date(bulkPlannedPayAt).toISOString();
    if (bulkPaidAt) patch.paidAt = new Date(bulkPaidAt).toISOString();
    if (bulkBankId && bulkBankId !== "__none__") patch.bankAccountId = bulkBankId;
    if (Object.keys(patch).length === 0) return toast.error("Выберите хотя бы одно поле для изменения");

    setBulkSaving(true);
    const res = await fetch("/api/payouts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, patch }),
    });
    setBulkSaving(false);
    if (!res.ok) return toast.error("Ошибка массового обновления");
    const { updated } = await res.json();
    toast.success(`Обновлено ${updated} выплат`);
    setSelectedIds(new Set());
    setBulkStatus(""); setBulkPlannedPayAt(""); setBulkPaidAt(""); setBulkBankId("");
    mutate();
  }

  function toggleRow(key: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  function toggleAll() {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map(rowKey)));
  }

  function activeSortField(): SortField { return sort[0]?.field ?? "weekPlanFact"; }
  function activeSortDir(): SortDir { return sort[0]?.dir ?? "desc"; }

  return (
    <>
      <PageHeader title="Выплаты" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MultiSelectFilter label="Год выполнения" options={periodYearOptions} value={periodYearFilter} onChange={setPeriodYearFilter} />
        <MultiSelectFilter label="Месяц выполнения" options={MONTHS} value={periodMonthFilter} onChange={setPeriodMonthFilter} />
        <MultiSelectFilter label="Неделя план-факт" options={weekOptions} value={weekFilter} onChange={setWeekFilter} />
        <MultiSelectFilter label="Исполнитель" options={executorOptions} value={executorFilter} onChange={setExecutorFilter} />
        <MultiSelectFilter label="Статус выплаты" options={Object.entries(PAYMENT_STATUSES).map(([value, { label }]) => ({ value, label }))} value={statusFilter} onChange={setStatusFilter} />
        <MultiSelectFilter label="Источник оплаты" options={bankOptions} value={bankFilter} onChange={setBankFilter} />
        <MultiSelectFilter label="Тип сметы" options={[{ value: "personal", label: "Личная смета" }, { value: "other-expense", label: "Прочие траты" }]} value={smetaFilter} onChange={setSmetaFilter} />
      </div>

      {/* Bulk toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
          <span className="text-xs font-medium text-blue-700">{selectedIds.size} выбрано</span>
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
            <Input type="date" className="h-7 text-xs w-36" value={bulkPlannedPayAt} onChange={(e) => setBulkPlannedPayAt(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">Дата оплаты:</span>
            <Input type="date" className="h-7 text-xs w-36" value={bulkPaidAt} onChange={(e) => setBulkPaidAt(e.target.value)} />
          </div>
          <Select value={bulkBankId || "__none__"} onValueChange={(v) => setBulkBankId(v === "__none__" ? "" : (v ?? ""))}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue>{bulkBankId ? (activeBanks.find(b => b.id === bulkBankId)?.name ?? "Источник оплаты") : "— не менять —"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— не менять —</SelectItem>
              {activeBanks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs" onClick={handleBulkApply} disabled={bulkSaving}>
            {bulkSaving ? "..." : "Применить"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setSelectedIds(new Set()); setBulkStatus(""); setBulkPlannedPayAt(""); setBulkPaidAt(""); setBulkBankId(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Aggregations */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200">
          <span className="text-xs text-neutral-500">{rows.length} записей</span>
          <span className="text-sm font-bold tabular-nums text-neutral-900">{formatMoney(aggregations.total)}</span>
          {Object.entries(PAYMENT_STATUSES).map(([k, v]) => {
            const amt = aggregations.byStatus[k];
            if (!amt) return null;
            const dotCls = v.tone === "green" ? "bg-green-400" : v.tone === "yellow" ? "bg-yellow-400" : "bg-neutral-400";
            return (
              <span key={k} className="flex items-center gap-1 text-xs tabular-nums">
                <span className={`inline-block h-2 w-2 rounded-full ${dotCls}`} />
                <span className="text-neutral-500">{v.label}:</span>
                <span className="font-semibold text-neutral-700">{formatMoney(amt)}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table className="min-w-[1500px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={rows.length > 0 && selectedIds.size === rows.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Год план-факт</TableHead>
              <SortableHead field="periodYear" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort}>Год выполн.</SortableHead>
              <SortableHead field="periodMonth" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort}>Месяц</SortableHead>
              <SortableHead field="weekPlanFact" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort}>Неделя</SortableHead>
              <SortableHead field="executorName" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort}>Исполнитель</SortableHead>
              <TableHead>Комментарий</TableHead>
              <SortableHead field="paymentStatus" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort}>Статус</SortableHead>
              <SortableHead field="amount" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort} className="text-right">Выплата</SortableHead>
              <TableHead>Дата план</TableHead>
              <TableHead>Дата оплаты</TableHead>
              <SortableHead field="bankAccountName" sortBy={activeSortField()} sortDir={activeSortDir()} onSort={handleSort}>Источник оплаты</SortableHead>
              <TableHead>Тип сметы</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={14} className="text-center text-neutral-500 py-8">Загрузка...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={14} className="text-center text-neutral-500 py-12">Нет выплат.</TableCell></TableRow>
            ) : (
              rows.map((r) => {
                const key = rowKey(r);
                const isEditing = (field: string) => inlineEdit?.key === key && inlineEdit.field === field;
                return (
                  <TableRow key={key} className={selectedIds.has(key) ? "bg-blue-50/40" : undefined}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(key)} onCheckedChange={() => toggleRow(key)} />
                    </TableCell>
                    <TableCell className="tabular-nums">{r.yearPlanFact ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.periodYear}</TableCell>
                    <TableCell>{monthLabel(r.periodMonth)}</TableCell>
                    <TableCell>{r.weekPlanFact != null ? weekLabel(r.weekPlanFact) : "—"}</TableCell>
                    <TableCell>{r.executorName}</TableCell>
                    <TableCell className="max-w-48 truncate" title={r.comment ?? ""}>{r.comment ?? "—"}</TableCell>

                    {/* Inline status */}
                    <TableCell>
                      <Select value={r.paymentStatus} onValueChange={(v) => v && patchInlineStatus(r, v)}>
                        <SelectTrigger className="h-6 w-auto min-w-[120px] border-0 bg-transparent shadow-none p-0 focus:ring-0 [&>svg]:hidden">
                          <SelectValue><StatusBadge dict={PAYMENT_STATUSES} value={r.paymentStatus} /></SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAYMENT_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="text-right tabular-nums font-semibold text-sm">{formatMoney(r.amount)}</TableCell>

                    {/* Inline дата план */}
                    <TableCell
                      className="cursor-pointer hover:bg-neutral-50 min-w-[100px]"
                      onClick={() => !isEditing("plannedPayAt") && startInline(r, "plannedPayAt")}
                    >
                      {isEditing("plannedPayAt") ? (
                        <input
                          autoFocus
                          type="date"
                          value={inlineVal}
                          onChange={(e) => setInlineVal(e.target.value)}
                          onBlur={() => commitInlineEdit(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitInlineEdit(r);
                            if (e.key === "Escape") setInlineEdit(null);
                          }}
                          className="w-full h-6 rounded border border-blue-300 px-1 text-xs bg-blue-50 focus:outline-none"
                        />
                      ) : (
                        <span className="text-xs text-neutral-600">{formatDateShort(r.plannedPayAt)}</span>
                      )}
                    </TableCell>

                    {/* Inline дата оплаты */}
                    <TableCell
                      className="cursor-pointer hover:bg-neutral-50 min-w-[100px]"
                      onClick={() => !isEditing("paidAt") && startInline(r, "paidAt")}
                    >
                      {isEditing("paidAt") ? (
                        <input
                          autoFocus
                          type="date"
                          value={inlineVal}
                          onChange={(e) => setInlineVal(e.target.value)}
                          onBlur={() => commitInlineEdit(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitInlineEdit(r);
                            if (e.key === "Escape") setInlineEdit(null);
                          }}
                          className="w-full h-6 rounded border border-blue-300 px-1 text-xs bg-blue-50 focus:outline-none"
                        />
                      ) : (
                        <span className="text-xs text-neutral-600">{formatDateShort(r.paidAt)}</span>
                      )}
                    </TableCell>

                    {/* Inline источник оплаты */}
                    <TableCell className="min-w-[140px]">
                      {isEditing("bankAccountId") ? (
                        <Select
                          value={inlineVal || "__none__"}
                          onValueChange={(v) => {
                            const val = v === "__none__" ? "" : (v ?? "");
                            setInlineVal(val);
                            const patch = { bankAccountId: val || null };
                            patchRow(r, patch).then(() => setInlineEdit(null));
                          }}
                          open
                          onOpenChange={(o) => !o && setInlineEdit(null)}
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
                          className="text-xs text-neutral-600 cursor-pointer hover:underline"
                          onClick={() => startInline(r, "bankAccountId")}
                        >
                          {r.bankAccountName ?? "—"}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>{SMETA_LABEL[r.sourceType]}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {r.paymentStatus === "planned" && (
                        <Button size="sm" variant="ghost" onClick={() => setPaying(r)} title="Оплатить" className="text-green-600 hover:text-green-800">
                          <CircleDollarSign className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)} title="Редактировать">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(r)} title="Удалить">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
    </>
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
