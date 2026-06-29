import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getISOWeek, getISOWeeksInYear, isoWeekStart } from "@/lib/iso-weeks";

/**
 * Определяет неделю/год для кэшфлоу по календарному году.
 * Граничные случаи:
 *   31 дек — ISO-неделя 1 следующего года → зажимаем на последнюю неделю этого года
 *   1-3 янв  — ISO-неделя 52/53 прошлого года → зажимаем на неделю 1 этого года
 */
function cashflowWeekYear(d: Date): { week: number; year: number } {
  const year = d.getFullYear();
  const isoWeek = getISOWeek(d);
  let week = isoWeek;
  if (isoWeek === 1 && d.getMonth() === 11) {
    week = getISOWeeksInYear(year);
  } else if (isoWeek >= 52 && d.getMonth() === 0) {
    week = 1;
  }
  return { week, year };
}

function chargeWeekPF(c: { paidAt: Date | null; paidPlanAt: Date | null }) {
  const d = c.paidAt ?? c.paidPlanAt;
  if (!d) return null;
  return cashflowWeekYear(d);
}

function issuedWeekPF(r: { paidAt: Date | null; plannedPayAt: Date | null }) {
  const d = r.paidAt ?? r.plannedPayAt;
  if (!d) return null;
  return cashflowWeekYear(d);
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
  const weeksInYear = getISOWeeksInYear(year);
  const weeks = Array.from({ length: weeksInYear }, (_, i) => i + 1);

  const [charges, works, otherExpenses, planLines, openingBalance, activeProjects] = await Promise.all([
    prisma.charge.findMany({ include: { order: { select: { projectId: true } } } }),
    prisma.work.findMany({ select: { projectId: true, amount: true, workStatus: true, plannedPayAt: true, paidAt: true } }),
    prisma.otherExpense.findMany({ select: { projectId: true, amount: true, workStatus: true, plannedPayAt: true, paidAt: true } }),
    prisma.spendingPlanLine.findMany({ where: { year }, select: { projectId: true, week: true, amount: true } }),
    prisma.cashflowOpeningBalance.findUnique({ where: { year } }),
    prisma.project.findMany({ where: { status: "active" }, select: { id: true, name: true, type: true } }),
  ]);

  const activeProjectIds = new Set(activeProjects.map(p => p.id));

  // ─── Aggregate per week ───────────────────────────────────────
  // Charge: total (plan+fact) и paid per week
  const chargeTotal = new Array(weeksInYear).fill(0);
  const chargePaid = new Array(weeksInYear).fill(0);
  // by project: total
  const chargeByProject = new Map<string, number[]>();

  for (const c of charges) {
    if (!c.order) continue;
    if (!activeProjectIds.has(c.order.projectId)) continue;
    const pf = chargeWeekPF(c);
    if (!pf || pf.year !== year) continue;
    const wi = pf.week - 1;
    chargeTotal[wi] += c.amount;
    if (c.status === "paid") chargePaid[wi] += c.amount;
    // per project
    const pid = c.order.projectId;
    if (!chargeByProject.has(pid)) chargeByProject.set(pid, new Array(weeksInYear).fill(0));
    chargeByProject.get(pid)![wi] += c.amount;
  }

  // IssuedWork: total and paid per week
  const iwTotal = new Array(weeksInYear).fill(0);
  const iwPaid = new Array(weeksInYear).fill(0);
  const iwByProject = new Map<string, number[]>();

  const allSources = [
    ...works.map(w => ({ ...w })),
    ...otherExpenses.map(o => ({ ...o })),
  ];
  for (const r of allSources) {
    if (!activeProjectIds.has(r.projectId)) continue;
    const pf = issuedWeekPF(r);
    if (!pf || pf.year !== year) continue;
    const wi = pf.week - 1;
    iwTotal[wi] += r.amount;
    if (r.workStatus === "paid") iwPaid[wi] += r.amount;
    // per project
    if (!iwByProject.has(r.projectId)) iwByProject.set(r.projectId, new Array(weeksInYear).fill(0));
    iwByProject.get(r.projectId)![wi] += r.amount;
  }

  // SpendingPlan per week and per project
  const planTotal = new Array(weeksInYear).fill(0);
  const planByProject = new Map<string, number[]>();

  for (const pl of planLines) {
    if (!activeProjectIds.has(pl.projectId)) continue;
    const wi = pl.week - 1;
    if (wi < 0 || wi >= weeksInYear) continue;
    planTotal[wi] += pl.amount;
    if (!planByProject.has(pl.projectId)) planByProject.set(pl.projectId, new Array(weeksInYear).fill(0));
    planByProject.get(pl.projectId)![wi] += pl.amount;
  }

  // ─── Block 1: Summary (11 строк × недели) ─────────────────────
  const startBalance = openingBalance?.amount ?? 0;
  const summaryRows = {
    balanceStart: [] as number[],      // row 3
    incomeFact: [] as number[],        // row 4
    incomePlanOnly: [] as number[],    // row 5
    incomePlanFact: [] as number[],    // row 6
    expensePlanDP: [] as number[],     // row 7
    balanceEndDP: [] as number[],      // row 8
    paidFromBudget: [] as number[],    // row 9
    unpaidFromBudget: [] as number[],  // row 10
    totalExpenseBudget: [] as number[],// row 11
    deltaDP: [] as number[],           // row 12
    balanceEndBudget: [] as number[],  // row 13
  };

  let rollingDP = startBalance;
  let rollingBudget = startBalance;

  for (let i = 0; i < weeksInYear; i++) {
    const balanceStart = i === 0 ? startBalance : summaryRows.balanceEndDP[i - 1];
    const incomePF = chargeTotal[i];
    const incomeFact = chargePaid[i];
    const incPlanOnly = incomePF - incomeFact;
    const expDP = planTotal[i];
    const expBudget = iwTotal[i];
    const paidBudget = iwPaid[i];
    const unpaidBudget = expBudget - paidBudget;
    const balanceEndDP = balanceStart + incomePF - expDP;
    const balanceEndBudget = balanceStart + incomePF - expBudget;
    const delta = expBudget - expDP;

    summaryRows.balanceStart.push(balanceStart);
    summaryRows.incomeFact.push(incomeFact);
    summaryRows.incomePlanOnly.push(incPlanOnly);
    summaryRows.incomePlanFact.push(incomePF);
    summaryRows.expensePlanDP.push(expDP);
    summaryRows.balanceEndDP.push(balanceEndDP);
    summaryRows.paidFromBudget.push(paidBudget);
    summaryRows.unpaidFromBudget.push(unpaidBudget);
    summaryRows.totalExpenseBudget.push(expBudget);
    summaryRows.deltaDP.push(delta);
    summaryRows.balanceEndBudget.push(balanceEndBudget);

    rollingDP = balanceEndDP;
    rollingBudget = balanceEndBudget;
  }

  // ─── Projects union list ───────────────────────────────────────
  const allPids = new Set<string>([
    ...planByProject.keys(),
    ...iwByProject.keys(),
    ...chargeByProject.keys(),
  ]);
  const projectRows = activeProjects
    .filter(p => allPids.has(p.id))
    .map(p => {
      const plan = planByProject.get(p.id) ?? new Array(weeksInYear).fill(0);
      const iw = iwByProject.get(p.id) ?? new Array(weeksInYear).fill(0);
      const charges2 = chargeByProject.get(p.id) ?? new Array(weeksInYear).fill(0);

      // Block 2.4: rolling cashflow per project
      const cashflow = new Array(weeksInYear).fill(0);
      let prev = 0;
      for (let i = 0; i < weeksInYear; i++) {
        prev = prev + charges2[i] - plan[i];
        cashflow[i] = prev;
      }

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        plan,
        iw,
        charges: charges2,
        cashflow,
      };
    });

  const externalProjects = projectRows.filter(p => p.type === "client");
  const internalProjects = projectRows.filter(p => p.type !== "client");

  // ─── Aggregates ───────────────────────────────────────────────
  const TAXES_NAME = "Налоги";
  const MOTIVATION_NAME = "Мотивация";
  const taxesProject = activeProjects.find(p => p.name === TAXES_NAME);
  const motivationProject = activeProjects.find(p => p.name === MOTIVATION_NAME);
  const taxesId = taxesProject?.id;
  const motivationId = motivationProject?.id;

  const zeroArr = () => new Array(weeksInYear).fill(0);

  const projectExpenses = zeroArr();
  const nonProjectExpenses = zeroArr();
  const taxes = zeroArr();
  const motivation = zeroArr();

  for (let i = 0; i < weeksInYear; i++) {
    for (const p of externalProjects) projectExpenses[i] += p.plan[i];
    for (const p of internalProjects) {
      if (p.id === taxesId) taxes[i] += p.plan[i];
      else if (p.id === motivationId) motivation[i] += p.plan[i];
      else nonProjectExpenses[i] += p.plan[i];
    }
  }

  // ─── Week headers ──────────────────────────────────────────────
  const weekHeaders = weeks.map(w => {
    const start = isoWeekStart(year, w);
    return {
      week: w,
      month: start.getMonth() + 1,
      monthName: start.toLocaleDateString("ru-RU", { month: "short" }),
    };
  });

  return NextResponse.json({
    year,
    weeksInYear,
    weeks: weekHeaders,
    openingBalance: openingBalance?.amount ?? 0,
    summary: summaryRows,
    projects: projectRows,
    externalProjects,
    internalProjects,
    aggregates: { projectExpenses, nonProjectExpenses, taxes, motivation },
  });
}
