"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner" ;
import { Plus, Pencil, Archive, ArchiveRestore, Check, X, KeyRound, RefreshCw, ExternalLink, Search } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { ConfirmDialog } from "@/components/ui-custom/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ENTITY_STATUSES,
  EXECUTOR_TYPES,
  EXECUTOR_TYPE_FILTER_GROUPS,
  RECIPIENT_TYPES,
} from "@/lib/statuses";
import { normalizeExecutorType } from "@/lib/executor-type";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/components/ui-custom/SortableHead";
import { ExpandableListCell } from "@/components/ui-custom/ExpandableListCell";
import { ExecutorWizard } from "./ExecutorWizard";
import { hasPersonalSmeta } from "@/lib/executor-personal-estimate";
import { EXECUTOR_COMPANY_STATUSES } from "@/lib/statuses";
type Row = {
  id: string;
  name: string;
  companyStatus: string | null;
  type: string;
  workTypeIds: string[];
  workTypeNames: string[];
  projectNames: string[];
  responsibleUserId: string | null;
  responsibleName: string | null;
  defaultBankAccountId: string | null;
  defaultBankAccountName: string | null;
  recipientTypes: string[];
  requisites: string | null;
  contacts: string | null;
  userId: string | null;
  email: string | null;
  inTgChat: boolean;
  specialty: string | null;
  note: string | null;
  contractFile: string | null;
  ndaFile: string | null;
  hasAccess: boolean;
  status: string;
  lastPaidAt: string | null;
  legalForm: string | null;
};
export type ExecutorRow = Row;

type BankAccountOption = { id: string; name: string; status: string };
type WorkTypeOption = { id: string; name: string; status: string; segment?: string };
type ResponsibleOption = { id: string; fullName: string; isActive: boolean };

const fetcher = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<T>;
  });

type SortField = "name" | "responsibleName" | "lastPaidAt";
type SortDir = "asc" | "desc";

type ExecutorsClientProps = {
  /** admin — полный доступ; manage — PM/постоянный исполнитель (только настройки, без сметы). */
  mode?: "admin" | "manage";
  /** Можно добавлять исполнителей (admin, PM). */
  canAdd?: boolean;
};

export function ExecutorsClient({ mode = "admin", canAdd = true }: ExecutorsClientProps = {}) {
  const isManage = mode === "manage";
  const detailBase = isManage ? "/executor/executors" : "/admin/executors";
  const { data, isLoading, mutate } = useSWR<Row[]>("/api/executors", fetcher);
  const { data: bankAccounts } = useSWR<BankAccountOption[]>("/api/bank-accounts", fetcher);
  const { data: workTypes } = useSWR<WorkTypeOption[]>("/api/work-types", fetcher);
  const { data: responsibles } = useSWR<ResponsibleOption[]>("/api/responsibles", fetcher);

  const [typeFilter, setTypeFilter] = React.useState<string[]>([]);
  const [workTypeFilter, setWorkTypeFilter] = React.useState<string[]>([]);
  const [projectFilter, setProjectFilter] = React.useState<string[]>([]);
  const [responsibleFilter, setResponsibleFilter] = React.useState<string[]>([]);
  const [bankFilter, setBankFilter] = React.useState<string[]>([]);
  const [recipientFilter, setRecipientFilter] = React.useState<string[]>([]);
  const [companyStatusFilter, setCompanyStatusFilter] = React.useState<string[]>([]);
  const [accessFilter, setAccessFilter] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>(["active"]);
  const [nameSearch, setNameSearch] = React.useState("");
  const [sort, setSort] = React.useState<{ field: SortField; dir: SortDir }>({
    field: "name",
    dir: "asc",
  });

  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = React.useState<Row | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<Row | null>(null);
  const [archivePrecheck, setArchivePrecheck] = React.useState<{
    openWorks: number;
    pendingPayments: number;
  } | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = React.useState<Row | null>(null);

  const projectOptions = React.useMemo(() => {
    const list = data ?? [];
    const set = new Set<string>();
    for (const r of list) for (const n of r.projectNames) set.add(n);
    const sorted = Array.from(set)
      .sort((a, b) => a.localeCompare(b, "ru"))
      .map((p) => ({ value: p, label: p }));
    return [{ value: "__empty__", label: "Пусто" }, ...sorted];
  }, [data]);

  const rows = React.useMemo(() => {
    let list = data ?? [];

    const q = nameSearch.trim().toLowerCase();
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));

    if (typeFilter.length) {
      const flatTypes = new Set<string>();
      for (const group of typeFilter) {
        const dbTypes =
          EXECUTOR_TYPE_FILTER_GROUPS[group as keyof typeof EXECUTOR_TYPE_FILTER_GROUPS] ?? [];
        for (const t of dbTypes) flatTypes.add(t);
      }
      list = list.filter((r) => flatTypes.has(normalizeExecutorType(r.type)));
    }

    if (workTypeFilter.length) {
      list = list.filter((r) => {
        if (workTypeFilter.includes("__empty__") && r.workTypeIds.length === 0) return true;
        return r.workTypeIds.some((id) => workTypeFilter.includes(id));
      });
    }

    if (projectFilter.length) {
      list = list.filter((r) => {
        if (projectFilter.includes("__empty__") && r.projectNames.length === 0) return true;
        return r.projectNames.some((n) => projectFilter.includes(n));
      });
    }

    if (responsibleFilter.length) {
      list = list.filter((r) => responsibleFilter.includes(r.responsibleUserId ?? "__none__"));
    }

    if (bankFilter.length) {
      list = list.filter((r) => bankFilter.includes(r.defaultBankAccountId ?? "__none__"));
    }

    if (recipientFilter.length) {
      list = list.filter((r) => {
        if (recipientFilter.includes("__none__") && r.recipientTypes.length === 0) return true;
        return r.recipientTypes.some((t) => recipientFilter.includes(t));
      });
    }

    if (companyStatusFilter.length) {
      list = list.filter((r) => {
        if (companyStatusFilter.includes("__none__") && !r.companyStatus) return true;
        return r.companyStatus != null && companyStatusFilter.includes(r.companyStatus);
      });
    }

    if (accessFilter.length) {
      list = list.filter((r) => accessFilter.includes(r.hasAccess ? "true" : "false"));
    }

    if (statusFilter.length) list = list.filter((r) => statusFilter.includes(r.status));

    list = [...list].sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""), "ru");
      const primary = sort.dir === "asc" ? cmp : -cmp;
      if (primary !== 0) return primary;
      return String(a.responsibleName ?? "").localeCompare(String(b.responsibleName ?? ""), "ru");
    });
    return list;
  }, [
    data,
    nameSearch,
    typeFilter,
    workTypeFilter,
    projectFilter,
    responsibleFilter,
    bankFilter,
    recipientFilter,
    companyStatusFilter,
    accessFilter,
    statusFilter,
    sort,
  ]);

  function handleSort(field: string, dir: SortDir) {
    setSort({ field: field as SortField, dir });
  }

  async function openArchiveTarget(row: Row) {
    setArchiveTarget(row);
    setArchivePrecheck(null);
    try {
      const r = await fetch(`/api/executors/${row.id}/archive`);
      if (r.ok) {
        const check = (await r.json()) as { openWorks: number; pendingPayments: number };
        setArchivePrecheck(check);
      }
    } catch {
      // ignore — покажем generic confirm
    }
  }

  async function handleArchive(row: Row) {
    const res = await fetch(`/api/executors/${row.id}/archive`, { method: "POST" });
    if (!res.ok) return toast.error("Не удалось архивировать");
    toast.success(`«${row.name}» архивирован, доступ снят`);
    mutate();
  }

  async function handleUnarchive(row: Row) {
    const res = await fetch(`/api/executors/${row.id}/archive`, { method: "DELETE" });
    if (!res.ok) return toast.error("Не удалось вернуть из архива");
    toast.success(`«${row.name}» снова активен`);
    mutate();
  }

  async function toggleAccess(row: Row) {
    if (!row.email) {
      toast.error("У исполнителя нет учётной записи — нельзя выдать доступ");
      return;
    }
    const method = row.hasAccess ? "DELETE" : "POST";
    const res = await fetch(`/api/executors/${row.id}/access`, { method });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error ?? "Не удалось изменить доступ");
    }
    toast.success(row.hasAccess ? "Доступ отозван" : "Доступ выдан");
    mutate();
  }

  const responsibleOpts = React.useMemo(() => {
    if (!responsibles) return [];
    const opts = [...responsibles]
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"))
      .map((r) => ({ value: r.id, label: r.fullName }));
    return [{ value: "__none__", label: "Пусто" }, ...opts];
  }, [responsibles]);

  const bankOpts = React.useMemo(() => {
    if (!bankAccounts) return [];
    const opts = [...bankAccounts]
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .map((b) => ({ value: b.id, label: b.name }));
    return [{ value: "__none__", label: "Пусто" }, ...opts];
  }, [bankAccounts]);

  const workTypeOpts = React.useMemo(() => {
    if (!workTypes) return [];
    const sorted = [...workTypes].sort((a, b) =>
      (a.segment ?? "").localeCompare(b.segment ?? "", "ru") ||
      a.name.localeCompare(b.name, "ru")
    );
    return [{ value: "__empty__", label: "Пусто", group: "" }, ...sorted.map((w) => ({ value: w.id, label: w.name, group: w.segment }))];
  }, [workTypes]);

  const recipientOpts = React.useMemo(
    () => [
      { value: "__none__", label: "Пусто" },
      ...RECIPIENT_TYPES.map((r) => ({ value: r, label: r })),
    ],
    []
  );

  const companyStatusOpts = React.useMemo(
    () => [
      { value: "__none__", label: "Пусто" },
      ...Object.entries(EXECUTOR_COMPANY_STATUSES).map(([value, label]) => ({ value, label })),
    ],
    []
  );

  const typeFilterOpts = React.useMemo(
    () =>
      Object.keys(EXECUTOR_TYPE_FILTER_GROUPS).map((label) => ({
        value: label,
        label,
      })),
    []
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] min-h-0">
      <PageHeader
        title="Исполнители"
        actions={
          canAdd ? (
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Добавить исполнителя
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
          <Input
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <MultiSelectFilter label="Тип" options={typeFilterOpts} value={typeFilter} onChange={setTypeFilter} />
        <MultiSelectFilter
          label="Статус в компании"
          options={companyStatusOpts}
          value={companyStatusFilter}
          onChange={setCompanyStatusFilter}
        />
        <MultiSelectFilter
          label="Виды работ"
          options={workTypeOpts}
          value={workTypeFilter}
          onChange={setWorkTypeFilter}
        />
        <MultiSelectFilter
          label="Проекты"
          options={projectOptions}
          value={projectFilter}
          onChange={setProjectFilter}
        />
        <MultiSelectFilter
          label="Ответственный"
          options={responsibleOpts}
          value={responsibleFilter}
          onChange={setResponsibleFilter}
        />
        <MultiSelectFilter
          label="Источник оплаты"
          options={bankOpts}
          value={bankFilter}
          onChange={setBankFilter}
        />
        <MultiSelectFilter
          label="Тип получателя"
          options={recipientOpts}
          value={recipientFilter}
          onChange={setRecipientFilter}
        />
        <MultiSelectFilter
          label="Доступ к смете"
          options={[
            { value: "true", label: "Есть доступ" },
            { value: "false", label: "Нет доступа" },
          ]}
          value={accessFilter}
          onChange={setAccessFilter}
        />
        <MultiSelectFilter
          label="Статус"
          options={Object.entries(ENTITY_STATUSES).map(([value, { label }]) => ({ value, label }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <Table
        className="min-w-[1600px]"
        containerClassName="rounded-md border bg-white flex-1 min-h-0 overflow-auto"
      >
          <TableHeader>
            <TableRow>
              <SortableHead field="name" sortBy={sort.field} sortDir={sort.dir} onSort={handleSort}>
                Исполнитель
              </SortableHead>
              <TableHead className="w-20 min-w-20 px-1 leading-tight align-bottom !whitespace-normal">
                <span className="block text-left">
                  Статус
                  <br />
                  <span className="whitespace-nowrap">в компании</span>
                </span>
              </TableHead>
              <TableHead>Тип</TableHead>
              <TableHead className="w-40 max-w-40">Виды работ</TableHead>
              <TableHead>Специальность</TableHead>
              <TableHead>Проекты</TableHead>
              <SortableHead
                field="responsibleName"
                sortBy={sort.field}
                sortDir={sort.dir}
                onSort={handleSort}
              >
                Ответственный
              </SortableHead>
              <TableHead>Источник оплаты</TableHead>
              <TableHead>Тип получателя</TableHead>
              <TableHead>В чате ТГ</TableHead>
              <TableHead>Доступ</TableHead>
              <TableHead>Статус</TableHead>
              <SortableHead
                field="lastPaidAt"
                sortBy={sort.field}
                sortDir={sort.dir}
                onSort={handleSort}
              >
                Последняя выплата
              </SortableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-neutral-500 py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-neutral-500 py-8">
                  Нет исполнителей
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className={r.status === "archived" ? "bg-neutral-100 text-neutral-400" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1 min-w-0">
                      {isManage ? (
                        <Link
                          href={`${detailBase}/${r.id}`}
                          className="truncate hover:underline text-neutral-900"
                          title="Открыть настройки исполнителя"
                        >
                          {r.name}
                        </Link>
                      ) : hasPersonalSmeta(r) ? (
                        <>
                          <Link
                            href={`/admin/executors/${r.id}`}
                            className="truncate hover:underline text-neutral-900"
                          >
                            {r.name}
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 shrink-0"
                            title="Открыть смету в новом окне"
                            onClick={() => window.open(`/admin/executors/${r.id}`, "_blank")}
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
                          </Button>
                        </>
                      ) : (
                        <span className="truncate">{r.name}</span>
                      )}
                    </div>
                    {r.email && <div className="text-xs text-neutral-500">{r.email}</div>}
                  </TableCell>
                  <TableCell className="w-20 min-w-20 px-1">
                    {r.companyStatus === "core"
                      ? "Ядро"
                      : r.companyStatus === "orbit"
                        ? "Орбита"
                        : "—"}
                  </TableCell>
                  <TableCell>
                    {EXECUTOR_TYPES[normalizeExecutorType(r.type)] ?? r.type}
                  </TableCell>
                  <TableCell className="w-40 max-w-40" style={{ maxWidth: "10rem", width: "10rem" }}>
                    <ExpandableListCell items={r.workTypeNames} className="max-w-full" />
                  </TableCell>
                  <TableCell className="max-w-32 truncate">
                    {r.specialty ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ExpandableListCell items={r.projectNames} className="max-w-64" />
                  </TableCell>
                  <TableCell>{r.responsibleName ?? "—"}</TableCell>
                  <TableCell>{r.defaultBankAccountName ?? "—"}</TableCell>
                  <TableCell>
                    <ExpandableListCell items={r.recipientTypes} className="max-w-56" />
                  </TableCell>
                  <TableCell className="text-center">
                    {r.inTgChat ? (
                      <Check className="h-4 w-4 text-green-600 inline" />
                    ) : (
                      <X className="h-4 w-4 text-neutral-300 inline" />
                    )}
                  </TableCell>
                  <TableCell>
                    {r.email && r.type !== "service" ? (
                      <button
                        type="button"
                        onClick={() => !isManage && toggleAccess(r)}
                        disabled={isManage}
                        title={isManage ? undefined : "Переключить доступ"}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                          r.hasAccess
                            ? "bg-green-50 border-green-300 text-green-800"
                            : "bg-neutral-100 border-neutral-300 text-neutral-600"
                        } ${
                          isManage
                            ? "cursor-default"
                            : r.hasAccess
                              ? "hover:bg-green-100"
                              : "hover:bg-neutral-200"
                        }`}
                      >
                        {r.hasAccess ? (
                          <><Check className="h-3 w-3" /> Дан</>
                        ) : (
                          <><X className="h-3 w-3" /> Нет</>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge dict={ENTITY_STATUSES} value={r.status} />
                  </TableCell>
                  <TableCell>
                    {r.lastPaidAt ? formatDate(r.lastPaidAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Настройки"
                        render={
                          <Link href={`${detailBase}/${r.id}?tab=settings`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        }
                      />
                      {!isManage && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => r.userId && setResetPasswordTarget(r)}
                            title="Сменить пароль"
                            className={r.userId ? "" : "invisible pointer-events-none"}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          {r.status === "active" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openArchiveTarget(r)}
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
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

      {wizardOpen && (
        <ExecutorWizard
          bankAccounts={bankAccounts ?? []}
          responsibles={responsibles ?? []}
          onClose={() => setWizardOpen(false)}
          onCreated={() => {
            setWizardOpen(false);
            mutate();
          }}
        />
      )}

      {resetPasswordTarget && (
        <ResetPasswordDialog
          target={resetPasswordTarget}
          onClose={() => setResetPasswordTarget(null)}
        />
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => {
          if (!o) {
            setArchiveTarget(null);
            setArchivePrecheck(null);
          }
        }}
        title="Архивировать исполнителя?"
        description={
          archivePrecheck && (archivePrecheck.openWorks > 0 || archivePrecheck.pendingPayments > 0)
            ? `У исполнителя ${archivePrecheck.openWorks} открытых работ и ${archivePrecheck.pendingPayments} незакрытых выплат. Архивировать всё равно? Доступ к смете будет снят, история сохранится.`
            : `«${archiveTarget?.name}» исчезнет из активных списков. Доступ к смете будет снят. История сохранится.`
        }
        confirmLabel="Архивировать"
        destructive
        onConfirm={async () => {
          if (archiveTarget) await handleArchive(archiveTarget);
        }}
      />

      <ConfirmDialog
        open={!!unarchiveTarget}
        onOpenChange={(o) => !o && setUnarchiveTarget(null)}
        title="Вернуть исполнителя из архива?"
        description={`«${unarchiveTarget?.name}» снова станет доступен. Доступ к смете нужно будет включить отдельно.`}
        confirmLabel="Вернуть"
        onConfirm={async () => {
          if (unarchiveTarget) await handleUnarchive(unarchiveTarget);
        }}
      />
    </div>
  );
}

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function ResetPasswordDialog({
  target,
  onClose,
}: {
  target: Row;
  onClose: () => void;
}) {
  const [password, setPassword] = React.useState(() => generatePassword());
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    if (!password || password.length < 6) {
      toast.error("Пароль не короче 6 символов");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/users/${target.userId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Не удалось изменить пароль");
      return;
    }
    toast.success("Пароль успешно изменён");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сменить пароль — {target.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-neutral-500">
            Введите новый пароль или сгенерируйте случайный. Сообщите пароль пользователю.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="newPwd">Новый пароль</Label>
            <div className="flex gap-2">
              <Input
                id="newPwd"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className="font-mono"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} title="Сгенерировать">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="text-xs text-red-600">Пароль слишком короткий</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving || password.length < 6}>
            {saving ? "Сохранение..." : "Сохранить пароль"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
