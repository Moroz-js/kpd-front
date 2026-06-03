"use client";

import * as React from "react";
import { computeRowSelection } from "@/lib/table-row-selection";

export function useTableRowSelection(orderedIds: string[]) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const anchorIndexRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const anchor = anchorIndexRef.current;
    if (anchor !== null && anchor >= orderedIds.length) {
      anchorIndexRef.current = null;
    }
  }, [orderedIds]);

  const handleRowSelect = React.useCallback(
    (index: number, id: string, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const { nextSelected, nextAnchor } = computeRowSelection(
          orderedIds,
          prev,
          anchorIndexRef.current,
          index,
          id,
          shiftKey
        );
        anchorIndexRef.current = nextAnchor;
        return nextSelected;
      });
    },
    [orderedIds]
  );

  function toggleAll(visibleIds: string[]) {
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(visibleIds));
    anchorIndexRef.current = null;
  }

  function clearSelection() {
    setSelectedIds(new Set());
    anchorIndexRef.current = null;
  }

  return {
    selectedIds,
    setSelectedIds,
    handleRowSelect,
    toggleAll,
    clearSelection,
  };
}
