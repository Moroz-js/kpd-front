"use client";

import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  checked: boolean;
  rowIndex: number;
  rowId: string;
  onSelect: (index: number, id: string, shiftKey: boolean) => void;
};

/** Чекбокс строки с поддержкой Shift+клик для диапазонного выделения. */
export function RowSelectCheckbox({ checked, rowIndex, rowId, onSelect }: Props) {
  return (
    <Checkbox
      checked={checked}
      className="select-none"
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
      }}
      onClick={(e) => {
        e.preventDefault();
        onSelect(rowIndex, rowId, e.shiftKey);
      }}
    />
  );
}
