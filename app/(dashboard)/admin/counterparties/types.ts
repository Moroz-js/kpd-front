export type Requisite = {
  id: string;
  paymentMethod: string;
  taxId: string | null;
  bic: string | null;
  bankName: string | null;
  accountNumber: string | null;
  cardNumber: string | null;
  status: string;
  comment: string | null;
};

export type Alias = {
  id: string;
  value: string;
  source: string;
};

export type Counterparty = {
  id: string;
  name: string;
  kind: string;
  legalType: string | null;
  status: string;
  comment: string | null;
  executorId: string | null;
  executorName: string | null;
  clientId: string | null;
  clientName: string | null;
  bankAccountId: string | null;
  bankAccountName: string | null;
  personalEstimateUrl: string | null;
  requisites: Requisite[];
  aliases: Alias[];
  operationCount: number;
  createdAt: string;
};

export type LinkOption = { id: string; name: string; status: string };

/** Что заполнено у контрагента: ссылка ровно одна. */
export type LinkKind = "executor" | "client" | "bankAccount";

export const LINK_LABELS: Record<LinkKind, string> = {
  executor: "Исполнитель",
  client: "Клиент",
  bankAccount: "Банковский счёт",
};

/** Уникальные непустые значения реквизитов — для колонок таблицы. */
export function requisiteValues(
  requisites: Requisite[],
  field: keyof Requisite
): string[] {
  const values = requisites
    .map((r) => r[field])
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return [...new Set(values)];
}
