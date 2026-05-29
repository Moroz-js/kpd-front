"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ChevronLeft, Save, KeyRound, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Detail = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  projects: { id: string; name: string; status: string }[];
};

type ProjectOption = {
  id: string;
  name: string;
  status: string;
  responsibleUserId: string | null;
};

const jsonFetcher = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<T>;
  });

export function ResponsibleDetailClient({ id }: { id: string }) {
  const { data: detail, mutate: refetchDetail } = useSWR<Detail>(
    `/api/responsibles/${id}`,
    jsonFetcher
  );
  const { data: allProjects } = useSWR<ProjectOption[]>(
    "/api/projects/options",
    jsonFetcher
  );

  const [assignedIds, setAssignedIds] = React.useState<Set<string>>(new Set());
  const [initialIds, setInitialIds] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [resetting, setResetting] = React.useState(false);

  React.useEffect(() => {
    if (!detail) return;
    const ids = new Set(detail.projects.map((p) => p.id));
    setAssignedIds(ids);
    setInitialIds(new Set(ids));
  }, [detail]);

  const visibleProjects = React.useMemo(() => {
    if (!allProjects) return [];
    return allProjects
      .filter((p) => p.status === "active" || assignedIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [allProjects, assignedIds]);

  const dirty = React.useMemo(() => {
    if (assignedIds.size !== initialIds.size) return true;
    for (const id of assignedIds) if (!initialIds.has(id)) return true;
    return false;
  }, [assignedIds, initialIds]);

  function toggle(projectId: string) {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/responsibles/${id}/projects`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectIds: Array.from(assignedIds) }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Не удалось сохранить назначения");
    toast.success("Назначения сохранены");
    refetchDetail();
  }

  function generatePassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
    const pwd = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setNewPassword(pwd);
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Пароль должен быть не короче 6 символов");
      return;
    }
    setResetting(true);
    const res = await fetch(`/api/users/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    setResetting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Не удалось сбросить пароль");
      return;
    }
    toast.success("Пароль успешно изменён");
    setResetOpen(false);
    setNewPassword("");
  }

  if (!detail) {
    return (
      <>
        <PageHeader title="Загрузка..." />
      </>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Link
          href="/admin/responsibles"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> К списку
        </Link>
      </div>

      <PageHeader
        title={detail.fullName}
        description={detail.email}
        actions={
          <>
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              <KeyRound className="h-4 w-4 mr-1" /> Сбросить пароль
            </Button>
            <StatusBadge
              tone={detail.isActive ? "green" : "slate"}
              label={detail.isActive ? "Активный" : "Архивный"}
            />
          </>
        }
      />

      {!detail.isActive && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900 mb-4">
          Ответственный архивирован. Назначения проектов сохраняются, но новые активные проекты
          ему присвоить нельзя без возврата из архива.
        </div>
      )}

      <section className="rounded-md border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">Назначение проектов</h2>
            <p className="text-sm text-neutral-500">
              Отмеченные проекты будут закреплены за этим ответственным. Можно выбирать только
              активные проекты, уже привязанные проекты остаются в списке для возможности снятия.
            </p>
          </div>
          <Button onClick={handleSave} disabled={!dirty || saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>

        {visibleProjects.length === 0 ? (
          <div className="text-sm text-neutral-500 py-6 text-center">
            Нет проектов для назначения. Создайте проекты в разделе «Проекты».
          </div>
        ) : (
          <ul className="divide-y">
            {visibleProjects.map((p) => {
              const checked = assignedIds.has(p.id);
              const assignedToOther = p.responsibleUserId && p.responsibleUserId !== id;
              return (
                <li key={p.id} className="py-2 flex items-center gap-3">
                  <Checkbox
                    id={`proj-${p.id}`}
                    checked={checked}
                    onCheckedChange={() => toggle(p.id)}
                    disabled={!detail.isActive && !checked}
                  />
                  <Label
                    htmlFor={`proj-${p.id}`}
                    className="flex-1 text-sm font-normal cursor-pointer flex items-center gap-2"
                  >
                    <span>{p.name}</span>
                    {p.status === "archived" && (
                      <StatusBadge tone="slate" label="Архивный" />
                    )}
                    {assignedToOther && (
                      <span className="text-xs text-neutral-400">
                        (сейчас у другого PM — будет переназначен)
                      </span>
                    )}
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog
        open={resetOpen}
        onOpenChange={(o) => {
          if (!o) { setResetOpen(false); setNewPassword(""); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сменить пароль</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-neutral-500">
              Введите новый пароль или сгенерируйте случайный. Сообщите пароль пользователю безопасным каналом.
            </p>
            <div className="flex gap-2">
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                type="text"
                className="font-mono"
              />
              <Button type="button" variant="outline" size="icon" onClick={generatePassword} title="Сгенерировать">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {newPassword && newPassword.length < 6 && (
              <p className="text-xs text-red-600">Пароль слишком короткий (мин. 6)</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setResetOpen(false); setNewPassword(""); }} disabled={resetting}>
              Отмена
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 6}>
              {resetting ? "Сохранение..." : "Сохранить пароль"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
