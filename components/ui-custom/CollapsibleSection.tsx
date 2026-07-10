"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Хук хранения свёрнутости секции ДП в localStorage.
 * Ключ: dp:section:<sectionId>, значения "expanded" / "collapsed".
 * Если значения нет — используется defaultExpanded.
 */
export function useSectionCollapsed(sectionId: string, defaultExpanded = true) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`dp:section:${sectionId}`);
      if (stored === "expanded") setExpanded(true);
      else if (stored === "collapsed") setExpanded(false);
    } catch {
      // localStorage недоступен (SSR/приватный режим) — остаёмся на дефолте
    }
  }, [sectionId]);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`dp:section:${sectionId}`, next ? "expanded" : "collapsed");
      } catch {
        // ignore
      }
      return next;
    });
  }, [sectionId]);

  return [expanded, toggle] as const;
}

/** Иконка-шеврон состояния секции. */
export function SectionChevron({ expanded, className }: { expanded: boolean; className?: string }) {
  const Icon = expanded ? ChevronDown : ChevronRight;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0 text-neutral-400", className)} />;
}

/**
 * Сворачиваемый блок-карточка (для блоков ДП вне общей таблицы:
 * график кэшфлоу, все работы по проекту).
 */
export function CollapsibleSection({
  sectionId,
  title,
  defaultExpanded = true,
  children,
  className,
}: {
  sectionId: string;
  title: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [expanded, toggle] = useSectionCollapsed(sectionId, defaultExpanded);

  return (
    <div className={cn("rounded-lg border border-neutral-200 bg-white", className)}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left select-none"
      >
        <SectionChevron expanded={expanded} />
        <span className="text-base font-semibold text-neutral-900">{title}</span>
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
