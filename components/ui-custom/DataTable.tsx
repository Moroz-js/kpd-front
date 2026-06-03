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
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BulkSelectTableBody } from "@/components/ui-custom/BulkSelectTableBody";
import { RowSelectCheckbox } from "@/components/ui-custom/RowSelectCheckbox";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { computeRowSelection } from "@/lib/table-row-selection";

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
  const orderedIds = React.useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const anchorIndexRef = React.useRef<number | null>(null);

  const allChecked = hasBulk && rows.length > 0 && rows.every((r) => selectedSet.has(getRowId(r)));
  const someChecked = hasBulk && rows.some((r) => selectedSet.has(getRowId(r)));

  function toggleAll(checked: boolean) {
    if (!onSelectionChange) return;
    anchorIndexRef.current = null;
    if (checked) {
      const ids = new Set(selectedIds ?? []);
      rows.forEach((r) => ids.add(getRowId(r)));
      onSelectionChange(Array.from(ids));
    } else {
      const visibleIds = new Set(rows.map(getRowId));
      onSelectionChange((selectedIds ?? []).filter((id) => !visibleIds.has(id)));
    }
  }

  function selectRow(index: number, id: string, shiftKey: boolean) {
    if (!onSelectionChange) return;
    const { nextSelected, nextAnchor } = computeRowSelection(
      orderedIds,
      selectedSet,
      anchorIndexRef.current,
      index,
      id,
      shiftKey
    );
    anchorIndexRef.current = nextAnchor;
    onSelectionChange(Array.from(nextSelected));
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
      <BulkSelectTableBody>
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
          rows.map((row, rowIndex) => {
            const id = getRowId(row);
            const selected = selectedSet.has(id);
            return (
              <TableRow key={id} className={cn(selected && "bg-neutral-50")}>
                {hasBulk && (
                  <TableCell className="w-10">
                    <RowSelectCheckbox
                      checked={selected}
                      rowIndex={rowIndex}
                      rowId={id}
                      onSelect={selectRow}
                    />
                  </TableCell>
                )}
                {renderRow(row, selected)}
              </TableRow>
            );
          })
        )}
      </BulkSelectTableBody>
    </Table>
  );
}
