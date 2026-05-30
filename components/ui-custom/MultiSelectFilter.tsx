"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string; group?: string };

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

  // Group options
  const grouped = React.useMemo(() => {
    const hasGroups = options.some((o) => o.group);
    if (!hasGroups) return [{ group: null, opts: options }];
    const map = new Map<string, MultiSelectOption[]>();
    for (const opt of options) {
      const g = opt.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(opt);
    }
    return Array.from(map.entries()).map(([group, opts]) => ({ group: group || null, opts }));
  }, [options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-xs font-normal whitespace-nowrap",
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
            <div className="px-3 py-2 text-xs text-neutral-500">Нет вариантов</div>
          )}
          {grouped.map(({ group, opts }) => (
            <React.Fragment key={group ?? "__ungrouped__"}>
              {group && (
                <div className="px-2 pt-2 pb-0.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                  {group}
                </div>
              )}
              {opts.map((opt) => {
                const checked = valueSet.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs whitespace-nowrap hover:bg-neutral-100"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(opt.value)} />
                    <span className="flex-1 text-left">{opt.label}</span>
                    {checked && <Check className="h-3 w-3 shrink-0 text-neutral-500" />}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
