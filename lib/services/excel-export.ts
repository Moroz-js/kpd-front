/**
 * Экспорт данных БД в формат исходной сметы (Смета_23.xlsx).
 *
 * Стратегия: берем templates/Smeta_23.xlsx как zip-контейнер и патчим только
 * sheetData в 11 листах БД_*. Остальные XML-части книги (стили, умные таблицы,
 * графики, пивоты, формулы) остаются из шаблона.
 *
 * Допустимые потери: один счёт из мультиселекта, null invoiceNumber, без __SRC_UID.
 */

import path from "path";
import fs from "fs";
import { prisma } from "@/lib/db";
import {
  ru,
  monthLabel,
  SHEET_META,
  STATUS_EN_RU,
  EXECUTOR_TYPE_EN_RU,
  PROJECT_TYPE_EN_RU,
  WORK_STATUS_EN_RU,
  CHARGE_STATUS_EN_RU,
  PAYMENT_STATUS_EN_RU,
} from "@/lib/excel/mappings";
import { patchWorkbookTemplate, type ExcelRow, type SheetPatch } from "@/lib/excel/xlsx-template-patcher";
import { listClients } from "@/lib/services/clients";

type Row = ExcelRow;

const TEMPLATE_PATH = path.resolve(process.cwd(), "templates", "Smeta_23.xlsx");

function weekLabel(week: number | null | undefined): string | null {
  if (week == null) return null;
  return `Неделя ${String(week).padStart(2, "0")}`;
}

// ─── Сериализаторы (зеркало extract* из migrate-excel.mjs) ────────────────────

async function serializeUsers(): Promise<Row[]> {
  const users = await prisma.user.findMany({
    where: { role: "responsible" },
    orderBy: { fullName: "asc" },
  });
  return users.map((u) => ({
    Имя: u.fullName,
    Статус: u.isActive ? "Активный" : "Архивный",
  }));
}

async function serializeBankAccounts(): Promise<Row[]> {
  const accounts = await prisma.bankAccount.findMany({ orderBy: { name: "asc" } });
  return accounts.map((b) => ({
    Счёт: b.name,
    Статус: ru(STATUS_EN_RU, b.status),
  }));
}

async function serializeWorkTypes(): Promise<Row[]> {
  const wts = await prisma.workType.findMany({ orderBy: { name: "asc" } });
  return wts.map((w) => ({
    "Вид работ": w.name,
    Сегмент: w.segment,
    Статус: ru(STATUS_EN_RU, w.status),
  }));
}

const CLIENT_PROJECTS_STATUS_RU: Record<string, string> = {
  has_active: "Есть активные",
  all_archived: "Все в архиве",
  none: "Нет проектов",
};

async function serializeClients(): Promise<Row[]> {
  const clients = await listClients();
  return clients.map((c) => ({
    Клиент: c.name,
    Компания: c.company,
    Департамент: c.department,
    "Статус проектов": CLIENT_PROJECTS_STATUS_RU[c.projectsStatus] ?? c.projectsStatus,
    Выручка: c.revenue,
  }));
}

async function serializeProjects(): Promise<Row[]> {
  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    include: {
      client: { select: { name: true } },
      responsible: { select: { fullName: true } },
    },
  });
  return projects.map((p) => ({
    Проект: p.name,
    "Название проекта": p.shortName,
    Клиент: p.client?.name ?? null,
    "Тип проекта": ru(PROJECT_TYPE_EN_RU, p.type),
    Статус: ru(STATUS_EN_RU, p.status),
    "Руководитель проекта": p.responsible?.fullName ?? null,
  }));
}

async function serializeExecutors(): Promise<Row[]> {
  const executors = await prisma.executor.findMany({
    orderBy: { name: "asc" },
    include: {
      responsibleUser: { select: { fullName: true } },
      defaultBankAccount: { select: { name: true } },
      executorWorkTypes: { include: { workType: { select: { name: true } } } },
      projectExecutors: { include: { project: { select: { name: true } } } },
    },
  });
  return executors.map((e) => ({
    Исполнитель: e.name,
    "Статус в компании": e.companyStatus,
    Тип: ru(EXECUTOR_TYPE_EN_RU, e.type),
    "Виды работ": e.executorWorkTypes.map((x) => x.workType.name).join(", "),
    Специальность: e.specialty,
    Проекты: e.projectExecutors.map((x) => x.project.name).join(", "),
    Ответственный: e.responsibleUser?.fullName ?? null,
    "Источник оплаты": e.defaultBankAccount?.name ?? null,
    "Тип получателя": e.recipientType,
    Контакт: e.contacts,
    Реквизиты: e.requisites,
    "В чате ТГ": e.inTgChat ? "да" : "нет",
    Примечание: e.note,
    договор: e.contractFile,
    NDA: e.ndaFile,
    "Статус исполнителя": ru(STATUS_EN_RU, e.status),
    "Доступ к смете": e.accessRevokedAt ? "закрыт" : "открыт",
    "Старая смета": e.oldEstimateUrl,
  }));
}

async function serializeOrders(): Promise<Row[]> {
  const orders = await prisma.order.findMany({
    orderBy: { orderNumber: "asc" },
    include: {
      project: { select: { name: true, client: { select: { name: true } } } },
    },
  });
  return orders.map((o) => ({
    "Номер заказа": o.orderNumber,
    "Описание заказа": o.description,
    "Номер договора/допсоглашения": o.contractNumber,
    Статус: ru(STATUS_EN_RU, o.status),
    Проект: o.project?.name ?? null,
    Клиент: o.project?.client?.name ?? null,
  }));
}

async function serializeCharges(): Promise<Row[]> {
  const charges = await prisma.charge.findMany({
    orderBy: { chargeNumber: "asc" },
    include: {
      bankAccount: { select: { name: true } },
      order: {
        select: {
          orderNumber: true,
          project: { select: { name: true, client: { select: { name: true } } } },
        },
      },
    },
  });
  return charges.map((c) => ({
    "Банковский счет": c.bankAccount?.name ?? null,
    "Номер Начисления": c.chargeNumber,
    "№ счета": c.invoiceNumber,
    Сумма: c.amount,
    "Выставлен - план": c.issuedPlanAt,
    "Выставлен - факт": c.issuedAt,
    "Оплачен – план": c.paidPlanAt,
    "Оплачен – факт": c.paidAt,
    Проект: c.order?.project?.name ?? null,
    "Назначение платежа": c.paymentPurpose,
    Клиент: c.order?.project?.client?.name ?? null,
    Статус: ru(CHARGE_STATUS_EN_RU, c.status),
    Документы: c.documents,
    "Номер Заказа": c.order?.orderNumber ?? null,
  }));
}

async function serializeWorks(): Promise<Row[]> {
  const [works, otherExpenses] = await Promise.all([
    prisma.work.findMany({
      include: {
        executor: { select: { name: true } },
        project: { select: { name: true } },
        workType: { select: { name: true } },
        responsibleExecutor: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.otherExpense.findMany({
      include: {
        executor: { select: { name: true } },
        project: { select: { name: true } },
        workType: { select: { name: true } },
        responsibleExecutor: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const workRows: Row[] = works.map((w) => ({
    Исполнитель: w.executor.name,
    Проект: w.project.name,
    "Вид работ": w.workType.name,
    Ответственный: w.responsibleExecutor?.name ?? null,
    "Год выполнения": w.executionYear,
    "Месяц выполнения работ": monthLabel(w.executionMonth),
    "Сумма к выплате": w.amount,
    "Тип сметы": "Личная смета",
    Статус: ru(WORK_STATUS_EN_RU, w.workStatus),
    Комментарий: w.comment,
    "Дата проверки": w.checkedAt,
    "Дата оплаты": w.paidAt,
    "Дата оплаты - план": w.plannedPayAt,
  }));

  const otherRows: Row[] = otherExpenses.map((o) => ({
    Исполнитель: o.executor.name,
    Проект: o.project.name,
    "Вид работ": o.workType.name,
    Ответственный: o.responsibleExecutor?.name ?? null,
    "Год выполнения": o.executionYear,
    "Месяц выполнения работ": monthLabel(o.executionMonth),
    "Сумма к выплате": o.amount,
    "Тип сметы": "Прочие траты",
    Статус: ru(WORK_STATUS_EN_RU, o.workStatus),
    Комментарий: o.comment,
    "Дата проверки": o.checkedAt,
    "Дата оплаты": o.paidAt,
    "Дата оплаты - план": o.plannedPayAt,
  }));

  return [...workRows, ...otherRows];
}

async function serializePayments(): Promise<Row[]> {
  const payments = await prisma.payment.findMany({
    include: {
      executor: { select: { name: true } },
      bankAccount: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return payments.map((p) => ({
    Исполнитель: p.executor.name,
    "Год выполнения": p.periodYear,
    "Месяц выполнения работ": monthLabel(p.periodMonth),
    Выплата: p.amount,
    Статус: ru(PAYMENT_STATUS_EN_RU, p.paymentStatus),
    "Дата оплаты план": p.plannedPayAt,
    "Дата оплаты": p.paidAt,
    "Источник перевода": p.bankAccount?.name ?? null,
    Комментарий: p.comment,
  }));
}

async function serializeSpendingPlan(): Promise<Row[]> {
  const lines = await prisma.spendingPlanLine.findMany({
    include: {
      project: { select: { name: true, responsible: { select: { fullName: true } } } },
      executor: { select: { name: true } },
      workType: { select: { name: true } },
    },
    orderBy: [{ year: "asc" }, { week: "asc" }],
  });
  return lines.map((l) => ({
    "Год оплаты - план": l.year,
    "Неделя оплаты - план": weekLabel(l.week),
    Проект: l.project.name,
    Руководитель: l.project.responsible?.fullName ?? null,
    Сумма: l.amount,
    "Вид работ": l.workType.name,
    Исполнитель: l.executor.name,
  }));
}

// ─── Точка входа ──────────────────────────────────────────────────────────────

export async function buildExportWorkbook(): Promise<Buffer> {
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);

  const [
    bankAccounts,
    workTypes,
    clients,
    projects,
    executors,
    orders,
    charges,
    works,
    payments,
    spendingPlan,
  ] = await Promise.all([
    serializeBankAccounts(),
    serializeWorkTypes(),
    serializeClients(),
    serializeProjects(),
    serializeExecutors(),
    serializeOrders(),
    serializeCharges(),
    serializeWorks(),
    serializePayments(),
    serializeSpendingPlan(),
  ]);

  const patches: SheetPatch[] = [
    { meta: SHEET_META.bankAccounts, rows: bankAccounts },
    { meta: SHEET_META.workTypes, rows: workTypes },
    { meta: SHEET_META.clients, rows: clients },
    { meta: SHEET_META.projects, rows: projects },
    { meta: SHEET_META.executors, rows: executors },
    { meta: SHEET_META.orders, rows: orders },
    { meta: SHEET_META.charges, rows: charges },
    { meta: SHEET_META.works, rows: works },
    { meta: SHEET_META.payments, rows: payments },
    { meta: SHEET_META.spendingPlan, rows: spendingPlan },
  ];

  const keepSheets = [
    "Кэшфлоу проектов",
    "График кешфлоу",
    "БД_Выставленные_работы",
    "БД_Выплаты",
    "БД_Заказы",
    "БД_Начисления",
    "БД_Клиенты",
    "БД_Виды_работ",
    "БД_Исполнители",
    "БД_Банковские счета",
    "БД_Проекты",
    "БД_План_расходов_полный",
  ];

  return patchWorkbookTemplate(templateBuffer, patches, keepSheets);
}
