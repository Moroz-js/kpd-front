import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Реэкспорт для совместимости со старым кодом.
// Новый код должен импортировать напрямую из @/lib/format, @/lib/iso-weeks.
export { formatMoney, formatDate, formatDateTime, monthLabel, monthFullLabel, MONTHS } from "./format";
export { nearestPaymentDate, getISOWeek as dateToWeek } from "./iso-weeks";

export const YEARS = [2024, 2025, 2026, 2027];

// ─── Совместимость со старыми статус-словарями (DEPRECATED) ───
// Использовать @/lib/statuses в новом коде.
export const WORK_STATUS_LABELS: Record<string, string> = {
  submitted: "Выставлено",
  checked: "Проверено",
  paid: "Оплачено",
  rework: "Нужно доработать",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  paid: "Оплачено",
};

export function weekToMonth(week: number): number {
  return Math.min(12, Math.ceil(week / (52 / 12)));
}
