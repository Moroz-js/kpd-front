/**
 * StatusBadge — универсальный бейдж статуса.
 *
 * Использует единую палитру тонов из @/lib/statuses (gray/yellow/blue/green/red/slate).
 *
 * Примеры:
 *   <StatusBadge dict={WORK_STATUSES} value="checked" />
 *   <StatusBadge tone="red" label="Просрочено" />
 */

import { cn } from "@/lib/utils";
import { BADGE_TONE_CLASS, type BadgeTone } from "@/lib/statuses";

type FromDictProps = {
  dict: Record<string, { label: string; tone: BadgeTone }>;
  value: string;
  tone?: never;
  label?: never;
};

type RawProps = {
  dict?: never;
  value?: never;
  tone: BadgeTone;
  label: React.ReactNode;
};

type StatusBadgeProps = (FromDictProps | RawProps) & {
  className?: string;
};

export function StatusBadge(props: StatusBadgeProps) {
  let tone: BadgeTone;
  let label: React.ReactNode;

  if ("dict" in props && props.dict) {
    const entry = props.dict[props.value!];
    if (!entry) {
      tone = "slate";
      label = props.value;
    } else {
      tone = entry.tone;
      label = entry.label;
    }
  } else {
    tone = (props as RawProps).tone;
    label = (props as RawProps).label;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONE_CLASS[tone],
        (props as { className?: string }).className
      )}
    >
      {label}
    </span>
  );
}
