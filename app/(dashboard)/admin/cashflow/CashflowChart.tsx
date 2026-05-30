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

type WeekHeader = { week: number; month: number; monthName: string };

type Props = {
  weeks: WeekHeader[];
  balanceEndDP: number[];
  balanceEndBudget: number[];
  currentISOWeek: number;
  year: number;
};

function fmtY(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}М`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}К`;
  return String(v);
}

export function CashflowChart({ weeks, balanceEndDP, balanceEndBudget, currentISOWeek, year }: Props) {
  const currentYear = new Date().getFullYear();

  const data = weeks.map((wh, i) => ({
    name: `${wh.week} (${wh.monthName})`,
    week: wh.week,
    "Баланс (из ДП)": balanceEndDP[i] ?? 0,
    "Баланс из смет": balanceEndBudget[i] ?? 0,
    isCurrent: wh.week === currentISOWeek && year === currentYear,
  }));

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-700 mb-4">Динамика баланса по неделям</h2>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickFormatter={(v) => `Н${v}`}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickFormatter={fmtY}
            width={64}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              value.toLocaleString("ru-RU", { maximumFractionDigits: 0 }),
              name,
            ]}
            labelFormatter={(label) => {
              const entry = data.find((d) => d.week === label);
              return entry ? `Нед. ${label} (${entry.name.split(" (")[1]?.replace(")", "") ?? ""})` : `Нед. ${label}`;
            }}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="Баланс (из ДП)"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="Баланс из смет"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
