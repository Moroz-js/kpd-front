/**
 * Разовая миграция данных в справочник контрагентов.
 *
 * Что делает:
 *   1. Заводит контрагента на каждого исполнителя, клиента и наш банковский счёт
 *      (свои счета — контрагенты во внутренних переводах).
 *   2. Ставит юридический статус по типу получателя и по префиксу названия.
 *   3. Забирает написания из уже разобранных банковских операций в «имена в выписке».
 *   4. Привязывает операции к контрагентам: по имени, по написанию, а внутренние
 *      переводы — по названию нашего счёта.
 *
 * Реквизиты (ИНН, счета, карты) здесь не разбираются: их бэкфилл — отдельная
 * задача, поэтому текст из карточки исполнителя переносится в комментарий, чтобы
 * ничего не потерялось.
 *
 * Идемпотентен: повторный запуск ничего не меняет.
 *
 *   npm run migrate:counterparties            # только план, ничего не пишет
 *   npm run migrate:counterparties -- --apply # применить
 *
 * База берётся из DATABASE_URL: по умолчанию локальная SQLite, для Neon —
 * запускать с DATABASE_URL стенда.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { normalizeMatchValue } from "../lib/counterparty-match";

const root = join(__dirname, "..");
for (const file of [".env", ".env.local"]) {
  const path = join(root, file);
  if (existsSync(path)) config({ path, override: file === ".env.local" });
}

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

type LegalType =
  | "individual"
  | "entrepreneur"
  | "self_employed"
  | "company"
  | "foreign_company";

/**
 * Юридический статус: сначала префикс названия (он надёжнее всего — «ИП Иванов»
 * это ИП независимо от заполненности карточки), потом тип получателя.
 */
function guessLegalType(
  name: string,
  type: string,
  recipientType: string | null
): LegalType | null {
  const n = name.trim().toUpperCase();
  if (/^ИП[\s.]/.test(n)) return "entrepreneur";
  if (/^(ООО|АО|ПАО|ОАО|ЗАО)[\s"«]/.test(n)) return "company";
  if (/^(ТОО|DOO|LLC|LTD|GMBH|OU|SIA)[\s"«]/.test(n)) return "foreign_company";

  const r = (recipientType ?? "").toLowerCase();
  if (r.includes("самозанятый")) return "self_employed";
  if (r.startsWith("ип")) return "entrepreneur";
  if (r.includes("юрлицо")) {
    return r.includes("в рф") ? "company" : "foreign_company";
  }
  if (r.includes("сервис")) return r.includes("в рф") ? "company" : "foreign_company";
  if (r.includes("физлицо") || r.startsWith("з/п") || r.includes("гпх")) return "individual";
  if (r.includes("криптокошелёк")) return "individual";

  if (type === "service" || type === "bank") return "company";
  return null;
}

type Desired = {
  name: string;
  legalType: LegalType | null;
  status: string;
  comment: string | null;
  executorId?: string;
  clientId?: string;
  bankAccountId?: string;
};

async function main() {
  const [executors, clients, bankAccounts, existing] = await Promise.all([
    prisma.executor.findMany({
      select: { id: true, name: true, type: true, recipientType: true, requisites: true, status: true },
    }),
    prisma.client.findMany({ select: { id: true, name: true, status: true } }),
    prisma.bankAccount.findMany({ select: { id: true, name: true, status: true } }),
    prisma.counterparty.findMany({
      select: {
        id: true,
        name: true,
        executorId: true,
        clientId: true,
        bankAccountId: true,
        aliases: { select: { normalized: true } },
      },
    }),
  ]);

  const desired: Desired[] = [
    ...executors.map((e) => ({
      name: e.name,
      legalType: guessLegalType(e.name, e.type, e.recipientType),
      status: e.status,
      comment: e.requisites?.trim()
        ? `Реквизиты из карточки исполнителя: ${e.requisites.trim()}`
        : null,
      executorId: e.id,
    })),
    ...clients.map((c) => ({
      name: c.name,
      legalType: "company" as LegalType,
      status: c.status,
      comment: null,
      clientId: c.id,
    })),
    ...bankAccounts.map((a) => ({
      name: a.name,
      legalType: null,
      status: a.status,
      comment: null,
      bankAccountId: a.id,
    })),
  ];

  const byLink = new Map<string, (typeof existing)[number]>();
  const byName = new Map<string, (typeof existing)[number]>();
  for (const cp of existing) {
    const link = cp.executorId ?? cp.clientId ?? cp.bankAccountId;
    if (link) byLink.set(link, cp);
    byName.set(normalizeMatchValue(cp.name), cp);
  }

  const toCreate: Desired[] = [];
  const nameClashes: Desired[] = [];
  for (const d of desired) {
    const link = d.executorId ?? d.clientId ?? d.bankAccountId!;
    if (byLink.has(link)) continue;
    // Имя контрагента уникально: исполнитель и клиент с одинаковым названием
    // обязаны разъезжаться руками, автоматически такое сливать нельзя.
    if (byName.has(normalizeMatchValue(d.name))) {
      nameClashes.push(d);
      continue;
    }
    toCreate.push(d);
    byName.set(normalizeMatchValue(d.name), {
      id: "new",
      name: d.name,
      executorId: d.executorId ?? null,
      clientId: d.clientId ?? null,
      bankAccountId: d.bankAccountId ?? null,
      aliases: [],
    });
  }

  console.log(
    `Исполнителей ${executors.length}, клиентов ${clients.length}, наших счетов ${bankAccounts.length}. ` +
      `Контрагентов в базе: ${existing.length}.\n`
  );
  console.log(`Создать контрагентов: ${toCreate.length}`);
  if (nameClashes.length) {
    console.log(`\n⚠ Совпадают названия с уже существующим контрагентом (${nameClashes.length}) — пропущены:`);
    for (const c of nameClashes) console.log(`  ? ${c.name}`);
  }

  if (apply && toCreate.length) {
    for (const d of toCreate) {
      await prisma.counterparty.create({
        data: {
          name: d.name,
          legalType: d.legalType,
          status: d.status,
          comment: d.comment,
          executorId: d.executorId ?? null,
          clientId: d.clientId ?? null,
          bankAccountId: d.bankAccountId ?? null,
        },
      });
    }
  }

  // ─── Написания из выписки и привязка операций ──────────────────────────────

  const counterparties = apply
    ? await prisma.counterparty.findMany({
        select: {
          id: true,
          name: true,
          bankAccountId: true,
          clientId: true,
          executor: { select: { type: true } },
          aliases: { select: { normalized: true } },
        },
      })
    : [
        ...existing.map((cp) => ({
          id: cp.id,
          name: cp.name,
          bankAccountId: cp.bankAccountId,
          clientId: cp.clientId,
          executor: null as { type: string } | null,
          aliases: cp.aliases,
        })),
        ...toCreate.map((d) => ({
          id: "new",
          name: d.name,
          bankAccountId: d.bankAccountId ?? null,
          clientId: d.clientId ?? null,
          executor: null as { type: string } | null,
          aliases: [] as { normalized: string }[],
        })),
      ];

  const cpByName = new Map(counterparties.map((cp) => [normalizeMatchValue(cp.name), cp]));
  const cpByAlias = new Map<string, (typeof counterparties)[number]>();
  for (const cp of counterparties) {
    for (const a of cp.aliases) cpByAlias.set(a.normalized, cp);
  }

  const operations = await prisma.bankOperation.findMany({
    select: {
      id: true,
      counterpartyId: true,
      counterpartyName: true,
      rawCounterparty: true,
      transferSource: true,
      isInternalTransfer: true,
      kind: true,
    },
  });

  type Link = { operationId: string; counterpartyId: string; kind: string; via: string };
  const links: Link[] = [];
  const newAliases = new Map<string, { counterpartyId: string; value: string }>();
  const unmatched = new Map<string, number>();

  function counterpartyKind(cp: (typeof counterparties)[number]): string {
    if (cp.clientId) return "client";
    if (cp.bankAccountId) return "own_account";
    if (cp.executor?.type === "service") return "service";
    if (cp.executor?.type === "bank") return "bank";
    return "executor";
  }

  for (const op of operations) {
    if (op.counterpartyId) continue;

    const nameKey = op.counterpartyName ? normalizeMatchValue(op.counterpartyName) : null;
    const rawKey = op.rawCounterparty ? normalizeMatchValue(op.rawCounterparty) : null;
    const sourceKey =
      op.isInternalTransfer && op.transferSource ? normalizeMatchValue(op.transferSource) : null;

    let cp: (typeof counterparties)[number] | undefined;
    let via = "";
    if (nameKey && cpByName.has(nameKey)) {
      cp = cpByName.get(nameKey);
      via = "имя контрагента";
    } else if (rawKey && (cpByName.has(rawKey) || cpByAlias.has(rawKey))) {
      cp = cpByName.get(rawKey) ?? cpByAlias.get(rawKey);
      via = "написание в выписке";
    } else if (sourceKey && cpByName.has(sourceKey)) {
      cp = cpByName.get(sourceKey);
      via = "наш счёт (внутренний перевод)";
    }

    if (!cp) {
      const label = op.counterpartyName ?? op.rawCounterparty ?? op.transferSource;
      if (label) unmatched.set(label, (unmatched.get(label) ?? 0) + 1);
      continue;
    }

    links.push({ operationId: op.id, counterpartyId: cp.id, kind: counterpartyKind(cp), via });

    // Написание из банка отличается от нашего названия — запоминаем как алиас.
    if (
      rawKey &&
      rawKey !== normalizeMatchValue(cp.name) &&
      !cpByAlias.has(rawKey) &&
      !newAliases.has(rawKey) &&
      op.rawCounterparty
    ) {
      newAliases.set(rawKey, { counterpartyId: cp.id, value: op.rawCounterparty });
    }
  }

  const viaCounts = links.reduce<Record<string, number>>((acc, l) => {
    acc[l.via] = (acc[l.via] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\nОперации: всего ${operations.length}, без контрагента ${operations.filter((o) => !o.counterpartyId).length}.`);
  console.log(`Привязать операций: ${links.length}`);
  for (const [via, count] of Object.entries(viaCounts)) console.log(`  · по ${via}: ${count}`);
  console.log(`Добавить написаний в выписке: ${newAliases.size}`);

  if (unmatched.size) {
    const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    console.log(`\n⚠ Не сопоставлены (${unmatched.size} написаний), топ по числу операций:`);
    for (const [label, count] of top) console.log(`  ? ${label} — ${count}`);
  }

  if (!apply) {
    console.log("\nЭто план. Для применения: npm run migrate:counterparties -- --apply");
    await prisma.$disconnect();
    return;
  }

  for (const [normalized, alias] of newAliases) {
    await prisma.counterpartyAlias.create({
      data: {
        counterpartyId: alias.counterpartyId,
        value: alias.value,
        normalized,
        source: "robot",
      },
    });
  }

  for (const link of links) {
    await prisma.bankOperation.update({
      where: { id: link.operationId },
      data: { counterpartyId: link.counterpartyId, counterpartyType: link.kind },
    });
  }

  console.log(
    `\nГотово: создано контрагентов ${toCreate.length}, написаний ${newAliases.size}, привязано операций ${links.length}.`
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
