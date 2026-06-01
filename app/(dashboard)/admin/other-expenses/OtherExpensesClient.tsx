"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { WORK_STATUSES, PAYMENT_STATUSES } from "@/lib/statuses";
import { formatMoney, formatDate, formatDateShort, MONTHS } from "@/lib/format";
import { getISOWeek, weekLabel } from "@/lib/iso-weeks";
import { nearestPaymentDate, toLocalDateString } from "@/lib/iso-weeks";

// ─── Константы ────────────────────────────────────────────────────────────────

const PREFERRED_PAY_METHODS = [
  "З/П", "Крипта", "Самозанятый", "ИП", "Карта физлица РФ",
  "Карта физлица другой страны", "Р/С контрагента РФ", "Р/С контрагента КЗ",
  "Р/С контрагента ЧГ", "Р/С контрагента ЕС", "Бизнес-картой РФ",
  "Бизнес-картой КЗ", "Бизнес-картой ЧГ", "Бизнес-картой СЛ", "4DEV", "ГПХ",
];

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
  paymentStatus: string | null;
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

// ─── Утилиты ──────────────────────────────────────────────────────────────────

export function OtherExpensesClient({ isAdmin, userId, projects, executors, workTypes, responsibles, bankAccounts }: Props) {
  const [rows, setRows] = useState<OtherExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OtherExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OtherExpense | null>(null);
  const [checkTarget, setCheckTarget] = useState<OtherExpense | null>(null);

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWorkStatus, setBulkWorkStatus] = useState("");
  const [bulkPlannedPayAt, setBulkPlannedPayAt] = useState("");
  const [bulkPaidAt, setBulkPaidAt] = useState("");
  const [bulkBankId, setBulkBankId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Фильтры
  const [fYear, setFYear] = useState<string[]>([]);
  const [fMonth, setFMonth] = useState<string[]>([]);
  const [fProject, setFProject] = useState<string[]>([]);
  const [fExecutor, setFExecutor] = useState<string[]>([]);
  const [fWorkType, setFWorkType] = useState<string[]>([]);
  const [fResponsible, setFResponsible] = useState<string[]>([]);
  const [fWorkStatus, setFWorkStatus] = useState<string[]>([]);
  const [fPayStatus, setFPayStatus] = useState<string[]>([]);

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
    if (fYear.length && !fYear.includes(String(r.executionYear))) return false;
    if (fMonth.length && !fMonth.includes(String(r.executionMonth))) return false;
    if (fProject.length && !fProject.includes(r.projectId)) return false;
    if (fExecutor.length && !fExecutor.includes(r.executorId)) return false;
    if (fWorkType.length && !fWorkType.includes(r.workTypeId)) return false;
    if (fResponsible.length && !fResponsible.includes(r.responsibleUserId)) return false;
    if (fWorkStatus.length && !fWorkStatus.includes(r.workStatus)) return false;
    if (fPayStatus.length && !fPayStatus.includes(r.paymentStatus ?? "__empty__")) return false;
    return true;
  });

  async function handleCheck(row: OtherExpense) {
    setCheckTarget(null);
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, workStatus: "checked", checkedAt: new Date().toISOString(), paymentStatus: "planned" } : r));
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

  function toggleRow(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(r => r.id)));
  }

  async function handleBulkApply() {
    const ids = Array.from(selectedIds);
    const patch: Record<string, unknown> = {};
    if (bulkWorkStatus) patch.workStatus = bulkWorkStatus;
    if (bulkPlannedPayAt) patch.plannedPayAt = new Date(bulkPlannedPayAt).toISOString();
    if (bulkPaidAt) patch.paidAt = new Date(bulkPaidAt).toISOString();
    if (bulkBankId && bulkBankId !== "__none__") patch.bankAccountId = bulkBankId;
    if (Object.keys(patch).length === 0) return toast.error("Выберите хотя бы одно поле");
    setBulkSaving(true);
    const res = await fetch("/api/other-expenses/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, patch }),
    });
    setBulkSaving(false);
    if (!res.ok) return toast.error("Ошибка массового обновления");
    const { updated } = await res.json() as { updated: number };
    toast.success(`Обновлено ${updated} записей`);
    setSelectedIds(new Set());
    setBulkWorkStatus(""); setBulkPlannedPayAt(""); setBulkPaidAt(""); setBulkBankId("");
    silentLoad();
  }

  const th = "border border-neutral-200 px-2 py-1.5 text-left font-medium text-neutral-600 bg-neutral-50 text-xs whitespace-nowrap";
  const thr = th + " text-right";
  const td = "border border-neutral-200 px-2 py-1.5 text-xs";
  const tdr = td + " text-right";

  const workTypeOpts = React.useMemo(() => {
    const map = new Map<string, { label: string; group: string }>();
    for (const r of rows) {
      if (!map.has(r.workTypeId)) {
        map.set(r.workTypeId, { label: r.workType.name, group: r.workType.segment ?? "" });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) =>
        (a[1].group ?? "").localeCompare(b[1].group ?? "", "ru") ||
        a[1].label.localeCompare(b[1].label, "ru")
      )
      .map(([value, { label, group }]) => ({ value, label, group }));
  }, [rows]);

  const selectedSum = React.useMemo(() => {
    return filtered.filter(r => selectedIds.has(r.id)).reduce((s, r) => s + (r.amount ?? 0), 0);
  }, [filtered, selectedIds]);

  function payWeek(plannedPayAt: string | null, paidAt: string | null): string {
    const d = paidAt ?? plannedPayAt;
    if (!d) return "—";
    return weekLabel(getISOWeek(new Date(d)));
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Новая трата
        </Button>

        <div className="ml-auto flex flex-wrap gap-2">
          {/* Фильтры */}
          <MultiSelectFilter
            label="Год"
            options={allYears.map(y => ({ value: String(y), label: `${y} год` }))}
            value={fYear}
            onChange={setFYear}
          />
          <MultiSelectFilter
            label="Месяц"
            options={MONTHS.map(m => ({ value: m.value, label: m.label }))}
            value={fMonth}
            onChange={setFMonth}
          />
          <MultiSelectFilter
            label="Проект"
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            value={fProject}
            onChange={setFProject}
          />
          <MultiSelectFilter
            label="Исполнитель"
            options={executors.map(e => ({ value: e.id, label: e.name }))}
            value={fExecutor}
            onChange={setFExecutor}
          />
          <MultiSelectFilter
            label="Вид работ"
            options={workTypeOpts}
            value={fWorkType}
            onChange={setFWorkType}
          />
          <MultiSelectFilter
            label="Ответственный"
            options={responsibles.map(r => ({ value: r.id, label: r.fullName }))}
            value={fResponsible}
            onChange={setFResponsible}
          />
          <MultiSelectFilter
            label="Статус работы"
            options={Object.entries(WORK_STATUSES).map(([v, { label: l }]) => ({ value: v, label: l }))}
            value={fWorkStatus}
            onChange={setFWorkStatus}
          />
          <MultiSelectFilter
            label="Статус выплаты"
            options={[{ value: "__empty__", label: "Пусто" }, ...Object.entries(PAYMENT_STATUSES).map(([v, { label: l }]) => ({ value: v, label: l }))]}
            value={fPayStatus}
            onChange={setFPayStatus}
          />
        </div>
      </div>

      {/* Bulk toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
          <span className="text-xs font-medium text-blue-700">{selectedIds.size} выбрано</span>
          <span className="text-xs tabular-nums font-semibold text-neutral-700">{formatMoney(selectedSum)}</span>
          <Select value={bulkWorkStatus} onValueChange={(v) => v && setBulkWorkStatus(v)}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue>{bulkWorkStatus ? (WORK_STATUSES[bulkWorkStatus as keyof typeof WORK_STATUSES]?.label ?? "Статус работы") : "Статус работы"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(WORK_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
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
              <SelectValue>{bulkBankId ? (bankAccounts.find(b => b.id === bulkBankId)?.name ?? "Источник оплаты") : "— не менять —"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— не менять —</SelectItem>
              {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs" onClick={handleBulkApply} disabled={bulkSaving}>
            {bulkSaving ? "..." : "Применить"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setSelectedIds(new Set()); setBulkWorkStatus(""); setBulkPlannedPayAt(""); setBulkPaidAt(""); setBulkBankId(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center gap-4 px-1 py-1 text-xs text-neutral-500">
          <span>{filtered.length} записей</span>
          <span className="text-neutral-800 font-semibold tabular-nums">
            {formatMoney(filtered.reduce((s, r) => s + (r.amount ?? 0), 0))}
          </span>
        </div>
      )}

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table className="min-w-[1600px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Год</TableHead>
              <TableHead>Месяц</TableHead>
              <TableHead>Неделя оплаты</TableHead>
              <TableHead>Проект</TableHead>
              <TableHead>Исполнитель</TableHead>
              <TableHead className="min-w-[200px]">Описание работы</TableHead>
              <TableHead>Вид работ</TableHead>
              <TableHead>Ответственный</TableHead>
              <TableHead>Способ оплаты</TableHead>
              <TableHead>Дата оплаты план</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead>Статус работы</TableHead>
              <TableHead>Статус выплаты</TableHead>
              <TableHead className="text-right">Выплата</TableHead>
              <TableHead>Дата оплаты факт</TableHead>
              <TableHead>Счёт</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={18} className="text-center text-neutral-500 py-8">Загрузка...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={18} className="text-center text-neutral-500 py-8">Нет данных</TableCell>
              </TableRow>
            ) : filtered.map((row) => (
              <TableRow key={row.id} className={selectedIds.has(row.id) ? "bg-blue-50" : ""}>
                <TableCell>
                  <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleRow(row.id)} />
                </TableCell>
                <TableCell>{row.executionYear}</TableCell>
                <TableCell className="whitespace-nowrap">{MONTHS.find(m => m.value === String(row.executionMonth))?.label ?? row.executionMonth}</TableCell>
                <TableCell>{payWeek(row.plannedPayAt, row.paidAt)}</TableCell>
                <TableCell className="max-w-[120px] truncate" title={row.project.name}>{row.project.name}</TableCell>
                <TableCell className="whitespace-nowrap">{row.executor.name}</TableCell>
                <TableCell className="max-w-[200px]"><div className="truncate" title={row.description}>{row.description}</div></TableCell>
                <TableCell>{row.workType.name}</TableCell>
                <TableCell className="whitespace-nowrap">{row.responsibleUser.fullName}</TableCell>
                <TableCell>{row.preferredPayMethod ?? "—"}</TableCell>
                <TableCell>{formatDateShort(row.plannedPayAt)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatMoney(row.amount)}</TableCell>
                <TableCell><StatusBadge dict={WORK_STATUSES} value={row.workStatus} /></TableCell>
                <TableCell>
                  {row.paymentStatus
                    ? <StatusBadge dict={PAYMENT_STATUSES} value={row.paymentStatus} />
                    : <span className="text-neutral-300">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.paymentAmount != null ? formatMoney(row.paymentAmount) : "—"}</TableCell>
                <TableCell>{formatDateShort(row.paidAt)}</TableCell>
                <TableCell>{row.bankAccount?.name ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1 items-center">
                    {isAdmin && row.workStatus !== "checked" && row.workStatus !== "paid" && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Проверить" onClick={() => setCheckTarget(row)}>
                        <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                      </Button>
                    )}
                    {canEdit(row) && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Редактировать" onClick={() => setEditTarget(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit(row) && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Удалить" onClick={() => setDeleteTarget(row)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
  const [executorId, setExecutorId] = useState(initial?.executorId ?? "__unselected__");
  const [workTypeId, setWorkTypeId] = useState(initial?.workTypeId ?? "");
  const [executorWorkTypeIds, setExecutorWorkTypeIds] = useState<string[] | null>(null);

  // Load work type IDs for selected executor
  React.useEffect(() => {
    if (!executorId || executorId === "__unselected__") { setExecutorWorkTypeIds(null); return; }
    fetch(`/api/executors/${executorId}/work-type-ids`)
      .then(r => r.json())
      .then((ids: string[]) => { setExecutorWorkTypeIds(ids); })
      .catch(() => setExecutorWorkTypeIds(null));
  }, [executorId]);

  const filteredWorkTypes = React.useMemo(() => {
    if (!executorId || executorId === "") return [];
    if (executorId === "__unselected__") return workTypes;
    if (executorWorkTypeIds) return workTypes.filter(w => executorWorkTypeIds.includes(w.id));
    return workTypes;
  }, [executorId, executorWorkTypeIds, workTypes]);
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
  const [workStatus, setWorkStatus] = useState(initial?.workStatus ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saving, setSaving] = useState(false);

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const isEdit = !!initial;

  async function handleSave() {
    if (!projectId || !workTypeId || !responsibleUserId || !description || !amount) {
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
          projectId,
          executorId: executorId === "__unselected__" ? null : executorId,
          workTypeId, responsibleUserId,
          bankAccountId: bankAccountId || null,
          executionYear: parseInt(year),
          executionMonth: parseInt(month),
          description,
          amount: parseFloat(amount),
          paymentAmount: paymentAmount ? parseFloat(paymentAmount) : null,
          preferredPayMethod: preferredPayMethod || null,
          plannedPayAt: plannedPayAt || null,
          paidAt: paidAt || null,
          workStatus: workStatus || undefined,
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
        <DialogHeader><DialogTitle>{isEdit ? "Редактировать" : "Новая трата"}</DialogTitle></DialogHeader>
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
            {/* TODO: фильтровать исполнителей без личной сметы (hasPersonalEstimate: false) */}
            <Label>Исполнитель</Label>
            <Select value={executorId} onValueChange={(v) => setExecutorId(v ?? "__unselected__")}>
              <SelectTrigger>
                <SelectValue>
                  {executorId === "__unselected__" ? "Пока не выбран" : (executors.find(e => e.id === executorId)?.name ?? "Выберите")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unselected__">Пока не выбран</SelectItem>
                {executors.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Вид работ *</Label>
            <Select value={workTypeId} onValueChange={(v) => setWorkTypeId(v ?? "")} disabled={!executorId || executorId === ""}>
              <SelectTrigger>
                <SelectValue>
                  {workTypeId ? (workTypes.find(w => w.id === workTypeId)?.name ?? "Выберите") : "Выберите"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-80">
                {filteredWorkTypes.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                {filteredWorkTypes.length === 0 && (
                  <div className="px-3 py-2 text-xs text-neutral-400">
                    {executorId && executorId !== "__unselected__" ? "Нет видов работ у исполнителя" : "Сначала выберите исполнителя"}
                  </div>
                )}
              </SelectContent>
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
              <SelectContent className="w-80">
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
            <Input type="date" className="h-9" value={plannedPayAt} onChange={(e) => setPlannedPayAt(e.target.value)} />
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Дата оплаты (факт)</Label>
              <Input type="date" className="h-9" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Статус работы</Label>
            <Select value={workStatus || "__none__"} onValueChange={(v) => setWorkStatus(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue>{workStatus ? (WORK_STATUSES[workStatus as keyof typeof WORK_STATUSES]?.label ?? workStatus) : "— По умолчанию —"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— По умолчанию —</SelectItem>
                {Object.entries(WORK_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
