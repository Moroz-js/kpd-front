"use client";

/**
 * ConfirmDialog — единый компонент для подтверждения destructive-операций.
 * Использует shadcn AlertDialog. См. TZ §Глобальные правила.
 *
 * Контролируемый режим:
 *   <ConfirmDialog open={open} onOpenChange={setOpen} title="..." onConfirm={...} />
 *
 * Триггерный режим:
 *   <ConfirmDialog trigger={<Button>Delete</Button>} title="..." onConfirm={...} />
 */

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ConfirmDialogProps = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Контролируемый режим */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Триггерный режим */
  trigger?: React.ReactNode;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  destructive = false,
  onConfirm,
  open,
  onOpenChange,
  trigger,
}: ConfirmDialogProps) {
  const [isPending, startTransition] = React.useTransition();

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    startTransition(async () => {
      await onConfirm();
      onOpenChange?.(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger render={trigger as React.ReactElement} />}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className={cn(
              destructive && "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            )}
          >
            {isPending ? "..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
