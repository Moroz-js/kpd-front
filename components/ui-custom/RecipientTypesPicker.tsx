"use client";

import { RECIPIENT_TYPES } from "@/lib/statuses";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
  disabled?: boolean;
};

export function RecipientTypesPicker({ value, onChange, className, disabled }: Props) {
  function toggle(rt: string) {
    if (disabled) return;
    onChange(value.includes(rt) ? value.filter((x) => x !== rt) : [...value, rt]);
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {RECIPIENT_TYPES.map((rt) => {
        const selected = value.includes(rt);
        return (
          <button
            key={rt}
            type="button"
            onClick={() => toggle(rt)}
            disabled={disabled}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors text-left",
              selected
                ? "bg-violet-100 border-violet-300 text-violet-800"
                : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100",
              disabled && "opacity-60 cursor-default pointer-events-none"
            )}
          >
            {rt}
          </button>
        );
      })}
    </div>
  );
}
