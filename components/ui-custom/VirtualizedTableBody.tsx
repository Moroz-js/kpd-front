"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BulkSelectTableBody } from "@/components/ui-custom/BulkSelectTableBody";
import { TableCell, TableRow } from "@/components/ui/table";

const DEFAULT_ROW_HEIGHT = 40;

type VirtualizedTableBodyProps = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  rowCount: number;
  colSpan: number;
  estimateRowHeight?: number;
  overscan?: number;
  isLoading?: boolean;
  loading?: React.ReactNode;
  isEmpty?: boolean;
  empty?: React.ReactNode;
  renderRow: (index: number) => React.ReactNode;
};

/** Рендерит только видимые строки tbody; «выбрать всё» остаётся на уровне данных (Set id). */
export function VirtualizedTableBody({
  scrollRef,
  rowCount,
  colSpan,
  estimateRowHeight = DEFAULT_ROW_HEIGHT,
  overscan = 10,
  isLoading,
  loading,
  isEmpty,
  empty,
  renderRow,
}: VirtualizedTableBodyProps) {
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  });

  if (isLoading && loading) {
    return <BulkSelectTableBody>{loading}</BulkSelectTableBody>;
  }

  if (isEmpty && empty) {
    return <BulkSelectTableBody>{empty}</BulkSelectTableBody>;
  }

  const items = virtualizer.getVirtualItems();
  const paddingTop = items.length > 0 ? items[0].start : 0;
  const paddingBottom =
    items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;

  return (
    <BulkSelectTableBody>
      {paddingTop > 0 && (
        <TableRow className="border-0 hover:bg-transparent pointer-events-none">
          <TableCell colSpan={colSpan} className="p-0 border-0" style={{ height: paddingTop }} />
        </TableRow>
      )}
      {items.map((vi) => (
        <React.Fragment key={vi.key}>{renderRow(vi.index)}</React.Fragment>
      ))}
      {paddingBottom > 0 && (
        <TableRow className="border-0 hover:bg-transparent pointer-events-none">
          <TableCell colSpan={colSpan} className="p-0 border-0" style={{ height: paddingBottom }} />
        </TableRow>
      )}
    </BulkSelectTableBody>
  );
}
