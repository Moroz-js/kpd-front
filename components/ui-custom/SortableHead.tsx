"use client";

import { useRouter, usePathname } from "next/navigation";
import { TableHead } from "@/components/ui/table";
import { ChevronUp, ChevronDown, ChevronsUpDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type SortResetProps = {
  onReset: () => void;
  visible?: boolean;
};

export function SortResetButton({ onReset, visible = true }: SortResetProps) {
  return (
    <button
      onClick={onReset}
      className={cn(
        "inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors ml-1",
        !visible && "invisible pointer-events-none"
      )}
      title="Сбросить сортировку"
    >
      <RotateCcw className="h-3 w-3" />
      Сброс
    </button>
  );
}

type SortDir = "asc" | "desc";

/** Для клиентских таблиц — принимает onSort callback */
type CallbackProps = {
  field: string;
  sortBy: string;
  sortDir: SortDir;
  onSort: (field: string, dir: SortDir) => void;
  children: React.ReactNode;
  className?: string;
};

export function SortableHead({ field, sortBy, sortDir, onSort, children, className }: CallbackProps) {
  const active = sortBy === field;

  function handleClick() {
    const newDir: SortDir = active && sortDir === "asc" ? "desc" : "asc";
    onSort(field, newDir);
  }

  return (
    <TableHead className={cn("cursor-pointer select-none whitespace-nowrap", className)} onClick={handleClick}>
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          sortDir === "asc"
            ? <ChevronUp className="h-3.5 w-3.5 text-neutral-700" />
            : <ChevronDown className="h-3.5 w-3.5 text-neutral-700" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-300" />
        )}
      </span>
    </TableHead>
  );
}

/** Для серверных страниц — обновляет URL-параметры */
type UrlProps = {
  field: string;
  sortBy: string;
  sortDir: SortDir;
  searchParamsStr: string; // searchParams.toString() из серверного компонента
  children: React.ReactNode;
  className?: string;
};

export function UrlSortableHead({ field, sortBy, sortDir, searchParamsStr, children, className }: UrlProps) {
  const router = useRouter();
  const pathname = usePathname();
  const active = sortBy === field;

  function handleClick() {
    const params = new URLSearchParams(searchParamsStr);
    const newDir: SortDir = active && sortDir === "asc" ? "desc" : "asc";
    params.set("sortBy", field);
    params.set("sortDir", newDir);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <TableHead className={cn("cursor-pointer select-none whitespace-nowrap", className)} onClick={handleClick}>
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          sortDir === "asc"
            ? <ChevronUp className="h-3.5 w-3.5 text-neutral-700" />
            : <ChevronDown className="h-3.5 w-3.5 text-neutral-700" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-300" />
        )}
      </span>
    </TableHead>
  );
}
