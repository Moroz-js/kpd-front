"use client";

import * as React from "react";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

/** Сбрасывает страницу на 1 при смене фильтров. */
export function useServerTable(pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(pageSize);

  const resetPage = React.useCallback(() => setPage(1), []);

  const onFilterChange = React.useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
      setter(value);
      setPage(1);
    },
    []
  );

  return { page, setPage, pageSize: size, setPageSize: setSize, resetPage, onFilterChange };
}
