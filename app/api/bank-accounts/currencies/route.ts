import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  DEFAULT_CURRENCIES,
  isValidCurrencyCode,
  normalizeCurrencyCode,
} from "@/lib/currencies";

/**
 * Централизованный справочник валют (таблица currencies).
 * При первом обращении наполняется дефолтами и валютами существующих счетов,
 * чтобы валюта, созданная в любом счёте, была доступна во всех остальных.
 */
async function ensureSeeded(): Promise<void> {
  const [accountCurrencies, existing] = await Promise.all([
    prisma.bankAccount.findMany({ select: { currency: true }, distinct: ["currency"] }),
    prisma.currency.findMany({ select: { code: true } }),
  ]);
  const existingSet = new Set(existing.map((r) => r.code));
  const wanted = new Set<string>([
    ...DEFAULT_CURRENCIES,
    ...accountCurrencies.map((r) => normalizeCurrencyCode(r.currency)),
  ]);
  const missing = [...wanted].filter((code) => !existingSet.has(code));
  if (missing.length > 0) {
    await prisma.currency.createMany({ data: missing.map((code) => ({ code })) });
  }
}

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureSeeded();

  const rows = await prisma.currency.findMany({
    select: { code: true },
    orderBy: { code: "asc" },
  });

  return NextResponse.json(rows.map((r) => r.code));
}

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const raw = typeof body?.code === "string" ? body.code : "";
  const code = normalizeCurrencyCode(raw);
  if (!isValidCurrencyCode(code)) {
    return NextResponse.json({ error: "Некорректный код валюты (3–6 латинских букв)" }, { status: 422 });
  }

  const currency = await prisma.currency.upsert({
    where: { code },
    update: {},
    create: { code },
  });

  return NextResponse.json(currency, { status: 201 });
}
