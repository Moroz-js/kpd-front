"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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
const POS_COLOR = "#22c55e";
const NEG_COLOR = "#f472b6";

const SERIES_PROJECT = [
  { key: "Кэшфлоу", color: "#2563eb", dash: undefined as string | undefined },
  { key: "План расходов (ДП)", color: "#dc2626", dash: "4 2" },
  { key: "План доходов", color: "#16a34a", dash: undefined },
] as const;

function fmtY(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}М`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}К`;
  return String(v);
}

function barColor(value: number) {
  return value < 0 ? NEG_COLOR : POS_COLOR;
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
  const [showDP, setShowDP] = React.useState(true);
  const [showBudget, setShowBudget] = React.useState(true);
  const [showFromStart, setShowFromStart] = React.useState(false);

  const sortedProjects = React.useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [projects]
  );

  const selectedProject = React.useMemo(
    () => sortedProjects.find((p) => p.id === projectId),
    [sortedProjects, projectId]
  );

  const isCurrentYear = year === currentISOYear;
  const defaultFromWeek = Math.max(1, currentISOWeek - 3);

  const visibleIndices = React.useMemo(() => {
    if (!isCurrentYear || showFromStart) {
      return weeks.map((_, i) => i);
    }
    return weeks
      .map((wh, i) => ({ wh, i }))
      .filter(({ wh }) => wh.week >= defaultFromWeek)
      .map(({ i }) => i);
  }, [weeks, isCurrentYear, showFromStart, defaultFromWeek]);

  const barData = React.useMemo(() => {
    return visibleIndices.map((i) => {
      const wh = weeks[i];
      return {
        name: String(wh.week),
        week: wh.week,
        monthName: wh.monthName,
        month: wh.month,
        isCurrent: wh.week === currentISOWeek && year === currentISOYear,
        dp: balanceEndDP[i] ?? 0,
        budget: balanceEndBudget[i] ?? 0,
      };
    });
  }, [
    visibleIndices,
    weeks,
    balanceEndDP,
    balanceEndBudget,
    currentISOWeek,
    currentISOYear,
    year,
  ]);

  const projectData = React.useMemo(() => {
    return weeks.map((wh, i) => {
      const p = selectedProject;
      return {
        name: `${wh.week} (${wh.monthName})`,
        week: wh.week,
        isCurrent: wh.week === currentISOWeek && year === currentISOYear,
        Кэшфлоу: p?.cashflow[i] ?? 0,
        "План расходов (ДП)": p?.plan[i] ?? 0,
        "План доходов": p?.charges[i] ?? 0,
      };
    });
  }, [weeks, selectedProject, currentISOWeek, currentISOYear, year]);

  const chartTitle =
    projectId === ALL_PROJECTS
      ? "Динамика баланса по неделям"
      : `Проект: ${selectedProject?.name ?? ""}`;

  const monthTicks = React.useMemo(() => {
    const seen = new Set<string>();
    const ticks: { week: number; label: string }[] = [];
    for (const d of barData) {
      const key = `${d.month}-${d.monthName}`;
      if (!seen.has(key)) {
        seen.add(key);
        ticks.push({ week: d.week, label: d.monthName });
      }
    }
    return ticks;
  }, [barData]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-700">{chartTitle}</h2>
        <div className="flex flex-wrap items-center gap-3">
          {projectId === ALL_PROJECTS && (
            <>
              <label className="flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer select-none">
                <Checkbox checked={showDP} onCheckedChange={(v) => setShowDP(v === true)} />
                Баланс из ДП
              </label>
              <label className="flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer select-none">
                <Checkbox checked={showBudget} onCheckedChange={(v) => setShowBudget(v === true)} />
                Баланс из смет
              </label>
              {isCurrentYear && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowFromStart((v) => !v)}
                >
                  {showFromStart ? "Свернуть" : "Показать с начала"}
                </Button>
              )}
            </>
          )}
          <Select value={projectId} onValueChange={(v) => v && setProjectId(v)}>
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
      </div>

      {projectId === ALL_PROJECTS ? (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={barData} margin={{ top: 24, right: 24, left: 24, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "#737373" }}
              tickFormatter={(w: number) => {
                const t = monthTicks.find((m) => m.week === w);
                return t ? t.label : "";
              }}
              interval={0}
            />
            <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: "#737373" }} width={56} />
            <Tooltip
              formatter={(value) => fmtY(Number(value ?? 0))}
              labelFormatter={(label) => `Неделя ${label}`}
            />
            {showDP && (
              <Bar dataKey="dp" name="Баланс из ДП" radius={[2, 2, 0, 0]}>
                {barData.map((d, i) => (
                  <Cell key={`dp-${i}`} fill={barColor(d.dp)} />
                ))}
                <LabelList dataKey="week" position="top" className="fill-neutral-500 text-[10px]" />
              </Bar>
            )}
            {showBudget && (
              <Bar dataKey="budget" name="Баланс из смет" radius={[2, 2, 0, 0]}>
                {barData.map((d, i) => (
                  <Cell key={`budget-${i}`} fill={barColor(d.budget)} fillOpacity={showDP ? 0.7 : 1} />
                ))}
                {!showDP && (
                  <LabelList dataKey="week" position="top" className="fill-neutral-500 text-[10px]" />
                )}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={projectData} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#737373" }} />
            <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: "#737373" }} width={56} />
            <Tooltip formatter={(value) => fmtY(Number(value ?? 0))} />
            <Legend />
            {SERIES_PROJECT.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeDasharray={s.dash}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
