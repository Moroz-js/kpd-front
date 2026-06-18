// Одноразовый бэкофилл «Ответственного» (KPD-284/285).
// - OtherExpense.responsibleExecutorId = исполнитель, у которого userId == responsibleUserId
// - Work.responsibleExecutorId         = исполнитель-руководитель проекта (project.responsibleUserId)
//
// Запуск: node scripts/set-prisma-provider.mjs && node scripts/backfill-responsible.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // map userId -> executorId (для резолва РП → исполнитель)
  const executors = await prisma.executor.findMany({
    where: { userId: { not: null } },
    select: { id: true, userId: true },
  });
  const executorByUserId = new Map();
  for (const e of executors) {
    if (e.userId) executorByUserId.set(e.userId, e.id);
  }

  // 1) OtherExpense
  const expenses = await prisma.otherExpense.findMany({
    where: { responsibleExecutorId: null, responsibleUserId: { not: null } },
    select: { id: true, responsibleUserId: true },
  });
  let expensesUpdated = 0;
  for (const oe of expenses) {
    const execId = executorByUserId.get(oe.responsibleUserId);
    if (!execId) continue;
    await prisma.otherExpense.update({
      where: { id: oe.id },
      data: { responsibleExecutorId: execId },
    });
    expensesUpdated++;
  }

  // 2) Work — РП проекта
  const projects = await prisma.project.findMany({
    select: { id: true, responsibleUserId: true },
  });
  const pmExecutorByProject = new Map();
  for (const p of projects) {
    if (!p.responsibleUserId) continue;
    const execId = executorByUserId.get(p.responsibleUserId);
    if (execId) pmExecutorByProject.set(p.id, execId);
  }

  const works = await prisma.work.findMany({
    where: { responsibleExecutorId: null },
    select: { id: true, projectId: true },
  });
  let worksUpdated = 0;
  for (const w of works) {
    const execId = pmExecutorByProject.get(w.projectId);
    if (!execId) continue;
    await prisma.work.update({
      where: { id: w.id },
      data: { responsibleExecutorId: execId },
    });
    worksUpdated++;
  }

  console.log(
    `[backfill-responsible] OtherExpense updated=${expensesUpdated}/${expenses.length}, Work updated=${worksUpdated}/${works.length}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
