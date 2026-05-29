/**
 * ISO-week утилиты.
 *
 * Принципы:
 * - Используем реальное количество ISO-недель в году (52 или 53). См. TZ §Глобальные правила.
 * - `getISOWeek` совпадает с Excel `ISOWEEKNUM`.
 * - `getISOWeekYear` возвращает год по ISO (важно для 31 декабря / 1 января на стыке).
 */

import {
  getISOWeek as dfGetISOWeek,
  getISOWeekYear as dfGetISOWeekYear,
  getISOWeeksInYear as dfGetISOWeeksInYear,
  setISOWeek,
  setISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  addDays,
} from "date-fns";

export function getISOWeek(date: Date | string): number {
  return dfGetISOWeek(typeof date === "string" ? new Date(date) : date);
}

export function getISOWeekYear(date: Date | string): number {
  return dfGetISOWeekYear(typeof date === "string" ? new Date(date) : date);
}

export function getISOWeeksInYear(year: number): number {
  return dfGetISOWeeksInYear(new Date(year, 5, 15)); // любая дата в середине года
}

/** Начало (понедельник) ISO-недели N в году Y. */
export function isoWeekStart(year: number, week: number): Date {
  let d = setISOWeekYear(new Date(year, 5, 15), year);
  d = setISOWeek(d, week);
  return startOfISOWeek(d);
}

/** Конец (воскресенье) ISO-недели N в году Y. */
export function isoWeekEnd(year: number, week: number): Date {
  return endOfISOWeek(isoWeekStart(year, week));
}

/** Список номеров недель года: [1..N], где N = getISOWeeksInYear(year). */
export function isoWeeksOfYear(year: number): number[] {
  const total = getISOWeeksInYear(year);
  return Array.from({ length: total }, (_, i) => i + 1);
}

/**
 * Ближайшее «следующее 5 или 20 число» от заданной даты включительно.
 * Используется как default `plannedPayAt` в TDNB-15.
 */
/** Форматирует Date в "YYYY-MM-DD" по локальному времени (без сдвига UTC). */
export function toLocalDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function nearestPaymentDate(from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getDate();
  // Строго будущее: 5-е или 20-е, которое ещё не наступило
  if (day < 5) return new Date(d.getFullYear(), d.getMonth(), 5);
  if (day < 20) return new Date(d.getFullYear(), d.getMonth(), 20);
  return new Date(d.getFullYear(), d.getMonth() + 1, 5);
}

/** Форматирует номер недели: "Неделя 01", "Неделя 16". */
export function weekLabel(week: number): string {
  return `Неделя ${String(week).padStart(2, "0")}`;
}

/** Месяц (1-12), которому принадлежит ISO-неделя. */
export function isoWeekToMonth(year: number, week: number): number {
  return isoWeekStart(year, week).getMonth() + 1;
}

/** Удобный массив дней внутри ISO-недели (понедельник → воскресенье). */
export function isoWeekDays(year: number, week: number): Date[] {
  const start = isoWeekStart(year, week);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
