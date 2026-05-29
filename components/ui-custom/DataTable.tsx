"use client";

/**
 * DataTable — обёртка над shadcn Table с поддержкой bulk-выделения строк.
 *
 * Принцип (см. TZ §Глобальные правила, Bulk-операции):
 * - Первая колонка — checkbox.
 * - В шапке — «выделить всё на странице» (intermediate, если выделена часть).
 * - Состояние selectedIds управляется снаружи (callback onSelectionChange).
 *
 * Использование:
 *   const [selected, setSelected] = useState<string[]>([]);
 *   <DataTable
 *     rows={works}
 *     getRowId={(w) => w.id}
 *     selectedIds={selected}
 *     onSelectionChange={setSelected}
 *     columns={...}
 *   />
 *
 * Конкретные колонки рендерим сами через children-функцию `renderRow`.
 */

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type DataTableProps<T> = {
  rows: T[];
  getRowId: (row: T) => string;
  /** Если undefined — bulk-выделение выключено. */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Шапка таблицы (без bulk-чекбокса — он добавляется автоматически). */
  header: React.ReactNode;
  /** Render каждой строки. selected = true, если строка выделена. */
  renderRow: (row: T, selected: boolean) => React.ReactNode;
  /** Сколько колонок в `header` (для colspan empty-state). Если не указано — empty без colspan. */
  colSpan?: number;
  /** Текст когда rows пустой. */
  emptyText?: React.ReactNode;
  className?: string;
};

export function DataTable<T>({
  rows,
  getRowId,
  selectedIds,
  onSelectionChange,
  header,
  renderRow,
  colSpan,
  emptyText = "Нет данных",
  className,
}: DataTableProps<T>) {
  const hasBulk = !!onSelectionChange;
  const selectedSet = React.useMemo(() => new Set(selectedIds ?? []), [selectedIds]);

  const allChecked = hasBulk && rows.length > 0 && rows.every((r) => selectedSet.has(getRowId(r)));
  const someChecked = hasBulk && rows.some((r) => selectedSet.has(getRowId(r)));

  function toggleAll(checked: boolean) {
    if (!onSelectionChange) return;
    if (checked) {
      const ids = new Set(selectedIds ?? []);
      rows.forEach((r) => ids.add(getRowId(r)));
      onSelectionChange(Array.from(ids));
    } else {
      const visibleIds = new Set(rows.map(getRowId));
      onSelectionChange((selectedIds ?? []).filter((id) => !visibleIds.has(id)));
    }
  }

  function toggleOne(id: string, checked: boolean) {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(Array.from(new Set([...(selectedIds ?? []), id])));
    } else {
      onSelectionChange((selectedIds ?? []).filter((x) => x !== id));
    }
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {hasBulk && (
            <TableHead className="w-10">
              <Checkbox
                checked={allChecked}
                indeterminate={!allChecked && someChecked}
                onCheckedChange={toggleAll}
                aria-label="Выделить все"
              />
            </TableHead>
          )}
          {header}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={(colSpan ?? 1) + (hasBulk ? 1 : 0)}
              className="text-center text-neutral-500 py-8"
            >
              {emptyText}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => {
            const id = getRowId(row);
            const selected = selectedSet.has(id);
            return (
              <TableRow key={id} className={cn(selected && "bg-neutral-50")}>
                {hasBulk && (
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(c) => toggleOne(id, c)}
                      aria-label={`Выделить строку ${id}`}
                    />
                  </TableCell>
                )}
                {renderRow(row, selected)}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
