"use client";

/**
 * BulkActions — toolbar, который появляется над таблицей,
 * когда выделена хотя бы одна строка.
 *
 * См. TZ §Глобальные правила (Bulk-операции).
 *
 * Использование:
 *   <BulkActions
 *     selectedCount={selected.length}
 *     onClear={() => setSelected([])}
 *     actions={[
 *       { label: "Сменить статус", onClick: () => ... },
 *       { label: "Удалить", onClick: () => ..., destructive: true },
 *     ]}
 *   />
 */

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export type BulkAction = {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export type BulkActionsProps = {
  selectedCount: number;
  onClear: () => void;
  actions: BulkAction[];
};

export function BulkActions({ selectedCount, onClear, actions }: BulkActionsProps) {
  if (selectedCount === 0) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-neutral-100 border border-neutral-300 rounded-md">
      <span className="text-sm text-neutral-700">Выделено: {selectedCount}</span>
      <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-neutral-500">
        <X className="h-3 w-3 mr-1" />
        Сбросить
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {actions.map((a, i) => (
          <Button
            key={i}
            variant={a.destructive ? "destructive" : "default"}
            size="sm"
            onClick={a.onClick}
            disabled={a.disabled}
            className="h-7"
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
