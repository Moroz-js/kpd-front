"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { ConfirmDialog } from "@/components/ui-custom/ConfirmDialog";
import { ENTITY_STATUSES } from "@/lib/statuses";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead } from "@/components/ui-custom/SortableHead";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Row = {
  id: string;
  name: string;
  details: string | null;
  status: string;
  isDefault: boolean;
  paymentCount: number;
  chargeCount: number;
  operationCount: number;
  paymentSum: number;
  operationSum: number;
  chargeSum: number;
  createdAt: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<Row[]>);

type SortField = "name" | "status" | "paymentSum" | "chargeSum";
type SortDir = "asc" | "desc";

export function BankAccountsClient() {
  const { data, isLoading, mutate } = useSWR<Row[]>("/api/bank-accounts", fetcher);
  const [statusFilter, setStatusFilter] = React.useState<string[]>(["active"]);
  const [sort, setSort] = React.useState<{ field: SortField; dir: SortDir }>({
    field: "name",
    dir: "asc",
  });

  const [editing, setEditing] = React.useState<Row | "new" | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<Row | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = React.useState<Row | null>(null);

  const rows = React.useMemo(() => {
    let list = data ?? [];
    if (statusFilter.length > 0) list = list.filter((r) => statusFilter.includes(r.status));
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
    const res = await fetch(`/api/bank-accounts/${row.id}/archive`, { method: "POST" });
    if (!res.ok) {
      toast.error("Не удалось архивировать счёт");
      return;
    }
    toast.success(`Счёт «${row.name}» архивирован`);
    mutate();
  }

  async function handleUnarchive(row: Row) {
    const res = await fetch(`/api/bank-accounts/${row.id}/archive`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Не удалось вернуть счёт из архива");
      return;
    }
    toast.success(`Счёт «${row.name}» снова активен`);
    mutate();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] min-h-0">
      <PageHeader
        title="Банковские счета"
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1" /> Добавить счёт
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MultiSelectFilter
          label="Статус"
          options={Object.entries(ENTITY_STATUSES).map(([value, { label }]) => ({ value, label }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <Table containerClassName="rounded-md border bg-white flex-1 min-h-0 overflow-auto">
          <TableHeader>
            <TableRow>
              <SortableHead field="name" sortBy={sort.field} sortDir={sort.dir} onSort={handleSort}>
                Счёт
              </SortableHead>
              <SortableHead field="status" sortBy={sort.field} sortDir={sort.dir} onSort={handleSort}>
                Статус
              </SortableHead>
              <TableHead className="text-right">Кол-во выплат</TableHead>
              <TableHead className="text-right">Кол-во начислений</TableHead>
              <TableHead className="text-right">Операций с р/с</TableHead>
              <SortableHead
                field="paymentSum"
                sortBy={sort.field}
                sortDir={sort.dir}
                onSort={handleSort}
                className="text-right"
              >
                Сумма выплат
              </SortableHead>
              <TableHead className="text-right">Сумма операций</TableHead>
              <SortableHead
                field="chargeSum"
                sortBy={sort.field}
                sortDir={sort.dir}
                onSort={handleSort}
                className="text-right"
              >
                Сумма начислений
              </SortableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-neutral-500 py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-neutral-500 py-8">
                  Нет счетов
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge dict={ENTITY_STATUSES} value={r.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.paymentCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.chargeCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.operationCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.paymentSum)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.operationSum)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.chargeSum)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(r)}
                      title="Редактировать"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {r.status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setArchiveTarget(r)}
                        title="Архивировать"
                      >
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

      {editing && (
        <BankAccountEditDialog
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
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Архивировать счёт?"
        description={
          archiveTarget?.isDefault
            ? `Счёт «${archiveTarget.name}» сейчас используется по умолчанию. После архивации его нужно будет заменить.`
            : `Счёт «${archiveTarget?.name}» станет недоступен для новых выплат и начислений.`
        }
        confirmLabel="Архивировать"
        destructive
        onConfirm={async () => {
          if (archiveTarget) await handleArchive(archiveTarget);
        }}
      />

      <ConfirmDialog
        open={!!unarchiveTarget}
        onOpenChange={(open) => !open && setUnarchiveTarget(null)}
        title="Вернуть счёт из архива?"
        description={`Счёт «${unarchiveTarget?.name}» снова станет доступен в активных списках.`}
        confirmLabel="Вернуть"
        onConfirm={async () => {
          if (unarchiveTarget) await handleUnarchive(unarchiveTarget);
        }}
      />
    </div>
  );
}

function BankAccountEditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(row?.name ?? "");
  const [details, setDetails] = React.useState(row?.details ?? "");
  const [isDefault, setIsDefault] = React.useState(row?.isDefault ?? false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setName(row?.name ?? "");
    setDetails(row?.details ?? "");
    setIsDefault(row?.isDefault ?? false);
  }, [row]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Введите название счёта");
      return;
    }
    setSubmitting(true);
    const isNew = !row;
    const res = await fetch(isNew ? "/api/bank-accounts" : `/api/bank-accounts/${row.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        details: details.trim() || null,
        isDefault,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Не удалось сохранить");
      return;
    }
    toast.success(isNew ? "Счёт создан" : "Счёт обновлён");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? "Редактировать счёт" : "Новый счёт"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название счёта</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: ИП Иванов — Тинькофф"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="details">Расчётный счёт / реквизиты</Label>
            <Input
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="р/с 40802810…, БИК 04…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
