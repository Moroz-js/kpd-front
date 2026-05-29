import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit/log";

// ─── Автогенерация номера начисления H001, H002, ... ─────────────────────────

async function nextChargeNumber(): Promise<string> {
  const last = await prisma.charge.findFirst({
    orderBy: { chargeNumber: "desc" },
    select: { chargeNumber: true },
  });

  if (!last) return "H001";

  const num = parseInt(last.chargeNumber.replace(/^H/, ""), 10);
  const next = isNaN(num) ? 1 : num + 1;
  return `H${String(next).padStart(3, "0")}`;
}

// ─── Типы ─────────────────────────────────────────────────────────────────────

export type CreateChargeInput = {
  bankAccountId: string;
  orderId: string;
  amount?: number | null;
  issuedPlanAt?: string | null;
  issuedAt?: string | null;
  paidPlanAt?: string | null;
  paidAt?: string | null;
  paymentPurpose?: string | null;
  status?: string;
};

export type UpdateChargeInput = Partial<CreateChargeInput>;

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listCharges() {
  return prisma.charge.findMany({
    include: {
      bankAccount: { select: { id: true, name: true } },
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
    },
    orderBy: { chargeNumber: "desc" },
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createCharge(input: CreateChargeInput, userId: string) {
  const chargeNumber = await nextChargeNumber();

  // Автогенерация номера счёта: <chargeNumber>/<bankAccount.name>
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: input.bankAccountId },
    select: { name: true },
  });
  const invoiceNumber = `${chargeNumber}/${bankAccount?.name ?? input.bankAccountId}`;

  const paidAt = input.paidAt ? new Date(input.paidAt) : null;

  const charge = await prisma.charge.create({
    data: {
      chargeNumber,
      bankAccountId: input.bankAccountId,
      invoiceNumber,
      orderId: input.orderId,
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

  // Заполнение paidAt → paid
  let status = patch.status ?? existing.status;
  if (newPaidAt && !existing.paidAt) status = "paid";

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
      bankAccount: { select: { id: true, name: true } },
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
