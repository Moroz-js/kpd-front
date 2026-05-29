"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Pencil, Trash2, CircleDollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { ConfirmDialog } from "@/components/ui-custom/ConfirmDialog";
import { PAYMENT_STATUSES } from "@/lib/statuses";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  | "weekPlanFact"
  | "executorName"
  | "bankAccountName"
  | "amount"
  | "paymentStatus"
  | "periodYear"
  | "periodMonth";
type SortDir = "asc" | "desc";

const SMETA_LABEL: Record<Row["sourceType"], string> = {
  personal: "Личная смета",
  "other-expense": "Прочие траты",
};

export function PayoutsClient() {
  const { data, isLoading, mutate } = useSWR<Row[]>("/api/payouts", fetcher);
  const { data: executors } = useSWR<ExecutorOption[]>("/api/executors", fetcher);
  const { data: banks } = useSWR<BankOption[]>("/api/bank-accounts", fetcher);

  const [periodYearFilter, setPeriodYearFilter] = React.useState<string[]>([]);
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
    () =>
      Array.from(new Set(allRows.map((r) => r.periodYear)))
        .sort((a, b) => b - a)
        .map((y) => ({ value: String(y), label: String(y) })),
    [allRows]
  );
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
  const bankOptions = React.useMemo(
    () =>
      Array.from(
        new Map(
          allRows
            .filter((r) => r.bankAccountId)
            .map((r) => [r.bankAccountId as string, r.bankAccountName ?? "—"])
        ).entries()
      ).map(([value, label]) => ({ value, label })),
    [allRows]
  );

  const rows = React.useMemo(() => {
    let list = allRows;
    if (periodYearFilter.length)
      list = list.filter((r) => periodYearFilter.includes(String(r.periodYear)));
    if (periodMonthFilter.length)
      list = list.filter((r) => periodMonthFilter.includes(String(r.periodMonth)));
    if (weekFilter.length) list = list.filter((r) => weekFilter.includes(String(r.weekPlanFact ?? "")));
    if (executorFilter.length) list = list.filter((r) => executorFilter.includes(r.executorId));
    if (statusFilter.length) list = list.filter((r) => statusFilter.includes(r.paymentStatus));
    if (bankFilter.length)
      list = list.filter((r) => bankFilter.includes(r.bankAccountId ?? ""));
    if (smetaFilter.length) list = list.filter((r) => smetaFilter.includes(r.sourceType));
    return [...list].sort(compareRows);
  }, [
    allRows,
    periodYearFilter,
    periodMonthFilter,
    weekFilter,
    executorFilter,
    statusFilter,
    bankFilter,
    smetaFilter,
    sort,
  ]);

  async function handleMarkPaid(row: Row, paidAt: string, bankAccountId: string | null) {
    setPaying(null);
    const compositeId = `${row.sourceType}:${row.sourceId}`;
    const res = await fetch(`/api/payouts/${compositeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentStatus: "paid",
        paidAt: new Date(paidAt).toISOString(),
        bankAccountId: bankAccountId || null,
      }),
    });
    if (!res.ok) return toast.error("Не удалось провести оплату");
    toast.success("Выплата оплачена");
    mutate();
  }

  async function handleDelete(row: Row) {
    const compositeId = `${row.sourceType}:${row.sourceId}`;
    const res = await fetch(`/api/payouts/${compositeId}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Не удалось удалить");
    toast.success(
      row.sourceType === "personal"
        ? "Выплата удалена. Работы освобождены, статус откатан."
        : "Поля выплаты очищены. Статус работы откатан."
    );
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
        title="Выплаты"
        description="Сводная таблица выплат."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MultiSelectFilter
          label="Год выполнения"
          options={periodYearOptions}
          value={periodYearFilter}
          onChange={setPeriodYearFilter}
        />
        <MultiSelectFilter
          label="Месяц выполнения"
          options={MONTHS}
          value={periodMonthFilter}
          onChange={setPeriodMonthFilter}
        />
        <MultiSelectFilter
          label="Неделя план-факт"
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
          label="Статус выплаты"
          options={Object.entries(PAYMENT_STATUSES).map(([value, { label }]) => ({
            value,
            label,
          }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <MultiSelectFilter
          label="Источник оплаты"
          options={bankOptions}
          value={bankFilter}
          onChange={setBankFilter}
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
        <Table className="min-w-[1400px]">
          <TableHeader>
            <TableRow>
              <TableHead>Год план-факт</TableHead>
              <SortableHead
                field="periodYear"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
              >
                Год выполн.
              </SortableHead>
              <SortableHead
                field="periodMonth"
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
              <TableHead>Комментарий</TableHead>
              <SortableHead
                field="paymentStatus"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
              >
                Статус
              </SortableHead>
              <SortableHead
                field="amount"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
                className="text-right"
              >
                Выплата
              </SortableHead>
              <TableHead>Дата оплаты — план</TableHead>
              <TableHead>Дата оплаты</TableHead>
              <SortableHead
                field="bankAccountName"
                sortBy={activeSortField()}
                sortDir={activeSortDir()}
                onSort={handleSort}
              >
                Источник оплаты
              </SortableHead>
              <TableHead>Тип сметы</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-neutral-500 py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-neutral-500 py-12">
                  Пока нет ни одной выплаты. Они появятся после создания Payment в Личной смете
                  или назначения суммы выплаты в Прочих тратах (Phase 3).
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={`${r.sourceType}:${r.sourceId}`}>
                  <TableCell className="text-sm tabular-nums">{r.yearPlanFact ?? "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{r.periodYear}</TableCell>
                  <TableCell className="text-sm">{monthLabel(r.periodMonth)}</TableCell>
                  <TableCell className="text-sm">
                    {r.weekPlanFact != null ? weekLabel(r.weekPlanFact) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.executorName}</TableCell>
                  <TableCell className="text-sm max-w-64 truncate" title={r.comment ?? ""}>
                    {r.comment ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge dict={PAYMENT_STATUSES} value={r.paymentStatus} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.amount)}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.plannedPayAt)}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.paidAt)}</TableCell>
                  <TableCell className="text-sm">{r.bankAccountName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{SMETA_LABEL[r.sourceType]}</TableCell>
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
              ))
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
          onSaved={() => {
            setEditing(null);
            mutate();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={
          deleting?.sourceType === "personal"
            ? "Удалить выплату из Личной сметы?"
            : "Очистить данные выплаты в Прочих тратах?"
        }
        description={
          deleting?.sourceType === "personal"
            ? `Будет удалён Payment. У всех работ, привязанных к нему, paymentId, paidAt очистятся, статус «Оплачено» откатится на «Проверено». Сами работы сохранятся.`
            : `У строки Прочих трат очистятся payment-поля. Если статус работы был «Оплачено» — откатится на «Проверено». Сама строка сохранится.`
        }
        confirmLabel={deleting?.sourceType === "personal" ? "Удалить" : "Очистить"}
        destructive
        onConfirm={async () => {
          if (deleting) await handleDelete(deleting);
        }}
      />
    </>
  );
}

// ─── Диалог быстрой оплаты ───────────────────────────────────────────────────

function toLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MarkPaidDialog({
  row,
  banks,
  onClose,
  onConfirm,
}: {
  row: Row;
  banks: BankOption[];
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
          <DialogTitle>Оплатить выплату — {row.executorName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Дата оплаты</Label>
            <div className="relative w-full cursor-pointer" onClick={() => { ref.current?.focus(); try { ref.current?.showPicker(); } catch { /**/ } }}>
              <input
                ref={ref}
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Источник оплаты</Label>
            <Select value={bankAccountId || "__none__"} onValueChange={(v) => setBankAccountId(v === "__none__" ? "" : (v ?? ""))}>
              <SelectTrigger>
                <SelectValue>
                  {bankAccountId ? (activeBanks.find((b) => b.id === bankAccountId)?.name ?? "—") : "— Не задан —"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Не задан —</SelectItem>
                {activeBanks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button disabled={!paidAt} onClick={() => onConfirm(paidAt, bankAccountId || null)}>
            Провести оплату
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
