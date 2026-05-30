"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ChevronLeft, KeyRound, RefreshCw, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Detail = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  projects: { id: string; name: string; status: string }[];
};

const jsonFetcher = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<T>;
  });

export function ResponsibleDetailClient({ id }: { id: string }) {
  const { data: detail } = useSWR<Detail>(
    `/api/responsibles/${id}`,
    jsonFetcher
  );

  const [resetOpen, setResetOpen] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [resetting, setResetting] = React.useState(false);

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
    return <PageHeader title="Загрузка..." />;
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
          Ответственный архивирован.
        </div>
      )}

      <section className="rounded-md border bg-white p-4">
        <h2 className="text-base font-semibold mb-3">Проекты как руководитель</h2>
        {detail.projects.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Не назначен руководителем ни одного проекта.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {detail.projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/projects/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  {p.name}
                  {p.status === "archived" && (
                    <span className="text-xs text-neutral-400 ml-1">(архив)</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-neutral-400 mt-3">
          Назначить руководителем можно в разделе «Проекты».
        </p>
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
