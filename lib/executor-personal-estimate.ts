import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Личная смета: не сервис и привязан пользователь (логин). */
export function hasPersonalSmeta(executor: { type: string; userId: string | null }): boolean {
  return executor.type !== "service" && executor.userId != null;
}

/** Прочие траты: без личной сметы или личная смета с отозванным доступом. */
export function canAssignOtherExpense(executor: {
  status: string;
  type: string;
  userId: string | null;
  accessRevokedAt: Date | null;
}): boolean {
  if (executor.status !== "active") return false;
  if (!hasPersonalSmeta(executor)) return true;
  return executor.accessRevokedAt != null;
}

export const executorWhereForOtherExpense: Prisma.ExecutorWhereInput = {
  status: "active",
  NOT: {
    AND: [
      { type: { not: "service" } },
      { userId: { not: null } },
      { accessRevokedAt: null },
    ],
  },
};

export async function assertExecutorEligibleForOtherExpense(executorId: string): Promise<void> {
  const executor = await prisma.executor.findUnique({
    where: { id: executorId },
    select: { status: true, type: true, userId: true, accessRevokedAt: true },
  });
  if (!executor || !canAssignOtherExpense(executor)) {
    throw new Error(
      "Исполнитель недоступен для прочих трат: нужен без личной сметы или с отозванным доступом"
    );
  }
}
