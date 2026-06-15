/**
 * Экспорт данных БД в формат исходной сметы (Смета_23.xlsx).
 *
 * Стратегия: грузим шаблон templates/Smeta_23.xlsx и перезаписываем 11 листов
 * БД_* актуальными данными. Остальные листы (формулы, сводки) не трогаем —
 * они ссылаются на БД_* по адресам ячеек, поэтому значения остаются согласованными.
 *
 * Допустимые потери: один счёт из мультиселекта, null invoiceNumber, без __SRC_UID.
 */

import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
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
  type SheetMeta,
} from "@/lib/excel/mappings";
import { listClients } from "@/lib/services/clients";

type Row = Record<string, unknown>;

const TEMPLATE_PATH = path.resolve(process.cwd(), "templates", "Smeta_23.xlsx");

// ─── Запись данных в лист с сохранением заголовка ────────────────────────────

function fillSheet(wb: XLSX.WorkBook, meta: SheetMeta, rows: Row[]): void {
  const ws = wb.Sheets[meta.sheet];
  if (!ws) throw new Error(`Лист "${meta.sheet}" не найден в шаблоне`);

  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: true,
  });

  let headerIdx = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i]?.some((v) => v === meta.identifyBy)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1)
    throw new Error(`Колонка "${meta.identifyBy}" не найдена в листе "${meta.sheet}"`);

  const headers = (raw[headerIdx] as unknown[]).map((h) =>
    h != null ? String(h).trim() : null
  );

  // Сохраняем всё до начала данных (заголовок + строки аннотаций при dataOffset>1)
  const preserved = raw.slice(0, headerIdx + meta.dataOffset);

  const dataRows = rows.map((r) =>
    headers.map((h) => {
      const v = h && h in r ? r[h] : null;
      if (v == null) return null;
      // Невалидные даты ломают запись xlsx → null
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
      return v;
    })
  );

  const aoa = [...preserved, ...dataRows];
  const next = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  wb.Sheets[meta.sheet] = next;
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
    include: { project: { select: { name: true } } },
  });
  return orders.map((o) => ({
    "Номер заказа": o.orderNumber,
    "Описание заказа": o.description,
    "Номер договора/допсоглашения": o.contractNumber,
    Статус: ru(STATUS_EN_RU, o.status),
    Проект: o.project?.name ?? null,
  }));
}

async function serializeCharges(): Promise<Row[]> {
  const charges = await prisma.charge.findMany({
    orderBy: { chargeNumber: "asc" },
    include: {
      bankAccount: { select: { name: true } },
      order: { select: { orderNumber: true } },
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
    "Назначение платежа": c.paymentPurpose,
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
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.otherExpense.findMany({
      include: {
        executor: { select: { name: true } },
        project: { select: { name: true } },
        workType: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const workRows: Row[] = works.map((w) => ({
    Исполнитель: w.executor.name,
    Проект: w.project.name,
    "Вид работ": w.workType.name,
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
    "Неделя оплаты - план": l.week,
    Проект: l.project.name,
    Руководитель: l.project.responsible?.fullName ?? null,
    Сумма: l.amount,
    "Вид работ": l.workType.name,
    Исполнитель: l.executor.name,
  }));
}

// ─── Точка входа ──────────────────────────────────────────────────────────────

export async function buildExportWorkbook(): Promise<Buffer> {
  // В бандле Next у XLSX.readFile нет доступа к fs — читаем файл сами в буфер.
  // Без cellDates: иначе даты на нетронутых листах превращаются в Date,
  // и одна некорректная ломает XLSX.write (Invalid time value).
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const wb = XLSX.read(templateBuffer, { type: "buffer" });

  const [
    users,
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
    serializeUsers(),
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

  fillSheet(wb, SHEET_META.users, users);
  fillSheet(wb, SHEET_META.bankAccounts, bankAccounts);
  fillSheet(wb, SHEET_META.workTypes, workTypes);
  fillSheet(wb, SHEET_META.clients, clients);
  fillSheet(wb, SHEET_META.projects, projects);
  fillSheet(wb, SHEET_META.executors, executors);
  fillSheet(wb, SHEET_META.orders, orders);
  fillSheet(wb, SHEET_META.charges, charges);
  fillSheet(wb, SHEET_META.works, works);
  fillSheet(wb, SHEET_META.payments, payments);
  fillSheet(wb, SHEET_META.spendingPlan, spendingPlan);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}
