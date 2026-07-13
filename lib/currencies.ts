/**
 * Справочник валют для банковских счетов.
 * Базовый список — дефолты; пользователь может добавить любой код.
 */

export const DEFAULT_CURRENCIES = ["RUB", "USD", "EUR", "GEL"] as const;

/** Объединяет дефолты + коды из БД (distinct). Без дублей, uppercase, по алфавиту. */
export function mergeCurrencyOptions(fromDb: string[]): string[] {
  const set = new Set([...DEFAULT_CURRENCIES, ...fromDb.map((c) => c.toUpperCase())]);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Нормализация кода — uppercase, trim. */
export function normalizeCurrencyCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Проверка: валидный код валюты (3–6 латинских символов). */
export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3,6}$/.test(code.trim().toUpperCase());
}
