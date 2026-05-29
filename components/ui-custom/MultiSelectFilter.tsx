"use client";

/**
 * MultiSelectFilter — фильтр с мультиселектом по списку опций.
 *
 * Использование:
 *   <MultiSelectFilter
 *     label="Статус"
 *     options={[{value: 'active', label: 'Активный'}, ...]}
 *     value={selected}
 *     onChange={setSelected}
 *   />
 *
 * Состояние value хранится снаружи (массив value).
 * Кнопка показывает: "Статус", "Статус: Активный", "Статус: 2".
 */

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string };

export type MultiSelectFilterProps = {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
};

export function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  className,
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false);
  const valueSet = React.useMemo(() => new Set(value), [value]);

  const triggerLabel = (() => {
    if (value.length === 0) return label;
    if (value.length === 1) {
      const opt = options.find((o) => o.value === value[0]);
      return `${label}: ${opt?.label ?? value[0]}`;
    }
    return `${label}: ${value.length}`;
  })();

  function toggle(v: string) {
    if (valueSet.has(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-sm font-normal",
              value.length > 0 && "border-neutral-400 bg-neutral-50",
              className
            )}
          >
            <span className="truncate max-w-44">{triggerLabel}</span>
            {value.length > 0 ? (
              <span
                role="button"
                tabIndex={0}
                onClick={clear}
                className="ml-1 -mr-1 rounded-sm p-0.5 hover:bg-neutral-200"
              >
                <X className="h-3 w-3" />
              </span>
            ) : (
              <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
            )}
          </Button>
        }
      />
      <PopoverContent className="w-56 p-1" align="start">
        <div className="max-h-72 overflow-y-auto">
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-neutral-500">Нет вариантов</div>
          )}
          {options.map((opt) => {
            const checked = valueSet.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-neutral-100"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(opt.value)} />
                <span className="flex-1 text-left">{opt.label}</span>
                {checked && <Check className="h-3 w-3 text-neutral-500" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
