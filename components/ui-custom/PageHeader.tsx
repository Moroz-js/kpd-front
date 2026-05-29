/**
 * PageHeader — заголовок страницы со слотом для действий справа.
 */

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between mb-6", className)}>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
