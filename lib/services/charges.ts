import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit/log";
import { getISOWeek, getISOWeekYear } from "@/lib/iso-weeks";
import { paginateSlice, type PaginatedResult } from "@/lib/pagination";

// ─── Автогенерация номера начисления H001, H002, ... ─────────────────────────

async function nextChargeNumber(): Promise<string> {
  // Числовой max по всем записям без привязки к префиксу (H/Н):
  // лексикографическая сортировка ломается на легаси/импортных номерах.
  const charges = await prisma.charge.findMany({ select: { chargeNumber: true } });
  const maxNum = charges.reduce((max, c) => {
    const n = parseInt(c.chargeNumber.replace(/\D/g, ""), 10) || 0;
    return n > max ? n : max;
  }, 0);
  return `Н${String(maxNum + 1).padStart(3, "0")}`;
}

// ─── Типы ─────────────────────────────────────────────────────────────────────

export type CreateChargeInput = {
  bankAccountId?: string | null;
  orderId?: string | null;
  amount?: number | null;
  issuedPlanAt?: string | null;
  issuedAt?: string | null;
  paidPlanAt?: string | null;
  paidAt?: string | null;
  paymentPurpose?: string | null;
  status?: string;
};

export type UpdateChargeInput = Partial<CreateChargeInput>;

// ─── List / pagination ────────────────────────────────────────────────────────

const chargeInclude = {
  bankAccount: { select: { id: true, name: true, currency: true } },
  order: {
    select: {
      id: true,
      orderNumber: true,
      description: true,
      project: {
        select: {
          id: true,
          name: true,
          shortName: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

export type ChargeListRow = Awaited<ReturnType<typeof listCharges>>[number];

export type ChargesFilter = {
  bankAccountId?: string[];
  orderId?: string[];
  status?: string[];
  clientId?: string[];
  clientIdHasEmpty?: boolean;
  projectId?: string[];
  projectIdHasEmpty?: boolean;
  payWeek?: string[];
  hidePaid?: boolean;
};

export type ChargesListQuery = {
  filter?: ChargesFilter;
  page?: number;
  pageSize?: number;
};

function chargePayWeekKey(charge: {
  paidAt: Date | null;
  paidPlanAt: Date | null;
}): string {
  const d = charge.paidAt ?? charge.paidPlanAt;
  if (!d) return "__empty__";
  return `${getISOWeekYear(d)}-${getISOWeek(d)}`;
}

function applyChargesFilter(rows: ChargeListRow[], f: ChargesFilter): ChargeListRow[] {
  return rows.filter((r) => {
    if (f.bankAccountId?.length && (!r.bankAccountId || !f.bankAccountId.includes(r.bankAccountId))) return false;
    if (f.orderId?.length && (!r.orderId || !f.orderId.includes(r.orderId))) return false;
    if (f.status?.length && !f.status.includes(r.status)) return false;
    if (f.clientId?.length || f.clientIdHasEmpty) {
      const token = r.order?.project?.client?.id ?? "__empty__";
      const allowed = [...(f.clientId ?? []), ...(f.clientIdHasEmpty ? ["__empty__"] : [])];
      if (!allowed.includes(token)) return false;
    }
    if (f.projectId?.length || f.projectIdHasEmpty) {
      const token = r.order?.project?.id ?? "__empty__";
      const allowed = [...(f.projectId ?? []), ...(f.projectIdHasEmpty ? ["__empty__"] : [])];
      if (!allowed.includes(token)) return false;
    }
    if (f.payWeek?.length && !f.payWeek.includes(chargePayWeekKey(r))) return false;
    if (f.hidePaid && r.status === "paid") return false;
    return true;
  });
}

export async function listCharges() {
  return prisma.charge.findMany({
    include: chargeInclude,
    orderBy: { chargeNumber: "desc" },
  });
}

export async function listChargesPage(
  query: ChargesListQuery = {}
): Promise<PaginatedResult<ChargeListRow> & { totalAmount: number }> {
  const filter = query.filter ?? {};
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 100;
  const filtered = applyChargesFilter(await listCharges(), filter);
  const totalAmount = filtered.reduce((s, r) => s + (r.amount ?? 0), 0);
  return { ...paginateSlice(filtered, page, pageSize), totalAmount };
}

export async function listChargeIds(filter: ChargesFilter = {}): Promise<string[]> {
  return applyChargesFilter(await listCharges(), filter).map((r) => r.id);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createCharge(input: CreateChargeInput, userId: string) {
  const chargeNumber = await nextChargeNumber();

  // № счёта: chargeNumber/bankAccount.name, или просто chargeNumber если счёт не выбран
  let invoiceNumber = chargeNumber;
  if (input.bankAccountId) {
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: input.bankAccountId },
      select: { name: true },
    });
    invoiceNumber = `${chargeNumber}/${bankAccount?.name ?? input.bankAccountId}`;
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : null;

  const charge = await prisma.charge.create({
    data: {
      chargeNumber,
      bankAccountId: input.bankAccountId ?? null,
      invoiceNumber,
      orderId: input.orderId ?? null,
      amount: input.amount ?? 0,
      issuedPlanAt: input.issuedPlanAt ? new Date(input.issuedPlanAt) : null,
      issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
      paidPlanAt: input.paidPlanAt ? new Date(input.paidPlanAt) : null,
      paidAt,
      paymentPurpose: input.paymentPurpose ?? null,
      status: paidAt ? "paid" : (input.status ?? "planned"),
    },
  });

  await logActivity({
    userId,
    action: "create",
    entityType: "Charge",
    entityId: charge.id,
    entityLabel: `${charge.chargeNumber} / ${invoiceNumber}`,
  });

  return charge;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateCharge(id: string, patch: UpdateChargeInput, userId: string) {
  const existing = await prisma.charge.findUniqueOrThrow({ where: { id } });

  const newPaidAt = patch.paidAt !== undefined
    ? (patch.paidAt ? new Date(patch.paidAt) : null)
    : existing.paidAt;

  // Заполнение paidAt → paid; очистка paidAt при статусе paid → to_pay
  // Авто-логика срабатывает только если статус не передан явно
  let status = patch.status ?? existing.status;
  if (patch.status === undefined) {
    if (newPaidAt && !existing.paidAt) {
      status = "paid";
    } else if (!newPaidAt && patch.paidAt !== undefined && status === "paid") {
      status = "to_pay";
    }
  }

  const updated = await prisma.charge.update({
    where: { id },
    data: {
      ...(patch.bankAccountId !== undefined && { bankAccountId: patch.bankAccountId }),
      ...(patch.orderId !== undefined && { orderId: patch.orderId }),
      ...(patch.amount !== undefined && { amount: patch.amount ?? 0 }),
      ...(patch.issuedPlanAt !== undefined && { issuedPlanAt: patch.issuedPlanAt ? new Date(patch.issuedPlanAt) : null }),
      ...(patch.issuedAt !== undefined && { issuedAt: patch.issuedAt ? new Date(patch.issuedAt) : null }),
      ...(patch.paidPlanAt !== undefined && { paidPlanAt: patch.paidPlanAt ? new Date(patch.paidPlanAt) : null }),
      ...(patch.paymentPurpose !== undefined && { paymentPurpose: patch.paymentPurpose }),
      paidAt: newPaidAt,
      status,
    },
    include: {
      bankAccount: { select: { id: true, name: true, currency: true } },
      order: {
        select: {
          id: true, orderNumber: true, description: true,
          project: {
            select: {
              id: true, name: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  await logActivity({
    userId,
    action: "update",
    entityType: "Charge",
    entityId: id,
    entityLabel: existing.chargeNumber,
  });

  return updated;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCharge(id: string, userId: string) {
  const existing = await prisma.charge.findUniqueOrThrow({ where: { id } });
  await prisma.charge.delete({ where: { id } });
  await logActivity({
    userId,
    action: "delete",
    entityType: "Charge",
    entityId: id,
    entityLabel: existing.chargeNumber,
  });
}
