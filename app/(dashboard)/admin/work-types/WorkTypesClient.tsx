"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { ConfirmDialog } from "@/components/ui-custom/ConfirmDialog";
import { ENTITY_STATUSES, WORK_TYPE_SEGMENTS, PROJECT_TYPES } from "@/lib/statuses";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead } from "@/components/ui-custom/SortableHead";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = {
  id: string;
  name: string;
  segment: string;
  status: string;
  projectNames: string[];
  projectCount: number;
  projectTypes: string[];
  estimateSources: string[];
  issuedWorkCount: number;
  isUnused: boolean;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<Row[]>);

type SortField = "name" | "segment" | "projectCount" | "issuedWorkCount" | "status";
type SortDir = "asc" | "desc";

const SOURCE_LABEL: Record<string, string> = {
  personal: "Личная смета",
  "other-expense": "Прочие траты",
};

export function WorkTypesClient() {
  const { data, isLoading, mutate } = useSWR<Row[]>("/api/work-types", fetcher);

  const [segmentFilter, setSegmentFilter] = React.useState<string[]>([]);
  const [projectTypeFilter, setProjectTypeFilter] = React.useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>(["active"]);
  const [usageFilter, setUsageFilter] = React.useState<string[]>([]);
  const [sort, setSort] = React.useState<{ field: SortField; dir: SortDir }>({
    field: "name",
    dir: "asc",
  });

  const [editing, setEditing] = React.useState<Row | "new" | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<Row | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = React.useState<Row | null>(null);

  const rows = React.useMemo(() => {
    let list = data ?? [];
    if (segmentFilter.length) list = list.filter((r) => segmentFilter.includes(r.segment));
    if (statusFilter.length) list = list.filter((r) => statusFilter.includes(r.status));
    if (projectTypeFilter.length) {
      list = list.filter((r) => r.projectTypes.some((t) => projectTypeFilter.includes(t)));
    }
    if (sourceFilter.length) {
      list = list.filter((r) => r.estimateSources.some((s) => sourceFilter.includes(s)));
    }
    if (usageFilter.length) {
      list = list.filter((r) => usageFilter.includes(r.isUnused ? "unused" : "used"));
    }
    list = [...list].sort((a, b) => {
      // Unused always at bottom
      if (a.isUnused !== b.isUnused) return a.isUnused ? 1 : -1;
      const av = a[sort.field];
      const bv = b[sort.field];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "ru");
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [data, segmentFilter, statusFilter, projectTypeFilter, sourceFilter, usageFilter, sort]);

  function handleSort(field: string, dir: SortDir) {
    setSort({ field: field as SortField, dir });
  }

  async function handleArchive(row: Row) {
    const res = await fetch(`/api/work-types/${row.id}/archive`, { method: "POST" });
    if (!res.ok) return toast.error("Не удалось архивировать");
    toast.success(`Вид работ «${row.name}» архивирован`);
    mutate();
  }
  async function handleUnarchive(row: Row) {
    const res = await fetch(`/api/work-types/${row.id}/archive`, { method: "DELETE" });
    if (!res.ok) return toast.error("Не удалось вернуть из архива");
    toast.success(`Вид работ «${row.name}» снова активен`);
    mutate();
  }

  return (
    <>
      <PageHeader
        title="Виды работ"
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1" /> Добавить вид работ
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MultiSelectFilter
          label="Сегмент"
          options={WORK_TYPE_SEGMENTS.map((s) => ({ value: s, label: s }))}
          value={segmentFilter}
          onChange={setSegmentFilter}
        />
        <MultiSelectFilter
          label="Типы проектов"
          options={Object.entries(PROJECT_TYPES).map(([value, label]) => ({ value, label }))}
          value={projectTypeFilter}
          onChange={setProjectTypeFilter}
        />
        <MultiSelectFilter
          label="Типы смет"
          options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))}
          value={sourceFilter}
          onChange={setSourceFilter}
        />
        <MultiSelectFilter
          label="Статус"
          options={Object.entries(ENTITY_STATUSES).map(([value, { label }]) => ({ value, label }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <MultiSelectFilter
          label="Использование"
          options={[
            { value: "used", label: "Использовался" },
            { value: "unused", label: "Не использовался" },
          ]}
          value={usageFilter}
          onChange={setUsageFilter}
        />
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead field="name" sortBy={sort.field} sortDir={sort.dir} onSort={handleSort}>
                Вид работ
              </SortableHead>
              <SortableHead field="segment" sortBy={sort.field} sortDir={sort.dir} onSort={handleSort}>
                Сегмент
              </SortableHead>
              <TableHead>Использовано в проектах</TableHead>
              <SortableHead
                field="projectCount"
                sortBy={sort.field}
                sortDir={sort.dir}
                onSort={handleSort}
                className="text-right"
              >
                Кол-во проектов
              </SortableHead>
              <SortableHead
                field="issuedWorkCount"
                sortBy={sort.field}
                sortDir={sort.dir}
                onSort={handleSort}
                className="text-right"
              >
                Кол-во работ
              </SortableHead>
              <SortableHead field="status" sortBy={sort.field} sortDir={sort.dir} onSort={handleSort}>
                Статус
              </SortableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-neutral-500 py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-neutral-500 py-8">
                  Нет видов работ
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className={r.isUnused ? "text-neutral-400" : ""}>{r.name}</span>
                    {r.isUnused && <span className="ml-1.5 text-[10px] text-neutral-400 font-normal">(не используется)</span>}
                  </TableCell>
                  <TableCell>{r.segment}</TableCell>
                  <TableCell className="max-w-64 truncate" title={r.projectNames.join(", ")}>
                    {r.projectNames.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.projectCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.issuedWorkCount}</TableCell>
                  <TableCell>
                    <StatusBadge dict={ENTITY_STATUSES} value={r.status} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)} title="Редактировать">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {r.status === "active" ? (
                      <Button size="sm" variant="ghost" onClick={() => setArchiveTarget(r)} title="Архивировать">
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setUnarchiveTarget(r)} title="Вернуть из архива">
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
        <WorkTypeEditDialog
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
        title="Архивировать вид работ?"
        description={`Вид работ «${archiveTarget?.name}» станет недоступен для выбора в новых работах. Существующие записи сохранятся.`}
        confirmLabel="Архивировать"
        destructive
        onConfirm={async () => {
          if (archiveTarget) await handleArchive(archiveTarget);
        }}
      />
      <ConfirmDialog
        open={!!unarchiveTarget}
        onOpenChange={(o) => !o && setUnarchiveTarget(null)}
        title="Вернуть вид работ из архива?"
        description={`«${unarchiveTarget?.name}» снова станет доступен в активных списках.`}
        confirmLabel="Вернуть"
        onConfirm={async () => {
          if (unarchiveTarget) await handleUnarchive(unarchiveTarget);
        }}
      />
    </>
  );
}

function WorkTypeEditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(row?.name ?? "");
  const [segment, setSegment] = React.useState(row?.segment ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setName(row?.name ?? "");
    setSegment(row?.segment ?? "");
  }, [row]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Введите название");
    if (!segment) return toast.error("Выберите сегмент");
    setSubmitting(true);
    const isNew = !row;
    const res = await fetch(isNew ? "/api/work-types" : `/api/work-types/${row.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), segment }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Не удалось сохранить");
      return;
    }
    toast.success(isNew ? "Вид работ создан" : "Вид работ обновлён");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? "Редактировать вид работ" : "Новый вид работ"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Дизайн посадочной страницы"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="segment">Сегмент</Label>
            <Select value={segment} onValueChange={(v) => setSegment(v ?? "")}>
              <SelectTrigger id="segment">
                <SelectValue placeholder="Выберите сегмент">
                  {segment || undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WORK_TYPE_SEGMENTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
