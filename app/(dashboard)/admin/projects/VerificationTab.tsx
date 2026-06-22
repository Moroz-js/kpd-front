"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toLocalDateString } from "@/lib/iso-weeks";
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

type VerificationResult = {
  projectId: string;
  projectName: string;
  checked: boolean;
  comment: string | null;
};

type Verification = {
  id: string;
  date: string;
  createdAt: string;
  totalProjects: number;
  checkedProjects: number;
  progressPct: number;
  results: VerificationResult[];
};

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

const VERIFICATION_COL =
  "w-[128px] min-w-[128px] max-w-[128px] px-1.5 border-r last:border-r-0";

function CommentCell({
  verificationId,
  projectId,
  comment,
  onSave,
}: {
  verificationId: string;
  projectId: string;
  comment: string | null;
  onSave: (verificationId: string, projectId: string, comment: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(comment ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setValue(comment ?? "");
  }, [open, comment]);

  function handleSave() {
    onSave(verificationId, projectId, value);
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

function CreateVerificationDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = toLocalDateString(new Date());
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
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const allProjects = useMemo(() => {
    const map = new Map<string, string>();
    verifications.forEach(v => {
      v.results.forEach(r => {
        if (!map.has(r.projectId)) map.set(r.projectId, r.projectName);
      });
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "ru"));
  }, [verifications]);

  const lookup = useMemo(() => {
    const m = new Map<string, Map<string, VerificationResult>>();
    verifications.forEach(v => {
      const inner = new Map<string, VerificationResult>();
      v.results.forEach(r => inner.set(r.projectId, r));
      m.set(v.id, inner);
    });
    return m;
  }, [verifications]);

  async function handleToggle(verificationId: string, projectId: string, checked: boolean) {
    setVerifications(prev => prev.map(v => {
      if (v.id !== verificationId) return v;
      const newResults = v.results.map(r =>
        r.projectId === projectId ? { ...r, checked } : r
      );
      const checkedCount = newResults.filter(r => r.checked).length;
      return {
        ...v,
        results: newResults,
        checkedProjects: checkedCount,
        progressPct: v.totalProjects === 0 ? 0 : Math.round((checkedCount / v.totalProjects) * 100),
      };
    }));

    try {
      const r = await fetch(`/api/project-verifications/${verificationId}/results/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked }),
      });
      if (!r.ok) throw new Error();
    } catch {
      load();
      toast.error("Не удалось обновить");
    }
  }

  async function handleComment(verificationId: string, projectId: string, comment: string) {
    setVerifications(prev => prev.map(v => {
      if (v.id !== verificationId) return v;
      return {
        ...v,
        results: v.results.map(r =>
          r.projectId === projectId ? { ...r, comment: comment || null } : r
        ),
      };
    }));

    try {
      const r = await fetch(`/api/project-verifications/${verificationId}/results/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment || null }),
      });
      if (!r.ok) throw new Error();
    } catch {
      load();
      toast.error("Не удалось сохранить комментарий");
    }
  }

  async function handleDelete(verificationId: string) {
    try {
      const r = await fetch(`/api/project-verifications/${verificationId}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      toast.success("Проверка удалена");
      setConfirmDeleteId(null);
      load();
    } catch {
      toast.error("Не удалось удалить");
    }
  }

  const confirmDeleteVerification = verifications.find(v => v.id === confirmDeleteId);

  if (loading) {
    return <div className="text-sm text-neutral-400 text-center py-12">Загрузка...</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Создать проверку
        </Button>
      </div>

      {verifications.length === 0 ? (
        <div className="text-sm text-neutral-500 text-center py-12 space-y-3">
          <p>Проверок пока нет. Создайте первую, чтобы начать отслеживать статус проектов.</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Создать проверку
          </Button>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-neutral-200 flex-1 min-h-0">
          <table className="border-collapse text-xs w-max">
            <thead>
              <tr className="bg-neutral-50">
                <th className="sticky left-0 z-20 bg-neutral-50 border-b border-r border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 uppercase tracking-wide min-w-[220px]">
                  Проект
                </th>
                {verifications.map(v => (
                  <th
                    key={v.id}
                    className={`border-b border-neutral-200 py-2 text-left font-medium text-neutral-600 ${VERIFICATION_COL}`}
                  >
                    <div className="font-medium text-neutral-800 text-[11px] leading-tight">
                      {formatRuDateShort(v.date)}
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <Progress value={v.progressPct} className="h-1 min-w-0 flex-1" />
                      <span className="text-neutral-500 shrink-0 text-[10px] tabular-nums">
                        {v.checkedProjects}/{v.totalProjects}
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
              {allProjects.map(([projectId, projectName], rowIdx) => (
                <tr
                  key={projectId}
                  className={rowIdx % 2 === 0 ? "bg-white" : "bg-neutral-50/50"}
                >
                  <td className="sticky left-0 z-10 border-r border-neutral-100 px-3 py-2 font-medium text-neutral-800 text-xs bg-inherit">
                    {projectName}
                  </td>
                  {verifications.map(v => {
                    const result = lookup.get(v.id)?.get(projectId);
                    return (
                      <td
                        key={v.id}
                        className={`border-neutral-100 py-1.5 ${VERIFICATION_COL}`}
                      >
                        {result ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <Checkbox
                              id={`pv-${v.id}-${projectId}`}
                              checked={result.checked}
                              onCheckedChange={(c) => handleToggle(v.id, projectId, Boolean(c))}
                              className="h-3.5 w-3.5"
                            />
                            <CommentCell
                              verificationId={v.id}
                              projectId={projectId}
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
              {allProjects.length === 0 && (
                <tr>
                  <td colSpan={verifications.length + 1} className="px-3 py-8 text-center text-neutral-400">
                    Нет проектов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CreateVerificationDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); load(); }}
        />
      )}

      {confirmDeleteId && confirmDeleteVerification && (
        <ConfirmDialog
          open={true}
          onOpenChange={(o) => !o && setConfirmDeleteId(null)}
          title="Удалить проверку?"
          description={`Удалить проверку за ${formatRuDate(confirmDeleteVerification.date)}? Все отметки будут потеряны.`}
          confirmLabel="Удалить"
          onConfirm={() => handleDelete(confirmDeleteId)}
          destructive
        />
      )}
    </div>
  );
}
