"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-custom/DateInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toLocalDateString } from "@/lib/iso-weeks";
import { weekLabel } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConfirmDialog } from "@/components/ui-custom/ConfirmDialog";

type ReconciliationResult = {
  bankAccountId: string;
  bankAccountName: string;
  bankAccountCurrency: string;
  foreignAmount: number | null;
  exchangeRate: number | null;
  amount: number | null;
  comment: string | null;
};

type Reconciliation = {
  id: string;
  date: string;
  isoWeek: number;
  isoWeekYear: number;
  weekLabel: string;
  createdAt: string;
  totalAccounts: number;
  filledAccounts: number;
  progressPct: number;
  results: ReconciliationResult[];
};

function isResultFilled(r: ReconciliationResult): boolean {
  if (r.bankAccountCurrency === "RUB") {
    return r.foreignAmount !== null && Number.isFinite(r.foreignAmount);
  }
  return (
    r.foreignAmount !== null &&
    Number.isFinite(r.foreignAmount) &&
    r.exchangeRate !== null &&
    Number.isFinite(r.exchangeRate)
  );
}

function parseNumber(val: string): number | null {
  const t = val.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatRuDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  });
}

function formatRuDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Moscow",
  });
}

function getClientISOWeek(dateStr: string): { isoWeek: number; isoWeekYear: number } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  // ISO week calc
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const isoWeek =
    1 +
    Math.round(
      ((tmp.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    );
  const isoWeekYear = tmp.getFullYear();
  return { isoWeek, isoWeekYear };
}

// ─── Comment cell ────────────────────────────────────────────────────────────

function CommentCell({
  reconciliationId,
  bankAccountId,
  comment,
  onSave,
}: {
  reconciliationId: string;
  bankAccountId: string;
  comment: string | null;
  onSave: (reconciliationId: string, bankAccountId: string, comment: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(comment ?? "");

  useEffect(() => {
    if (open) setValue(comment ?? "");
  }, [open, comment]);

  function handleSave() {
    onSave(reconciliationId, bankAccountId, value);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title={comment ? comment : "Добавить комментарий"}
        className={`rounded p-0.5 transition-colors border-0 bg-transparent cursor-pointer ${
          comment
            ? "text-blue-500 hover:text-blue-700"
            : "text-neutral-300 hover:text-neutral-500"
        }`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="top" align="center">
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-700">Комментарий</p>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Введите комментарий..."
            className="text-xs min-h-[72px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSave();
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
              Сохранить
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Number input cell ────────────────────────────────────────────────────────

function NumberInputCell({
  value,
  onChange,
  onCommit,
  placeholder,
  step = "1",
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  onCommit: (v: number | null) => void;
  placeholder?: string;
  step?: string;
  className?: string;
}) {
  const [local, setLocal] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setLocal(value === null ? "" : String(value));
  }, [value]);

  function commit() {
    const parsed = parseNumber(local);
    const same =
      (parsed === null && value === null) ||
      (parsed !== null && value !== null && parsed === value);
    if (same) return;
    onChange(parsed);
    onCommit(parsed);
  }

  return (
    <input
      type="number"
      step="any"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`h-6 w-[76px] text-[11px] px-1.5 tabular-nums rounded border bg-transparent outline-none focus:bg-white focus:border-blue-400 ${value !== null ? "border-neutral-300" : "border-neutral-200"} ${className ?? ""}`}
      placeholder={placeholder ?? "—"}
    />
  );
}

// ─── Editable date header ─────────────────────────────────────────────────────

function EditableDateHeader({
  reconciliation,
  existingWeeks,
  onDateChange,
}: {
  reconciliation: Reconciliation;
  existingWeeks: Array<{ isoWeek: number; isoWeekYear: number; id: string }>;
  onDateChange: (id: string, newDate: string, isoWeek: number, isoWeekYear: number, newWeekLabel: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dateVal, setDateVal] = useState(reconciliation.date.slice(0, 10));
  const [saving, setSaving] = useState(false);

  const weekInfo = useMemo(() => getClientISOWeek(dateVal), [dateVal]);

  const conflict = useMemo(() => {
    if (!weekInfo) return false;
    return existingWeeks.some(
      (w) =>
        w.id !== reconciliation.id &&
        w.isoWeek === weekInfo.isoWeek &&
        w.isoWeekYear === weekInfo.isoWeekYear
    );
  }, [weekInfo, existingWeeks, reconciliation.id]);

  async function handleSave() {
    if (!dateVal || !weekInfo || conflict) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/bank-account-reconciliations/${reconciliation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateVal }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast.error(err.error ?? "Не удалось изменить дату");
        return;
      }
      const data = await r.json();
      onDateChange(reconciliation.id, data.date, data.isoWeek, data.isoWeekYear, data.weekLabel);
      setEditing(false);
    } catch {
      toast.error("Ошибка при изменении даты");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        title="Изменить дату"
        className="text-left w-full group"
        onClick={() => { setDateVal(reconciliation.date.slice(0, 10)); setEditing(true); }}
      >
        <div className="font-medium text-neutral-800 text-[11px] leading-tight group-hover:underline">
          {formatRuDateShort(reconciliation.date)}
        </div>
        <div className="text-[10px] text-neutral-500 mt-0.5">{reconciliation.weekLabel}</div>
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <DateInput
        value={dateVal}
        onChange={(e) => setDateVal(e.target.value)}
        className="h-6 text-[11px] px-1 w-[110px]"
        autoFocus
      />
      {weekInfo && (
        <div className={`text-[10px] ${conflict ? "text-red-600 font-medium" : "text-neutral-500"}`}>
          {weekLabel(weekInfo.isoWeek)}
          {conflict ? " — уже занята" : ""}
        </div>
      )}
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-5 text-[10px] px-1.5"
          onClick={handleSave}
          disabled={saving || conflict || !weekInfo}
        >
          {saving ? "..." : "OK"}
        </Button>
        <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => setEditing(false)}>
          ✕
        </Button>
      </div>
    </div>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateReconciliationDialog({
  existingWeeks,
  onClose,
  onCreated,
}: {
  existingWeeks: Array<{ isoWeek: number; isoWeekYear: number; id: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = toLocalDateString(new Date());
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);

  const weekInfo = useMemo(() => getClientISOWeek(date), [date]);

  const conflict = useMemo(() => {
    if (!weekInfo) return false;
    return existingWeeks.some(
      (w) => w.isoWeek === weekInfo.isoWeek && w.isoWeekYear === weekInfo.isoWeekYear
    );
  }, [weekInfo, existingWeeks]);

  async function handleSave() {
    if (!date || conflict) return;
    setSaving(true);
    try {
      const r = await fetch("/api/bank-account-reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast.error(err.error ?? "Ошибка при создании");
        return;
      }
      toast.success("Остатки созданы");
      onCreated();
    } catch {
      toast.error("Ошибка при создании");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Создать остатки</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Дата остатков *</Label>
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {weekInfo && (
            <div className={`text-sm ${conflict ? "text-red-600 font-medium" : "text-neutral-500"}`}>
              {weekLabel(weekInfo.isoWeek)} {weekInfo.isoWeekYear}
              {conflict ? " — остаток за эту неделю уже существует. Выберите другую дату." : ""}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving || conflict || !weekInfo}>
            {saving ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

const RECON_COL_FX   = "w-[116px] min-w-[116px] max-w-[116px] px-1 border-r last:border-r-0";
const RECON_COL_RATE = "w-[56px]  min-w-[56px]  max-w-[56px]  px-1 border-r last:border-r-0";
const RECON_COL_RUB  = "w-[104px] min-w-[104px] max-w-[104px] px-1 border-r last:border-r-0";
/** @deprecated use RECON_COL_* */
const RECON_SUB_COL = RECON_COL_FX;
const RECON_GROUP_COL = "min-w-[240px] border-r last:border-r-0";

export function BankAccountVerificationTab() {
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/bank-account-reconciliations");
      if (!r.ok) throw new Error();
      setReconciliations(await r.json());
    } catch {
      toast.error("Не удалось загрузить остатки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const existingWeeks = useMemo(
    () => reconciliations.map((v) => ({ id: v.id, isoWeek: v.isoWeek, isoWeekYear: v.isoWeekYear })),
    [reconciliations]
  );

  const allAccounts = useMemo(() => {
    const map = new Map<string, string>();
    reconciliations.forEach((v) => {
      v.results.forEach((r) => {
        if (!map.has(r.bankAccountId)) map.set(r.bankAccountId, r.bankAccountName);
      });
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "ru"));
  }, [reconciliations]);

  const lookup = useMemo(() => {
    const m = new Map<string, Map<string, ReconciliationResult>>();
    reconciliations.forEach((v) => {
      const inner = new Map<string, ReconciliationResult>();
      v.results.forEach((r) => inner.set(r.bankAccountId, r));
      m.set(v.id, inner);
    });
    return m;
  }, [reconciliations]);

  function updateLocalResult(
    reconciliationId: string,
    bankAccountId: string,
    patch: Partial<ReconciliationResult>
  ) {
    setReconciliations((prev) =>
      prev.map((v) => {
        if (v.id !== reconciliationId) return v;
        const newResults = v.results.map((r) =>
          r.bankAccountId === bankAccountId ? { ...r, ...patch } : r
        );
        const filled = newResults.filter(isResultFilled).length;
        const total = v.totalAccounts;
        return {
          ...v,
          results: newResults,
          filledAccounts: filled,
          progressPct: total === 0 ? 0 : Math.round((filled / total) * 100),
        };
      })
    );
  }

  async function patchResult(
    reconciliationId: string,
    bankAccountId: string,
    data: Record<string, unknown>
  ) {
    try {
      const r = await fetch(
        `/api/bank-account-reconciliations/${reconciliationId}/results/${bankAccountId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!r.ok) throw new Error();
      const resp = await r.json();
      // server returns calculated amount
      if (resp.amount !== undefined) {
        updateLocalResult(reconciliationId, bankAccountId, { amount: resp.amount });
      }
    } catch {
      load();
      toast.error("Не удалось сохранить");
    }
  }

  function handleForeignAmount(reconciliationId: string, bankAccountId: string, val: number | null) {
    const result = lookup.get(reconciliationId)?.get(bankAccountId);
    if (!result) return;
    // optimistic RUB calc
    const newAmount =
      result.bankAccountCurrency === "RUB"
        ? val
        : val != null && result.exchangeRate != null
          ? Math.round(val * result.exchangeRate * 100) / 100
          : null;
    updateLocalResult(reconciliationId, bankAccountId, { foreignAmount: val, amount: newAmount });
    patchResult(reconciliationId, bankAccountId, { foreignAmount: val });
  }

  function handleExchangeRate(reconciliationId: string, bankAccountId: string, val: number | null) {
    const result = lookup.get(reconciliationId)?.get(bankAccountId);
    if (!result) return;
    const newAmount =
      result.foreignAmount != null && val != null
        ? Math.round(result.foreignAmount * val * 100) / 100
        : null;
    updateLocalResult(reconciliationId, bankAccountId, { exchangeRate: val, amount: newAmount });
    patchResult(reconciliationId, bankAccountId, { exchangeRate: val });
  }

  function handleComment(reconciliationId: string, bankAccountId: string, comment: string) {
    updateLocalResult(reconciliationId, bankAccountId, { comment: comment || null });
    patchResult(reconciliationId, bankAccountId, { comment: comment || null });
  }

  function handleDateChange(
    id: string,
    newDate: string,
    isoWeek: number,
    isoWeekYear: number,
    newWeekLbl: string
  ) {
    setReconciliations((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, date: newDate, isoWeek, isoWeekYear, weekLabel: newWeekLbl } : v
      )
    );
  }

  async function handleDelete(reconciliationId: string) {
    try {
      const r = await fetch(`/api/bank-account-reconciliations/${reconciliationId}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error();
      toast.success("Остатки удалены");
      setConfirmDeleteId(null);
      load();
    } catch {
      toast.error("Не удалось удалить");
    }
  }

  const confirmDeleteItem = reconciliations.find((v) => v.id === confirmDeleteId);

  if (loading) {
    return <div className="text-sm text-neutral-400 text-center py-12">Загрузка...</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Создать остатки
        </Button>
      </div>

      {reconciliations.length === 0 ? (
        <div className="text-sm text-neutral-500 text-center py-12">
          <p>Остатков пока нет. Создайте первую запись по дате.</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-neutral-200 flex-1 min-h-0">
          <table className="border-collapse text-xs w-max">
            <thead>
              {/* Row 1: date groups */}
              <tr className="bg-neutral-50">
                <th
                  className="sticky left-0 z-20 bg-neutral-50 border-b border-r border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 uppercase tracking-wide min-w-[220px]"
                  rowSpan={2}
                >
                  Счёт
                </th>
                {reconciliations.map((v) => (
                  <th
                    key={v.id}
                    colSpan={3}
                    className={`border-b border-neutral-200 py-2 px-2 text-left font-medium text-neutral-600 ${RECON_GROUP_COL}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <EditableDateHeader
                        reconciliation={v}
                        existingWeeks={existingWeeks}
                        onDateChange={handleDateChange}
                      />
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1">
                          <Progress value={v.progressPct} className="h-1 w-16" />
                          <span className="text-neutral-500 text-[10px] tabular-nums">
                            {v.filledAccounts}/{v.totalAccounts}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(v.id)}
                          className="text-[11px] text-red-400 hover:text-red-600 flex items-center gap-0.5 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" /> Удалить
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
              {/* Row 2: sub-column headers */}
              <tr className="bg-neutral-50">
                {reconciliations.map((v) => {
                  const anyCurrency = v.results[0]?.bankAccountCurrency;
                  return (
                    <React.Fragment key={v.id}>
                      <th className={`border-b border-neutral-200 py-1 text-center text-[10px] font-medium text-neutral-500 ${RECON_COL_FX}`}>
                        Валюта
                      </th>
                      <th className={`border-b border-neutral-200 py-1 text-center text-[10px] font-medium text-neutral-500 ${RECON_COL_RATE}`}>
                        Курс
                      </th>
                      <th className={`border-b border-neutral-200 py-1 text-center text-[10px] font-medium text-neutral-500 ${RECON_COL_RUB}`}>
                        Руб
                      </th>
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allAccounts.map(([bankAccountId, bankAccountName], rowIdx) => (
                <tr
                  key={bankAccountId}
                  className={rowIdx % 2 === 0 ? "bg-white" : "bg-neutral-50"}
                >
                  <td className={`sticky left-0 z-10 border-r border-neutral-100 px-3 py-1.5 font-medium text-neutral-800 text-xs ${rowIdx % 2 === 0 ? "bg-white" : "bg-neutral-50"}`}>
                    {bankAccountName}
                  </td>
                  {reconciliations.map((v) => {
                    const result = lookup.get(v.id)?.get(bankAccountId);
                    const isRub = result?.bankAccountCurrency === "RUB";
                    const currency = result?.bankAccountCurrency ?? "RUB";

                    return (
                      <React.Fragment key={v.id}>
                        {/* Валюта */}
                        <td className={`py-1 ${RECON_COL_FX}`}>
                          {result ? (
                            <div className="flex items-center gap-0.5">
                              <NumberInputCell
                                value={result.foreignAmount}
                                onChange={(val) =>
                                  updateLocalResult(v.id, bankAccountId, { foreignAmount: val })
                                }
                                onCommit={(val) => handleForeignAmount(v.id, bankAccountId, val)}
                                placeholder="—"
                                className="w-[76px] text-[11px]"
                              />
                              <span className="text-[10px] text-neutral-400 font-mono shrink-0">{currency}</span>
                            </div>
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                        {/* Курс */}
                        <td className={`py-1 ${RECON_COL_RATE}`}>
                          {result ? (
                            isRub ? (
                              <Input
                                type="text"
                                value="1"
                                disabled
                                className="h-7 w-full text-[11px] px-1.5 tabular-nums border-neutral-100 bg-neutral-50 text-neutral-300 cursor-not-allowed"
                              />
                            ) : (
                              <NumberInputCell
                                value={result.exchangeRate}
                                onChange={(val) =>
                                  updateLocalResult(v.id, bankAccountId, { exchangeRate: val })
                                }
                                onCommit={(val) => handleExchangeRate(v.id, bankAccountId, val)}
                                placeholder="—"
                                className="w-full text-[11px]"
                              />
                            )
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                        {/* Руб */}
                        <td className={`py-1 ${RECON_COL_RUB}`}>
                          {result ? (
                            <div className="flex items-center gap-0.5 overflow-hidden">
                              <span
                                className={`text-[11px] tabular-nums px-1 min-w-0 flex-1 text-right truncate ${
                                  result.amount !== null ? "text-neutral-800" : "text-neutral-300"
                                }`}
                                title={result.amount !== null ? result.amount.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) : undefined}
                              >
                                {result.amount !== null
                                  ? result.amount.toLocaleString("ru-RU", { maximumFractionDigits: 0 })
                                  : "—"}
                              </span>
                              <CommentCell
                                reconciliationId={v.id}
                                bankAccountId={bankAccountId}
                                comment={result.comment}
                                onSave={handleComment}
                              />
                            </div>
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
              {allAccounts.length === 0 && (
                <tr>
                  <td
                    colSpan={reconciliations.length * 3 + 1}
                    className="px-3 py-8 text-center text-neutral-400"
                  >
                    Нет активных счетов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CreateReconciliationDialog
          existingWeeks={existingWeeks}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {confirmDeleteId && confirmDeleteItem && (
        <ConfirmDialog
          open={true}
          onOpenChange={(o) => !o && setConfirmDeleteId(null)}
          title="Удалить остатки?"
          description={`Удалить остатки за ${formatRuDate(confirmDeleteItem.date)}? Все суммы и комментарии будут потеряны.`}
          confirmLabel="Удалить"
          onConfirm={() => handleDelete(confirmDeleteId)}
          destructive
        />
      )}
    </div>
  );
}
