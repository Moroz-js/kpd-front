"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type WeekHeader = { week: number; monthName: string };

const SERIES = [
  { key: "Кэшфлоу", color: "#2563eb", dash: undefined as string | undefined },
  { key: "План расходов", color: "#dc2626", dash: "4 2" },
  { key: "План доходов", color: "#16a34a", dash: undefined },
] as const;

function fmtY(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}М`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}К`;
  return String(v);
}

type Props = {
  weeks: WeekHeader[];
  cashflow: number[];
  expensePlan: number[];
  incomePlanFact: number[];
};

/** График кэшфлоу одного проекта (те же серии, что в /admin/cashflow при выборе проекта). */
export function ProjectCashflowChart({
  weeks,
  cashflow,
  expensePlan,
  incomePlanFact,
}: Props) {
  const data = React.useMemo(
    () =>
      weeks.map((wh, i) => ({
        name: `${wh.week} (${wh.monthName})`,
        week: wh.week,
        Кэшфлоу: cashflow[i] ?? 0,
        "План расходов": expensePlan[i] ?? 0,
        "План доходов": incomePlanFact[i] ?? 0,
      })),
    [weeks, cashflow, expensePlan, incomePlanFact]
  );

  if (weeks.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
        Нет данных для графика
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold text-neutral-700">График кэшфлоу</h2>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickFormatter={(v) => `Н${v}`}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={fmtY} width={64} />
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number"
                ? value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })
                : String(value ?? ""),
              name as string,
            ]}
            labelFormatter={(label) => {
              const entry = data.find((d) => d.week === label);
              return entry
                ? `Нед. ${label} (${entry.name.split(" (")[1]?.replace(")", "") ?? ""})`
                : `Нед. ${label}`;
            }}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              strokeDasharray={s.dash}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
