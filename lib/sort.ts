/**
 * Единая сортировка справочников для выпадающих списков.
 * Prisma orderBy сортирует по байтам (SQLite/PG BINARY-collation),
 * поэтому кириллицу дополнительно сортируем через localeCompare("ru").
 */

export function compareRu(a: string, b: string): number {
  return a.localeCompare(b, "ru");
}

/** Возвращает новый массив, отсортированный по полю name (алфавит, ru). */
export function sortByNameRu<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareRu(a.name, b.name));
}

/** Возвращает новый массив, отсортированный по полю label (алфавит, ru). */
export function sortByLabelRu<T extends { label: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareRu(a.label, b.label));
}

/** Возвращает новый массив, отсортированный по произвольному строковому ключу (алфавит, ru). */
export function sortByRu<T>(items: T[], getKey: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareRu(getKey(a), getKey(b)));
}
