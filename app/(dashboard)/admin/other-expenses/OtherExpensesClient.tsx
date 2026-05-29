"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle } from "lucide-react";
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
import { formatMoney, formatDate, MONTHS } from "@/lib/format";
import { getISOWeek, weekLabel } from "@/lib/iso-weeks";
import { WORK_STATUSES, PAYMENT_STATUSES, BADGE_TONE_CLASS } from "@/lib/statuses";
import { nearestPaymentDate, toLocalDateString } from "@/lib/iso-weeks";

// ─── Константы ────────────────────────────────────────────────────────────────

const PREFERRED_PAY_METHODS = [
  "З/П", "Крипта", "Самозанятый", "ИП", "Карта физлица РФ",
  "Карта физлица другой страны", "Р/С контрагента РФ", "Р/С контрагента КЗ",
  "Р/С контрагента ЧГ", "Р/С контрагента ЕС", "Бизнес-картой РФ",
  "Бизнес-картой КЗ", "Бизнес-картой ЧГ", "Бизнес-картой СЛ", "4DEV", "ГПХ",
];

const WORK_STATUS_LABELS: Record<string, string> = {
  submitted: "Выставлено",
  checked: "Проверено",
  paid: "Оплачено",
  rework: "Нужно доработать",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  paid: "Оплачено",
};

// ─── Типы ─────────────────────────────────────────────────────────────────────

type Ref = { id: string; name: string };
type UserRef = { id: string; fullName: string };

type OtherExpense = {
  id: string;
  projectId: string; project: Ref;
  executorId: string; executor: Ref;
  workTypeId: string; workType: Ref & { segment: string };
  responsibleUserId: string; responsibleUser: UserRef;
  bankAccountId: string | null; bankAccount: Ref | null;
  executionYear: number;
  executionMonth: number;
  description: string;
  amount: number;
  paymentAmount: number | null;
  preferredPayMethod: string | null;
  plannedPayAt: string | null;
  paidAt: string | null;
  checkedAt: string | null;
  workStatus: string;
  paymentStatus: string;
  comment: string | null;
  createdById: string;
  createdAt: string;
};

type Props = {
  isAdmin: boolean;
  userId: string;
  projects: Ref[];
  executors: Ref[];
  workTypes: Ref[];
  responsibles: UserRef[];
  bankAccounts: Ref[];
};

// ─── Утилиты ──────────────────────────────────────────────────────────────────

async function readApiJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  if (!text.trim()) {
    if (!r.ok) throw new Error(`Ошибка сервера (${r.status})`);
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(r.ok ? "Некорректный ответ сервера" : `Ошибка сервера (${r.status})`);
  }
}

function payWeek(plannedPayAt: string | null, paidAt: string | null): string {
  const d = paidAt ?? plannedPayAt;
  if (!d) return "—";
  return weekLabel(getISOWeek(new Date(d)));
}

function StatusBadge({ status, type }: { status: string; type: "work" | "payment" }) {
  const dict = type === "work" ? WORK_STATUSES : PAYMENT_STATUSES;
  const entry = dict[status as keyof typeof dict];
  if (!entry) return <span className="text-[10px] text-neutral-400">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium whitespace-nowrap ${BADGE_TONE_CLASS[entry.tone]}`}>
      {type === "work" ? WORK_STATUS_LABELS[status] : PAYMENT_STATUS_LABELS[status]}
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

export function OtherExpensesClient({ isAdmin, userId, projects, executors, workTypes, responsibles, bankAccounts }: Props) {
  const [rows, setRows] = useState<OtherExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OtherExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OtherExpense | null>(null);
  const [checkTarget, setCheckTarget] = useState<OtherExpense | null>(null);

  // Фильтры
  const [fYear, setFYear] = useState("");
  const [fMonth, setFMonth] = useState("");
  const [fProject, setFProject] = useState("");
  const [fExecutor, setFExecutor] = useState("");
  const [fWorkType, setFWorkType] = useState("");
  const [fResponsible, setFResponsible] = useState("");
  const [fWorkStatus, setFWorkStatus] = useState("");
  const [fPayStatus, setFPayStatus] = useState("");

  const fetchData = useCallback(async () => {
    const r = await fetch("/api/other-expenses");
    if (!r.ok) throw new Error();
    return r.json() as Promise<OtherExpense[]>;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchData()); } catch { toast.error("Не удалось загрузить данные"); }
    finally { setLoading(false); }
  }, [fetchData]);

  const silentLoad = useCallback(() => { fetchData().then(setRows).catch(() => {}); }, [fetchData]);

  useEffect(() => { load(); }, [load]);

  function canEdit(row: OtherExpense) {
    if (isAdmin) return true;
    if (row.workStatus === "checked") return false;
    return row.createdById === userId || row.responsibleUserId === userId;
  }

  const allYears = [...new Set(rows.map(r => r.executionYear))].sort();

  const filtered = rows.filter(r => {
    if (fYear && String(r.executionYear) !== fYear) return false;
    if (fMonth && String(r.executionMonth) !== fMonth) return false;
    if (fProject && r.projectId !== fProject) return false;
    if (fExecutor && r.executorId !== fExecutor) return false;
    if (fWorkType && r.workTypeId !== fWorkType) return false;
    if (fResponsible && r.responsibleUserId !== fResponsible) return false;
    if (fWorkStatus && r.workStatus !== fWorkStatus) return false;
    if (fPayStatus && r.paymentStatus !== fPayStatus) return false;
    return true;
  });

  async function handleCheck(row: OtherExpense) {
    setCheckTarget(null);
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, workStatus: "checked", checkedAt: new Date().toISOString() } : r));
    try {
      const res = await fetch(`/api/other-expenses/${row.id}/check`, { method: "POST" });
      if (!res.ok) { const d = await readApiJson<{ error?: string }>(res); throw new Error(d.error ?? "Ошибка"); }
      toast.success("Работа проверена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
      silentLoad();
    }
  }

  async function handleDelete(row: OtherExpense) {
    setDeleteTarget(null);
    setRows(prev => prev.filter(r => r.id !== row.id));
    try {
      const res = await fetch(`/api/other-expenses/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Строка удалена");
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
          <Plus className="h-3.5 w-3.5 mr-1" /> Новая строка
        </Button>

        <div className="ml-auto flex flex-wrap gap-2">
          {/* Фильтры */}
          {[
            { label: "Все годы", value: fYear, setValue: setFYear, opts: allYears.map(y => ({ v: String(y), l: `${y} год` })) },
            { label: "Все месяцы", value: fMonth, setValue: setFMonth, opts: MONTHS.map(m => ({ v: m.value, l: m.label })) },
            { label: "Все проекты", value: fProject, setValue: setFProject, opts: projects.map(p => ({ v: p.id, l: p.name })) },
            { label: "Все исполнители", value: fExecutor, setValue: setFExecutor, opts: executors.map(e => ({ v: e.id, l: e.name })) },
            { label: "Все ответственные", value: fResponsible, setValue: setFResponsible, opts: responsibles.map(r => ({ v: r.id, l: r.fullName })) },
            { label: "Статус работы", value: fWorkStatus, setValue: setFWorkStatus, opts: Object.entries(WORK_STATUS_LABELS).map(([v, l]) => ({ v, l })) },
            { label: "Статус выплаты", value: fPayStatus, setValue: setFPayStatus, opts: Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => ({ v, l })) },
          ].map(({ label, value, setValue, opts }) => (
            <Select key={label} value={value} onValueChange={(v) => setValue(v ?? "")}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue>{value ? (opts.find(o => o.v === value)?.l ?? label) : label}</SelectValue></SelectTrigger>
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
                <th className={th}>Год</th>
                <th className={th}>Месяц</th>
                <th className={th}>Неделя оплаты</th>
                <th className={th}>Проект</th>
                <th className={th}>Исполнитель</th>
                <th className={th} style={{ minWidth: 200 }}>Описание работы</th>
                <th className={th}>Вид работ</th>
                <th className={th}>Ответственный</th>
                <th className={th}>Способ оплаты</th>
                <th className={th}>Дата план</th>
                <th className={thr}>Сумма</th>
                <th className={th}>Статус работы</th>
                <th className={th}>Статус выплаты</th>
                <th className={thr}>Выплата</th>
                <th className={th}>Дата оплаты</th>
                <th className={th}>Счёт</th>
                <th className={th} style={{ width: 64 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-neutral-50">
                  <td className={td}>{row.executionYear}</td>
                  <td className={td + " whitespace-nowrap"}>{MONTHS.find(m => m.value === String(row.executionMonth))?.label ?? row.executionMonth}</td>
                  <td className={td}>{payWeek(row.plannedPayAt, row.paidAt)}</td>
                  <td className={td + " max-w-[120px] truncate"} title={row.project.name}>{row.project.name}</td>
                  <td className={td + " whitespace-nowrap"}>{row.executor.name}</td>
                  <td className={td + " max-w-[200px]"}><div className="truncate" title={row.description}>{row.description}</div></td>
                  <td className={td}>{row.workType.name}</td>
                  <td className={td + " whitespace-nowrap"}>{row.responsibleUser.fullName}</td>
                  <td className={td}>{row.preferredPayMethod ?? "—"}</td>
                  <td className={td}>{formatDate(row.plannedPayAt)}</td>
                  <td className={tdr}>{formatMoney(row.amount)}</td>
                  <td className={td}><StatusBadge status={row.workStatus} type="work" /></td>
                  <td className={td}>{row.paymentStatus ? <StatusBadge status={row.paymentStatus} type="payment" /> : <span className="text-neutral-300">—</span>}</td>
                  <td className={tdr}>{row.paymentAmount != null ? formatMoney(row.paymentAmount) : "—"}</td>
                  <td className={td}>{formatDate(row.paidAt)}</td>
                  <td className={td}>{row.bankAccount?.name ?? "—"}</td>
                  <td className={td}>
                    <div className="flex gap-1 items-center">
                      {isAdmin && row.workStatus !== "checked" && row.workStatus !== "paid" && (
                        <button title="Проверить" className="p-0.5 text-blue-600 hover:text-blue-800" onClick={() => setCheckTarget(row)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canEdit(row) && (
                        <button title="Редактировать" className="p-0.5 text-neutral-500 hover:text-neutral-800" onClick={() => setEditTarget(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canEdit(row) && (
                        <button title="Удалить" className="p-0.5 text-red-400 hover:text-red-600" onClick={() => setDeleteTarget(row)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Диалоги */}
      {createOpen && (
        <OtherExpenseFormDialog
          isAdmin={isAdmin} userId={userId}
          projects={projects} executors={executors} workTypes={workTypes}
          responsibles={responsibles} bankAccounts={bankAccounts}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); silentLoad(); toast.success("Создано"); }}
        />
      )}

      {editTarget && (
        <OtherExpenseFormDialog
          isAdmin={isAdmin} userId={userId}
          projects={projects} executors={executors} workTypes={workTypes}
          responsibles={responsibles} bankAccounts={bankAccounts}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); silentLoad(); toast.success("Сохранено"); }}
        />
      )}

      <AlertDialog open={!!checkTarget} onOpenChange={(o) => !o && setCheckTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Проверить работу?</AlertDialogTitle>
            <AlertDialogDescription>
              Статус сменится на «Проверено». Если сумма выплаты не заполнена — подставится сумма работы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => checkTarget && handleCheck(checkTarget)}>Проверить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить строку?</AlertDialogTitle>
            <AlertDialogDescription>Строка будет удалена без возможности восстановления.</AlertDialogDescription>
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

// ─── Форма создания / редактирования ─────────────────────────────────────────

function OtherExpenseFormDialog({
  isAdmin, userId, projects, executors, workTypes, responsibles, bankAccounts,
  initial, onClose, onSaved,
}: {
  isAdmin: boolean; userId: string;
  projects: Ref[]; executors: Ref[]; workTypes: Ref[]; responsibles: UserRef[]; bankAccounts: Ref[];
  initial?: OtherExpense;
  onClose: () => void;
  onSaved: () => void;
}) {
  const now = new Date();
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [executorId, setExecutorId] = useState(initial?.executorId ?? "");
  const [workTypeId, setWorkTypeId] = useState(initial?.workTypeId ?? "");
  const [responsibleUserId, setResponsibleUserId] = useState(initial?.responsibleUserId ?? (isAdmin ? "" : userId));
  const [bankAccountId, setBankAccountId] = useState(initial?.bankAccountId ?? "");
  const [year, setYear] = useState(String(initial?.executionYear ?? now.getFullYear()));
  const [month, setMonth] = useState(String(initial?.executionMonth ?? now.getMonth() + 1));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [paymentAmount, setPaymentAmount] = useState(initial?.paymentAmount != null ? String(initial.paymentAmount) : "");
  const [preferredPayMethod, setPreferredPayMethod] = useState(initial?.preferredPayMethod ?? "");
  const [plannedPayAt, setPlannedPayAt] = useState(initial?.plannedPayAt ? new Date(initial.plannedPayAt).toISOString().slice(0, 10) : toLocalDateString(nearestPaymentDate()));
  const [paidAt, setPaidAt] = useState(initial?.paidAt ? new Date(initial.paidAt).toISOString().slice(0, 10) : "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saving, setSaving] = useState(false);

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const isEdit = !!initial;

  async function handleSave() {
    if (!projectId || !executorId || !workTypeId || !responsibleUserId || !description || !amount) {
      toast.error("Заполните обязательные поля");
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/other-expenses/${initial!.id}` : "/api/other-expenses";
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, executorId, workTypeId, responsibleUserId,
          bankAccountId: bankAccountId || null,
          executionYear: parseInt(year),
          executionMonth: parseInt(month),
          description,
          amount: parseFloat(amount),
          paymentAmount: paymentAmount ? parseFloat(paymentAmount) : null,
          preferredPayMethod: preferredPayMethod || null,
          plannedPayAt: plannedPayAt || null,
          paidAt: paidAt || null,
          comment: comment || null,
        }),
      });
      if (!r.ok) {
        const d = await readApiJson<{ error?: string }>(r);
        throw new Error(d.error ?? "Ошибка");
      }
      await readApiJson(r);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Редактировать" : "Новая строка"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Год *</Label>
            <Select value={year} onValueChange={(v) => setYear(v ?? "")}>
              <SelectTrigger><SelectValue>{year} год</SelectValue></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y} год</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Месяц *</Label>
            <Select value={month} onValueChange={(v) => setMonth(v ?? "")}>
              <SelectTrigger><SelectValue>{MONTHS.find(m => m.value === month)?.label}</SelectValue></SelectTrigger>
              <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Проект *</Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v ?? "")}>
              <SelectTrigger><SelectValue>{projects.find(p => p.id === projectId)?.name ?? "Выберите проект"}</SelectValue></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Исполнитель *</Label>
            <Select value={executorId} onValueChange={(v) => setExecutorId(v ?? "")}>
              <SelectTrigger><SelectValue>{executors.find(e => e.id === executorId)?.name ?? "Выберите"}</SelectValue></SelectTrigger>
              <SelectContent>{executors.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Вид работ *</Label>
            <Select value={workTypeId} onValueChange={(v) => setWorkTypeId(v ?? "")}>
              <SelectTrigger><SelectValue>{workTypes.find(w => w.id === workTypeId)?.name ?? "Выберите"}</SelectValue></SelectTrigger>
              <SelectContent>{workTypes.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Описание работы *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание..." />
          </div>
          <div className="space-y-1.5">
            <Label>Ответственный *</Label>
            {isAdmin ? (
              <Select value={responsibleUserId} onValueChange={(v) => setResponsibleUserId(v ?? "")}>
                <SelectTrigger><SelectValue>{responsibles.find(r => r.id === responsibleUserId)?.fullName ?? "Выберите"}</SelectValue></SelectTrigger>
                <SelectContent>{responsibles.map(r => <SelectItem key={r.id} value={r.id}>{r.fullName}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input value={responsibles.find(r => r.id === userId)?.fullName ?? ""} disabled />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Способ оплаты</Label>
            <Select value={preferredPayMethod} onValueChange={(v) => setPreferredPayMethod(v ?? "")}>
              <SelectTrigger><SelectValue>{preferredPayMethod || "—"}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="">—</SelectItem>
                {PREFERRED_PAY_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Сумма к выплате *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Выплата (факт)</Label>
            <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="= сумма по умолчанию" />
          </div>
          <div className="space-y-1.5">
            <Label>Дата оплаты — план</Label>
            <DateInput value={plannedPayAt} onChange={setPlannedPayAt} />
          </div>
          <div className="space-y-1.5">
            <Label>Дата оплаты (факт)</Label>
            <DateInput value={paidAt} onChange={setPaidAt} />
          </div>
          <div className="space-y-1.5">
            <Label>Источник оплаты</Label>
            <Select value={bankAccountId} onValueChange={(v) => setBankAccountId(v ?? "")}>
              <SelectTrigger><SelectValue>{bankAccounts.find(b => b.id === bankAccountId)?.name ?? "—"}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="">—</SelectItem>
                {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Комментарий</Label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} />
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
