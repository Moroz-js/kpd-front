"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { TASK_STATUSES, BADGE_TONE_CLASS } from "@/lib/statuses";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  plannedDoneAt: string | null;
  result: string | null;
  comment: string | null;
  isOnboarding: boolean;
  createdAt: string;
};

type Props = {
  executorId: string;
  isAdmin: boolean;
  isOwner: boolean;
  onTaskCountChange?: (count: number) => void;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Поставлена",
  in_progress: "В работе",
  paused: "На паузе",
  review: "На проверке",
  done: "Выполнено",
};

function TaskStatusBadge({ status }: { status: string }) {
  const entry = TASK_STATUSES[status as keyof typeof TASK_STATUSES];
  if (!entry) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_TONE_CLASS[entry.tone]}`}>
      {entry.label}
    </span>
  );
}

export function TasksTab({ executorId, isAdmin, isOwner, onTaskCountChange }: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TaskRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/executors/${executorId}/tasks`);
      if (!r.ok) throw new Error();
      const data: TaskRow[] = await r.json();
      setTasks(data);
      onTaskCountChange?.(data.filter((t) => t.status !== "done").length);
    } catch {
      toast.error("Не удалось загрузить задачи");
    } finally {
      setLoading(false);
    }
  }, [executorId, onTaskCountChange]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    try {
      const r = await fetch(`/api/executors/${executorId}/tasks/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      toast.success("Задача удалена");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Не удалось удалить задачу");
    }
  }

  async function handleStatusChange(task: TaskRow, status: string) {
    try {
      const r = await fetch(`/api/executors/${executorId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error();
      load();
    } catch {
      toast.error("Не удалось обновить задачу");
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Задача
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-neutral-400 text-center py-8">Загрузка...</div>
      ) : tasks.length === 0 ? (
        <div className="text-sm text-neutral-400 text-center py-8">
          Задач нет. {isAdmin ? "Создайте первую задачу." : ""}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-neutral-50">
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 min-w-[300px]">Задача</th>
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 min-w-[110px]">Статус</th>
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 min-w-[90px]">Срок</th>
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 min-w-[140px]">Результат</th>
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 min-w-[140px]">Комментарий</th>
                <th className="border border-neutral-200 px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className={`hover:bg-neutral-50 ${task.status === "done" ? "opacity-60" : ""}`}>
                  <td className="border border-neutral-200 px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {task.isOnboarding && (
                        <span className="text-[10px] text-neutral-400 border border-neutral-200 rounded px-1">онбординг</span>
                      )}
                      <span>{task.title}</span>
                    </div>
                  </td>
                  <td className="border border-neutral-200 px-3 py-1.5">
                    {isAdmin || isOwner ? (
                      <Select
                        value={task.status}
                        onValueChange={(v) => v && handleStatusChange(task, v)}
                      >
                        <SelectTrigger className="h-6 text-xs border-0 px-0 shadow-none focus:ring-0">
                          <SelectValue>
                            <TaskStatusBadge status={task.status} />
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <TaskStatusBadge status={task.status} />
                    )}
                  </td>
                  <td className="border border-neutral-200 px-3 py-1.5 text-neutral-500">
                    {formatDate(task.plannedDoneAt)}
                  </td>
                  <td className="border border-neutral-200 px-3 py-1.5">
                    {(isAdmin || isOwner) ? (
                      <InlineEdit
                        value={task.result ?? ""}
                        onSave={(v) => {
                          fetch(`/api/executors/${executorId}/tasks/${task.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ result: v || null }),
                          }).then(() => load());
                        }}
                      />
                    ) : (
                      <span className="text-neutral-600">{task.result || "—"}</span>
                    )}
                  </td>
                  <td className="border border-neutral-200 px-3 py-1.5">
                    {(isAdmin || isOwner) ? (
                      <InlineEdit
                        value={task.comment ?? ""}
                        onSave={(v) => {
                          fetch(`/api/executors/${executorId}/tasks/${task.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ comment: v || null }),
                          }).then(() => load());
                        }}
                      />
                    ) : (
                      <span className="text-neutral-600">{task.comment || "—"}</span>
                    )}
                  </td>
                  <td className="border border-neutral-200 px-3 py-1.5">
                    {isAdmin && (
                      <button
                        title="Удалить"
                        className="p-0.5 text-red-400 hover:text-red-600"
                        onClick={() => setDeleteTarget(task)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CreateTaskDialog
          executorId={executorId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); load(); }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.title?.slice(0, 60)}» будет удалена.
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

// Inline-редактирование текстового поля
function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        className="border border-blue-300 rounded px-1 py-0.5 text-xs w-full outline-none"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { setEditing(false); onSave(v); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { setEditing(false); onSave(v); }
          if (e.key === "Escape") { setEditing(false); setV(value); }
        }}
      />
    );
  }
  return (
    <span
      className="cursor-pointer hover:bg-neutral-100 rounded px-1 py-0.5 text-neutral-600 min-w-[60px] inline-block"
      onClick={() => setEditing(true)}
      title="Нажмите для редактирования"
    >
      {v || <span className="text-neutral-300">—</span>}
    </span>
  );
}

function CreateTaskDialog({
  executorId,
  onClose,
  onCreated,
}: {
  executorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [plannedDoneAt, setPlannedDoneAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) { toast.error("Введите название задачи"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/executors/${executorId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), plannedDoneAt: plannedDoneAt || null }),
      });
      if (!r.ok) throw new Error();
      toast.success("Задача создана");
      onCreated();
    } catch {
      toast.error("Ошибка при создании");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Новая задача</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Задача *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Описание задачи" />
          </div>
          <div className="space-y-1.5">
            <Label>Срок выполнения</Label>
            <Input type="date" value={plannedDoneAt} onChange={(e) => setPlannedDoneAt(e.target.value)} />
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
