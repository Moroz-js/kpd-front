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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WeekHeader = { week: number; month: number; monthName: string };

type ProjectRow = {
  id: string;
  name: string;
  plan: number[];
  charges: number[];
  cashflow: number[];
};

type Props = {
  weeks: WeekHeader[];
  balanceEndDP: number[];
  balanceEndBudget: number[];
  projects: ProjectRow[];
  currentISOWeek: number;
  currentISOYear: number;
  year: number;
};

const ALL_PROJECTS = "_all";

const SERIES_ALL = [
  { key: "Баланс (из ДП)", color: "#2563eb", dash: undefined as string | undefined },
  { key: "Баланс из смет", color: "#16a34a", dash: "4 2" },
] as const;

const SERIES_PROJECT = [
  { key: "Кэшфлоу", color: "#2563eb", dash: undefined },
  { key: "План расходов (ДП)", color: "#dc2626", dash: "4 2" },
  { key: "План доходов", color: "#16a34a", dash: undefined },
] as const;

function fmtY(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}М`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}К`;
  return String(v);
}

export function CashflowChart({
  weeks,
  balanceEndDP,
  balanceEndBudget,
  projects,
  currentISOWeek,
  currentISOYear,
  year,
}: Props) {
  const [projectId, setProjectId] = React.useState(ALL_PROJECTS);

  const sortedProjects = React.useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [projects]
  );

  const selectedProject = React.useMemo(
    () => sortedProjects.find((p) => p.id === projectId),
    [sortedProjects, projectId]
  );

  const series = projectId === ALL_PROJECTS ? SERIES_ALL : SERIES_PROJECT;

  const data = React.useMemo(() => {
    return weeks.map((wh, i) => {
      const base = {
        name: `${wh.week} (${wh.monthName})`,
        week: wh.week,
        isCurrent: wh.week === currentISOWeek && year === currentISOYear,
      };
      if (projectId === ALL_PROJECTS) {
        return {
          ...base,
          "Баланс (из ДП)": balanceEndDP[i] ?? 0,
          "Баланс из смет": balanceEndBudget[i] ?? 0,
        };
      }
      const p = selectedProject;
      return {
        ...base,
        Кэшфлоу: p?.cashflow[i] ?? 0,
        "План расходов (ДП)": p?.plan[i] ?? 0,
        "План доходов": p?.charges[i] ?? 0,
      };
    });
  }, [
    weeks,
    projectId,
    selectedProject,
    balanceEndDP,
    balanceEndBudget,
    currentISOWeek,
    currentISOYear,
    year,
  ]);

  const chartTitle =
    projectId === ALL_PROJECTS
      ? "Динамика баланса по неделям"
      : `Проект: ${selectedProject?.name ?? ""}`;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-700">{chartTitle}</h2>
        <Select
          value={projectId}
          onValueChange={(v) => v && setProjectId(v)}
        >
          <SelectTrigger className="h-8 w-64 max-w-full text-sm">
            <SelectValue placeholder="Проект">
              {projectId === ALL_PROJECTS
                ? "Все проекты"
                : selectedProject?.name ?? "Проект"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROJECTS}>Все проекты</SelectItem>
            {sortedProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
          {series.map((s) => (
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
