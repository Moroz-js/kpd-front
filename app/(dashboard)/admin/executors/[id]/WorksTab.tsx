"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle, ChevronDown, CircleDollarSign, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { formatMoney, formatDate, monthFullLabel, MONTHS } from "@/lib/format";
import { WORK_STATUSES, PAYMENT_STATUSES, BADGE_TONE_CLASS } from "@/lib/statuses";
import { nearestPaymentDate, toLocalDateString } from "@/lib/iso-weeks";
import { getISOWeek, getISOWeekYear } from "@/lib/iso-weeks";

type WorkType = { id: string; name: string };
type Project = { id: string; name: string };
type BankAccount = { id: string; name: string };
type PaymentRow = {
  id: string;
  amount: number;
  paymentStatus: string;
  plannedPayAt: string | null;
  paidAt: string | null;
  bankAccountId: string | null;
  bankAccount: { id: string; name: string } | null;
  comment: string | null;
};
type WorkRow = {
  id: string;
  projectId: string;
  project: Project;
  workTypeId: string;
  workType: WorkType;
  executionYear: number;
  executionMonth: number;
  techTask: string | null;
  report: string | null;
  link: string | null;
  volume: number | null;
  rate: number | null;
  amount: number;
  plannedPayAt: string | null;
  paidAt: string | null;
  filledTechTask: string | null;
  filledAct: string | null;
  workStatus: string;
  checkedAt: string | null;
  comment: string | null;
  paymentId: string | null;
  payment: PaymentRow | null;
};

type Props = {
  executorId: string;
  isAdmin: boolean;
  isOwner: boolean;
  bankAccounts: BankAccount[];
};

const WORK_STATUS_LABELS: Record<string, string> = {
  submitted: "Работа выставлена",
  checked: "Работа проверена",
  paid: "Работа оплачена",
  rework: "Нужно доработать",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  planned: "Выплата запланирована",
  paid: "Выплата оплачена",
};

function StatusBadge({ status, type }: { status: string; type: "work" | "payment" }) {
  const dict = type === "work" ? WORK_STATUSES : PAYMENT_STATUSES;
  const entry = dict[status as keyof typeof dict];
  if (!entry) return <span className="text-[10px] text-neutral-400">—</span>;
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight whitespace-nowrap ${BADGE_TONE_CLASS[entry.tone]}`}
    >
      {type === "work" ? WORK_STATUS_LABELS[status] : PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}

type AllPaymentRow = PaymentRow & { periodYear: number; periodMonth: number };

function EditableColHead({
  children,
  className,
  showPencil,
  align = "left",
}: {
  children: React.ReactNode;
  className: string;
  showPencil?: boolean;
  align?: "left" | "right";
}) {
  return (
    <th className={className}>
      <span
        className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end w-full" : ""}`}
      >
        {children}
        {showPencil && <Pencil className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />}
      </span>
    </th>
  );
}

export function WorksTab({ executorId, isAdmin, isOwner, bankAccounts }: Props) {
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [allPayments, setAllPayments] = useState<AllPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterProject, setFilterProject] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all"); // all | works | payments
  const [createWorkOpen, setCreateWorkOpen] = useState(false);
  const [createPaymentOpen, setCreatePaymentOpen] = useState(false);
  const [editWork, setEditWork] = useState<WorkRow | null>(null);
  const [editPayment, setEditPayment] = useState<PaymentRow & { executionYear: number; executionMonth: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "work" | "payment"; id: string; label: string } | null>(null);
  const [checkTarget, setCheckTarget] = useState<WorkRow | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<PaymentRow | null>(null);

  // Bulk state (Р-1)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = React.useState<string>("");
  const [bulkDate, setBulkDate] = React.useState<string>("");

  const fetchData = useCallback(async () => {
    const [worksRes, paymentsRes] = await Promise.all([
      fetch(`/api/executors/${executorId}/works`),
      fetch(`/api/executors/${executorId}/payments`),
    ]);
    if (!worksRes.ok || !paymentsRes.ok) throw new Error();
    const [worksData, paymentsData] = await Promise.all([worksRes.json(), paymentsRes.json()]);
    setWorks(worksData);
    setAllPayments(paymentsData);
  }, [executorId]);

  const load = useCallback(async () => {
    setLoading(true);
    try { await fetchData(); } catch { toast.error("Не удалось загрузить данные"); }
    finally { setLoading(false); }
  }, [fetchData]);

  const silentLoad = useCallback(() => {
    fetchData().catch(() => {});
  }, [fetchData]);

  React.useEffect(() => { load(); }, [load]);

  // Группировка по (year, month) — из работ И из выплат
  const allYears = [
    ...new Set([
      ...works.map((w) => w.executionYear),
      ...allPayments.map((p) => p.periodYear),
    ]),
  ].sort();

  const filtered = works.filter((w) => {
    if (filterYear && String(w.executionYear) !== filterYear) return false;
    if (filterProject && w.projectId !== filterProject) return false;
    return true;
  });
  const filteredPayments = allPayments.filter((p) => {
    if (filterYear && String(p.periodYear) !== filterYear) return false;
    return true;
  });

  type Group = { year: number; month: number; works: WorkRow[]; payments: PaymentRow[] };
  const groupMap = new Map<string, Group>();

  // Добавляем группы из работ
  for (const w of filtered) {
    const key = `${w.executionYear}-${w.executionMonth}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { year: w.executionYear, month: w.executionMonth, works: [], payments: [] });
    }
    groupMap.get(key)!.works.push(w);
  }

  // Собираем выплаты привязанные к работам (чтобы не дублировать)
  const linkedPaymentIds = new Set<string>();
  for (const w of filtered) {
    if (w.payment) linkedPaymentIds.add(w.payment.id);
  }

  // Добавляем выплаты из работ
  for (const group of groupMap.values()) {
    const paymentsMap = new Map<string, PaymentRow>();
    for (const w of group.works) {
      if (w.payment && !paymentsMap.has(w.payment.id)) {
        paymentsMap.set(w.payment.id, w.payment);
      }
    }
    group.payments = [...paymentsMap.values()];
  }

  // Добавляем ручные выплаты (без привязанных работ)
  for (const p of filteredPayments) {
    if (linkedPaymentIds.has(p.id)) continue; // уже в группе через работу
    const key = `${p.periodYear}-${p.periodMonth}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { year: p.periodYear, month: p.periodMonth, works: [], payments: [] });
    }
    const group = groupMap.get(key)!;
    if (!group.payments.find((x) => x.id === p.id)) {
      group.payments.push(p);
    }
  }

  const groups = [...groupMap.values()].sort(
    (a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month
  );

  async function handleCheck(work: WorkRow) {
    // Оптимистичное обновление
    const now = new Date().toISOString();
    setWorks((prev) =>
      prev.map((w) => w.id === work.id ? { ...w, workStatus: "checked", checkedAt: now } : w)
    );
    setCheckTarget(null);
    try {
      const r = await fetch(`/api/executors/${executorId}/works/${work.id}/check`, { method: "POST" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Ошибка");
      }
      toast.success("Работа проверена");
      silentLoad(); // подтягиваем фоново — может создаться авто-выплата
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
      silentLoad(); // откат
    }
  }

  async function handleDeleteWork(id: string) {
    try {
      const r = await fetch(`/api/executors/${executorId}/works/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      toast.success("Работа удалена");
      setDeleteTarget(null);
      silentLoad();
    } catch {
      toast.error("Не удалось удалить работу");
    }
  }

  async function handleDeletePayment(id: string) {
    try {
      const r = await fetch(`/api/executors/${executorId}/payments/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      toast.success("Выплата удалена");
      setDeleteTarget(null);
      silentLoad();
    } catch {
      toast.error("Не удалось удалить выплату");
    }
  }

  const canCreate = isAdmin || isOwner;

  async function handleBulkApply() {
    const patch: { workStatus?: string; plannedPayAt?: string | null } = {};
    if (bulkStatus) patch.workStatus = bulkStatus;
    if (bulkDate !== "") patch.plannedPayAt = bulkDate || null;
    if (Object.keys(patch).length === 0) return;

    const res = await fetch(`/api/executors/${executorId}/works/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds), patch }),
    });
    if (!res.ok) return toast.error("Не удалось применить изменения");
    const { updated } = await res.json();
    toast.success(`Обновлено работ: ${updated}`);
    setSelectedIds(new Set());
    setBulkStatus("");
    setBulkDate("");
    silentLoad();
  }

  async function handleMarkPaid(paymentId: string, paidAt: string, bankAccountId: string | null) {
    // Оптимистичное обновление
    const applyPaid = (p: AllPaymentRow) =>
      p.id === paymentId ? { ...p, paymentStatus: "paid", paidAt } : p;
    setAllPayments((prev) => prev.map(applyPaid));
    setWorks((prev) =>
      prev.map((w) => w.payment ? { ...w, payment: applyPaid(w.payment as AllPaymentRow) } : w)
    );
    setMarkPaidTarget(null);
    try {
      const r = await fetch(`/api/executors/${executorId}/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "paid", paidAt, bankAccountId: bankAccountId || null }),
      });
      if (!r.ok) throw new Error();
      toast.success("Выплата оплачена, работы переведены в «Оплачено»");
      silentLoad();
    } catch {
      toast.error("Не удалось обновить выплату");
      silentLoad();
    }
  }

  async function patchWorkPlannedDate(workId: string, date: string | null) {
    setWorks((prev) =>
      prev.map((w) => w.id === workId ? { ...w, plannedPayAt: date } : w)
    );
    const r = await fetch(`/api/executors/${executorId}/works/${workId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedPayAt: date }),
    });
    if (!r.ok) throw new Error();
  }

  async function patchWorkAmount(workId: string, amount: number) {
    setWorks((prev) =>
      prev.map((w) => {
        if (w.id !== workId) return w;
        const next = { ...w, amount };
        if (w.payment) {
          const linked = prev.filter((x) => x.payment?.id === w.payment!.id);
          const paymentAmount = linked.reduce(
            (s, x) => s + (x.id === workId ? amount : x.amount),
            0
          );
          next.payment = { ...w.payment, amount: paymentAmount };
        }
        return next;
      })
    );
    const r = await fetch(`/api/executors/${executorId}/works/${workId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error ?? "Ошибка");
    }
    silentLoad();
  }

  async function patchPaymentPlannedDate(paymentId: string, date: string | null) {
    const applyDate = (p: AllPaymentRow) => p.id === paymentId ? { ...p, plannedPayAt: date } : p;
    setAllPayments((prev) => prev.map(applyDate));
    setWorks((prev) => prev.map((w) => w.payment ? { ...w, payment: applyDate(w.payment as AllPaymentRow) } : w));
    await fetch(`/api/executors/${executorId}/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedPayAt: date }),
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedIds.size > 0 ? (
          <>
            <span className="text-xs font-medium text-neutral-700">{selectedIds.size} работ выбрано</span>
            {isAdmin && (
              <Select value={bulkStatus} onValueChange={(v) => v && setBulkStatus(v)}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue>{bulkStatus ? (WORK_STATUS_LABELS[bulkStatus] ?? "Статус не менять") : "Статус не менять"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WORK_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              type="date"
              className="h-8 text-xs w-36"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              placeholder="Дата план"
            />
            <Button size="sm" onClick={handleBulkApply} disabled={!bulkStatus && !bulkDate}>
              Применить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" /> Снять
            </Button>
          </>
        ) : (
          <>
            {canCreate && (
              <Button size="sm" onClick={() => setCreateWorkOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Работа
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setCreatePaymentOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Выплата
              </Button>
            )}
          </>
        )}
        <div className="ml-auto flex gap-2 flex-wrap">
          <Select value={filterYear} onValueChange={(v) => setFilterYear(v ?? "")}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue>
                {filterYear ? `${filterYear} год` : "Все годы"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Все годы</SelectItem>
              {allYears.map((y) => (
                <SelectItem key={y} value={String(y)}>{y} год</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterProject} onValueChange={(v) => setFilterProject(v ?? "")}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue>
                {filterProject
                  ? (works.find((w) => w.projectId === filterProject)?.project.name ?? "—")
                  : "Все проекты"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Все проекты</SelectItem>
              {Array.from(new Map(works.map((w) => [w.projectId, w.project])).entries()).map(([id, p]) => (
                <SelectItem key={id} value={id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={(v) => setFilterType(v ?? "")}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue>
                {filterType === "all" ? "Всё" : filterType === "works" ? "Только работы" : "Только выплаты"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всё</SelectItem>
              <SelectItem value="works">Только работы</SelectItem>
              <SelectItem value="payments">Только выплаты</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(() => {
        if (loading) return <div className="text-sm text-neutral-400 py-8 text-center">Загрузка...</div>;

        // Плоский список строк с учётом фильтра типа
        type FlatRow =
          | { kind: "work"; year: number; month: number; data: WorkRow }
          | { kind: "payment"; year: number; month: number; data: PaymentRow & { executionYear: number; executionMonth: number } };

        const flatRows: FlatRow[] = [];
        for (const g of groups) {
          if (filterType !== "payments") {
            for (const w of g.works) flatRows.push({ kind: "work", year: g.year, month: g.month, data: w });
          }
          if (filterType !== "works") {
            for (const p of g.payments) flatRows.push({ kind: "payment", year: g.year, month: g.month, data: { ...p, executionYear: g.year, executionMonth: g.month } });
          }
        }

        if (flatRows.length === 0) return (
          <div className="text-sm text-neutral-400 py-8 text-center">
            {filterYear || filterProject ? "Нет данных по фильтрам" : "Работ ещё нет. Создайте первую работу."}
          </div>
        );

        // Вычисляем rowspan для года/месяца
        const rowspans: number[] = new Array(flatRows.length).fill(0);
        let ri = 0;
        while (ri < flatRows.length) {
          const key = `${flatRows[ri].year}-${flatRows[ri].month}`;
          let cnt = 1;
          while (ri + cnt < flatRows.length && `${flatRows[ri + cnt].year}-${flatRows[ri + cnt].month}` === key) cnt++;
          rowspans[ri] = cnt;
          ri += cnt;
        }

        const th =
          "border-b border-neutral-200 px-1 py-1 text-left text-[10px] leading-tight font-medium text-neutral-600 bg-neutral-100 uppercase tracking-tight";
        const thr =
          "border-b border-neutral-200 px-1 py-1 text-right text-[10px] leading-tight font-medium text-neutral-600 bg-neutral-100 uppercase tracking-tight";
        const td = "border-b border-neutral-100 px-1 py-1 text-[10px] leading-tight";
        const tdDim = "border-b border-neutral-100 px-1 py-1 text-[10px] leading-tight text-neutral-300";
        const tdStatus = `${td} min-w-[8.25rem] w-[8.25rem] px-1.5 overflow-hidden`;
        const tdStatusPay = `${td} min-w-[10rem] w-[10rem] px-1.5 overflow-hidden`;

        const showWorks = filterType !== "payments";
        const showPayments = filterType !== "works";

        return (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full table-fixed text-[10px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={`${th} w-7 px-0.5`}>
                    {(() => {
                      const allWorkIds = flatRows.filter((r) => r.kind === "work").map((r) => r.data.id);
                      const allSelected = allWorkIds.length > 0 && allWorkIds.every((id) => selectedIds.has(id));
                      return (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => {
                            if (allSelected) {
                              setSelectedIds(new Set());
                            } else {
                              setSelectedIds(new Set(allWorkIds));
                            }
                          }}
                          className="h-3.5 w-3.5 cursor-pointer"
                        />
                      );
                    })()}
                  </th>
                  <th className={`${th} w-[2.5%]`}>Год</th>
                  <th className={`${th} w-[5%]`}>Месяц</th>
                  {showWorks && <>
                    <th className={`${th} w-[6%]`}>Проект</th>
                    <th className={`${th} w-[8%]`}>
                      <span className="block normal-case">Тех. задание</span>
                    </th>
                    <th className={`${th} w-[5.5%]`}>Вид работ</th>
                    <th className={`${th} w-[3.5%]`}>Отчёт</th>
                    <th className={`${th} w-[3.5%]`}>Ссылка</th>
                    <th className={`${thr} w-[3.5%]`}>Объём</th>
                    <th className={`${thr} w-[4.5%]`}>Ставка</th>
                    <EditableColHead className={`${thr} w-[5%]`} showPencil={isAdmin} align="right">
                      Сумма
                    </EditableColHead>
                    <EditableColHead className={`${th} w-[5.5%]`} showPencil={isAdmin}>
                      <span className="block normal-case whitespace-normal leading-tight">Дата план (р)</span>
                    </EditableColHead>
                    <th className={`${th} min-w-[8.25rem] w-[8.25rem] px-1.5`}>Статус работы</th>
                  </>}
                  {showPayments && <>
                    <th className={`${thr} w-[5%]`}>Выплата</th>
                    <th className={`${th} w-[5%]`}>
                      <span className="block normal-case whitespace-normal leading-tight">Дата оплаты</span>
                    </th>
                    <EditableColHead className={`${th} w-[5%]`} showPencil={isAdmin}>
                      <span className="block normal-case whitespace-normal leading-tight">Дата план (в)</span>
                    </EditableColHead>
                    <th className={`${th} min-w-[10rem] w-[10rem] px-1.5`}>Статус выплаты</th>
                    <th className={`${th} w-[5.5rem] min-w-[5.5rem]`}>
                      <span className="block normal-case whitespace-normal leading-tight">Счёт в выплате</span>
                    </th>
                  </>}
                  {showWorks && (
                    <>
                      <th className={`${th} w-[4%]`}>
                        <span className="block normal-case whitespace-normal leading-tight">Заполн. ТЗ</span>
                      </th>
                      <th className={`${th} w-[4%]`}>
                        <span className="block normal-case whitespace-normal leading-tight">Заполн. акт</span>
                      </th>
                      <th className={`${th} w-[5%]`}>Проверена</th>
                    </>
                  )}
                  <th className={`${th} w-[3.5%]`}></th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((row, idx) => {
                  const isFirst = rowspans[idx] > 0;
                  const span = rowspans[idx];
                  const groupBorder = isFirst && idx > 0 ? "border-t-2 border-t-neutral-400" : "";
                  const ymClass = `${td} font-medium text-neutral-700 align-top ${groupBorder}`;
                  const dim = "border border-neutral-200 px-2 py-1.5 bg-neutral-100 text-neutral-300";

                  if (row.kind === "work") {
                    const w = row.data;
                    const canEdit = isAdmin || (isOwner && w.workStatus !== "checked" && w.workStatus !== "paid");
                    return (
                      <tr key={w.id} className="hover:bg-neutral-50">
                        <td className="border border-neutral-200 px-1 py-1.5 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(w.id)}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(w.id)) next.delete(w.id); else next.add(w.id);
                                return next;
                              });
                            }}
                            className="h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                        {isFirst && <td className={ymClass} rowSpan={span}>{row.year}</td>}
                        {isFirst && <td className={`${ymClass} whitespace-nowrap`} rowSpan={span}>{monthFullLabel(row.month)}</td>}
                        {showWorks && <>
                          <td className={`${td} truncate`} title={w.project.name}>{w.project.name}</td>
                          <td className={td}>
                            <div className="truncate" title={w.techTask ?? ""}>{w.techTask || "—"}</div>
                          </td>
                          <td className={`${td} truncate text-neutral-600`} title={w.workType.name}>{w.workType.name}</td>
                          <td className={td}>{w.report ? <a href={w.report} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">отч.</a> : <span className="text-neutral-300">—</span>}</td>
                          <td className={td}>{w.link ? <a href={w.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">ссыл.</a> : <span className="text-neutral-300">—</span>}</td>
                          <td className={`${td} text-right text-neutral-600 tabular-nums`}>{w.volume ?? "—"}</td>
                          <td className={`${td} text-right text-neutral-600 tabular-nums`}>{w.rate ? formatMoney(w.rate) : "—"}</td>
                          <td className={`${td} text-right font-medium tabular-nums`}>
                            <InlineAmountInput
                              value={w.amount}
                              disabled={!canEdit}
                              onSave={(n) => patchWorkAmount(w.id, n)}
                            />
                          </td>
                          <td className={td}>
                            <InlineDateInput
                              value={w.plannedPayAt ? new Date(w.plannedPayAt).toISOString().slice(0, 10) : ""}
                              disabled={!isAdmin && !(isOwner && w.workStatus !== "checked" && w.workStatus !== "paid")}
                              onSave={(d) => patchWorkPlannedDate(w.id, d)}
                            />
                          </td>
                          <td className={tdStatus}><StatusBadge status={w.workStatus} type="work" /></td>
                        </>}
                        {showPayments && <>
                          <td className={dim}>—</td>
                          <td className={dim}>—</td>
                          <td className={dim}>—</td>
                          <td className={dim}>—</td>
                          <td className={dim}>—</td>
                        </>}
                        {showWorks && (
                          <>
                            <td className={td}>
                              {w.filledTechTask ? (
                                <a href={w.filledTechTask} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">ТЗ</a>
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                            <td className={td}>
                              {w.filledAct ? (
                                <a href={w.filledAct} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">акт</a>
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                            <td className={`${td} text-neutral-500 whitespace-nowrap`}>{formatDate(w.checkedAt)}</td>
                          </>
                        )}
                        <td className={td}>
                          <div className="flex gap-1 items-center">
                            {isAdmin && w.workStatus !== "checked" && w.workStatus !== "paid" && (
                              <button title="Проверить" className="p-0.5 text-blue-600 hover:text-blue-800" onClick={() => setCheckTarget(w)}>
                                <CheckCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canEdit && <button title="Редактировать" className="p-0.5 text-neutral-500 hover:text-neutral-800" onClick={() => setEditWork(w)}><Pencil className="h-3.5 w-3.5" /></button>}
                            {canEdit && <button title="Удалить" className="p-0.5 text-red-400 hover:text-red-600" onClick={() => setDeleteTarget({ type: "work", id: w.id, label: w.techTask || "работу" })}><Trash2 className="h-3.5 w-3.5" /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const p = row.data;
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30">
                      <td className="border border-neutral-200 px-1 py-1.5 w-8" />
                      {isFirst && <td className={ymClass} rowSpan={span}>{row.year}</td>}
                      {isFirst && <td className={`${ymClass} whitespace-nowrap`} rowSpan={span}>{monthFullLabel(row.month)}</td>}
                      {showWorks && <>
                        <td className={dim}>—</td><td className={dim}>—</td><td className={dim}>—</td>
                        <td className={dim}>—</td><td className={dim}>—</td>
                        <td className={dim}>—</td><td className={dim}>—</td><td className={dim}>—</td>
                        <td className={dim}>—</td><td className={dim}>—</td>
                      </>}
                      {showPayments && <>
                        <td className={`${td} text-right font-semibold text-green-800 tabular-nums`}>{formatMoney(p.amount)}</td>
                        <td className={`${td} whitespace-nowrap`}>{formatDate(p.paidAt)}</td>
                        <td className={td}>
                          <InlineDateInput
                            value={p.plannedPayAt ? new Date(p.plannedPayAt).toISOString().slice(0, 10) : ""}
                            disabled={!isAdmin}
                            onSave={(d) => patchPaymentPlannedDate(p.id, d)}
                          />
                        </td>
                        <td className={tdStatusPay}><StatusBadge status={p.paymentStatus} type="payment" /></td>
                        <td className={`${td} w-[5.5rem] min-w-[5.5rem] truncate text-neutral-600`} title={p.bankAccount?.name ?? undefined}>{p.bankAccount?.name ?? "—"}</td>
                      </>}
                      {showWorks && (
                        <>
                          <td className={dim}>—</td>
                          <td className={dim}>—</td>
                          <td className={dim}>—</td>
                        </>
                      )}
                      <td className={td}>
                        {isAdmin && (
                          <div className="flex gap-1 items-center">
                            {p.paymentStatus !== "paid" && <button title="Оплатить" className="p-0.5 text-green-600 hover:text-green-800" onClick={() => setMarkPaidTarget(p)}><CircleDollarSign className="h-3.5 w-3.5" /></button>}
                            <button title="Редактировать" className="p-0.5 text-neutral-500 hover:text-neutral-800" onClick={() => setEditPayment(p)}><Pencil className="h-3.5 w-3.5" /></button>
                            <button title="Удалить" className="p-0.5 text-red-400 hover:text-red-600" onClick={() => setDeleteTarget({ type: "payment", id: p.id, label: `выплату ${formatMoney(p.amount)} ₽` })}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Create Work Dialog */}
      {createWorkOpen && (
        <CreateWorkDialog
          executorId={executorId}
          onClose={() => setCreateWorkOpen(false)}
          onCreated={() => { setCreateWorkOpen(false); silentLoad(); }}
        />
      )}

      {/* Create Payment Dialog */}
      {createPaymentOpen && (
        <CreatePaymentDialog
          executorId={executorId}
          bankAccounts={bankAccounts}
          onClose={() => setCreatePaymentOpen(false)}
          onCreated={(p) => {
            setCreatePaymentOpen(false);
            setAllPayments((prev) => [...prev, p]);
          }}
        />
      )}

      {/* Edit Work Dialog */}
      {editWork && (
        <EditWorkDialog
          executorId={executorId}
          work={editWork}
          isAdmin={isAdmin}
          onClose={() => setEditWork(null)}
          onSaved={() => { setEditWork(null); silentLoad(); }}
        />
      )}

      {/* Edit Payment Dialog */}
      {editPayment && (
        <EditPaymentDialog
          executorId={executorId}
          payment={editPayment}
          onClose={() => setEditPayment(null)}
          onSaved={() => { setEditPayment(null); silentLoad(); }}
        />
      )}

      {/* Mark Paid Dialog */}
      {markPaidTarget && (
        <MarkPaidDialog
          payment={markPaidTarget}
          bankAccounts={bankAccounts}
          onClose={() => setMarkPaidTarget(null)}
          onConfirm={(paidAt, bankAccountId) => handleMarkPaid(markPaidTarget.id, paidAt, bankAccountId)}
        />
      )}

      {/* Check confirm */}
      <AlertDialog open={!!checkTarget} onOpenChange={(o) => !o && setCheckTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите проверку</AlertDialogTitle>
            <AlertDialogDescription>
              Работа получит статус «Проверено». Если это последняя непроверенная работа месяца, автоматически создастся строка выплаты.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => checkTarget && handleCheck(checkTarget)}>
              Проверить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить {deleteTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "payment"
                ? "Выплата будет удалена, связанные работы вернутся в статус «Выставлено»."
                : "Работа будет удалена безвозвратно. Если работа привязана к выплате — сумма выплаты пересчитается."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "work") handleDeleteWork(deleteTarget.id);
                else handleDeletePayment(deleteTarget.id);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── DateInput: date field that opens calendar on full-area click ─────────

function DateInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="relative w-full cursor-pointer"
      onClick={() => { ref.current?.focus(); try { ref.current?.showPicker(); } catch { /* ignore */ } }}
    >
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors
          file:border-0 file:bg-transparent file:text-sm file:font-medium
          placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1
          focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${className ?? ""}`}
      />
    </div>
  );
}

// ─── Inline Amount Input ──────────────────────────────────────────────────

function InlineAmountInput({
  value,
  disabled,
  onSave,
}: {
  value: number;
  disabled?: boolean;
  onSave: (val: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setLocalVal(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  async function commit() {
    setEditing(false);
    const parsed = parseFloat(localVal.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) {
      setLocalVal(String(value));
      toast.error("Введите корректную сумму");
      return;
    }
    if (parsed === value) return;
    setSaving(true);
    try {
      await onSave(parsed);
    } catch (e) {
      setLocalVal(String(value));
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить сумму");
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return <span className="text-xs tabular-nums">{formatMoney(value)}</span>;
  }

  if (editing || saving) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        step="0.01"
        className="w-full min-w-[4.5rem] max-w-[6rem] ml-auto text-xs text-right border border-neutral-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setEditing(false);
            setLocalVal(String(value));
          }
        }}
        disabled={saving}
      />
    );
  }

  return (
    <button
      type="button"
      className="text-xs tabular-nums w-full text-right hover:text-blue-600 hover:underline cursor-pointer"
      onClick={() => {
        setLocalVal(String(value));
        setEditing(true);
      }}
    >
      {formatMoney(value)}
    </button>
  );
}

// ─── Inline Date Input ────────────────────────────────────────────────────

function InlineDateInput({
  value,
  disabled,
  onSave,
}: {
  value: string; // "YYYY-MM-DD" or ""
  disabled?: boolean;
  onSave: (val: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      try { inputRef.current.showPicker(); } catch { /* не все браузеры поддерживают */ }
    }
  }, [editing]);

  async function handleBlur() {
    setEditing(false);
    if (localVal === value) return;
    setSaving(true);
    try {
      await onSave(localVal || null);
    } catch {
      toast.error("Не удалось сохранить дату");
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return <span className="text-xs text-neutral-500">{value ? formatDate(value) : "—"}</span>;
  }

  if (editing || saving) {
    return (
      <input
        ref={inputRef}
        type="date"
        className="w-full min-w-[7rem] text-xs border border-neutral-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === "Escape") { setEditing(false); setLocalVal(value); } }}
        disabled={saving}
      />
    );
  }

  return (
    <button
      className="text-xs text-left w-full hover:text-blue-600 hover:underline cursor-pointer"
      onClick={() => { setLocalVal(value); setEditing(true); }}
    >
      {value ? (
        <span className="text-neutral-600">{formatDate(value)}</span>
      ) : (
        <span className="text-neutral-300 hover:text-blue-400">поставить дату</span>
      )}
    </button>
  );
}

// ─── Create Work Dialog ────────────────────────────────────────────────

function CreateWorkDialog({
  executorId,
  onClose,
  onCreated,
}: {
  executorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const now = new Date();
  const [projectId, setProjectId] = useState("");
  const [workTypeId, setWorkTypeId] = useState("");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [techTask, setTechTask] = useState("");
  const [volume, setVolume] = useState("");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [plannedPayAt, setPlannedPayAt] = useState(
    toLocalDateString(nearestPaymentDate())
  );
  const [link, setLink] = useState("");
  const [report, setReport] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Динамическая загрузка проектов из плана расходов
  const [planProjects, setPlanProjects] = useState<Project[]>([]);
  const [planWorkTypes, setPlanWorkTypes] = useState<WorkType[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingWorkTypes, setLoadingWorkTypes] = useState(false);

  React.useEffect(() => {
    setLoadingProjects(true);
    fetch(`/api/executors/${executorId}/plan-projects`)
      .then((r) => r.json())
      .then(setPlanProjects)
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, [executorId]);

  React.useEffect(() => {
    if (!projectId) { setPlanWorkTypes([]); return; }
    setLoadingWorkTypes(true);
    setWorkTypeId("");
    fetch(`/api/executors/${executorId}/plan-work-types?projectId=${projectId}`)
      .then((r) => r.json())
      .then(setPlanWorkTypes)
      .catch(() => {})
      .finally(() => setLoadingWorkTypes(false));
  }, [executorId, projectId]);

  // Авто-расчёт суммы
  React.useEffect(() => {
    const v = parseFloat(volume);
    const r = parseFloat(rate);
    if (!isNaN(v) && !isNaN(r)) setAmount(String(v * r));
  }, [volume, rate]);

  async function handleSave() {
    if (!projectId || !workTypeId || !techTask || !amount) {
      toast.error("Заполните обязательные поля");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/executors/${executorId}/works`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workTypeId,
          executionYear: parseInt(year),
          executionMonth: parseInt(month),
          techTask,
          volume: volume ? parseFloat(volume) : null,
          rate: rate ? parseFloat(rate) : null,
          amount: parseFloat(amount),
          plannedPayAt: plannedPayAt || null,
          link: link || null,
          report: report || null,
          comment: comment || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Ошибка");
      }
      toast.success("Работа создана");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новая работа</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Год *</Label>
              <Select value={year} onValueChange={(v) => setYear(v ?? "")}>
                <SelectTrigger><SelectValue>{year} год</SelectValue></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y} год</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Месяц *</Label>
              <Select value={month} onValueChange={(v) => setMonth(v ?? "")}>
                <SelectTrigger><SelectValue>{MONTHS[parseInt(month) - 1]?.label}</SelectValue></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Проект *</Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v ?? "")}>
              <SelectTrigger>
                <SelectValue>
                  {loadingProjects
                    ? "Загрузка..."
                    : projectId ? (planProjects.find((p) => p.id === projectId)?.name ?? "—") : "Выберите проект"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {planProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                {!loadingProjects && planProjects.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-neutral-400">Нет проектов в плане расходов</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Вид работ *</Label>
            <Select value={workTypeId} onValueChange={(v) => setWorkTypeId(v ?? "")} disabled={!projectId}>
              <SelectTrigger>
                <SelectValue>
                  {!projectId
                    ? "Сначала выберите проект"
                    : loadingWorkTypes
                      ? "Загрузка..."
                      : workTypeId ? (planWorkTypes.find((w) => w.id === workTypeId)?.name ?? "—") : "Выберите вид работ"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {planWorkTypes.map((wt) => <SelectItem key={wt.id} value={wt.id}>{wt.name}</SelectItem>)}
                {!loadingWorkTypes && projectId && planWorkTypes.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-neutral-400">Нет видов работ в плане для этого проекта</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Техническое задание *</Label>
            <Input value={techTask} onChange={(e) => setTechTask(e.target.value)} placeholder="Описание задания" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Объём</Label>
              <Input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Ставка</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Сумма *</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Дата оплаты план</Label>
            <DateInput value={plannedPayAt} onChange={setPlannedPayAt} />
          </div>
          <div className="space-y-1.5">
            <Label>Ссылка</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Отчёт</Label>
            <Input value={report} onChange={(e) => setReport(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Комментарий</Label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Work Dialog ──────────────────────────────────────────────────────

function EditWorkDialog({
  executorId,
  work,
  isAdmin,
  onClose,
  onSaved,
}: {
  executorId: string;
  work: WorkRow;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState(work.projectId);
  const [workTypeId, setWorkTypeId] = useState(work.workTypeId);
  const [year, setYear] = useState(String(work.executionYear));
  const [month, setMonth] = useState(String(work.executionMonth));
  const [techTask, setTechTask] = useState(work.techTask ?? "");
  const [volume, setVolume] = useState(work.volume != null ? String(work.volume) : "");
  const [rate, setRate] = useState(work.rate != null ? String(work.rate) : "");
  const [amount, setAmount] = useState(String(work.amount));
  const [plannedPayAt, setPlannedPayAt] = useState(
    work.plannedPayAt ? new Date(work.plannedPayAt).toISOString().slice(0, 10) : ""
  );
  const [link, setLink] = useState(work.link ?? "");
  const [report, setReport] = useState(work.report ?? "");
  const [filledTechTask, setFilledTechTask] = useState(work.filledTechTask ?? "");
  const [filledAct, setFilledAct] = useState(work.filledAct ?? "");
  const [workStatus, setWorkStatus] = useState(work.workStatus);
  const [comment, setComment] = useState(work.comment ?? "");
  const [saving, setSaving] = useState(false);

  // Dynamic plan-based projects/work types
  const [planProjects, setPlanProjects] = useState<Project[]>([]);
  const [planWorkTypes, setPlanWorkTypes] = useState<WorkType[]>([]);

  React.useEffect(() => {
    fetch(`/api/executors/${executorId}/plan-projects`)
      .then((r) => r.json())
      .then(setPlanProjects)
      .catch(() => {});
  }, [executorId]);

  React.useEffect(() => {
    if (!projectId) { setPlanWorkTypes([]); return; }
    fetch(`/api/executors/${executorId}/plan-work-types?projectId=${projectId}`)
      .then((r) => r.json())
      .then(setPlanWorkTypes)
      .catch(() => {});
  }, [executorId, projectId]);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`/api/executors/${executorId}/works/${work.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workTypeId,
          executionYear: parseInt(year),
          executionMonth: parseInt(month),
          techTask,
          volume: volume ? parseFloat(volume) : null,
          rate: rate ? parseFloat(rate) : null,
          amount: parseFloat(amount),
          plannedPayAt: plannedPayAt || null,
          link: link || null,
          report: report || null,
          filledTechTask: filledTechTask || null,
          filledAct: filledAct || null,
          workStatus: isAdmin ? workStatus : undefined,
          comment: comment || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Ошибка");
      }
      toast.success("Работа обновлена");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактировать работу</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Год</Label>
              <Select value={year} onValueChange={(v) => setYear(v ?? "")}>
                <SelectTrigger><SelectValue>{year} год</SelectValue></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y} год</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Месяц</Label>
              <Select value={month} onValueChange={(v) => setMonth(v ?? "")}>
                <SelectTrigger><SelectValue>{MONTHS[parseInt(month) - 1]?.label}</SelectValue></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Проект</Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v ?? "")}>
              <SelectTrigger>
                <SelectValue>{planProjects.find((p) => p.id === projectId)?.name ?? work.project.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {planProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Вид работ</Label>
            <Select value={workTypeId} onValueChange={(v) => setWorkTypeId(v ?? "")}>
              <SelectTrigger>
                <SelectValue>{planWorkTypes.find((w) => w.id === workTypeId)?.name ?? work.workType.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {planWorkTypes.map((wt) => <SelectItem key={wt.id} value={wt.id}>{wt.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Техническое задание</Label>
            <Input value={techTask} onChange={(e) => setTechTask(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Объём</Label>
              <Input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ставка</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Сумма</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Дата оплаты план</Label>
            <DateInput value={plannedPayAt} onChange={setPlannedPayAt} />
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <Select value={workStatus} onValueChange={(v) => setWorkStatus(v ?? "")}>
                <SelectTrigger>
                  <SelectValue>
                    {WORK_STATUS_LABELS[workStatus] ?? workStatus}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WORK_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Ссылка</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Отчёт (URL)</Label>
            <Input value={report} onChange={(e) => setReport(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Заполненное ТЗ (URL)</Label>
            <Input value={filledTechTask} onChange={(e) => setFilledTechTask(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Заполненный акт (URL)</Label>
            <Input value={filledAct} onChange={(e) => setFilledAct(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Комментарий</Label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Payment Dialog ─────────────────────────────────────────────────

function CreatePaymentDialog({
  executorId,
  bankAccounts,
  onClose,
  onCreated,
}: {
  executorId: string;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onCreated: (payment: AllPaymentRow) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [amount, setAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("planned");
  const [bankAccountId, setBankAccountId] = useState("");
  const [plannedPayAt, setPlannedPayAt] = useState(
    toLocalDateString(nearestPaymentDate())
  );
  const [paidAt, setPaidAt] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  async function handleSave() {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Введите сумму выплаты");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/executors/${executorId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodYear: parseInt(year),
          periodMonth: parseInt(month),
          amount: parseFloat(amount),
          paymentStatus,
          bankAccountId: bankAccountId || null,
          plannedPayAt: plannedPayAt || null,
          paidAt: paidAt || null,
          comment: comment || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Ошибка");
      }
      const created = await r.json();
      toast.success("Выплата создана");
      onCreated(created);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новая выплата</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Год *</Label>
              <Select value={year} onValueChange={(v) => setYear(v ?? "")}>
                <SelectTrigger><SelectValue>{year} год</SelectValue></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y} год</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Месяц *</Label>
              <Select value={month} onValueChange={(v) => setMonth(v ?? "")}>
                <SelectTrigger><SelectValue>{MONTHS[parseInt(month) - 1]?.label}</SelectValue></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Сумма *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Статус</Label>
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v ?? "")}>
              <SelectTrigger>
                <SelectValue>{PAYMENT_STATUS_LABELS[paymentStatus]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Выплата запланирована</SelectItem>
                <SelectItem value="paid">Выплата оплачена</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Источник оплаты</Label>
            <Select value={bankAccountId} onValueChange={(v) => setBankAccountId(v ?? "")}>
              <SelectTrigger>
                <SelectValue>
                  {bankAccountId
                    ? (bankAccounts.find((b) => b.id === bankAccountId)?.name ?? "—")
                    : "— По умолчанию —"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— По умолчанию —</SelectItem>
                {bankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Дата оплаты план</Label>
            <DateInput value={plannedPayAt} onChange={setPlannedPayAt} />
          </div>
          <div className="space-y-1.5">
            <Label>Дата оплаты (факт)</Label>
            <DateInput value={paidAt} onChange={setPaidAt} />
          </div>
          <div className="space-y-1.5">
            <Label>Комментарий</Label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mark Paid Dialog ─────────────────────────────────────────────────────

function MarkPaidDialog({
  payment,
  bankAccounts,
  onClose,
  onConfirm,
}: {
  payment: PaymentRow;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onConfirm: (paidAt: string, bankAccountId: string | null) => void;
}) {
  const [paidAt, setPaidAt] = useState(toLocalDateString(new Date()));
  const [bankAccountId, setBankAccountId] = useState(payment.bankAccountId ?? "");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Оплатить выплату</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Дата оплаты *</Label>
            <DateInput value={paidAt} onChange={setPaidAt} />
          </div>
          <div className="space-y-1.5">
            <Label>Источник оплаты</Label>
            <Select value={bankAccountId} onValueChange={(v) => setBankAccountId(v ?? "")}>
              <SelectTrigger>
                <SelectValue>
                  {bankAccountId
                    ? (bankAccounts.find((b) => b.id === bankAccountId)?.name ?? "—")
                    : "— По умолчанию —"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— По умолчанию —</SelectItem>
                {bankAccounts.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={!paidAt}
            onClick={() => onConfirm(paidAt, bankAccountId || null)}
          >
            Оплатить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Payment Dialog ───────────────────────────────────────────────────

function EditPaymentDialog({
  executorId,
  payment,
  onClose,
  onSaved,
}: {
  executorId: string;
  payment: PaymentRow & { executionYear: number; executionMonth: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paidAt, setPaidAt] = useState(
    payment.paidAt ? new Date(payment.paidAt).toISOString().slice(0, 10) : ""
  );
  const [comment, setComment] = useState(payment.comment ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`/api/executors/${executorId}/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAt: paidAt || null, comment: comment || null }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Ошибка");
      }
      toast.success("Выплата обновлена");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Комментарий к выплате</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Дата оплаты (факт)</Label>
            <DateInput value={paidAt} onChange={setPaidAt} />
          </div>
          <div className="space-y-1.5">
            <Label>Комментарий</Label>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Введите комментарий"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
