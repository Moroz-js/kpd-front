/**
 * Единые словари статусов и палитра бейджей.
 *
 * Палитра (см. TZ §Глобальные правила):
 *   gray   — planned / pending
 *   yellow — submitted / in_progress / review / need_approval
 *   blue   — checked / paused
 *   green  — paid / done / approved
 *   red    — rework / overdue
 *   slate  — archived
 */

export type BadgeTone = "gray" | "yellow" | "blue" | "green" | "red" | "slate";

export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  gray: "bg-gray-100 text-gray-700 border-gray-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  green: "bg-green-100 text-green-800 border-green-200",
  red: "bg-red-100 text-red-800 border-red-200",
  slate: "bg-slate-200 text-slate-600 border-slate-300",
};

// ─── WORK STATUSES ────────────────────────────────────────────
export const WORK_STATUSES = {
  submitted: { label: "Выставлено",      tone: "gray"   as BadgeTone },
  checked:   { label: "Проверено",       tone: "yellow" as BadgeTone },
  paid:      { label: "Оплачено",        tone: "green"  as BadgeTone },
  rework:    { label: "Нужно доработать", tone: "red"   as BadgeTone },
} as const;
export type WorkStatus = keyof typeof WORK_STATUSES;

/** Статусы работы, доступные для ручной смены (без «Оплачено» — только из выплаты). */
export const WORK_STATUSES_SETTABLE = ["submitted", "checked", "rework"] as const;
export type WorkStatusSettable = (typeof WORK_STATUSES_SETTABLE)[number];

// ─── PAYMENT STATUSES ─────────────────────────────────────────
export const PAYMENT_STATUSES = {
  planned: { label: "Запланировано", tone: "gray" as BadgeTone },
  sent:    { label: "Отправлено",    tone: "yellow" as BadgeTone },
  paid:    { label: "Оплачено",      tone: "green" as BadgeTone },
} as const;
export type PaymentStatus = keyof typeof PAYMENT_STATUSES;

// ─── TASK STATUSES ────────────────────────────────────────────
export const TASK_STATUSES = {
  pending:     { label: "Поставлена",  tone: "gray" as BadgeTone },
  in_progress: { label: "В работе",    tone: "yellow" as BadgeTone },
  paused:      { label: "На паузе",    tone: "blue" as BadgeTone },
  review:      { label: "На проверке", tone: "yellow" as BadgeTone },
  done:        { label: "Выполнено",   tone: "green" as BadgeTone },
} as const;
export type TaskStatus = keyof typeof TASK_STATUSES;

// ─── VACATION STATUSES ────────────────────────────────────────
export const VACATION_STATUSES = {
  need_approval: { label: "Надо согласовать", tone: "yellow" as BadgeTone },
  approved:      { label: "Согласовано с РП", tone: "green" as BadgeTone },
} as const;
export type VacationStatus = keyof typeof VACATION_STATUSES;

// ─── ENTITY STATUSES (active/archived) ────────────────────────
export const ENTITY_STATUSES = {
  active:   { label: "Активный",  tone: "green" as BadgeTone },
  archived: { label: "Архивный",  tone: "slate" as BadgeTone },
} as const;
export type EntityStatus = keyof typeof ENTITY_STATUSES;

// ─── ORDER STATUSES ───────────────────────────────────────────
export const ORDER_STATUSES = ENTITY_STATUSES;

// ─── CHARGE STATUSES ──────────────────────────────────────────
export const CHARGE_STATUSES = {
  planned:           { label: "В плане",          tone: "gray"   as BadgeTone },
  to_pay:            { label: "К оплате",         tone: "yellow" as BadgeTone },
  pending_approval:  { label: "На согласовании",  tone: "blue"   as BadgeTone },
  paid:              { label: "Оплачено",         tone: "green"  as BadgeTone },
} as const;
export type ChargeStatus = keyof typeof CHARGE_STATUSES;

// ─── EXECUTOR TYPES ───────────────────────────────────────────
export const EXECUTOR_TYPES = {
  permanent: "Постоянный",
  external: "Внешний",
  service: "Сервис",
  bank: "Банки",
} as const;
export type ExecutorType = keyof typeof EXECUTOR_TYPES;

export const EXECUTOR_TYPE_FILTER_GROUPS: Record<string, ExecutorType[]> = {
  Постоянный: ["permanent"],
  Внешний: ["external"],
  Сервис: ["service"],
  Банки: ["bank"],
};

// «Статус в компании» (для permanent).
export const EXECUTOR_COMPANY_STATUSES = {
  core:  "Ядро",
  orbit: "Орбита",
} as const;

/** «core,orbit» → «Ядро, Орбита» для UI */
export function formatCompanyStatus(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .split(",")
    .map((s) => EXECUTOR_COMPANY_STATUSES[s.trim() as keyof typeof EXECUTOR_COMPANY_STATUSES] ?? s.trim())
    .join(", ");
}

// «Тип получателя» (I) — 16 значений, см. TDNB-18 §Тип получателя.
export const RECIPIENT_TYPES = [
  "Сервис заруб.",
  "Сервис в РФ",
  "Филиал ГПХ",
  "ИП в РФ",
  "Криптокошелёк",
  "Юрлицо в РФ",
  "З/П в РФ налог 15%",
  "З/П в РФ налог 30%",
  "Самозанятый в РФ",
  "Юрлицо в КЗ",
  "Юрлицо в ЧГ",
  "Юрлицо в ЕС",
  "ИП зарубежный",
  "Самозанятый заруб.",
  "Физлицо на карту РФ",
  "Физлицо на заруб. карту",
] as const;
export type RecipientType = (typeof RECIPIENT_TYPES)[number];

// Тип юрлица (для external-legal).
export const LEGAL_FORMS = ["ООО", "ИП", "АО", "ОАО", "ПАО"] as const;

// ─── WORK TYPE SEGMENTS ──────────────────────────────────────
export const WORK_TYPE_SEGMENTS = [
  "Транзитные платежи",
  "Видео",
  "Аналитика",
  "Продвижение",
  "Экспертиза",
  "Сервисы",
  "Менеджмент",
  "Визуал",
  "Текст",
  "IT",
] as const;
export type WorkTypeSegment = (typeof WORK_TYPE_SEGMENTS)[number];

// ─── PROJECT TYPES ───────────────────────────────────────────
export const PROJECT_TYPES = {
  internal: "Внутренний",
  client:   "Клиентский",
} as const;

// ─── CLIENT DEPARTMENTS (TDNB-21) ─────────────────────────────
export const CLIENT_DEPARTMENTS = [
  "PR",
  "Intercom",
  "Непроектные расходы",
  "СБ",
  "Общепроектные расходы",
  "Маркетинг",
  "SM",
] as const;

// ─── PALETTE FOR ACTIVITY LOG ACTIONS ─────────────────────────
export const ACTIVITY_ACTIONS: Record<string, string> = {
  create: "создал",
  update: "изменил",
  delete: "удалил",
  archive: "архивировал",
  unarchive: "вернул из архива",
  status_change: "сменил статус",
  access_grant: "выдал доступ",
  access_revoke: "забрал доступ",
  password_reset: "сбросил пароль",
  approve: "согласовал",
};
