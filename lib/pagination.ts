export const DEFAULT_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  /** Сумма amount по всем отфильтрованным записям (не только текущая страница). */
  totalAmount?: number;
};

export function paginateSlice<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const total = items.length;
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
  };
}

export function parsePositiveInt(value: string | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** CSV → string[]; пустая строка → []. */
export function parseCsvParam(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

/** CSV → number[] */
export function parseCsvIntParam(value: string | null | undefined): number[] {
  return parseCsvParam(value)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

export function appendCsv(params: URLSearchParams, key: string, values: string[]) {
  if (values.length) params.set(key, values.join(","));
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
