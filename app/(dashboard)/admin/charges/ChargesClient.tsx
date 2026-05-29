"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatDate } from "@/lib/format";
import { getISOWeek, getISOWeekYear, weekLabel } from "@/lib/iso-weeks";
import { CHARGE_STATUSES, BADGE_TONE_CLASS } from "@/lib/statuses";

// ─── Типы ─────────────────────────────────────────────────────────────────────

type BankAccount = { id: string; name: string };
type Order = {
  id: string;
  orderNumber: number;
  description: string;
  project: {
    id: string; name: string;
    client: { id: string; name: string } | null;
  };
};

type Charge = {
  id: string;
  chargeNumber: string;
  bankAccountId: string; bankAccount: BankAccount;
  invoiceNumber: string;
  orderId: string; order: Order;
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
  return condition ? "bg-red-50 text-red-700" : "";
}

function isOverdueH(charge: Charge): boolean {
  const d = planDate(charge);
  if (!d) return false;
  return d < new Date() && charge.status !== "paid";
}

function isMissingM(charge: Charge): boolean {
  return charge.status === "paid" && !charge.paidAt;
}

// ─── Компоненты ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const entry = CHARGE_STATUSES[status as keyof typeof CHARGE_STATUSES];
  if (!entry) return <span className="text-[10px] text-neutral-400">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium whitespace-nowrap ${BADGE_TONE_CLASS[entry.tone]}`}>
      {entry.label}
    </span>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative w-full cursor-pointer" onClick={() => { ref.current?.focus(); try { ref.current?.showPicker(); } catch { /**/ } }}>
      <input ref={ref} type="date" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer" />
    </div>
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
  const [fBankAccount, setFBankAccount] = useState("");
  const [fOrder, setFOrder] = useState("");
  const [fStatus, setFStatus] = useState("");

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
    if (fBankAccount && r.bankAccountId !== fBankAccount) return false;
    if (fOrder && r.orderId !== fOrder) return false;
    if (fStatus && r.status !== fStatus) return false;
    return true;
  });

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

  const th = "border border-neutral-200 px-2 py-1.5 text-left font-medium text-neutral-600 bg-neutral-50 text-xs whitespace-nowrap";
  const thr = th + " text-right";
  const td = "border border-neutral-200 px-2 py-1.5 text-xs";
  const tdr = td + " text-right";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Новое начисление
        </Button>

        <div className="ml-auto flex flex-wrap gap-2">
          {[
            { label: "Все счета", value: fBankAccount, setValue: setFBankAccount, opts: bankAccounts.map(b => ({ v: b.id, l: b.name })) },
            { label: "Все заказы", value: fOrder, setValue: setFOrder, opts: orders.map(o => ({ v: o.id, l: `№${o.orderNumber} ${o.description}` })) },
            { label: "Все статусы", value: fStatus, setValue: setFStatus, opts: Object.entries(CHARGE_STATUSES).map(([v, s]) => ({ v, l: s.label })) },
          ].map(({ label, value, setValue, opts }) => (
            <Select key={label} value={value} onValueChange={(v) => setValue(v ?? "")}>
              <SelectTrigger className="h-8 text-xs w-44"><SelectValue>{value ? (opts.find(o => o.v === value)?.l ?? label) : label}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— {label} —</SelectItem>
                {opts.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-400 py-8 text-center">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-neutral-400 py-8 text-center">Нет данных</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={th}>Банк. счёт</th>
                <th className={th}>№ счёта</th>
                <th className={th}>Заказ</th>
                <th className={th}>Номер</th>
                <th className={thr}>Сумма</th>
                <th className={th}>Выставлен план</th>
                <th className={th}>Выставлен факт</th>
                <th className={th}>Оплачен план</th>
                <th className={th}>Месяц плана</th>
                <th className={th}>Неделя плана</th>
                <th className={th}>Неделя месяца</th>
                <th className={th}>Год плана</th>
                <th className={th}>Оплачен факт</th>
                <th className={th}>Неделя план-факт</th>
                <th className={th}>Год план-факт</th>
                <th className={th}>Статус</th>
                <th className={th}>Проект</th>
                <th className={th}>Клиент</th>
                <th className={th} style={{ minWidth: 160 }}>Назначение</th>
                <th className={th} style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const pd = planDate(row);
                const weekPF = payWeekPF(row);
                const yearPF = payYearPF(row);
                const missingA = !row.bankAccountId;
                const missingB = !row.invoiceNumber;
                const missingC = !row.orderId;
                const missingE = !row.amount;
                const projectName = row.order?.project?.name;
                const missingV = !projectName;
                const overdueH = isOverdueH(row);
                const missingM = isMissingM(row);

                return (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className={`${td} ${cellRed(missingA)}`}>{row.bankAccount?.name ?? <span className="text-neutral-300">—</span>}</td>
                    <td className={`${td} ${cellRed(missingB)}`}>{row.invoiceNumber || <span className="text-neutral-300">—</span>}</td>
                    <td className={`${td} ${cellRed(missingC)}`}>{row.order ? `№${row.order.orderNumber}` : <span className="text-neutral-300">—</span>}</td>
                    <td className={td}>{row.chargeNumber}</td>
                    <td className={`${tdr} ${cellRed(missingE)}`}>{row.amount ? formatMoney(row.amount) : <span className="text-neutral-300">—</span>}</td>
                    <td className={td}>{formatDate(row.issuedPlanAt)}</td>
                    <td className={td}>{formatDate(row.issuedAt)}</td>
                    <td className={`${td} ${cellRed(overdueH)}`}>{formatDate(row.paidPlanAt)}</td>
                    <td className={td}>{pd ? MONTH_LABELS[pd.getMonth()] : <span className="text-neutral-300">—</span>}</td>
                    <td className={td}>{pd ? weekLabel(getISOWeek(pd)) : <span className="text-neutral-300">—</span>}</td>
                    <td className={td + " whitespace-nowrap"}>{pd ? weekOfMonth(pd) : <span className="text-neutral-300">—</span>}</td>
                    <td className={td}>{pd ? pd.getFullYear() : <span className="text-neutral-300">—</span>}</td>
                    <td className={`${td} ${cellRed(missingM)}`}>{formatDate(row.paidAt)}</td>
                    <td className={td}>{weekPF != null ? weekLabel(weekPF) : <span className="text-neutral-300">—</span>}</td>
                    <td className={td}>{yearPF ?? <span className="text-neutral-300">—</span>}</td>
                    <td className={td}><StatusBadge status={row.status} /></td>
                    <td className={`${td} ${cellRed(missingV)}`}>{projectName ?? <span className="text-neutral-300">—</span>}</td>
                    <td className={td}>{row.order?.project?.client?.name ?? <span className="text-neutral-300">—</span>}</td>
                    <td className={td}><div className="truncate max-w-[160px]" title={row.paymentPurpose ?? ""}>{row.paymentPurpose ?? <span className="text-neutral-300">—</span>}</div></td>
                    <td className={td}>
                      <div className="flex gap-1 items-center">
                        <button title="Редактировать" className="p-0.5 text-neutral-500 hover:text-neutral-800" onClick={() => setEditTarget(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button title="Удалить" className="p-0.5 text-red-400 hover:text-red-600" onClick={() => setDeleteTarget(row)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <ChargeFormDialog bankAccounts={bankAccounts} orders={orders}
          onClose={() => setCreateOpen(false)}
          onSaved={(row) => { setCreateOpen(false); setRows(prev => [row, ...prev]); toast.success("Начисление создано"); }} />
      )}

      {editTarget && (
        <ChargeFormDialog bankAccounts={bankAccounts} orders={orders}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setEditTarget(null);
            setRows(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
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
  onSaved: (row: Charge) => void;
}) {
  const [bankAccountId, setBankAccountId] = useState(initial?.bankAccountId ?? "");
  const [orderId, setOrderId] = useState(initial?.orderId ?? "");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [issuedPlanAt, setIssuedPlanAt] = useState(initial?.issuedPlanAt ? new Date(initial.issuedPlanAt).toISOString().slice(0, 10) : "");
  const [issuedAt, setIssuedAt] = useState(initial?.issuedAt ? new Date(initial.issuedAt).toISOString().slice(0, 10) : "");
  const [paidPlanAt, setPaidPlanAt] = useState(initial?.paidPlanAt ? new Date(initial.paidPlanAt).toISOString().slice(0, 10) : "");
  const [paidAt, setPaidAt] = useState(initial?.paidAt ? new Date(initial.paidAt).toISOString().slice(0, 10) : "");
  const [paymentPurpose, setPaymentPurpose] = useState(initial?.paymentPurpose ?? "");
  const [status, setStatus] = useState(initial?.status ?? "planned");
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial;

  async function handleSave() {
    setSaving(true);
    try {
      const url = isEdit ? `/api/charges/${initial!.id}` : "/api/charges";
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: bankAccountId || null,
          orderId: orderId || null,
          amount: amount ? parseFloat(amount) : null,
          issuedPlanAt: issuedPlanAt || null,
          issuedAt: issuedAt || null,
          paidPlanAt: paidPlanAt || null,
          paidAt: paidAt || null,
          paymentPurpose: paymentPurpose || null,
          status,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Ошибка"); }
      const saved = await r.json();
      onSaved(saved);
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
          <div className="space-y-1.5">
            <Label>Банковский счёт</Label>
            <Select value={bankAccountId} onValueChange={(v) => setBankAccountId(v ?? "")}>
              <SelectTrigger><SelectValue>{bankAccounts.find(b => b.id === bankAccountId)?.name ?? "Выберите"}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="">—</SelectItem>
                {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Заказ</Label>
            <Select value={orderId} onValueChange={(v) => setOrderId(v ?? "")}>
              <SelectTrigger>
                <SelectValue>{selectedOrder ? `№${selectedOrder.orderNumber} — ${selectedOrder.description}` : "Выберите заказ"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">—</SelectItem>
                {orders.map(o => <SelectItem key={o.id} value={o.id}>№{o.orderNumber} — {o.description}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedOrder && (
              <p className="text-xs text-neutral-500">
                Проект: {selectedOrder.project.name}
                {selectedOrder.project.client ? ` · ${selectedOrder.project.client.name}` : ""}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Сумма</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Статус</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "planned")}>
              <SelectTrigger><SelectValue>{CHARGE_STATUSES[status as keyof typeof CHARGE_STATUSES]?.label ?? status}</SelectValue></SelectTrigger>
              <SelectContent>
                {Object.entries(CHARGE_STATUSES).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Выставлен — план</Label>
            <DateInput value={issuedPlanAt} onChange={setIssuedPlanAt} />
          </div>
          <div className="space-y-1.5">
            <Label>Выставлен — факт</Label>
            <DateInput value={issuedAt} onChange={setIssuedAt} />
          </div>
          <div className="space-y-1.5">
            <Label>Оплачен — план</Label>
            <DateInput value={paidPlanAt} onChange={setPaidPlanAt} />
          </div>
          <div className="space-y-1.5">
            <Label>Оплачен — факт</Label>
            <DateInput value={paidAt} onChange={setPaidAt} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Назначение платежа</Label>
            <Input value={paymentPurpose} onChange={(e) => setPaymentPurpose(e.target.value)} placeholder="Текст назначения..." />
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
