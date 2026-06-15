/**
 * Общие классы для «прилипающей» (sticky) правой колонки действий в таблицах.
 * Кнопки действий остаются видимыми при горизонтальном скролле.
 * Эталон — таблица «Прочие траты».
 *
 * Использование:
 *   <TableHead className={stickyActionsHead} />
 *   <TableCell className={cn(stickyActionsCell, isSelected && "bg-blue-50")}>…</TableCell>
 *
 * Важно: у ячейки должен быть непрозрачный фон (по умолчанию bg-white),
 * для выделенных/подсвеченных строк фон нужно переопределить тем же цветом.
 */
export const stickyActionsHead =
  "sticky right-0 z-20 bg-neutral-100 border-l border-neutral-200 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] min-w-[96px]";

export const stickyActionsCell =
  "sticky right-0 z-10 border-l border-neutral-200 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] bg-white";

/** Обёртка для кнопок внутри ячейки действий — прижимает их вправо. */
export const stickyActionsInner =
  "flex shrink-0 gap-0.5 items-center justify-end";
