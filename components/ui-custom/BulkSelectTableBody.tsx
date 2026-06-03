"use client";

import type { ComponentProps } from "react";
import { TableBody } from "@/components/ui/table";

/** TableBody для таблиц с bulk-выделением: Shift+клик не выделяет текст в браузере. */
export function BulkSelectTableBody(props: ComponentProps<typeof TableBody>) {
  return (
    <TableBody
      {...props}
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
        props.onMouseDown?.(e);
      }}
    />
  );
}
