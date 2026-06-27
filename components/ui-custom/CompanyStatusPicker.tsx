"use client";

import { EXECUTOR_COMPANY_STATUSES } from "@/lib/statuses";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
};

export function CompanyStatusPicker({ value, onChange, className }: Props) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((x) => x !== key) : [...value, key]);
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {Object.entries(EXECUTOR_COMPANY_STATUSES).map(([key, label]) => {
        const selected = value.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors text-left",
              selected
                ? "bg-violet-100 border-violet-300 text-violet-800"
                : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
