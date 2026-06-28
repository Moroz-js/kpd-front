"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatMoneyRub, formatDate, formatDateShort } from "@/lib/format";
import { getISOWeek, getISOWeekYear, weekLabel, toLocalDateString } from "@/lib/iso-weeks";
import { CHARGE_STATUSES, BADGE_TONE_CLASS } from "@/lib/statuses";
import {
  Table, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { stickyActionsHead, stickyActionsCell, stickyActionsInner } from "@/lib/table-styles";
import { BulkSelectTableBody } from "@/components/ui-custom/BulkSelectTableBody";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { RowSelectCheckbox } from "@/components/ui-custom/RowSelectCheckbox";
import { useTableRowSelection } from "@/lib/useTableRowSelection";

// ─── Типы ─────────────────────────────────────────────────────────────────────

type BankAccount = { id: string; name: string };
type Order = {
  id: string;
  orderNumber: string;
  description: string | null;
  project: {
    id: string; name: string;
    client: { id: string; name: string } | null;
  };
};

type Charge = {
  id: string;
  chargeNumber: string;
  bankAccountId: string | null; bankAccount: BankAccount | null;
  invoiceNumber: string;
  orderId: string | null; order: Order | null;
  amount: number;
  issuedPlanAt: string | null;
  issuedAt: string | null;
  paidPlanAt: string | null;
  paidAt: string | null;
  paymentPurpose: string | null;
  status: string;
  createdAt: string;
};

type Props = {
  bankAccounts: BankAccount[];
  orders: Order[];
};

// ─── Вычисляемые поля ─────────────────────────────────────────────────────────

function planDate(charge: Charge): Date | null {
  return charge.paidPlanAt ? new Date(charge.paidPlanAt) : null;
}

function payWeekPF(charge: Charge): number | null {
  const d = charge.paidAt ?? charge.paidPlanAt;
  if (!d) return null;
  return getISOWeek(new Date(d));
}

function payYearPF(charge: Charge): number | null {
  const d = charge.paidAt ?? charge.paidPlanAt;
  if (!d) return null;
  return getISOWeekYear(new Date(d));
}

const ROMAN = ["I", "II", "III", "IV", "V"];

function weekOfMonth(date: Date): string {
  const weekNum = Math.ceil(date.getDate() / 7);
  return `Неделя ${ROMAN[weekNum - 1] ?? weekNum}`;
}

// ─── Условное форматирование ──────────────────────────────────────────────────

function cellRed(condition: boolean) {
  return condition ? "bg-red-100 text-red-700" : "";
}

function cellEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && !value.trim()) return true;
  if (typeof value === "number" && value === 0) return true;
  return false;
}

function isOverdueH(charge: Charge): boolean {
  const d = planDate(charge);
  if (!d) return false;
  return d < new Date() && charge.status !== "paid";
}

function isMissingM(charge: Charge): boolean {
  return !charge.paidAt && (charge.status === "paid" || isOverdueH(charge));
}

// ─── Компоненты ───────────────────────────────────────────────────────────────

function ChargeStatusBadge({ status }: { status: string }) {
  const entry = CHARGE_STATUSES[status as keyof typeof CHARGE_STATUSES];
  if (!entry) return <span className="text-[10px] text-neutral-400">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium whitespace-nowrap ${BADGE_TONE_CLASS[entry.tone]}`}>
      {entry.label}
    </span>
  );
}

function InlineDateCell({ value, onSave, highlight }: { value: string; onSave: (v: string) => void; highlight?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);

  if (!editing) {
    return (
      <span
        className="inline-flex cursor-pointer hover:bg-neutral-100 rounded px-1 py-0.5 text-neutral-600"
        onClick={() => { setEditing(true); setTimeout(() => { try { ref.current?.showPicker(); } catch { /**/ } }, 50); }}
      >
        {v ? v.slice(5).split("-").reverse().join(".") : <span className={highlight ? "font-medium" : "text-neutral-300"}>—</span>}
      </span>
    );
  }
  return (
    <input
      ref={ref}
      autoFocus
      type="date"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEditing(false); onSave(v); }}
      onClick={() => { try { ref.current?.showPicker(); } catch { /**/ } }}
      className="border border-blue-300 rounded px-1 py-0.5 text-xs outline-none w-32 cursor-pointer"
    />
  );
}

function InlinePurposeCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  function handleSave() {
    setOpen(false);
    if (draft !== value) onSave(draft);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex max-w-[220px] rounded px-1 py-0.5 text-left text-xs text-neutral-600 hover:bg-neutral-100"
          />
        }
      >
        <span className="line-clamp-2 min-w-0 break-words">
          {value || <span className="text-neutral-300">— задать —</span>}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start" side="bottom">
        <div className="space-y-2">
          <Label className="text-xs text-neutral-600">Назначение платежа</Label>
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="min-h-[120px] resize-y text-xs"
            placeholder="Текст назначения..."
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(value);
                setOpen(false);
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(value);
                setOpen(false);
              }}
            >
              Отмена
            </Button>
            <Button type="button" size="sm" onClick={handleSave}>
              Сохранить
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export function ChargesClient({ bankAccounts, orders }: Props) {
  const [rows, setRows] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Charge | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Charge | null>(null);

  // Фильтры
  const [fBankAccount, setFBankAccount] = useState<string[]>([]);
  const [fOrder, setFOrder] = useState<string[]>([]);
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [fClient, setFClient] = useState<string[]>([]);
  const [fProject, setFProject] = useState<string[]>([]);
  const [fWeek, setFWeek] = useState<string[]>([]);

  const [bulkStatus, setBulkStatus] = useState("");

  const fetchData = useCallback(async () => {
    const r = await fetch("/api/charges");
    if (!r.ok) throw new Error();
    return r.json() as Promise<Charge[]>;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchData()); } catch { toast.error("Не удалось загрузить данные"); }
    finally { setLoading(false); }
  }, [fetchData]);

  const silentLoad = useCallback(() => { fetchData().then(setRows).catch(() => {}); }, [fetchData]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => {
    if (fBankAccount.length && (!r.bankAccountId || !fBankAccount.includes(r.bankAccountId))) return false;
    if (fOrder.length && (!r.orderId || !fOrder.includes(r.orderId))) return false;
    if (fStatus.length && !fStatus.includes(r.status)) return false;
    if (fClient.length) {
      const clientId = r.order?.project?.client?.id ?? "__empty__";
      if (!fClient.includes(clientId)) return false;
    }
    if (fProject.length) {
      const projectId = r.order?.project?.id ?? "__empty__";
      if (!fProject.includes(projectId)) return false;
    }
    if (fWeek.length) {
      const w = payWeekPF(r);
      const y = payYearPF(r);
      const key = w !== null && y !== null ? `${y}-${w}` : "__empty__";
      if (!fWeek.includes(key)) return false;
    }
    return true;
  });

  const orderedRowIds = React.useMemo(() => filtered.map((r) => r.id), [filtered]);
  const { selectedIds, handleRowSelect, toggleAll, clearSelection } = useTableRowSelection(orderedRowIds);

  const selectedSum = React.useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)).reduce((s, r) => s + (r.amount ?? 0), 0),
    [rows, selectedIds]
  );

  const clientOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    // Полный список клиентов берём из заказов (стабильный источник),
    // чтобы лейбл резолвился даже когда таблица начислений отфильтрована/пуста.
    for (const o of orders) {
      if (o.project?.client) map.set(o.project.client.id, o.project.client.name);
    }
    if (rows.some((r) => !r.order?.project?.client)) map.set("__empty__", "Пусто");
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [orders, rows]);

  const projectOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) {
      if (o.project) map.set(o.project.id, o.project.name);
    }
    if (rows.some((r) => !r.order?.project)) map.set("__empty__", "Пусто");
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [orders, rows]);

  const weekOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const w = payWeekPF(r);
      const y = payYearPF(r);
      if (w !== null && y !== null) {
        const key = `${y}-${String(w).padStart(2, "0")}`;
        if (!map.has(key)) map.set(key, `${weekLabel(w)} ${y}`);
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
  }, [rows]);

  async function patchInlineStatus(id: string, status: string) {
    const res = await fetch(`/api/charges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return toast.error("Не удалось изменить статус");
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  async function patchInlinePaidAt(id: string, paidAt: string) {
    const res = await fetch(`/api/charges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paidAt: paidAt ? new Date(paidAt).toISOString() : null }),
    });
    if (!res.ok) return toast.error("Не удалось изменить дату");
    const updated = await res.json() as Charge;
    setRows(prev => prev.map(r => r.id === id ? updated : r));
  }

  async function patchInlinePurpose(id: string, paymentPurpose: string) {
    const res = await fetch(`/api/charges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPurpose: paymentPurpose || null }),
    });
    if (!res.ok) return toast.error("Не удалось изменить назначение");
    setRows(prev => prev.map(r => r.id === id ? { ...r, paymentPurpose: paymentPurpose || null } : r));
  }

  async function handleBulkApply() {
    if (!bulkStatus) return toast.error("Выберите статус");
    const ids = Array.from(selectedIds);
    const res = await fetch("/api/charges/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, patch: { status: bulkStatus } }),
    });
    if (!res.ok) return toast.error("Ошибка массового обновления");
    const { updated } = await res.json() as { updated: number };
    toast.success(`Обновлено ${updated} начислений`);
    setRows(prev => prev.map(r => selectedIds.has(r.id) ? { ...r, status: bulkStatus } : r));
    clearSelection();
    setBulkStatus("");
  }

  async function handleDelete(row: Charge) {
    setDeleteTarget(null);
    setRows(prev => prev.filter(r => r.id !== row.id));
    try {
      const res = await fetch(`/api/charges/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Начисление удалено");
    } catch {
      toast.error("Не удалось удалить");
      silentLoad();
    }
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-3rem)] min-h-0">
      <PageHeader title="Начисления" />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Новое начисление
        </Button>

        <div className="ml-auto flex flex-wrap gap-2">
          <MultiSelectFilter
            label="Счёт получения"
            options={bankAccounts.map(b => ({ value: b.id, label: b.name }))}
            value={fBankAccount}
            onChange={setFBankAccount}
          />
          <MultiSelectFilter
            label="Клиент"
            options={clientOptions}
            value={fClient}
            onChange={setFClient}
          />
          <MultiSelectFilter
            label="Проект"
            options={projectOptions}
            value={fProject}
            onChange={setFProject}
          />
          <MultiSelectFilter
            label="Заказ"
            options={orders.map(o => ({ value: o.id, label: `№${o.orderNumber}${o.description ? ` ${o.description}` : ""}` }))}
            value={fOrder}
            onChange={setFOrder}
          />
          <MultiSelectFilter
            label="Статус"
            options={Object.entries(CHARGE_STATUSES).map(([v, s]) => ({ value: v, label: s.label }))}
            value={fStatus}
            onChange={setFStatus}
          />
          <MultiSelectFilter
            label="Неделя оплаты"
            options={weekOptions}
            value={fWeek}
            onChange={setFWeek}
          />
        </div>
      </div>

      {/* Bulk toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-blue-50 border-blue-200 px-3 py-2">
          <span className="text-xs text-blue-700 font-medium">Выбрано: {selectedIds.size}</span>
          <span className="text-xs font-medium tabular-nums text-blue-900">{formatMoneyRub(selectedSum)}</span>
          <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v ?? "")}>
            <SelectTrigger className="h-7 text-xs w-40 bg-white">
              <SelectValue>{bulkStatus ? (CHARGE_STATUSES[bulkStatus as keyof typeof CHARGE_STATUSES]?.label ?? bulkStatus) : "— статус —"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CHARGE_STATUSES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7" onClick={handleBulkApply} disabled={!bulkStatus}>
            Применить
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-neutral-500" onClick={() => clearSelection()}>
            Сбросить
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
      {loading ? (
        <div className="text-xs text-neutral-400 py-8 text-center">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="text-xs text-neutral-400 py-8 text-center">Нет данных</div>
      ) : (
        <Table
          className="min-w-[1400px]"
          containerClassName="rounded-md border bg-white flex-1 min-h-0 min-w-0 overflow-auto"
        >
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={() => toggleAll(orderedRowIds)}
                  />
                </TableHead>
                <TableHead>Счёт получения</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>
                  <span className="flex items-center gap-1">
                    Статус
                    <Pencil className="h-3 w-3 text-neutral-400" />
                  </span>
                </TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Проект</TableHead>
                <TableHead>Выст. план</TableHead>
                <TableHead>Выст. факт</TableHead>
                <TableHead>Опл. план</TableHead>
                <TableHead>Месяц</TableHead>
                <TableHead>Неделя</TableHead>
                <TableHead>Год</TableHead>
                <TableHead>
                  <span className="flex items-center gap-1">
                    Опл. факт
                    <Pencil className="h-3 w-3 text-neutral-400" />
                  </span>
                </TableHead>
                <TableHead className="min-w-[220px]">
                  <span className="flex items-center gap-1">
                    Назначение
                    <Pencil className="h-3 w-3 text-neutral-400" />
                  </span>
                </TableHead>
                <TableHead>Номер заказа</TableHead>
                <TableHead>Номер начисления</TableHead>
                <TableHead>Номер счёта</TableHead>
                <TableHead className={stickyActionsHead} />
              </TableRow>
            </TableHeader>
            <BulkSelectTableBody>
              {filtered.map((row, rowIndex) => {
                const pd = planDate(row);
                const weekPF = payWeekPF(row);
                const yearPF = payYearPF(row);
                const overdueH = isOverdueH(row);
                const missingM = isMissingM(row);

                return (
                  <TableRow key={row.id} className={selectedIds.has(row.id) ? "bg-blue-50/50" : ""}>
                    <TableCell>
                      <RowSelectCheckbox
                        checked={selectedIds.has(row.id)}
                        rowIndex={rowIndex}
                        rowId={row.id}
                        onSelect={handleRowSelect}
                      />
                    </TableCell>
                    <TableCell className={cellRed(cellEmpty(row.bankAccount?.name))}>{row.bankAccount?.name ?? "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold text-sm ${cellRed(cellEmpty(row.amount))}`}>{row.amount ? formatMoney(row.amount) : "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={row.status}
                        onValueChange={(v) => v && patchInlineStatus(row.id, v)}
                      >
                        <SelectTrigger className="h-6 w-auto min-w-[110px] border-0 bg-transparent shadow-none p-0 focus:ring-0 [&>svg]:hidden">
                          <SelectValue>
                            <ChargeStatusBadge status={row.status} />
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CHARGE_STATUSES).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{row.order?.project?.client?.name ?? "—"}</TableCell>
                    <TableCell className={cellRed(cellEmpty(row.order?.project?.name))}>{row.order?.project?.name ?? "—"}</TableCell>
                    <TableCell>{formatDateShort(row.issuedPlanAt)}</TableCell>
                    <TableCell>{formatDateShort(row.issuedAt)}</TableCell>
                    <TableCell className={cellRed(overdueH)}>{formatDateShort(row.paidPlanAt)}</TableCell>
                    <TableCell>{pd ? MONTH_LABELS[pd.getMonth()] : "—"}</TableCell>
                    <TableCell>{pd ? weekLabel(getISOWeek(pd)) : "—"}</TableCell>
                    <TableCell>{pd ? pd.getFullYear() : "—"}</TableCell>
                    <TableCell className={cellRed(missingM)}>
                      <InlineDateCell
                        value={row.paidAt ? row.paidAt.slice(0, 10) : ""}
                        onSave={(v) => patchInlinePaidAt(row.id, v)}
                        highlight={missingM}
                      />
                    </TableCell>
                    <TableCell className="align-top max-w-[280px]">
                      <InlinePurposeCell
                        value={row.paymentPurpose ?? ""}
                        onSave={(v) => patchInlinePurpose(row.id, v)}
                      />
                    </TableCell>
                    <TableCell className={`tabular-nums ${cellRed(cellEmpty(row.order?.orderNumber))}`}>{row.order ? row.order.orderNumber : "—"}</TableCell>
                    <TableCell className="tabular-nums">{row.chargeNumber}</TableCell>
                    <TableCell className={cellRed(cellEmpty(row.invoiceNumber))}>{row.invoiceNumber || "—"}</TableCell>
                    <TableCell className={cn(stickyActionsCell, selectedIds.has(row.id) && "bg-blue-50/50")}>
                      <div className={stickyActionsInner}>
                        <button title="Редактировать" className="p-0.5 text-neutral-500 hover:text-neutral-800" onClick={() => setEditTarget(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button title="Удалить" className="p-0.5 text-red-400 hover:text-red-600" onClick={() => setDeleteTarget(row)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </BulkSelectTableBody>
          </Table>
      )}
      </div>

      {createOpen && (
        <ChargeFormDialog bankAccounts={bankAccounts} orders={orders}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); silentLoad(); toast.success("Начисление создано"); }} />
      )}

      {editTarget && (
        <ChargeFormDialog bankAccounts={bankAccounts} orders={orders}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            silentLoad();
            toast.success("Сохранено");
          }} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить начисление {deleteTarget?.chargeNumber}?</AlertDialogTitle>
            <AlertDialogDescription>Это действие необратимо.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const MONTH_LABELS = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

// ─── Форма создания / редактирования ─────────────────────────────────────────

function ChargeFormDialog({
  bankAccounts, orders, initial, onClose, onSaved,
}: {
  bankAccounts: BankAccount[];
  orders: Order[];
  initial?: Charge;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bankAccountId, setBankAccountId] = useState(initial?.bankAccountId ?? "");
  const [orderId, setOrderId] = useState(initial?.orderId ?? "");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [issuedPlanAt, setIssuedPlanAt] = useState(initial?.issuedPlanAt ? toLocalDateString(new Date(initial.issuedPlanAt)) : "");
  const [issuedAt, setIssuedAt] = useState(initial?.issuedAt ? toLocalDateString(new Date(initial.issuedAt)) : "");
  const [paidPlanAt, setPaidPlanAt] = useState(initial?.paidPlanAt ? toLocalDateString(new Date(initial.paidPlanAt)) : "");
  const [paidAt, setPaidAt] = useState(initial?.paidAt ? toLocalDateString(new Date(initial.paidAt)) : "");
  const [paymentPurpose, setPaymentPurpose] = useState(initial?.paymentPurpose ?? "");
  const [status, setStatus] = useState(initial?.status ?? "planned");
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial;

  const paidAtChangedRef = useRef(false);

  // Авто-синхронизация статуса при изменении paidAt (не при открытии диалога)
  useEffect(() => {
    if (!paidAtChangedRef.current) { paidAtChangedRef.current = true; return; }
    if (!paidAt) {
      if (status === "paid") setStatus("to_pay");
    } else {
      setStatus("paid");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidAt]);

  async function handleSave() {
    if (!bankAccountId) {
      toast.error("Выберите счёт получения");
      return;
    }
    if (!orderId) {
      toast.error("Выберите заказ");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Введите сумму");
      return;
    }
    if (isEdit && status === "paid" && !paidAt) {
      toast.error("Укажите дату оплаты факт для статуса «Оплачено»");
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/charges/${initial!.id}` : "/api/charges";
      const method = isEdit ? "PATCH" : "POST";
      const payload: Record<string, unknown> = {
        bankAccountId: bankAccountId || null,
        orderId: orderId || null,
        amount: amount ? parseFloat(amount) : null,
        issuedPlanAt: issuedPlanAt || null,
        paidPlanAt: paidPlanAt || null,
        paymentPurpose: paymentPurpose || null,
        status,
      };
      if (isEdit) {
        payload.issuedAt = issuedAt || null;
        payload.paidAt = paidAt || null;
      }
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Ошибка"); }
      const saved = await r.json();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const selectedOrder = orders.find(o => o.id === orderId);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Редактировать ${initial!.chargeNumber}` : "Новое начисление"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 min-w-0">
            <Label>Счёт получения</Label>
            <Select value={bankAccountId} onValueChange={(v) => setBankAccountId(v ?? "")}>
              <SelectTrigger>
                <SelectValue>{bankAccounts.find(b => b.id === bankAccountId)?.name ?? "Выберите"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">—</SelectItem>
                {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2 min-w-0">
            <Label>Заказ</Label>
            <Select value={orderId} onValueChange={(v) => setOrderId(v ?? "")}>
              <SelectTrigger>
                <SelectValue>{selectedOrder ? `№${selectedOrder.orderNumber}${selectedOrder.description ? ` — ${selectedOrder.description}` : ""}` : "Выберите заказ"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">—</SelectItem>
                {orders.map(o => <SelectItem key={o.id} value={o.id}>№{o.orderNumber}{o.description ? ` — ${o.description}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedOrder && (
              <p className="text-xs text-neutral-500">
                Проект: {selectedOrder.project.name}
              </p>
            )}
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>Сумма</Label>
            <Input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>Статус</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "planned")}>
              <SelectTrigger><SelectValue>{CHARGE_STATUSES[status as keyof typeof CHARGE_STATUSES]?.label ?? status}</SelectValue></SelectTrigger>
              <SelectContent>
                {Object.entries(CHARGE_STATUSES).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>Выставлен — план</Label>
            <Input type="date" className="h-8 text-xs" value={issuedPlanAt} onChange={(e) => setIssuedPlanAt(e.target.value)} />
          </div>
          {isEdit && (
            <div className="space-y-1.5 min-w-0">
              <Label>Выставлен — факт</Label>
              <Input type="date" className="h-8 text-xs" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5 min-w-0">
            <Label>Оплачен — план</Label>
            <Input type="date" className="h-8 text-xs" value={paidPlanAt} onChange={(e) => setPaidPlanAt(e.target.value)} />
          </div>
          {isEdit && (
            <div className="space-y-1.5 min-w-0">
              <Label>Оплачен — факт</Label>
              <Input type="date" className="h-8 text-xs" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5 col-span-2 min-w-0">
            <Label>Назначение платежа</Label>
            <Textarea
              value={paymentPurpose}
              onChange={(e) => setPaymentPurpose(e.target.value)}
              placeholder="Текст назначения..."
              rows={4}
              className="min-h-[100px] resize-y"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
