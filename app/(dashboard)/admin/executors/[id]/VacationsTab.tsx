"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { VACATION_STATUSES, BADGE_TONE_CLASS } from "@/lib/statuses";

type VacationRow = {
  id: string;
  startAt: string;
  endAt: string;
  daysCount: number;
  secondStartAt: string | null;
  secondEndAt: string | null;
  secondDaysCount: number | null;
  substituteContacts: string | null;
  status: string;
  approvedBy: { id: string; fullName: string } | null;
  approvedAt: string | null;
};

type Props = {
  executorId: string;
  isAdmin: boolean;
  isOwner: boolean;
};

function VacationStatusBadge({ status }: { status: string }) {
  const entry = VACATION_STATUSES[status as keyof typeof VACATION_STATUSES];
  if (!entry) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_TONE_CLASS[entry.tone]}`}>
      {entry.label}
    </span>
  );
}

export function VacationsTab({ executorId, isAdmin, isOwner }: Props) {
  const [entries, setEntries] = useState<VacationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VacationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VacationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/executors/${executorId}/vacations`);
      if (!r.ok) throw new Error();
      setEntries(await r.json());
    } catch {
      toast.error("Не удалось загрузить отпуска");
    } finally {
      setLoading(false);
    }
  }, [executorId]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id: string) {
    try {
      const r = await fetch(`/api/executors/${executorId}/vacations/${id}/approve`, { method: "POST" });
      if (!r.ok) throw new Error();
      toast.success("Отпуск согласован");
      load();
    } catch {
      toast.error("Не удалось согласовать");
    }
  }

  async function handleDelete(id: string) {
    try {
      const r = await fetch(`/api/executors/${executorId}/vacations/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Ошибка");
      }
      toast.success("Отпуск удалён");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const canCreate = isAdmin || isOwner;

  return (
    <div className="space-y-4">
      {canCreate && (
        <div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Отпуск
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-neutral-400 text-center py-8">Загрузка...</div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-neutral-400 text-center py-8">
          График отпусков пуст.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-neutral-50">
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 min-w-[100px]">Нач. 1</th>
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 min-w-[100px]">Кон. 1</th>
                <th className="border border-neutral-200 px-3 py-2 text-right font-medium text-neutral-600">Дней</th>
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 min-w-[100px]">Нач. 2</th>
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 min-w-[100px]">Кон. 2</th>
                <th className="border border-neutral-200 px-3 py-2 text-right font-medium text-neutral-600">Дней</th>
                <th className="border border-neutral-200 px-3 py-2 text-right font-medium text-neutral-600">Всего</th>
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600">Подмена</th>
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600">Статус</th>
                <th className="border border-neutral-200 px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-neutral-50">
                  <td className="border border-neutral-200 px-3 py-1.5">{formatDate(e.startAt)}</td>
                  <td className="border border-neutral-200 px-3 py-1.5">{formatDate(e.endAt)}</td>
                  <td className="border border-neutral-200 px-3 py-1.5 text-right">{e.daysCount}</td>
                  <td className="border border-neutral-200 px-3 py-1.5">{formatDate(e.secondStartAt)}</td>
                  <td className="border border-neutral-200 px-3 py-1.5">{formatDate(e.secondEndAt)}</td>
                  <td className="border border-neutral-200 px-3 py-1.5 text-right">{e.secondDaysCount ?? "—"}</td>
                  <td className="border border-neutral-200 px-3 py-1.5 text-right font-medium">
                    {e.daysCount + (e.secondDaysCount ?? 0)}
                  </td>
                  <td className="border border-neutral-200 px-3 py-1.5 max-w-[160px] truncate" title={e.substituteContacts ?? ""}>
                    {e.substituteContacts || "—"}
                  </td>
                  <td className="border border-neutral-200 px-3 py-1.5">
                    <VacationStatusBadge status={e.status} />
                  </td>
                  <td className="border border-neutral-200 px-3 py-1.5">
                    <div className="flex gap-1">
                      {isAdmin && e.status === "need_approval" && (
                        <button
                          title="Согласовать"
                          className="p-0.5 text-green-600 hover:text-green-800"
                          onClick={() => handleApprove(e.id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(isAdmin || (isOwner && e.status !== "approved")) && (
                        <button
                          title="Редактировать"
                          className="p-0.5 text-neutral-500 hover:text-neutral-800"
                          onClick={() => setEditTarget(e)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(isAdmin || (isOwner && e.status !== "approved")) && (
                        <button
                          title="Удалить"
                          className="p-0.5 text-red-400 hover:text-red-600"
                          onClick={() => setDeleteTarget(e)}
                        >
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

      {createOpen && (
        <VacationFormDialog
          executorId={executorId}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); load(); }}
        />
      )}

      {editTarget && (
        <VacationFormDialog
          executorId={executorId}
          entry={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отпуск?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись об отпуске будет удалена.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VacationFormDialog({
  executorId,
  entry,
  onClose,
  onSaved,
}: {
  executorId: string;
  entry?: VacationRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [startAt, setStartAt] = useState(
    entry?.startAt ? new Date(entry.startAt).toISOString().slice(0, 10) : ""
  );
  const [endAt, setEndAt] = useState(
    entry?.endAt ? new Date(entry.endAt).toISOString().slice(0, 10) : ""
  );
  const [secondStartAt, setSecondStartAt] = useState(
    entry?.secondStartAt ? new Date(entry.secondStartAt).toISOString().slice(0, 10) : ""
  );
  const [secondEndAt, setSecondEndAt] = useState(
    entry?.secondEndAt ? new Date(entry.secondEndAt).toISOString().slice(0, 10) : ""
  );
  const [substituteContacts, setSubstituteContacts] = useState(entry?.substituteContacts ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!startAt || !endAt) {
      toast.error("Укажите даты первого периода");
      return;
    }
    setSaving(true);
    try {
      const url = entry
        ? `/api/executors/${executorId}/vacations/${entry.id}`
        : `/api/executors/${executorId}/vacations`;
      const r = await fetch(url, {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt,
          endAt,
          secondStartAt: secondStartAt || null,
          secondEndAt: secondEndAt || null,
          substituteContacts: substituteContacts || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Ошибка");
      }
      toast.success(entry ? "Отпуск обновлён" : "Отпуск добавлен");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Редактировать отпуск" : "Добавить отпуск"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700">Первый период</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Начало *</Label>
                <Input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Конец *</Label>
                <Input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700">Второй период (если есть)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Начало</Label>
                <Input type="date" value={secondStartAt} onChange={(e) => setSecondStartAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Конец</Label>
                <Input type="date" value={secondEndAt} onChange={(e) => setSecondEndAt(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Подмена, контакты</Label>
            <Input
              value={substituteContacts}
              onChange={(e) => setSubstituteContacts(e.target.value)}
              placeholder="Кто подменяет, контакт"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : entry ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
