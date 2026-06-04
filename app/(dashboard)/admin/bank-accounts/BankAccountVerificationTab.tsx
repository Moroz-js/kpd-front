"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  amount: number | null;
  comment: string | null;
};

type Reconciliation = {
  id: string;
  date: string;
  createdAt: string;
  totalAccounts: number;
  filledAccounts: number;
  progressPct: number;
  results: ReconciliationResult[];
};

function isAmountFilled(amount: number | null): boolean {
  return amount !== null && Number.isFinite(amount);
}

function parseAmountInput(val: string): number | null {
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
  });
}

function formatRuDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const RECON_COL = "w-[108px] min-w-[108px] max-w-[108px] px-1.5 border-r last:border-r-0";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
            ref={textareaRef}
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

function AmountCell({
  reconciliationId,
  bankAccountId,
  amount,
  onSave,
}: {
  reconciliationId: string;
  bankAccountId: string;
  amount: number | null;
  onSave: (reconciliationId: string, bankAccountId: string, amount: number | null) => void;
}) {
  const [value, setValue] = useState(amount === null ? "" : String(amount));

  useEffect(() => {
    setValue(amount === null ? "" : String(amount));
  }, [amount]);

  function commit() {
    const parsed = parseAmountInput(value);
    const same =
      (parsed === null && amount === null) ||
      (parsed !== null && amount !== null && parsed === amount);
    if (same) return;
    onSave(reconciliationId, bankAccountId, parsed);
  }

  return (
    <Input
      type="number"
      step="0.01"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`h-7 w-[72px] text-xs px-1.5 tabular-nums ${
        isAmountFilled(amount) ? "border-neutral-300" : "border-neutral-200"
      }`}
      placeholder="—"
    />
  );
}

function CreateReconciliationDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!date) {
      toast.error("Укажите дату");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/bank-account-reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!r.ok) throw new Error();
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
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

  function updateProgress(results: ReconciliationResult[], total: number) {
    const filled = results.filter((r) => isAmountFilled(r.amount)).length;
    return {
      filledAccounts: filled,
      progressPct: total === 0 ? 0 : Math.round((filled / total) * 100),
    };
  }

  async function handleAmount(
    reconciliationId: string,
    bankAccountId: string,
    amount: number | null
  ) {
    setReconciliations((prev) =>
      prev.map((v) => {
        if (v.id !== reconciliationId) return v;
        const newResults = v.results.map((r) =>
          r.bankAccountId === bankAccountId ? { ...r, amount } : r
        );
        const prog = updateProgress(newResults, v.totalAccounts);
        return { ...v, results: newResults, ...prog };
      })
    );

    try {
      const r = await fetch(
        `/api/bank-account-reconciliations/${reconciliationId}/results/${bankAccountId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        }
      );
      if (!r.ok) throw new Error();
    } catch {
      load();
      toast.error("Не удалось обновить сумму");
    }
  }

  async function handleComment(
    reconciliationId: string,
    bankAccountId: string,
    comment: string
  ) {
    setReconciliations((prev) =>
      prev.map((v) => {
        if (v.id !== reconciliationId) return v;
        return {
          ...v,
          results: v.results.map((r) =>
            r.bankAccountId === bankAccountId ? { ...r, comment: comment || null } : r
          ),
        };
      })
    );

    try {
      const r = await fetch(
        `/api/bank-account-reconciliations/${reconciliationId}/results/${bankAccountId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: comment || null }),
        }
      );
      if (!r.ok) throw new Error();
    } catch {
      load();
      toast.error("Не удалось сохранить комментарий");
    }
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
        <div className="text-sm text-neutral-500 text-center py-12 space-y-3">
          <p>Остатков пока нет. Создайте первую запись по дате.</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Создать остатки
          </Button>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-neutral-200 flex-1 min-h-0">
          <table className="border-collapse text-xs w-max">
            <thead>
              <tr className="bg-neutral-50">
                <th className="sticky left-0 z-20 bg-neutral-50 border-b border-r border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 uppercase tracking-wide min-w-[220px]">
                  Счёт
                </th>
                {reconciliations.map((v) => (
                  <th
                    key={v.id}
                    className={`border-b border-neutral-200 py-2 text-left font-medium text-neutral-600 ${RECON_COL}`}
                  >
                    <div className="font-medium text-neutral-800 text-[11px] leading-tight">
                      {formatRuDateShort(v.date)}
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <Progress value={v.progressPct} className="h-1 min-w-0 flex-1" />
                      <span className="text-neutral-500 shrink-0 text-[10px] tabular-nums">
                        {v.filledAccounts}/{v.totalAccounts}
                      </span>
                    </div>
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(v.id)}
                        className="text-[11px] text-red-400 hover:text-red-600 flex items-center gap-0.5 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Удалить
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allAccounts.map(([bankAccountId, bankAccountName], rowIdx) => (
                <tr
                  key={bankAccountId}
                  className={rowIdx % 2 === 0 ? "bg-white" : "bg-neutral-50/50"}
                >
                  <td className="sticky left-0 z-10 border-r border-neutral-100 px-3 py-2 font-medium text-neutral-800 text-xs bg-inherit">
                    {bankAccountName}
                  </td>
                  {reconciliations.map((v) => {
                    const result = lookup.get(v.id)?.get(bankAccountId);
                    return (
                      <td key={v.id} className={`border-neutral-100 py-1.5 ${RECON_COL}`}>
                        {result ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <AmountCell
                              reconciliationId={v.id}
                              bankAccountId={bankAccountId}
                              amount={result.amount}
                              onSave={handleAmount}
                            />
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
                    );
                  })}
                </tr>
              ))}
              {allAccounts.length === 0 && (
                <tr>
                  <td
                    colSpan={reconciliations.length + 1}
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
