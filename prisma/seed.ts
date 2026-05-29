/**
 * Seed для kpd-demo.
 *
 * Phase 1: справочники (банковские счета, виды работ, клиенты, ответственные).
 * Phase 2+ дополнит проектами, заказами, исполнителями, операциями.
 *
 * Идемпотентно: используем upsert по уникальным ключам.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Password123!";

async function seedUsers(passwordHash: string) {
  // Admin
  await prisma.user.upsert({
    where: { email: "admin@kpd.local" },
    update: {},
    create: {
      email: "admin@kpd.local",
      password: passwordHash,
      fullName: "Админ Админов",
      role: "admin",
      isActive: true,
    },
  });

  // Responsibles (PMs)
  const responsibles = [
    { email: "manager.ivanov@kpd.local", fullName: "Иванов Сергей" },
    { email: "manager.petrov@kpd.local", fullName: "Петров Андрей" },
    { email: "manager.archived@kpd.local", fullName: "Сидоров Олег", isActive: false },
  ];
  for (const r of responsibles) {
    await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: {
        email: r.email,
        password: passwordHash,
        fullName: r.fullName,
        role: "responsible",
        isActive: r.isActive ?? true,
      },
    });
  }
}

async function seedBankAccounts() {
  const accounts = [
    { name: "Операционный счёт", isDefault: true, status: "active" },
    { name: "ИП Иванов — Тинькофф", isDefault: false, status: "active" },
    { name: "ИП Петров — Альфа", isDefault: false, status: "active" },
    { name: "Старый счёт Сбер", isDefault: false, status: "archived" },
  ];
  for (const a of accounts) {
    const existing = await prisma.bankAccount.findFirst({ where: { name: a.name } });
    if (existing) {
      await prisma.bankAccount.update({
        where: { id: existing.id },
        data: { isDefault: a.isDefault, status: a.status },
      });
    } else {
      await prisma.bankAccount.create({ data: a });
    }
  }
}

async function seedWorkTypes() {
  // Сегменты см. lib/statuses.ts и TDNB-24.
  const types: Array<{ name: string; segment: string; status?: string }> = [
    { name: "Дизайн посадочной", segment: "Визуал" },
    { name: "Лонгрид", segment: "Текст" },
    { name: "Монтаж видео", segment: "Видео" },
    { name: "Сценарий ролика", segment: "Видео" },
    { name: "SMM-ведение", segment: "Продвижение" },
    { name: "PR-аналитика", segment: "Аналитика" },
    { name: "Руководство проектом", segment: "Менеджмент" },
    { name: "Поддержка сайта", segment: "IT" },
    { name: "Экспертный комментарий", segment: "Экспертиза" },
    { name: "Транзит платежа", segment: "Транзитные платежи", status: "archived" },
  ];
  for (const t of types) {
    await prisma.workType.upsert({
      where: { name: t.name },
      update: { segment: t.segment, status: t.status ?? "active" },
      create: { name: t.name, segment: t.segment, status: t.status ?? "active" },
    });
  }
}

async function seedClients() {
  const clients = [
    { company: "Базис", department: "Контент – PR", status: "active" },
    { company: "Норникель", department: "PR", status: "active" },
    { company: "X5", department: "Маркетинг", status: "active" },
    { company: "КПД", department: "Внутренний", status: "active" },
    { company: "Старый клиент", department: "Архив", status: "archived" },
  ];
  for (const c of clients) {
    const name = `${c.department} – ${c.company}`;
    await prisma.client.upsert({
      where: { name },
      update: { company: c.company, department: c.department, status: c.status },
      create: { name, company: c.company, department: c.department, status: c.status },
    });
  }
}

async function seedProjects() {
  const clients = await prisma.client.findMany({ where: { status: "active" } });
  const ivanov = await prisma.user.findUnique({ where: { email: "manager.ivanov@kpd.local" } });
  const petrov = await prisma.user.findUnique({ where: { email: "manager.petrov@kpd.local" } });

  const findClient = (name: string) => clients.find((c) => c.name === name);

  const norilsk = findClient("PR – Норникель");
  const basis = findClient("Контент – PR – Базис");
  const x5 = findClient("Маркетинг – X5");
  const internal = findClient("Внутренний – КПД");

  const projectsToSeed: Array<{
    shortName: string;
    client?: { id: string; name: string };
    responsibleId?: string | null;
    status?: string;
  }> = [
    { shortName: "Контент", client: basis, responsibleId: ivanov?.id },
    { shortName: "SMM Q3", client: norilsk, responsibleId: ivanov?.id },
    { shortName: "Запуск приложения", client: x5, responsibleId: petrov?.id },
    { shortName: "База знаний", client: internal },
    { shortName: "Старый проект", client: x5, responsibleId: petrov?.id, status: "archived" },
  ];

  for (const p of projectsToSeed) {
    if (!p.client) continue;
    const fullName = `${p.shortName} – ${p.client.name}`;
    const type = p.client.name.toLowerCase().includes("кпд") ? "internal" : "client";
    const existing = await prisma.project.findFirst({
      where: { clientId: p.client.id, shortName: p.shortName },
    });
    if (existing) {
      await prisma.project.update({
        where: { id: existing.id },
        data: {
          name: fullName,
          type,
          status: p.status ?? "active",
          responsibleUserId: p.responsibleId ?? null,
        },
      });
    } else {
      await prisma.project.create({
        data: {
          shortName: p.shortName,
          name: fullName,
          type,
          status: p.status ?? "active",
          clientId: p.client.id,
          responsibleUserId: p.responsibleId ?? null,
        },
      });
    }
  }
}

async function seedOrders() {
  const projects = await prisma.project.findMany({ where: { status: "active" } });
  const baseDescriptions: Record<string, string> = {
    Контент: "Контент-производство Q3 2026",
    "SMM Q3": "SMM-ведение и продвижение Q3",
    "Запуск приложения": "Маркетинговое сопровождение запуска",
    "База знаний": "Внутренняя БЗ — поддержка и развитие",
  };

  const last = await prisma.order.findFirst({ orderBy: { orderNumber: "desc" } });
  let nextNumber = last ? last.orderNumber + 1 : 3000;

  for (const p of projects) {
    const desc = baseDescriptions[p.shortName];
    if (!desc) continue;
    const existing = await prisma.order.findFirst({ where: { projectId: p.id } });
    if (existing) continue;
    await prisma.order.create({
      data: {
        orderNumber: nextNumber++,
        description: desc,
        projectId: p.id,
        status: "active",
      },
    });
  }
}

async function seedExecutors(passwordHash: string) {
  const ivanov = await prisma.user.findUnique({ where: { email: "manager.ivanov@kpd.local" } });
  const petrov = await prisma.user.findUnique({ where: { email: "manager.petrov@kpd.local" } });
  const opsAccount = await prisma.bankAccount.findFirst({ where: { isDefault: true } });
  const workTypes = await prisma.workType.findMany({ where: { status: "active" } });

  const findWt = (name: string) => workTypes.find((w) => w.name === name);

  type SeedExecutor = {
    name: string;
    type: string;
    email?: string;
    companyStatus?: string;
    recipientType?: string;
    legalForm?: string;
    responsibleId?: string | null;
    inTgChat?: boolean;
    specialty?: string;
    workTypes?: string[];
    status?: string;
    hasAccess?: boolean;
  };

  const list: SeedExecutor[] = [
    {
      name: "Смирнов Алексей",
      type: "permanent",
      email: "executor.smirnov@kpd.local",
      companyStatus: "core",
      recipientType: "З/П в РФ налог 30%",
      responsibleId: ivanov?.id,
      inTgChat: true,
      specialty: "Дизайнер",
      workTypes: ["Дизайн посадочной"],
      hasAccess: true,
    },
    {
      name: "Козлова Анна",
      type: "external-person",
      email: "executor.kozlova@kpd.local",
      recipientType: "Самозанятый в РФ",
      responsibleId: ivanov?.id,
      inTgChat: true,
      specialty: "Копирайтер",
      workTypes: ["Лонгрид", "Сценарий ролика"],
      hasAccess: true,
    },
    {
      name: "Петров Иван",
      type: "external-person",
      email: "executor.petrov@kpd.local",
      recipientType: "Самозанятый в РФ",
      responsibleId: petrov?.id,
      specialty: "Видеомонтаж",
      workTypes: ["Монтаж видео"],
      hasAccess: false,
    },
    {
      name: "Рога и Копыта ООО",
      type: "external-legal",
      legalForm: "ООО",
      recipientType: "Юрлицо в РФ",
      responsibleId: petrov?.id,
      workTypes: ["Поддержка сайта"],
    },
    {
      name: "MIDJOURNEY",
      type: "service",
      recipientType: "Сервис заруб.",
    },
    {
      name: "Старый исполнитель",
      type: "external-person",
      email: "old.executor@kpd.local",
      recipientType: "Самозанятый в РФ",
      status: "archived",
    },
  ];

  for (const e of list) {
    const existing = await prisma.executor.findFirst({ where: { name: e.name } });
    if (existing) continue;

    let userId: string | null = null;
    if (e.email && (e.type === "permanent" || e.type === "external-person")) {
      const user = await prisma.user.upsert({
        where: { email: e.email },
        update: {},
        create: {
          email: e.email,
          password: passwordHash,
          fullName: e.name,
          role: "executor",
          isActive: e.status !== "archived",
        },
      });
      userId = user.id;
    }

    const exec = await prisma.executor.create({
      data: {
        name: e.name,
        type: e.type,
        userId,
        companyStatus: e.companyStatus ?? null,
        legalForm: e.legalForm ?? null,
        recipientType: e.recipientType ?? null,
        specialty: e.specialty ?? null,
        responsibleUserId: e.responsibleId ?? null,
        defaultBankAccountId: opsAccount?.id ?? null,
        inTgChat: e.inTgChat ?? false,
        status: e.status ?? "active",
        accessRevokedAt: e.hasAccess === false ? new Date() : null,
      },
    });

    if (e.workTypes?.length) {
      for (const wtName of e.workTypes) {
        const wt = findWt(wtName);
        if (wt) {
          await prisma.executorWorkType.create({
            data: { executorId: exec.id, workTypeId: wt.id },
          });
        }
      }
    }
  }
}

async function seedWorksAndPayments() {
  const smirnov = await prisma.executor.findFirst({ where: { name: "Смирнов Алексей" } });
  if (!smirnov) return;

  // Уже есть работы — пропускаем
  const existing = await prisma.work.count({ where: { executorId: smirnov.id } });
  if (existing > 0) return;

  const kozlova = await prisma.executor.findFirst({ where: { name: "Козлова Анна" } });
  const bankAccount = await prisma.bankAccount.findFirst({ where: { isDefault: true } });

  // Берём конкретные проекты и виды работ
  const projectContent = await prisma.project.findFirst({ where: { shortName: "Контент", status: "active" } });
  const projectSmm    = await prisma.project.findFirst({ where: { shortName: "SMM Q3",  status: "active" } });
  const project = projectContent ?? await prisma.project.findFirst({ where: { status: "active" } });
  if (!project) return;

  const wtDesign   = await prisma.workType.findFirst({ where: { name: "Дизайн посадочной" } });
  const wtLongread = await prisma.workType.findFirst({ where: { name: "Лонгрид" } });
  if (!wtDesign) return;

  // Привязываем исполнителей к проектам
  for (const proj of [project, projectSmm].filter(Boolean) as typeof project[]) {
    await prisma.projectExecutor.upsert({
      where: { projectId_executorId: { projectId: proj.id, executorId: smirnov.id } },
      update: {},
      create: { projectId: proj.id, executorId: smirnov.id },
    });
    if (kozlova) {
      await prisma.projectExecutor.upsert({
        where: { projectId_executorId: { projectId: proj.id, executorId: kozlova.id } },
        update: {},
        create: { projectId: proj.id, executorId: kozlova.id },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  СМИРНОВ АЛЕКСЕЙ (дизайн)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── ЯНВАРЬ 2026 — полностью оплачен ──────────────────────────────────────
  const s_jan = await prisma.payment.create({
    data: {
      executorId: smirnov.id, periodYear: 2026, periodMonth: 1,
      amount: 80_000, paymentStatus: "paid",
      bankAccountId: bankAccount?.id ?? null,
      plannedPayAt: new Date("2026-01-20"), paidAt: new Date("2026-01-22"),
    },
  });
  await prisma.work.createMany({
    data: [
      {
        executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
        executionYear: 2026, executionMonth: 1,
        techTask: "Дизайн главной страницы",
        amount: 50_000, workStatus: "paid",
        checkedAt: new Date("2026-01-15"),
        plannedPayAt: new Date("2026-01-20"), paidAt: new Date("2026-01-22"),
        paymentId: s_jan.id,
      },
      {
        executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
        executionYear: 2026, executionMonth: 1,
        techTask: "Дизайн карточек продуктов",
        amount: 30_000, workStatus: "paid",
        checkedAt: new Date("2026-01-16"),
        plannedPayAt: new Date("2026-01-20"), paidAt: new Date("2026-01-22"),
        paymentId: s_jan.id,
      },
    ],
  });

  // ── ФЕВРАЛЬ 2026 — выплата запланирована, все работы checked ─────────────
  const s_feb = await prisma.payment.create({
    data: {
      executorId: smirnov.id, periodYear: 2026, periodMonth: 2,
      amount: 60_000, paymentStatus: "planned",
      bankAccountId: bankAccount?.id ?? null,
      plannedPayAt: new Date("2026-03-05"),
    },
  });
  await prisma.work.createMany({
    data: [
      {
        executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
        executionYear: 2026, executionMonth: 2,
        techTask: "Редизайн раздела «О компании»",
        amount: 40_000, workStatus: "checked",
        checkedAt: new Date("2026-02-25"),
        plannedPayAt: new Date("2026-03-05"),
        paymentId: s_feb.id,
      },
      {
        executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
        executionYear: 2026, executionMonth: 2,
        techTask: "Баннеры для соцсетей (x5 форматов)",
        amount: 20_000, workStatus: "checked",
        checkedAt: new Date("2026-02-26"),
        plannedPayAt: new Date("2026-03-05"),
        paymentId: s_feb.id,
      },
    ],
  });

  // ── МАРТ 2026 — checked с выплатой + submitted-хвост ─────────────────────
  const s_mar = await prisma.payment.create({
    data: {
      executorId: smirnov.id, periodYear: 2026, periodMonth: 3,
      amount: 35_000, paymentStatus: "planned",
      bankAccountId: bankAccount?.id ?? null,
      plannedPayAt: new Date("2026-04-05"),
    },
  });
  await prisma.work.create({
    data: {
      executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
      executionYear: 2026, executionMonth: 3,
      techTask: "Анимация логотипа",
      amount: 35_000, workStatus: "checked",
      checkedAt: new Date("2026-03-20"),
      plannedPayAt: new Date("2026-04-05"),
      paymentId: s_mar.id,
    },
  });
  // submitted-хвост — выплата ещё не создана (работа не проверена)
  await prisma.work.create({
    data: {
      executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
      executionYear: 2026, executionMonth: 3,
      techTask: "Гайдлайн по фирменному стилю (в работе)",
      amount: 25_000, workStatus: "submitted",
    },
  });

  // ── АПРЕЛЬ 2026 — чистый хвост, submitted ────────────────────────────────
  await prisma.work.createMany({
    data: [
      {
        executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
        executionYear: 2026, executionMonth: 4,
        techTask: "Презентация для инвесторов (слайды 1–20)",
        amount: 45_000, workStatus: "submitted",
      },
      {
        executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
        executionYear: 2026, executionMonth: 4,
        techTask: "Иконки для мобильного приложения",
        amount: 20_000, workStatus: "submitted",
      },
    ],
  });

  // ── МАЙ 2026 — rework + checked (у checked своя запланированная выплата) ──
  // rework-работа: выплаты нет (ещё не принята)
  await prisma.work.create({
    data: {
      executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
      executionYear: 2026, executionMonth: 5,
      techTask: "Обложки для YouTube (возврат на доработку)",
      amount: 15_000, workStatus: "rework",
    },
  });
  // checked-работа — выплата planned (независима от rework-работы)
  const s_may = await prisma.payment.create({
    data: {
      executorId: smirnov.id, periodYear: 2026, periodMonth: 5,
      amount: 18_000, paymentStatus: "planned",
      bankAccountId: bankAccount?.id ?? null,
      plannedPayAt: new Date("2026-06-05"),
    },
  });
  await prisma.work.create({
    data: {
      executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
      executionYear: 2026, executionMonth: 5,
      techTask: "Шаблон email-рассылки",
      amount: 18_000, workStatus: "checked",
      checkedAt: new Date("2026-05-10"),
      plannedPayAt: new Date("2026-06-05"),
      paymentId: s_may.id,
    },
  });

  // ── ИЮНЬ 2026 — текущий месяц, свежие работы ─────────────────────────────
  await prisma.work.createMany({
    data: [
      {
        executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
        executionYear: 2026, executionMonth: 6,
        techTask: "Дизайн кейса для портфолио",
        volume: 3, rate: 10_000,
        amount: 30_000, workStatus: "submitted",
      },
      {
        executorId: smirnov.id, projectId: project.id, workTypeId: wtDesign.id,
        executionYear: 2026, executionMonth: 6,
        techTask: "Адаптив мобильной версии сайта",
        amount: 22_000, workStatus: "submitted",
        link: "https://figma.com/example",
      },
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  КОЗЛОВА АННА (копирайтинг) — при наличии
  // ═══════════════════════════════════════════════════════════════════════════
  if (kozlova && wtLongread) {
    const kProj = projectContent ?? project;

    // Январь 2026 — оплачено
    const k_jan = await prisma.payment.create({
      data: {
        executorId: kozlova.id, periodYear: 2026, periodMonth: 1,
        amount: 45_000, paymentStatus: "paid",
        bankAccountId: bankAccount?.id ?? null,
        plannedPayAt: new Date("2026-01-25"), paidAt: new Date("2026-01-27"),
      },
    });
    await prisma.work.create({
      data: {
        executorId: kozlova.id, projectId: kProj.id, workTypeId: wtLongread.id,
        executionYear: 2026, executionMonth: 1,
        techTask: "Лонгрид «Тренды контент-маркетинга 2026»",
        volume: 3, rate: 15_000,
        amount: 45_000, workStatus: "paid",
        checkedAt: new Date("2026-01-20"),
        plannedPayAt: new Date("2026-01-25"), paidAt: new Date("2026-01-27"),
        paymentId: k_jan.id,
      },
    });

    // Март 2026 — checked, выплата запланирована
    const k_mar = await prisma.payment.create({
      data: {
        executorId: kozlova.id, periodYear: 2026, periodMonth: 3,
        amount: 30_000, paymentStatus: "planned",
        bankAccountId: bankAccount?.id ?? null,
        plannedPayAt: new Date("2026-04-10"),
      },
    });
    await prisma.work.create({
      data: {
        executorId: kozlova.id, projectId: kProj.id, workTypeId: wtLongread.id,
        executionYear: 2026, executionMonth: 3,
        techTask: "Сценарий видеоролика для запуска продукта",
        amount: 30_000, workStatus: "checked",
        checkedAt: new Date("2026-03-28"),
        plannedPayAt: new Date("2026-04-10"),
        paymentId: k_mar.id,
      },
    });

    // Апрель 2026 — submitted (хвост)
    await prisma.work.create({
      data: {
        executorId: kozlova.id, projectId: kProj.id, workTypeId: wtLongread.id,
        executionYear: 2026, executionMonth: 4,
        techTask: "Лонгрид для блога: кейс клиента",
        amount: 25_000, workStatus: "submitted",
      },
    });

    // Май 2026 — submitted (текущий)
    await prisma.work.create({
      data: {
        executorId: kozlova.id, projectId: kProj.id, workTypeId: wtLongread.id,
        executionYear: 2026, executionMonth: 5,
        techTask: "Тексты для лендинга (5 блоков)",
        amount: 20_000, workStatus: "submitted",
      },
    });
  }

  console.log("[seed] works & payments seeded");
  console.log("[seed] тест-кейсы (Смирнов):");
  console.log("[seed]   Январь 2026  — 2 работы paid, выплата paid");
  console.log("[seed]   Февраль 2026 — 2 работы checked, выплата planned");
  console.log("[seed]   Март 2026    — 1 checked с выплатой + 1 submitted (хвост)");
  console.log("[seed]   Апрель 2026  — 2 submitted без выплаты");
  console.log("[seed]   Май 2026     — rework (без выплаты) + checked (своя выплата planned)");
  console.log("[seed]   Июнь 2026    — 2 submitted без выплаты");
  console.log("[seed] тест-кейсы (Козлова):");
  console.log("[seed]   Январь 2026  — 1 paid");
  console.log("[seed]   Март 2026    — 1 checked, выплата planned");
  console.log("[seed]   Апрель–Май   — submitted хвост");
}

async function seedOtherExpenses() {
  const existing = await prisma.otherExpense.count();
  if (existing > 0) return;

  // Используем конкретных исполнителей и виды работ
  const projectContent = await prisma.project.findFirst({ where: { shortName: "Контент", status: "active" } })
    ?? await prisma.project.findFirst({ where: { status: "active" } });
  const projectSmm = await prisma.project.findFirst({ where: { shortName: "SMM Q3", status: "active" } })
    ?? projectContent;

  const midjourney = await prisma.executor.findFirst({ where: { name: "MIDJOURNEY" } });
  const rogaIKopyta = await prisma.executor.findFirst({ where: { name: "Рога и Копыта ООО" } });
  const kozlova = await prisma.executor.findFirst({ where: { name: "Козлова Анна" } });

  const wtSmm   = await prisma.workType.findFirst({ where: { name: "SMM-ведение" } });
  const wtIt    = await prisma.workType.findFirst({ where: { name: "Поддержка сайта" } });
  const wtVideo = await prisma.workType.findFirst({ where: { name: "Монтаж видео" } });

  const responsible = await prisma.user.findFirst({ where: { email: "manager.ivanov@kpd.local" } });
  const petrov      = await prisma.user.findFirst({ where: { email: "manager.petrov@kpd.local" } });
  const adminUser   = await prisma.user.findFirst({ where: { role: "admin" } });
  const bankAccount = await prisma.bankAccount.findFirst({ where: { isDefault: true } });

  if (!projectContent || !adminUser || !responsible) return;

  const fallbackExec = midjourney
    ?? await prisma.executor.findFirst({ where: { status: "active" } });
  const fallbackWt = wtSmm
    ?? await prisma.workType.findFirst({ where: { status: "active" } });

  if (!fallbackExec || !fallbackWt) return;

  const rows = [
    // Март — оплачено (Midjourney, генерация изображений)
    midjourney && wtSmm && projectContent ? {
      projectId: projectContent.id,
      executorId: midjourney.id,
      workTypeId: wtSmm.id,
      responsibleUserId: responsible.id,
      createdById: adminUser.id,
      executionYear: 2026, executionMonth: 3,
      description: "Подписка Midjourney — март 2026",
      amount: 3_000, workStatus: "paid", paymentStatus: "paid",
      paymentAmount: 3_000,
      plannedPayAt: new Date("2026-03-01"), paidAt: new Date("2026-03-01"),
      bankAccountId: bankAccount?.id ?? null,
      preferredPayMethod: "4DEV",
    } : null,

    // Март — оплачено (Рога и Копыта, поддержка сайта)
    rogaIKopyta && wtIt && projectContent ? {
      projectId: projectContent.id,
      executorId: rogaIKopyta.id,
      workTypeId: wtIt.id,
      responsibleUserId: (petrov ?? responsible).id,
      createdById: adminUser.id,
      executionYear: 2026, executionMonth: 3,
      description: "Разработка и поддержка сайта — март",
      amount: 120_000, workStatus: "paid", paymentStatus: "paid",
      paymentAmount: 120_000,
      plannedPayAt: new Date("2026-03-31"), paidAt: new Date("2026-04-02"),
      bankAccountId: bankAccount?.id ?? null,
      preferredPayMethod: "Юрлицо в РФ",
    } : null,

    // Апрель — проверено, выплата запланирована (Midjourney)
    midjourney && wtSmm && projectContent ? {
      projectId: projectContent.id,
      executorId: midjourney.id,
      workTypeId: wtSmm.id,
      responsibleUserId: responsible.id,
      createdById: responsible.id,
      executionYear: 2026, executionMonth: 4,
      description: "Подписка Midjourney — апрель 2026",
      amount: 3_000, workStatus: "checked", paymentStatus: "planned",
      paymentAmount: 3_000,
      plannedPayAt: new Date("2026-05-01"),
      preferredPayMethod: "4DEV",
    } : null,

    // Апрель — checked, выплата planned (Рога и Копыта)
    rogaIKopyta && wtIt && projectContent ? {
      projectId: projectContent.id,
      executorId: rogaIKopyta.id,
      workTypeId: wtIt.id,
      responsibleUserId: (petrov ?? responsible).id,
      createdById: (petrov ?? adminUser).id,
      executionYear: 2026, executionMonth: 4,
      description: "Поддержка сайта — апрель",
      amount: 120_000, workStatus: "checked", paymentStatus: "planned",
      paymentAmount: 120_000,
      plannedPayAt: new Date("2026-05-05"),
    } : null,

    // Май — submitted (Козлова, видеосъёмка)
    kozlova && wtVideo && projectSmm ? {
      projectId: projectSmm.id,
      executorId: kozlova.id,
      workTypeId: wtVideo.id,
      responsibleUserId: responsible.id,
      createdById: responsible.id,
      executionYear: 2026, executionMonth: 5,
      description: "Фотосъёмка мероприятия для соцсетей",
      amount: 30_000, workStatus: "submitted", paymentStatus: "planned",
    } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  for (const row of rows) {
    await prisma.otherExpense.create({ data: row });
  }

  console.log(`[seed] other expenses seeded: ${rows.length} строк`);
}

async function seedCharges() {
  const existing = await prisma.charge.count();
  if (existing > 0) return;

  const order = await prisma.order.findFirst({ where: { status: "active" } });
  const bankAccount = await prisma.bankAccount.findFirst();
  if (!order || !bankAccount) return;

  await prisma.charge.createMany({
    data: [
      {
        chargeNumber: "H001", bankAccountId: bankAccount.id,
        invoiceNumber: "СЧ-2026-001", orderId: order.id,
        amount: 500_000, issuedPlanAt: new Date("2026-02-01"), issuedAt: new Date("2026-02-03"),
        paidPlanAt: new Date("2026-02-20"), paidAt: new Date("2026-02-19"),
        status: "paid", paymentPurpose: "Разработка контент-плана Q1 2026",
      },
      {
        chargeNumber: "H002", bankAccountId: bankAccount.id,
        invoiceNumber: "СЧ-2026-002", orderId: order.id,
        amount: 350_000, issuedPlanAt: new Date("2026-03-15"), issuedAt: new Date("2026-03-20"),
        paidPlanAt: new Date("2026-04-05"), status: "to_pay",
        paymentPurpose: "Создание видеоконтента Q1 2026",
      },
      {
        chargeNumber: "H003", bankAccountId: bankAccount.id,
        invoiceNumber: "СЧ-2026-003", orderId: order.id,
        amount: 200_000, issuedPlanAt: new Date("2026-04-01"),
        paidPlanAt: new Date("2026-04-20"), status: "planned",
        paymentPurpose: "Аналитика эффективности кампании",
      },
    ],
  });

  console.log("[seed] charges seeded (H001-H003)");
}

async function seedSpendingPlanLines() {
  const existing = await prisma.spendingPlanLine.count();
  if (existing > 0) return;

  const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!adminUser) return;

  const projects = await prisma.project.findMany({ where: { status: "active" }, take: 3 });
  const executors = await prisma.executor.findMany({ where: { status: "active" }, take: 3 });
  const workTypes = await prisma.workType.findMany({ where: { status: "active" }, take: 3 });

  if (!projects.length || !executors.length || !workTypes.length) return;

  // Добавим строки плана на 2026 год (недели 17–40)
  const year = 2026;
  const linesToCreate = [];

  for (const project of projects.slice(0, 2)) {
    const exec = executors[0];
    const wt = workTypes[0];

    // Привяжем исполнителя к проекту
    await prisma.projectExecutor.upsert({
      where: { projectId_executorId: { projectId: project.id, executorId: exec.id } },
      update: {},
      create: { projectId: project.id, executorId: exec.id },
    });

    // Недели 17–30 — разные суммы
    for (let week = 17; week <= 30; week++) {
      const amount = Math.round((15_000 + Math.random() * 20_000) / 1000) * 1000;
      linesToCreate.push({
        projectId: project.id,
        executorId: exec.id,
        workTypeId: wt.id,
        year,
        week,
        amount,
        sourceType: "personal" as const,
        createdById: adminUser.id,
      });
    }
  }

  // Второй исполнитель на первый проект
  if (projects[0] && executors[1] && workTypes[1]) {
    await prisma.projectExecutor.upsert({
      where: { projectId_executorId: { projectId: projects[0].id, executorId: executors[1].id } },
      update: {},
      create: { projectId: projects[0].id, executorId: executors[1].id },
    });

    for (let week = 20; week <= 28; week++) {
      linesToCreate.push({
        projectId: projects[0].id,
        executorId: executors[1].id,
        workTypeId: workTypes[1].id,
        year,
        week,
        amount: 12_000,
        sourceType: "other" as const,
        createdById: adminUser.id,
      });
    }
  }

  if (linesToCreate.length > 0) {
    await prisma.spendingPlanLine.createMany({ data: linesToCreate });
    console.log(`[seed] spending plan lines seeded: ${linesToCreate.length} строк`);
  }

  // Стартовый баланс кэшфлоу
  await prisma.cashflowOpeningBalance.upsert({
    where: { year },
    update: {},
    create: { year, amount: 1_500_000 },
  });
  console.log("[seed] cashflow opening balance seeded");
}

async function seedVacationEntries() {
  const existing = await prisma.vacationEntry.count();
  if (existing > 0) return;

  const executors = await prisma.executor.findMany({
    where: { status: "active", userId: { not: null } },
    take: 3,
  });

  if (!executors.length) return;

  const entries: Array<{
    executorId: string;
    startAt: Date;
    endAt: Date;
    daysCount: number;
    status: string;
    isPaid: boolean;
    substituteContacts?: string;
  }> = [];

  if (executors[0]) {
    entries.push({
      executorId: executors[0].id,
      startAt: new Date("2026-07-01"),
      endAt: new Date("2026-07-14"),
      daysCount: 14,
      status: "approved",
      isPaid: true,
      substituteContacts: "Козлова Анна, @anna_kozlova",
    });
  }

  if (executors[1]) {
    entries.push({
      executorId: executors[1].id,
      startAt: new Date("2026-08-15"),
      endAt: new Date("2026-08-28"),
      daysCount: 14,
      status: "need_approval",
      isPaid: false,
    });
  }

  for (const e of entries) {
    await prisma.vacationEntry.create({ data: e });
  }

  console.log(`[seed] vacation entries seeded: ${entries.length}`);
}

async function main() {
  console.log("[seed] start");
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);

  await seedUsers(hash);
  await seedBankAccounts();
  await seedWorkTypes();
  await seedClients();
  await seedProjects();
  await seedOrders();
  await seedExecutors(hash);
  await seedWorksAndPayments();
  await seedOtherExpenses();
  await seedCharges();
  await seedSpendingPlanLines();
  await seedVacationEntries();

  console.log(`[seed] credentials: admin@kpd.local / ${SEED_PASSWORD}`);
  console.log(`[seed]              manager.ivanov@kpd.local / ${SEED_PASSWORD}`);
  console.log(`[seed]              executor.smirnov@kpd.local / ${SEED_PASSWORD}`);
  console.log("[seed] done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
