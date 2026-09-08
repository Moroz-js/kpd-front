"use client";

/**
 * Выбор начислений, которые закрывает пополнение.
 * Одно пополнение может закрывать несколько начислений, поэтому суммы
 * распределяются вручную: пустое поле = вся сумма начисления.
 */

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { CHARGE_STATUSES } from "@/lib/statuses";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BankOperation, ChargeCandidate } from "./types";

type Draft = { chargeId: string; amount: string };

export function ChargeLinkDialog({
  operation,
  candidates,
  onClose,
  onSaved,
}: {
  operation: BankOperation;
  candidates: ChargeCandidate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [drafts, setDrafts] = React.useState<Draft[]>(() =>
    operation.charges.map((c) => ({
      chargeId: c.chargeId,
      amount: c.amount == null ? "" : String(c.amount),
    }))
  );
  const [submitting, setSubmitting] = React.useState(false);

  const draftMap = React.useMemo(
    () => new Map(drafts.map((d) => [d.chargeId, d])),
    [drafts]
  );

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = candidates.filter((c) => {
      if (draftMap.has(c.id)) return true;
      return c.linkedAmount < c.amount;
    });
    if (!q) return list;
    return list.filter((c) =>
      [c.chargeNumber, c.invoiceNumber, c.projectName, c.paymentPurpose]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [candidates, draftMap, search]);

  const distributed = drafts.reduce((sum, d) => {
    const candidate = candidates.find((c) => c.id === d.chargeId);
    const fallback = candidate ? candidate.amount - candidate.linkedAmount : 0;
    const value = d.amount.trim() === "" ? fallback : Number(d.amount.replace(",", "."));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  function toggle(chargeId: string) {
    setDrafts((prev) =>
      prev.some((d) => d.chargeId === chargeId)
        ? prev.filter((d) => d.chargeId !== chargeId)
        : [...prev, { chargeId, amount: "" }]
    );
  }

  function setAmount(chargeId: string, amount: string) {
    setDrafts((prev) => prev.map((d) => (d.chargeId === chargeId ? { ...d, amount } : d)));
  }

  async function handleSubmit() {
    setSubmitting(true);
    const res = await fetch(`/api/bank-operations/${operation.id}/charges`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        charges: drafts.map((d) => ({
          chargeId: d.chargeId,
          amount: d.amount.trim() === "" ? null : Number(d.amount.replace(",", ".")),
        })),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Не удалось сохранить привязку");
      return;
    }
    toast.success(drafts.length ? "Начисления привязаны" : "Привязка снята");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Начисления для пополнения</DialogTitle>
          <DialogDescription>
            Пополнение {formatMoney(operation.amount)} {operation.currency} от{" "}
            {formatDate(operation.date)}. Распределено {formatMoney(distributed)} из{" "}
            {formatMoney(operation.amount)}.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по номеру, счёту, проекту или назначению"
          autoFocus
        />

        <div className="max-h-96 overflow-y-auto rounded-md border">
          {visible.length === 0 ? (
            <div className="py-8 text-center text-neutral-500">
              Подходящих начислений нет — оставьте операцию без привязки
            </div>
          ) : (
            visible.map((c) => {
              const draft = draftMap.get(c.id);
              const remaining = c.amount - c.linkedAmount;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "flex items-center gap-3 border-b px-3 py-2 last:border-b-0",
                    draft ? "bg-blue-50/60" : "hover:bg-neutral-50"
                  )}
                >
                  <Checkbox checked={!!draft} onCheckedChange={() => toggle(c.id)} />
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.chargeNumber}</span>
                      {c.invoiceNumber && (
                        <span className="text-xs text-neutral-500">счёт {c.invoiceNumber}</span>
                      )}
                      <StatusBadge dict={CHARGE_STATUSES} value={c.status} />
                    </div>
                    <div className="truncate text-xs text-neutral-500">
                      {[c.projectName, c.paymentPurpose].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </button>
                  <div className="shrink-0 text-right text-xs text-neutral-500">
                    <div className="tabular-nums text-neutral-800">{formatMoney(c.amount)}</div>
                    <div>план оплаты {formatDate(c.paidPlanAt)}</div>
                  </div>
                  <Input
                    value={draft?.amount ?? ""}
                    onChange={(e) => setAmount(c.id, e.target.value)}
                    disabled={!draft}
                    placeholder={formatMoney(remaining)}
                    className="h-8 w-32 shrink-0 text-right tabular-nums"
                  />
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Сохранение..." : "Сохранить привязку"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
