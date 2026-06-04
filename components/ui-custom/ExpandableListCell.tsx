"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  items: string[];
  className?: string;
};

export function ExpandableListCell({ items, className }: Props) {
  const [open, setOpen] = React.useState(false);

  if (items.length === 0) {
    return <span className="text-neutral-400">—</span>;
  }

  const preview = items.join(", ");

  return (
    <div className="min-w-0 w-full overflow-hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                "block w-full min-w-0 max-w-full text-left text-xs text-neutral-800 hover:text-blue-700 hover:underline cursor-pointer",
                className
              )}
            >
              <span className="block truncate">{preview}</span>
            </button>
          }
        />
      <PopoverContent className="w-80 max-h-72 overflow-y-auto p-3" align="start">
        <ul className="space-y-1.5 text-sm text-neutral-800">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </PopoverContent>
      </Popover>
    </div>
  );
}
