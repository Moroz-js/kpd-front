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
  iw: number[];
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

/** ДП — насыщенные, сметы — светлые: контраст соседних столбцов. */
const COLORS = {
  dpPos: "#15803d",
  dpNeg: "#be185d",
  budgetPos: "#86efac",
  budgetNeg: "#f9a8d4",
} as const;

function fmtY(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}М`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}К`;
  return String(v);
}

function seriesColor(series: "dp" | "budget", value: number) {
  if (series === "dp") return value < 0 ? COLORS.dpNeg : COLORS.dpPos;
  return value < 0 ? COLORS.budgetNeg : COLORS.budgetPos;
}

/** Накопительный баланс проекта: приход − расход по неделям. */
function rollingBalance(charges: number[], expenses: number[], len: number): number[] {
  const out: number[] = [];
  let prev = 0;
  for (let i = 0; i < len; i++) {
    prev = prev + (charges[i] ?? 0) - (expenses[i] ?? 0);
    out.push(prev);
  }
  return out;
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

  const projectDp = React.useMemo(() => {
    if (!selectedProject) return [];
    return selectedProject.cashflow.length
      ? selectedProject.cashflow
      : rollingBalance(selectedProject.charges, selectedProject.plan, weeks.length);
  }, [selectedProject, weeks.length]);

  const projectBudget = React.useMemo(() => {
    if (!selectedProject) return [];
    return rollingBalance(selectedProject.charges, selectedProject.iw ?? [], weeks.length);
  }, [selectedProject, weeks.length]);

  const barData = React.useMemo(() => {
    const dpSrc = projectId === ALL_PROJECTS ? balanceEndDP : projectDp;
    const budgetSrc = projectId === ALL_PROJECTS ? balanceEndBudget : projectBudget;
    return visibleIndices.map((i) => {
      const wh = weeks[i];
      return {
        name: String(wh.week),
        week: wh.week,
        monthName: wh.monthName,
        month: wh.month,
        isCurrent: wh.week === currentISOWeek && year === currentISOYear,
        dp: dpSrc[i] ?? 0,
        budget: budgetSrc[i] ?? 0,
      };
    });
  }, [
    visibleIndices,
    weeks,
    projectId,
    balanceEndDP,
    balanceEndBudget,
    projectDp,
    projectBudget,
    currentISOWeek,
    currentISOYear,
    year,
  ]);

  const chartTitle =
    projectId === ALL_PROJECTS
      ? "Динамика баланса по неделям"
      : `Проект: ${selectedProject?.name ?? ""}`;

  const monthTicks = React.useMemo(() => {
    // Группы недель по календарному месяцу
    const groups: { month: number; monthName: string; weeks: number[]; indices: number[] }[] = [];
    for (let i = 0; i < barData.length; i++) {
      const d = barData[i];
      const last = groups[groups.length - 1];
      if (last && last.month === d.month) {
        last.weeks.push(d.week);
        last.indices.push(i);
      } else {
        groups.push({
          month: d.month,
          monthName: d.monthName,
          weeks: [d.week],
          indices: [i],
        });
      }
    }

    // ISO: 1-я неделя года часто начинается в декабре прошлого — подпись «дек.» сливается с «янв.»
    if (groups.length >= 2 && groups[0].month === 12 && groups[1].month === 1) {
      groups.shift();
    }

    const ticks: { week: number; label: string }[] = [];
    let lastIdx = -Infinity;
    // Минимум столбцов между подписями, чтобы не наезжали при полном годе
    const minGap = barData.length > 30 ? 3 : 2;

    for (const g of groups) {
      const mid = Math.floor((g.indices.length - 1) / 2);
      const idx = g.indices[mid];
      if (idx - lastIdx < minGap) continue;
      ticks.push({ week: g.weeks[mid], label: g.monthName });
      lastIdx = idx;
    }
    return ticks;
  }, [barData]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-700">{chartTitle}</h2>
        <div className="flex flex-wrap items-center gap-3">
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

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
        {showDP && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex gap-0.5" aria-hidden>
              <span className="h-3 w-3 rounded-sm" style={{ background: COLORS.dpPos }} />
              <span className="h-3 w-3 rounded-sm" style={{ background: COLORS.dpNeg }} />
            </span>
            Баланс из ДП
          </span>
        )}
        {showBudget && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex gap-0.5" aria-hidden>
              <span className="h-3 w-3 rounded-sm" style={{ background: COLORS.budgetPos }} />
              <span className="h-3 w-3 rounded-sm" style={{ background: COLORS.budgetNeg }} />
            </span>
            Баланс из смет
          </span>
        )}
        <span className="text-neutral-400">зелёный — плюс, розовый — минус</span>
      </div>

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
                <Cell key={`dp-${i}`} fill={seriesColor("dp", d.dp)} />
              ))}
              <LabelList dataKey="week" position="top" className="fill-neutral-500 text-[10px]" />
            </Bar>
          )}
          {showBudget && (
            <Bar dataKey="budget" name="Баланс из смет" radius={[2, 2, 0, 0]}>
              {barData.map((d, i) => (
                <Cell key={`budget-${i}`} fill={seriesColor("budget", d.budget)} />
              ))}
              {!showDP && (
                <LabelList dataKey="week" position="top" className="fill-neutral-500 text-[10px]" />
              )}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
