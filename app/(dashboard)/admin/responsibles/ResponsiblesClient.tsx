"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore, ExternalLink, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { ConfirmDialog } from "@/components/ui-custom/ConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead } from "@/components/ui-custom/SortableHead";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Row = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  projectCount: number;
  projectNames: string[];
  createdAt: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<Row[]>);

type SortField = "fullName" | "projectCount";
type SortDir = "asc" | "desc";

export function ResponsiblesClient() {
  const { data, isLoading, mutate } = useSWR<Row[]>("/api/responsibles", fetcher);
  const [statusFilter, setStatusFilter] = React.useState<string[]>(["active"]);
  const [sort, setSort] = React.useState<{ field: SortField; dir: SortDir }>({
    field: "fullName",
    dir: "asc",
  });
  const [editing, setEditing] = React.useState<Row | "new" | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<Row | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = React.useState<Row | null>(null);

  const rows = React.useMemo(() => {
    let list = data ?? [];
    if (statusFilter.length) {
      list = list.filter((r) =>
        statusFilter.includes(r.isActive ? "active" : "archived")
      );
    }
    list = [...list].sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "ru");
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [data, statusFilter, sort]);

  function handleSort(field: string, dir: SortDir) {
    setSort({ field: field as SortField, dir });
  }

  async function handleArchive(row: Row) {
    const res = await fetch(`/api/responsibles/${row.id}/archive`, { method: "POST" });
    if (!res.ok) return toast.error("Не удалось архивировать");
    toast.success(`«${row.fullName}» архивирован`);
    mutate();
  }
  async function handleUnarchive(row: Row) {
    const res = await fetch(`/api/responsibles/${row.id}/archive`, { method: "DELETE" });
    if (!res.ok) return toast.error("Не удалось вернуть из архива");
    toast.success(`«${row.fullName}» снова активен`);
    mutate();
  }

  return (
    <>
      <PageHeader
        title="Ответственные"
        description="Руководители проектов. Имеют доступ к своим проектам и связанным с ними сметам."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1" /> Добавить ответственного
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MultiSelectFilter
          label="Статус"
          options={[
            { value: "active", label: "Активный" },
            { value: "archived", label: "Архивный" },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead field="fullName" sortBy={sort.field} sortDir={sort.dir} onSort={handleSort}>
                Имя
              </SortableHead>
              <TableHead>Статус</TableHead>
              <SortableHead
                field="projectCount"
                sortBy={sort.field}
                sortDir={sort.dir}
                onSort={handleSort}
                className="text-right"
              >
                Кол-во проектов
              </SortableHead>
              <TableHead>Проекты как руководитель</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-500 py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-500 py-8">
                  Нет ответственных
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className={!r.isActive ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="font-medium">{r.fullName}</div>
                    <div className="text-xs text-neutral-500">{r.email}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      tone={r.isActive ? "green" : "slate"}
                      label={r.isActive ? "Активный" : "Архивный"}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.projectCount}</TableCell>
                  <TableCell className="text-sm whitespace-pre-line">
                    {r.projectNames.join("\n") || "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Link
                      href={`/admin/responsibles/${r.id}`}
                      title="Открыть карточку"
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)} title="Редактировать">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {r.isActive ? (
                      <Button size="sm" variant="ghost" onClick={() => setArchiveTarget(r)} title="Архивировать">
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setUnarchiveTarget(r)}
                        title="Вернуть из архива"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <ResponsibleEditDialog
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            mutate();
          }}
        />
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Архивировать ответственного?"
        description={`«${archiveTarget?.fullName}» станет недоступен для назначения на новые проекты. Текущие проекты сохранятся.`}
        confirmLabel="Архивировать"
        destructive
        onConfirm={async () => {
          if (archiveTarget) await handleArchive(archiveTarget);
        }}
      />
      <ConfirmDialog
        open={!!unarchiveTarget}
        onOpenChange={(o) => !o && setUnarchiveTarget(null)}
        title="Вернуть ответственного из архива?"
        description={`«${unarchiveTarget?.fullName}» снова станет доступен в активных списках.`}
        confirmLabel="Вернуть"
        onConfirm={async () => {
          if (unarchiveTarget) await handleUnarchive(unarchiveTarget);
        }}
      />
    </>
  );
}

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function ResponsibleEditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !row;
  const [fullName, setFullName] = React.useState(row?.fullName ?? "");
  const [email, setEmail] = React.useState(row?.email ?? "");
  const [password, setPassword] = React.useState(() => isNew ? generatePassword() : "");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setFullName(row?.fullName ?? "");
    setEmail(row?.email ?? "");
    setPassword(row ? "" : generatePassword());
  }, [row]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Введите имя");
    if (!email.trim()) return toast.error("Введите email");
    if (isNew && password.length < 6) return toast.error("Пароль не короче 6 символов");

    setSubmitting(true);
    const body: Record<string, string> = { fullName: fullName.trim(), email: email.trim() };
    if (isNew) body.password = password;

    const res = await fetch(isNew ? "/api/responsibles" : `/api/responsibles/${row.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Не удалось сохранить");
      return;
    }
    toast.success(isNew ? "Ответственный создан" : "Ответственный обновлён");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? "Редактировать ответственного" : "Новый ответственный"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Имя</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Например: Иванов Сергей"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (логин)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivanov@kpd.local"
              required
            />
          </div>
          {isNew && (
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  className="font-mono"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPassword(generatePassword())}
                  title="Сгенерировать"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {password && password.length < 6 && (
                <p className="text-xs text-red-600">Пароль слишком короткий</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting || (isNew && password.length < 6)}>
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
