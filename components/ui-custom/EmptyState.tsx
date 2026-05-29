import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: { label: string; href: string };
};

export function EmptyState({
  icon: Icon = Inbox,
  title = "Нет данных",
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-neutral-300 mb-4" />
      <p className="text-neutral-500 text-sm mb-1">{title}</p>
      {description && <p className="text-neutral-400 text-xs mb-4">{description}</p>}
      {action && (
        <Link href={action.href}>
          <Button variant="outline" size="sm">
            {action.label}
          </Button>
        </Link>
      )}
    </div>
  );
}
