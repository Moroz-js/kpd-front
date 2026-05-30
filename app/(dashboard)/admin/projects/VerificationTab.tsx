"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui-custom/ConfirmDialog";

type VerificationSummary = {
  id: string;
  date: string;
  createdAt: string;
  createdByName: string;
  totalProjects: number;
  checkedProjects: number;
  progressPct: number;
};

type VerificationDetail = VerificationSummary & {
  results: { projectId: string; projectName: string; checked: boolean }[];
};

function formatRuDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function VerificationCard({
  summary,
  defaultExpanded,
  onDeleted,
}: {
  summary: VerificationSummary;
  defaultExpanded: boolean;
  onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localResults, setLocalResults] = useState<{ projectId: string; projectName: string; checked: boolean }[]>([]);
  const [checkedCount, setCheckedCount] = useState(summary.checkedProjects);
  const total = summary.totalProjects;

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/project-verifications/${summary.id}`);
      if (!r.ok) throw new Error();
      const d: VerificationDetail = await r.json();
      setDetail(d);
      setLocalResults(d.results);
      setCheckedCount(d.checkedProjects);
    } catch {
      toast.error("Не удалось загрузить детали проверки");
    } finally {
      setLoading(false);
    }
  }, [summary.id]);

  useEffect(() => {
    if (expanded && !detail) loadDetail();
  }, [expanded, detail, loadDetail]);

  async function handleToggle(projectId: string, checked: boolean) {
    setLocalResults(prev => prev.map(r => r.projectId === projectId ? { ...r, checked } : r));
    setCheckedCount(prev => prev + (checked ? 1 : -1));
    try {
      const r = await fetch(`/api/project-verifications/${summary.id}/results/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setLocalResults(prev => prev.map(r => r.projectId === projectId ? { ...r, checked: !checked } : r));
      setCheckedCount(prev => prev + (checked ? -1 : 1));
      toast.error("Не удалось обновить");
    }
  }

  async function handleDelete() {
    try {
      const r = await fetch(`/api/project-verifications/${summary.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      toast.success("Проверка удалена");
      onDeleted();
    } catch {
      toast.error("Не удалось удалить");
    }
  }

  const progressPct = total === 0 ? 0 : Math.round((checkedCount / total) * 100);

  return (
    <div className="border border-neutral-200 rounded-lg bg-white">
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="mt-0.5 text-neutral-400 hover:text-neutral-700"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="font-medium text-sm">{formatRuDate(summary.date)}</span>
                <span className="text-xs text-neutral-500 ml-3">Создал: {summary.createdByName}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Удалить
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Progress value={progressPct} className="h-2 flex-1 max-w-xs" />
              <span className="text-xs text-neutral-600 whitespace-nowrap">
                {checkedCount} из {total} проверено ({progressPct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-neutral-100 px-4 py-3">
          {loading ? (
            <div className="text-xs text-neutral-400 py-2">Загрузка...</div>
          ) : (
            <div className="space-y-1.5">
              {localResults.map(r => (
                <div key={r.projectId} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`pv-${summary.id}-${r.projectId}`}
                    checked={r.checked}
                    onCheckedChange={(v) => handleToggle(r.projectId, Boolean(v))}
                  />
                  <label
                    htmlFor={`pv-${summary.id}-${r.projectId}`}
                    className={`text-sm cursor-pointer ${r.checked ? "text-neutral-400 line-through" : "text-neutral-800"}`}
                  >
                    {r.projectName}
                  </label>
                </div>
              ))}
              {localResults.length === 0 && (
                <div className="text-xs text-neutral-400">Нет проектов</div>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Удалить проверку?"
        description={`Удалить проверку за ${formatRuDate(summary.date)}? Все отметки будут потеряны.`}
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}

function CreateVerificationDialog({
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
    if (!date) { toast.error("Укажите дату"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/project-verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!r.ok) throw new Error();
      toast.success("Проверка создана");
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
        <DialogHeader><DialogTitle>Создать проверку</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Дата проверки *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VerificationTab() {
  const [verifications, setVerifications] = useState<VerificationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/project-verifications");
      if (!r.ok) throw new Error();
      setVerifications(await r.json());
    } catch {
      toast.error("Не удалось загрузить проверки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Создать проверку
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-400 text-center py-12">Загрузка...</div>
      ) : verifications.length === 0 ? (
        <div className="text-sm text-neutral-500 text-center py-12 space-y-3">
          <p>Проверок пока нет. Создайте первую, чтобы начать отслеживать статус проектов.</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Создать проверку
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map((v, i) => (
            <VerificationCard
              key={v.id}
              summary={v}
              defaultExpanded={i === 0}
              onDeleted={load}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateVerificationDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); load(); }}
        />
      )}
    </div>
  );
}
