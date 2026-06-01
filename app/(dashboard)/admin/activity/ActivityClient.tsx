"use client";

import { useState } from "react";
import useSWR from "swr";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const ACTION_LABELS: Record<string, string> = {
  create: "Создание",
  update: "Обновление",
  delete: "Удаление",
  archive: "Архивация",
  status_change: "Смена статуса",
  check: "Проверка",
  mark_paid: "Оплата",
};

const ENTITY_LABELS: Record<string, string> = {
  Work: "Работа",
  Payment: "Выплата",
  OtherExpense: "Прочие траты",
  Charge: "Начисление",
  Executor: "Исполнитель",
  Project: "Проект",
  Order: "Заказ",
  SpendingPlanLine: "План расходов",
  VacationEntry: "Отпуск",
  Task: "Задача",
  BankAccount: "Банковский счёт",
  WorkType: "Вид работ",
  Client: "Клиент",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  archive: "bg-yellow-100 text-yellow-700",
  status_change: "bg-purple-100 text-purple-700",
  check: "bg-teal-100 text-teal-700",
  mark_paid: "bg-green-100 text-green-700",
};

type LogItem = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  changes: string | null;
  createdAt: string;
  user: { fullName: string; role: string };
};

function parseChanges(raw: string | null): { field: string; from: string; to: string }[] {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw);
    return Object.entries(obj).map(([field, v]: [string, unknown]) => {
      const val = v as { from: unknown; to: unknown };
      return {
        field,
        from: val?.from != null ? String(val.from) : "—",
        to: val?.to != null ? String(val.to) : "—",
      };
    });
  } catch {
    return [];
  }
}

function formatDate(s: string) {
  const d = new Date(s);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ActivityClient() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("_all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const params = new URLSearchParams({ page: String(page) });
  if (entityType !== "_all") params.set("entityType", entityType);

  const { data } = useSWR<{ items: LogItem[]; total: number; pageSize: number }>(
    `/api/activity?${params}`,
    fetcher
  );

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-3rem)] min-h-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">История действий</h1>
        <Select
          value={entityType}
          onValueChange={v => { if (v) { setEntityType(v); setPage(1); } }}
        >
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Все объекты</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-auto flex-1 min-h-0">
        {!data && <div className="p-6 text-sm text-neutral-500">Загрузка…</div>}
        {data && data.items.length === 0 && <div className="p-6 text-sm text-neutral-400 text-center">Нет записей</div>}
        {data && data.items.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 w-36">Время</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 w-36">Пользователь</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 w-24">Действие</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 w-32">Объект</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500">Запись</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(item => {
                const changes = parseChanges(item.changes);
                const isOpen = expanded.has(item.id);
                return (
                  <>
                    <tr
                      key={item.id}
                      className={cn("border-b border-neutral-100 hover:bg-neutral-50", changes.length > 0 ? "cursor-pointer" : "")}
                      onClick={() => changes.length > 0 && toggleExpand(item.id)}
                    >
                      <td className="px-4 py-2 text-xs text-neutral-500 tabular-nums">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-2 text-xs">
                        <span className="font-medium">{item.user.fullName}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", ACTION_COLORS[item.action] ?? "bg-neutral-100 text-neutral-600")}>
                          {ACTION_LABELS[item.action] ?? item.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-600">
                        {ENTITY_LABELS[item.entityType] ?? item.entityType}
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-700">
                        {item.entityLabel ?? item.entityId.slice(0, 8) + "…"}
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-400">
                        {changes.length > 0 && (
                          <span className="text-neutral-400">{isOpen ? "▲" : "▼"}</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && changes.length > 0 && (
                      <tr key={`${item.id}-detail`} className="bg-neutral-50 border-b border-neutral-100">
                        <td colSpan={6} className="px-8 py-3">
                          <div className="text-xs space-y-1">
                            {changes.map(ch => (
                              <div key={ch.field} className="flex items-center gap-2">
                                <span className="text-neutral-500 w-32 shrink-0">{ch.field}:</span>
                                <span className="line-through text-neutral-400">{ch.from}</span>
                                <span className="text-neutral-400">→</span>
                                <span className="text-neutral-700 font-medium">{ch.to}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-neutral-600">
          <span>{data.total} записей, стр. {page} из {totalPages}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
