"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-custom/DateInput";
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
  Table, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BulkSelectTableBody } from "@/components/ui-custom/BulkSelectTableBody";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { WORK_STATUSES, PAYMENT_STATUSES } from "@/lib/statuses";
import { formatMoney, formatMoneyRub, formatDate, formatDateShort, MONTHS } from "@/lib/format";
import { getISOWeek, weekLabel, nearestPaymentDate, toLocalDateString } from "@/lib/iso-weeks";
import { cn } from "@/lib/utils";
import { RowSelectCheckbox } from "@/components/ui-custom/RowSelectCheckbox";
import { useTableRowSelection } from "@/lib/useTableRowSelection";
import { ExpandableListCell } from "@/components/ui-custom/ExpandableListCell";
import { stickyActionsHead, stickyActionsCell } from "@/lib/table-styles";

const compactPeriodHead =
  "text-[10px] leading-tight font-medium whitespace-normal normal-case align-bottom";
const compactHead =
  "text-[10px] leading-tight font-medium whitespace-normal normal-case align-bottom";
/** Ширины колонок (19) — table-fixed, иначе правые колонки сжимаются и наезжают друг на друга */
const ACTIONS_COL_WIDTH = 96;
const COL_WIDTHS = [
  36, 72, 84, 64, 168, 128, 180, 100, 108, 92, 88, 80, 108, 108, 88, 80, 104, 120, ACTIONS_COL_WIDTH,
] as const;
const TABLE_MIN_WIDTH = COL_WIDTHS.reduce((s, w) => s + w, 0);
const cellClip = "overflow-hidden max-w-0";

function EditableColHead({
  children,
  className,
  showPencil,
}: {
  children: React.ReactNode;
  className?: string;
  showPencil?: boolean;
}) {
  return (
    <TableHead className={className}>
      <span className="inline-flex items-center gap-1">
        {children}
        {showPencil && <Pencil className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />}
      </span>
    </TableHead>
  );
}

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
  const [bulkWorkStatus, setBulkWorkStatus] = useState("");
  const [bulkPlannedPayAt, setBulkPlannedPayAt] = useState("");
  const [bulkPaidAt, setBulkPaidAt] = useState("");
  const [bulkBankId, setBulkBankId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<{ rowId: string; field: "plannedPayAt" | "paidAt" } | null>(null);
  const [inlineVal, setInlineVal] = useState("");

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
    if (row.workStatus === "paid") return false;
    if (row.paymentStatus === "sent" || row.paymentStatus === "paid") return false;
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

  const orderedRowIds = React.useMemo(() => filtered.map((r) => r.id), [filtered]);
  const { selectedIds, handleRowSelect, toggleAll, clearSelection } = useTableRowSelection(orderedRowIds);

  async function patchRow(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/other-expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const d = await readApiJson<{ error?: string }>(res);
      throw new Error(d.error ?? "Ошибка");
    }
    const updated = await readApiJson<OtherExpense>(res);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    return updated;
  }

  function startInline(row: OtherExpense, field: "plannedPayAt" | "paidAt") {
    if (field === "plannedPayAt" && !row.paymentStatus) return;
    if (field === "paidAt" && !row.paymentStatus) return;
    if (!isAdmin) return;
    setInlineEdit({ rowId: row.id, field });
    if (field === "paidAt") {
      setInlineVal(row.paidAt ? row.paidAt.slice(0, 10) : toLocalDateString(new Date()));
    } else {
      setInlineVal(row.plannedPayAt ? row.plannedPayAt.slice(0, 10) : "");
    }
  }

  async function commitInline(row: OtherExpense) {
    if (!inlineEdit || inlineEdit.rowId !== row.id) return;
    const patch: Record<string, unknown> = {};
    if (inlineEdit.field === "paidAt") {
      patch.paidAt = inlineVal ? new Date(inlineVal).toISOString() : null;
    } else {
      patch.plannedPayAt = inlineVal ? new Date(inlineVal).toISOString() : null;
    }
    try {
      await patchRow(row.id, patch);
      setInlineEdit(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
      silentLoad();
    }
  }

  function renderPlanDateCell(row: OtherExpense) {
    const editing = inlineEdit?.rowId === row.id && inlineEdit.field === "plannedPayAt";
    if (!row.paymentStatus) {
      return <span className="text-neutral-300">—</span>;
    }
    if (editing) {
      return (
        <input
          autoFocus
          type="date"
          value={inlineVal}
          onChange={(e) => setInlineVal(e.target.value)}
          onBlur={() => commitInline(row)}
          onClick={(e) => { try { (e.target as HTMLInputElement).showPicker(); } catch { /**/ } }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitInline(row);
            if (e.key === "Escape") setInlineEdit(null);
          }}
          className="w-full h-6 rounded border border-blue-300 px-1 text-xs bg-blue-50 focus:outline-none cursor-pointer"
        />
      );
    }
    return (
      <button
        type="button"
        className="text-xs text-neutral-600 hover:text-blue-700 hover:underline"
        onClick={() => startInline(row, "plannedPayAt")}
      >
        {formatDateShort(row.plannedPayAt)}
      </button>
    );
  }

  async function handleCheck(row: OtherExpense) {
    setCheckTarget(null);
    const plannedIso = nearestPaymentDate().toISOString();
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              workStatus: "checked",
              checkedAt: new Date().toISOString(),
              paymentStatus: "planned",
              paymentAmount: r.amount,
              plannedPayAt: plannedIso,
            }
          : r
      )
    );
    try {
      const res = await fetch(`/api/other-expenses/${row.id}/check`, { method: "POST" });
      if (!res.ok) { const d = await readApiJson<{ error?: string }>(res); throw new Error(d.error ?? "Ошибка"); }
      const updated = await readApiJson<OtherExpense>(res);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      toast.success("Работа проверена, выплата создана");
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
    clearSelection();
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
    <div className="flex flex-col gap-4 h-[calc(100vh-3rem)] min-h-0">
      <PageHeader title="Прочие траты" />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
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
            popoverClassName="w-auto min-w-72 max-w-lg"
            optionLabelClassName="whitespace-normal"
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
          <span className="text-xs tabular-nums font-semibold text-neutral-700">{formatMoneyRub(selectedSum)}</span>
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
            <DateInput className="h-7 text-xs w-36" value={bulkPlannedPayAt} onChange={(e) => setBulkPlannedPayAt(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">Дата оплаты:</span>
            <DateInput className="h-7 text-xs w-36" value={bulkPaidAt} onChange={(e) => setBulkPaidAt(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">Источник перевода:</span>
            <Select value={bulkBankId || "__none__"} onValueChange={(v) => setBulkBankId(v === "__none__" ? "" : (v ?? ""))}>
              <SelectTrigger className="h-7 w-44 text-xs">
                <SelectValue>{bulkBankId ? (bankAccounts.find(b => b.id === bulkBankId)?.name ?? "") : "— не менять —"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— не менять —</SelectItem>
                {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-7 text-xs" onClick={handleBulkApply} disabled={bulkSaving}>
            {bulkSaving ? "..." : "Применить"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { clearSelection(); setBulkWorkStatus(""); setBulkPlannedPayAt(""); setBulkPaidAt(""); setBulkBankId(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center gap-4 px-1 py-1 text-xs text-neutral-500 shrink-0">
          <span>{filtered.length} записей</span>
          <span className="text-xs font-medium tabular-nums text-neutral-800">
            {formatMoneyRub(filtered.reduce((s, r) => s + (r.amount ?? 0), 0))}
          </span>
        </div>
      )}

      <Table
        className="table-fixed w-full"
        style={{ minWidth: TABLE_MIN_WIDTH }}
        containerClassName="rounded-md border bg-white flex-1 min-h-0 min-w-0 overflow-auto"
      >
          <colgroup>
            {COL_WIDTHS.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={() => toggleAll(orderedRowIds)} />
              </TableHead>
              <TableHead className={compactPeriodHead}>Год выполнения</TableHead>
              <TableHead className={compactPeriodHead}>Месяц выполнения</TableHead>
              <TableHead className={compactPeriodHead}>Неделя оплаты</TableHead>
              <TableHead className={compactHead}>Проект</TableHead>
              <TableHead className={compactHead}>Исполнитель</TableHead>
              <TableHead className={compactHead}>Описание работы</TableHead>
              <TableHead className={compactHead}>Вид работ</TableHead>
              <TableHead className={compactHead}>Ответственный</TableHead>
              <TableHead className={compactHead}>Способ оплаты</TableHead>
              <TableHead className={compactHead}>Дата план (работа)</TableHead>
              <TableHead className={cn(compactHead, "text-right")}>Сумма</TableHead>
              <TableHead className={compactHead}>Статус работы</TableHead>
              <TableHead className={compactHead}>Статус выплаты</TableHead>
              <TableHead className={compactHead}>Дата план (выплата)</TableHead>
              <TableHead className={cn(compactHead, "text-right")}>Выплата</TableHead>
              <EditableColHead className={compactHead} showPencil={isAdmin}>
                Дата оплаты факт
              </EditableColHead>
              <TableHead className={compactHead}>Источник перевода</TableHead>
              <TableHead className={stickyActionsHead} />
            </TableRow>
          </TableHeader>
          <BulkSelectTableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={19} className="text-center text-neutral-500 py-8">Загрузка...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={19} className="text-center text-neutral-500 py-8">Нет данных</TableCell>
              </TableRow>
            ) : filtered.map((row, rowIndex) => (
              <TableRow key={row.id} className={selectedIds.has(row.id) ? "bg-blue-50" : ""}>
                <TableCell>
                  <RowSelectCheckbox
                    checked={selectedIds.has(row.id)}
                    rowIndex={rowIndex}
                    rowId={row.id}
                    onSelect={handleRowSelect}
                  />
                </TableCell>
                <TableCell>{row.executionYear}</TableCell>
                <TableCell className="whitespace-nowrap">{MONTHS.find(m => m.value === String(row.executionMonth))?.label ?? row.executionMonth}</TableCell>
                <TableCell>{payWeek(row.plannedPayAt, row.paidAt)}</TableCell>
                <TableCell className={cn(cellClip, "whitespace-normal")}>
                  <ExpandableListCell items={[row.project.name]} />
                </TableCell>
                <TableCell className={cn(cellClip, "whitespace-normal")}>
                  <ExpandableListCell items={[row.executor.name]} />
                </TableCell>
                <TableCell className={cn(cellClip, "whitespace-normal")}>
                  <ExpandableListCell items={row.description ? [row.description] : []} />
                </TableCell>
                <TableCell className={cn(cellClip, "whitespace-normal")}>
                  <ExpandableListCell items={[row.workType.name]} />
                </TableCell>
                <TableCell className={cn(cellClip, "whitespace-normal")}>
                  <ExpandableListCell items={[row.responsibleUser.fullName]} />
                </TableCell>
                <TableCell className={cn(cellClip, "whitespace-normal")}>
                  {row.preferredPayMethod ? (
                    <ExpandableListCell items={[row.preferredPayMethod]} />
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </TableCell>
                <TableCell className={cn(cellClip, "whitespace-nowrap")}>
                  {renderPlanDateCell(row)}
                </TableCell>
                <TableCell className={cn(cellClip, "text-right tabular-nums font-semibold whitespace-nowrap")}>
                  {formatMoney(row.amount)}
                </TableCell>
                <TableCell className={cellClip}>
                  <div className="w-full overflow-hidden">
                    <StatusBadge dict={WORK_STATUSES} value={row.workStatus} />
                  </div>
                </TableCell>
                <TableCell className={cellClip}>
                  <div className="w-full overflow-hidden">
                    {row.paymentStatus ? (
                      <StatusBadge dict={PAYMENT_STATUSES} value={row.paymentStatus} />
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className={cn(cellClip, "whitespace-nowrap")}>
                  {renderPlanDateCell(row)}
                </TableCell>
                <TableCell className={cn(cellClip, "text-right tabular-nums whitespace-nowrap")}>
                  {row.paymentAmount != null ? formatMoney(row.paymentAmount) : "—"}
                </TableCell>
                <TableCell className={cn(cellClip, "whitespace-nowrap")}>
                  {inlineEdit?.rowId === row.id && inlineEdit.field === "paidAt" ? (
                    <input
                      autoFocus
                      type="date"
                      value={inlineVal}
                      onChange={(e) => setInlineVal(e.target.value)}
                      onBlur={() => commitInline(row)}
                      onClick={(e) => { try { (e.target as HTMLInputElement).showPicker(); } catch { /**/ } }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitInline(row);
                        if (e.key === "Escape") setInlineEdit(null);
                      }}
                      className="w-full h-6 rounded border border-blue-300 px-1 text-xs bg-blue-50 focus:outline-none cursor-pointer"
                    />
                  ) : row.paymentStatus && isAdmin ? (
                    <button
                      type="button"
                      className="text-xs text-neutral-600 hover:text-blue-700 hover:underline"
                      title="Указать дату оплаты"
                      onClick={() => startInline(row, "paidAt")}
                    >
                      {row.paidAt ? formatDateShort(row.paidAt) : "—"}
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-600">
                      {row.paidAt ? formatDateShort(row.paidAt) : "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell className={cn(cellClip, "whitespace-normal pr-1")}>
                  <ExpandableListCell items={row.bankAccount?.name ? [row.bankAccount.name] : []} />
                </TableCell>
                <TableCell
                  className={cn(
                    stickyActionsCell,
                    "min-w-[96px] w-[96px]",
                    selectedIds.has(row.id) && "bg-blue-50"
                  )}
                >
                  <div className="flex shrink-0 gap-0.5 items-center justify-end">
                    {isAdmin && !row.paymentStatus && row.workStatus === "submitted" && (
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
          </BulkSelectTableBody>
        </Table>

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
  const [executorWorkTypeIds, setExecutorWorkTypeIds] = useState<string[] | null>(null);

  // Load work type IDs for selected executor
  React.useEffect(() => {
    if (!executorId) { setExecutorWorkTypeIds(null); return; }
    fetch(`/api/executors/${executorId}/work-type-ids`)
      .then(r => r.json())
      .then((ids: string[]) => { setExecutorWorkTypeIds(ids); })
      .catch(() => setExecutorWorkTypeIds(null));
  }, [executorId]);

  const filteredWorkTypes = React.useMemo(() => {
    if (!executorId) return [];
    if (executorWorkTypeIds) return workTypes.filter(w => executorWorkTypeIds.includes(w.id));
    return workTypes;
  }, [executorId, executorWorkTypeIds, workTypes]);
  // PM (его user.id есть в списке ответственных) фиксируется на себе.
  // Постоянный исполнитель ответственным не является — выбирает его сам, как админ.
  const isResponsibleSelf = responsibles.some(r => r.id === userId);
  const canChooseResponsible = isAdmin || !isResponsibleSelf;
  const [responsibleUserId, setResponsibleUserId] = useState(
    initial?.responsibleUserId ?? (canChooseResponsible ? "" : userId)
  );
  const [bankAccountId, setBankAccountId] = useState(initial?.bankAccountId ?? "");
  const [year, setYear] = useState(String(initial?.executionYear ?? now.getFullYear()));
  const [month, setMonth] = useState(String(initial?.executionMonth ?? now.getMonth() + 1));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [preferredPayMethod, setPreferredPayMethod] = useState(initial?.preferredPayMethod ?? "");
  const [plannedPayAt, setPlannedPayAt] = useState(initial?.plannedPayAt ? new Date(initial.plannedPayAt).toISOString().slice(0, 10) : "");
  const [workStatus, setWorkStatus] = useState(initial?.workStatus ?? "submitted");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saving, setSaving] = useState(false);

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const isEdit = !!initial;
  const paymentCreated = !!initial?.paymentStatus;

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
          projectId,
          executorId,
          workTypeId, responsibleUserId,
          ...(isEdit ? { bankAccountId: bankAccountId || null } : {}),
          executionYear: parseInt(year),
          executionMonth: parseInt(month),
          description,
          amount: parseFloat(amount),
          preferredPayMethod: preferredPayMethod || null,
          ...(paymentCreated ? { plannedPayAt: plannedPayAt || null } : {}),
          workStatus: paymentCreated ? undefined : (workStatus || "submitted"),
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
              <SelectContent className="max-w-lg">
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id} className="whitespace-normal">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Исполнитель *</Label>
            <Select
              value={executorId}
              onValueChange={(v) => {
                setExecutorId(v ?? "");
                setWorkTypeId("");
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  {executors.find(e => e.id === executorId)?.name ?? "Выберите"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
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
                    {executorId ? "Нет видов работ у исполнителя" : "Сначала выберите исполнителя"}
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
            {canChooseResponsible ? (
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
          {paymentCreated && (
            <div className="space-y-1.5">
              <Label>Дата оплаты — план</Label>
              <DateInput className="h-9" value={plannedPayAt} onChange={(e) => setPlannedPayAt(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Статус работы</Label>
            {paymentCreated ? (
              <Input
                value={WORK_STATUSES[workStatus as keyof typeof WORK_STATUSES]?.label ?? workStatus}
                disabled
                className="h-9"
              />
            ) : (
              <Select value={workStatus || "__none__"} onValueChange={(v) => setWorkStatus(v === "__none__" ? "" : (v ?? ""))}>
                <SelectTrigger>
                  <SelectValue>{workStatus ? (WORK_STATUSES[workStatus as keyof typeof WORK_STATUSES]?.label ?? workStatus) : "— По умолчанию —"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— По умолчанию —</SelectItem>
                  {Object.entries(WORK_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Источник перевода</Label>
              <Select value={bankAccountId} onValueChange={(v) => setBankAccountId(v ?? "")}>
                <SelectTrigger><SelectValue>{bankAccounts.find(b => b.id === bankAccountId)?.name ?? "—"}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
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
