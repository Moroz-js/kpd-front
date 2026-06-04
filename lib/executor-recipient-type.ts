import { RECIPIENT_TYPES } from "@/lib/statuses";

/** Хранится в Executor.recipientType: JSON-массив или legacy — одна строка. */
export function parseRecipientTypes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const t = raw.trim();
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
    } catch {
      return [];
    }
  }
  return [t];
}

export function serializeRecipientTypes(types: string[]): string | null {
  const valid = new Set(RECIPIENT_TYPES as readonly string[]);
  const unique = [...new Set(types.filter((x) => valid.has(x)))];
  return unique.length > 0 ? JSON.stringify(unique) : null;
}

export function formatRecipientTypes(types: string[]): string {
  return types.length > 0 ? types.join(", ") : "—";
}
