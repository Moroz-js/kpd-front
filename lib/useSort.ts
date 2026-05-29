import { useState, useMemo } from "react";

type SortDir = "asc" | "desc";

export function useSort<T>(
  data: T[],
  defaultField: string = "",
  defaultDir: SortDir = "asc"
) {
  const [sortBy, setSortBy] = useState(defaultField);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function handleSort(field: string, dir: SortDir) {
    setSortBy(field);
    setSortDir(dir);
  }

  function resetSort() {
    setSortBy(defaultField);
    setSortDir(defaultDir);
  }

  const sorted = useMemo(() => {
    if (!sortBy) return data;
    return [...data].sort((a, b) => {
      const aVal = getNestedValue(a, sortBy);
      const bVal = getNestedValue(b, sortBy);
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortBy, sortDir]);

  const isCustomSort = sortBy !== defaultField || sortDir !== defaultDir;

  return { sortBy, sortDir, handleSort, resetSort, sorted, isCustomSort };
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}
