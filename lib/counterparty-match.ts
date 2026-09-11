/**
 * Нормализация значений для распознавания контрагентов.
 *
 * Одно и то же имя приходит из разных банков по-разному: разные кавычки, двойные
 * пробелы, «ё» вместо «е», разный регистр. Сравниваем и храним признак всегда
 * через normalizeMatchValue, иначе «ООО «Базис»» и «ООО Базис» окажутся двумя
 * разными контрагентами.
 */

const QUOTES = /[«»"'`\u2018\u2019\u201c\u201d]/g;

export function normalizeMatchValue(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/Ё/g, "Е")
    .replace(QUOTES, "")
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

/** ИНН, ИИК, IBAN, номера счетов и карт: значимы только цифры и латиница. */
export function normalizeAccountValue(raw: string): string {
  return raw.replace(/[^\dA-Za-z]/g, "").toUpperCase();
}

/** Нормализация зависит от того, по какому полю выписки сравниваем. */
export function normalizeByMatchField(field: string, raw: string): string {
  return field === "inn" || field === "account"
    ? normalizeAccountValue(raw)
    : normalizeMatchValue(raw);
}
