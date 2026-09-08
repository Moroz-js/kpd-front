"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/PageHeader";
import { MultiSelectFilter } from "@/components/ui-custom/MultiSelectFilter";
import { FilterResetButton } from "@/components/ui-custom/FilterResetButton";
import { StatusBadge } from "@/components/ui-custom/StatusBadge";
import { SortableHead } from "@/components/ui-custom/SortableHead";
import { ConfirmDialog } from "@/components/ui-custom/ConfirmDialog";
import { ExpandableListCell } from "@/components/ui-custom/ExpandableListCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { compactCell, compactHead, compactTable, stickyActionsCell, stickyActionsHead, stickyActionsInner } from "@/lib/table-styles";
import { matchesSearchText } from "@/lib/search";
import {
  COUNTERPARTY_KINDS,
  COUNTERPARTY_LEGAL_TYPES,
  COUNTERPARTY_PAYMENT_METHODS,
  ENTITY_STATUSES,
} from "@/lib/statuses";
import {
  usePersistedInterfaceState,
  usePersistedScroll,
} from "@/components/PersistedInterfaceState";
import { CounterpartyDialog } from "./CounterpartyDialog";
import { requisiteValues, type Counterparty, type LinkOption } from "./types";

const TABS = [
  { id: "all", label: "Все" },
  { id: "client", label: "Клиенты" },
  { id: "executor", label: "Исполнители" },
  { id: "service", label: "Сервисы" },
  { id: "bank", label: "Банки" },
  { id: "own_account", label: "Наши счета" },
] as const;
type Tab = (typeof TABS)[number]["id"];

type SortField = "name" | "status" | "operationCount";
type SortDir = "asc" | "desc";

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<Counterparty[]>);

export function CounterpartiesClient({
  executors,
  clients,
  bankAccounts,
}: {
  executors: LinkOption[];
  clients: LinkOption[];
  bankAccounts: LinkOption[];
}) {
  const { data, isLoading, mutate } = useSWR<Counterparty[]>("/api/counterparties", fetcher);
  const rowsAll = React.useMemo(() => data ?? [], [data]);

  const [activeTab, setActiveTab] = React.useState<Tab>("all");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string[]>(["active"]);
  const [legalTypeFilter, setLegalTypeFilter] = React.useState<string[]>([]);
  const [methodFilter, setMethodFilter] = React.useState<string[]>([]);
  const [sort, setSort] = React.useState<{ field: SortField; dir: SortDir }>({
    field: "name",
    dir: "asc",
  });

  const [editing, setEditing] = React.useState<Counterparty | "new" | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<Counterparty | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = React.useState<Counterparty | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter.length > 0 ||
    legalTypeFilter.length > 0 ||
    methodFilter.length > 0;

  function resetFilters() {
    setSearch("");
    setStatusFilter([]);
    setLegalTypeFilter([]);
    setMethodFilter([]);
  }

  usePersistedInterfaceState(
    "counterparties",
    { activeTab, statusFilter, legalTypeFilter, methodFilter, sort },
    (stored) => {
      if (stored.activeTab !== undefined) setActiveTab(stored.activeTab);
      if (stored.statusFilter) setStatusFilter(stored.statusFilter);
      if (stored.legalTypeFilter) setLegalTypeFilter(stored.legalTypeFilter);
      if (stored.methodFilter) setMethodFilter(stored.methodFilter);
      if (stored.sort) setSort(stored.sort);
    }
  );
  usePersistedScroll(scrollRef, `counterparties-table:${activeTab}`, {
    enabled: !isLoading && !!data,
    signature: { activeTab, statusFilter, legalTypeFilter, methodFilter, sort },
  });

  const tabCounts = React.useMemo(
    () =>
      Object.fromEntries(
        TABS.map((tab) => [
          tab.id,
          tab.id === "all" ? rowsAll.length : rowsAll.filter((r) => r.kind === tab.id).length,
        ])
      ) as Record<Tab, number>,
    [rowsAll]
  );

  const rows = React.useMemo(() => {
    let list = activeTab === "all" ? rowsAll : rowsAll.filter((r) => r.kind === activeTab);

    if (statusFilter.length) list = list.filter((r) => statusFilter.includes(r.status));
    if (legalTypeFilter.length)
      list = list.filter((r) => r.legalType && legalTypeFilter.includes(r.legalType));
    if (methodFilter.length)
      list = list.filter((r) => r.requisites.some((q) => methodFilter.includes(q.paymentMethod)));

    // Поиск идёт и по написаниям из выписки, и по реквизитам: бухгалтер ищет по тому,
    // что видит в банке, а не по нашему названию.
    if (search.trim()) {
      list = list.filter((r) =>
        matchesSearchText(
          search,
          r.name,
          [
            r.executorName,
            r.clientName,
            r.bankAccountName,
            ...r.aliases.map((a) => a.value),
            ...r.requisites.flatMap((q) => [q.taxId, q.accountNumber, q.cardNumber, q.bankName]),
          ]
            .filter(Boolean)
            .join(" ")
        )
      );
    }

    return [...list].sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "ru");
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rowsAll, activeTab, statusFilter, legalTypeFilter, methodFilter, search, sort]);

  function handleSort(field: string, dir: SortDir) {
    setSort({ field: field as SortField, dir });
  }

  async function toggleArchive(row: Counterparty, archive: boolean) {
    const res = await fetch(`/api/counterparties/${row.id}/archive`, {
      method: archive ? "POST" : "DELETE",
    });
    if (!res.ok) {
      toast.error(archive ? "Не удалось архивировать" : "Не удалось вернуть из архива");
      return;
    }
    toast.success(
      archive ? `Контрагент «${row.name}» в архиве` : `Контрагент «${row.name}» снова активен`
    );
    mutate();
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <PageHeader
        title="Контрагенты"
        description="Строка — юридический получатель: конкретное физлицо, ИП или компания. Реквизиты и написания из выписки лежат внутри карточки."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-1 h-4 w-4" /> Добавить контрагента
          </Button>
        }
      />

      <div className="mb-4 border-b border-neutral-200">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs text-neutral-400">{tabCounts[tab.id]}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию, написанию в выписке, ИНН, счёту"
          className="h-8 w-96"
        />
        <div className="ml-auto flex items-center gap-2">
          <FilterResetButton active={hasActiveFilters} onClick={resetFilters} />
          <MultiSelectFilter
            label="Юрлицо"
            options={Object.entries(COUNTERPARTY_LEGAL_TYPES).map(([value, label]) => ({
              value,
              label,
            }))}
            value={legalTypeFilter}
            onChange={setLegalTypeFilter}
          />
          <MultiSelectFilter
            label="Способ оплаты"
            options={Object.entries(COUNTERPARTY_PAYMENT_METHODS).map(([value, label]) => ({
              value,
              label,
            }))}
            value={methodFilter}
            onChange={setMethodFilter}
          />
          <MultiSelectFilter
            label="Статус"
            options={Object.entries(ENTITY_STATUSES).map(([value, { label }]) => ({
              value,
              label,
            }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>

      <Table
        containerRef={scrollRef}
        containerClassName="rounded-md border bg-white flex-1 min-h-0 overflow-auto"
        className={compactTable}
      >
        <TableHeader>
          <TableRow>
            <SortableHead
              field="name"
              sortBy={sort.field}
              sortDir={sort.dir}
              onSort={handleSort}
              className={cn(compactHead, "w-56")}
            >
              Контрагент
            </SortableHead>
            <TableHead className={cn(compactHead, "w-24")}>Тип</TableHead>
            <TableHead className={cn(compactHead, "w-20")}>Личная смета</TableHead>
            <TableHead className={cn(compactHead, "w-28")}>Юрлицо</TableHead>
            <SortableHead
              field="status"
              sortBy={sort.field}
              sortDir={sort.dir}
              onSort={handleSort}
              className={cn(compactHead, "w-24")}
            >
              Статус
            </SortableHead>
            <TableHead className={cn(compactHead, "w-32")}>Способ оплаты</TableHead>
            <TableHead className={cn(compactHead, "w-32")}>ИНН / ИИК / IBAN</TableHead>
            <TableHead className={cn(compactHead, "w-24")}>БИК</TableHead>
            <TableHead className={cn(compactHead, "w-28")}>Банк</TableHead>
            <TableHead className={cn(compactHead, "w-32")}>Номер счёта</TableHead>
            <TableHead className={cn(compactHead, "w-28")}>Номер карты</TableHead>
            <TableHead className={cn(compactHead, "w-40")}>Имена в выписке</TableHead>
            <SortableHead
              field="operationCount"
              sortBy={sort.field}
              sortDir={sort.dir}
              onSort={handleSort}
              className={cn(compactHead, "w-20 text-right")}
            >
              Операций
            </SortableHead>
            <TableHead className={stickyActionsHead} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={14} className="py-8 text-center text-neutral-500">
                Загрузка...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={14} className="py-8 text-center text-neutral-500">
                Нет контрагентов
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const linkedName = r.executorName ?? r.clientName ?? r.bankAccountName;
              return (
                <TableRow key={r.id}>
                  <TableCell className={cn(compactCell, "font-medium")}>
                    {r.executorId ? (
                      <Link
                        href={`/admin/executors/${r.executorId}`}
                        className="block truncate text-blue-700 hover:underline"
                        title={r.name}
                      >
                        {r.name}
                      </Link>
                    ) : (
                      <span className="block truncate" title={r.name}>
                        {r.name}
                      </span>
                    )}
                    {linkedName && linkedName !== r.name && (
                      <span className="block truncate text-[10px] text-neutral-400">
                        {linkedName}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={cn(compactCell, "truncate")}>
                    {COUNTERPARTY_KINDS[r.kind as keyof typeof COUNTERPARTY_KINDS] ?? r.kind}
                  </TableCell>
                  <TableCell className={compactCell}>
                    {r.personalEstimateUrl ? (
                      <Link
                        href={r.personalEstimateUrl}
                        className="text-blue-700 hover:underline"
                        title="Открыть личную смету"
                      >
                        Смета
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className={cn(compactCell, "truncate")}>
                    {r.legalType
                      ? (COUNTERPARTY_LEGAL_TYPES[
                          r.legalType as keyof typeof COUNTERPARTY_LEGAL_TYPES
                        ] ?? r.legalType)
                      : "—"}
                  </TableCell>
                  <TableCell className={compactCell}>
                    <StatusBadge dict={ENTITY_STATUSES} value={r.status} />
                  </TableCell>
                  <TableCell className={compactCell}>
                    <ExpandableListCell
                      items={[
                        ...new Set(
                          r.requisites.map(
                            (q) =>
                              COUNTERPARTY_PAYMENT_METHODS[
                                q.paymentMethod as keyof typeof COUNTERPARTY_PAYMENT_METHODS
                              ] ?? q.paymentMethod
                          )
                        ),
                      ]}
                    />
                  </TableCell>
                  <TableCell className={compactCell}>
                    <ExpandableListCell items={requisiteValues(r.requisites, "taxId")} />
                  </TableCell>
                  <TableCell className={compactCell}>
                    <ExpandableListCell items={requisiteValues(r.requisites, "bic")} />
                  </TableCell>
                  <TableCell className={compactCell}>
                    <ExpandableListCell items={requisiteValues(r.requisites, "bankName")} />
                  </TableCell>
                  <TableCell className={compactCell}>
                    <ExpandableListCell items={requisiteValues(r.requisites, "accountNumber")} />
                  </TableCell>
                  <TableCell className={compactCell}>
                    <ExpandableListCell items={requisiteValues(r.requisites, "cardNumber")} />
                  </TableCell>
                  <TableCell className={compactCell}>
                    <ExpandableListCell items={r.aliases.map((a) => a.value)} />
                  </TableCell>
                  <TableCell className={cn(compactCell, "text-right tabular-nums")}>
                    {r.operationCount}
                  </TableCell>
                  <TableCell className={cn(stickyActionsCell)}>
                    <div className={stickyActionsInner}>
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
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {editing && (
        <CounterpartyDialog
          row={editing === "new" ? null : editing}
          executors={executors}
          clients={clients}
          bankAccounts={bankAccounts}
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
        title="Архивировать контрагента?"
        description={`«${archiveTarget?.name}» перестанет предлагаться при разборе операций. Уже привязанные операции не изменятся.`}
        confirmLabel="Архивировать"
        destructive
        onConfirm={async () => {
          if (archiveTarget) await toggleArchive(archiveTarget, true);
        }}
      />

      <ConfirmDialog
        open={!!unarchiveTarget}
        onOpenChange={(open) => !open && setUnarchiveTarget(null)}
        title="Вернуть контрагента из архива?"
        description={`«${unarchiveTarget?.name}» снова появится в активных списках.`}
        confirmLabel="Вернуть"
        onConfirm={async () => {
          if (unarchiveTarget) await toggleArchive(unarchiveTarget, false);
        }}
      />
    </div>
  );
}
