/** Логика выделения строк: обычный клик — toggle, Shift+клик — диапазон от якоря. */

export function computeRowSelection(
  orderedIds: string[],
  selectedIds: Set<string>,
  anchorIndex: number | null,
  index: number,
  id: string,
  shiftKey: boolean
): { nextSelected: Set<string>; nextAnchor: number | null } {
  if (shiftKey && anchorIndex !== null && orderedIds.length > 0) {
    const start = Math.min(anchorIndex, index);
    const end = Math.max(anchorIndex, index);
    const next = new Set(selectedIds);
    for (let i = start; i <= end; i++) {
      const rowId = orderedIds[i];
      if (rowId) next.add(rowId);
    }
    return { nextSelected: next, nextAnchor: anchorIndex };
  }

  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return { nextSelected: next, nextAnchor: index };
}
