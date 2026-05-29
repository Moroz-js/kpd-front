"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type FilterOption = { value: string; label: string };

type FilterConfig = {
  key: string;
  label: string;
  options: FilterOption[];
};

type FilterBarProps = {
  filters: FilterConfig[];
  className?: string;
};

export function FilterBar({ filters, className }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetFilters() {
    router.push(pathname);
  }

  const hasActiveFilters = filters.some((f) => searchParams.has(f.key));

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? "mb-4"}`}>
      {filters.map((filter) => {
        const currentValue = searchParams.get(filter.key) ?? "all";
        const displayLabel =
          currentValue === "all"
            ? `${filter.label}: все`
            : (filter.options.find((o) => o.value === currentValue)?.label ?? currentValue);
        return (
          <Select
            key={filter.key}
            value={currentValue}
            onValueChange={(val) => updateFilter(filter.key, val ?? "all")}
          >
            <SelectTrigger
              className={`w-44 h-8 text-sm ${currentValue !== "all" ? "border-neutral-400 bg-neutral-50" : ""}`}
            >
              <span className="flex-1 text-left truncate">{displayLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{filter.label}: все</SelectItem>
              {filter.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="h-8 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <X className="h-3 w-3 mr-1" />
          Сбросить
        </Button>
      )}
    </div>
  );
}
