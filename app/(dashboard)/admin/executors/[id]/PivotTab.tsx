"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";

type PivotRow = {
  projectId: string;
  projectName: string;
  total: number;
  months: number[];
};

type PivotData = {
  year: number;
  type: string;
  months: string[];
  pivot: PivotRow[];
};

type Props = {
  executorId: string;
  type: "paid" | "debt";
};

export function PivotTab({ executorId, type }: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<PivotData | null>(null);
  const [loading, setLoading] = useState(false);

  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    setLoading(true);
    fetch(`/api/executors/${executorId}/pivot?year=${year}&type=${type}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast.error("Не удалось загрузить данные"))
      .finally(() => setLoading(false));
  }, [executorId, year, type]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={year} onValueChange={(v) => setYear(v ?? "")}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue>{year} год</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y} год</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-neutral-500">
          {type === "paid" ? "Сумма оплаченных работ по проектам" : "Непогашенный долг по проектам"}
        </span>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-400 text-center py-8">Загрузка...</div>
      ) : !data || data.pivot.length === 0 ? (
        <div className="text-sm text-neutral-400 text-center py-8">
          {type === "paid" ? "Нет оплаченных работ за выбранный год" : "Долгов нет"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-neutral-50">
                <th className="border border-neutral-200 px-3 py-2 text-left font-medium text-neutral-600 min-w-[200px]">
                  {type === "paid" ? `Оплачено ${year}` : `Долг ${year}`}
                </th>
                <th className="border border-neutral-200 px-3 py-2 text-right font-medium text-neutral-600">Итого</th>
                {data.months.map((m) => (
                  <th key={m} className="border border-neutral-200 px-2 py-2 text-right font-medium text-neutral-600 min-w-[70px]">
                    {m.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.pivot.map((row) => (
                <tr key={row.projectId} className="hover:bg-neutral-50">
                  <td className="border border-neutral-200 px-3 py-1.5 font-medium">{row.projectName}</td>
                  <td className="border border-neutral-200 px-3 py-1.5 text-right font-semibold">
                    {formatMoney(row.total)}
                  </td>
                  {row.months.map((v, i) => (
                    <td key={i} className={`border border-neutral-200 px-2 py-1.5 text-right ${v === 0 ? "text-neutral-300" : ""}`}>
                      {v === 0 ? "0" : formatMoney(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-100 font-semibold">
                <td className="border border-neutral-200 px-3 py-1.5">Итого</td>
                <td className="border border-neutral-200 px-3 py-1.5 text-right">
                  {formatMoney(data.pivot.reduce((s, r) => s + r.total, 0))}
                </td>
                {data.months.map((_, i) => {
                  const colSum = data.pivot.reduce((s, r) => s + (r.months[i] ?? 0), 0);
                  return (
                    <td key={i} className={`border border-neutral-200 px-2 py-1.5 text-right ${colSum === 0 ? "text-neutral-400" : ""}`}>
                      {colSum === 0 ? "0" : formatMoney(colSum)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
