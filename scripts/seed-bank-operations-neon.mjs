/**
 * Идемпотентный демо-сид банковских операций для Neon.
 *
 * Создаёт 180 разнообразных строк:
 * - 60 поступлений;
 * - 90 списаний;
 * - 15 внутренних переводов по две связанные операции.
 *
 * Скрипт удаляет и пересоздаёт только записи с id `demo-bank-op-*`.
 * Реальные банковские операции не затрагиваются.
 *
 *   node scripts/seed-bank-operations-neon.mjs
 *   node scripts/seed-bank-operations-neon.mjs --apply
 */

import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.production" });

const PREFIX = "demo-bank-op-";
const INCOMING_COUNT = 60;
const OUTGOING_COUNT = 90;
const TRANSFER_PAIR_COUNT = 15;
const apply = process.argv.includes("--apply");
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString?.startsWith("postgres")) {
  throw new Error("В .env.production не задан PostgreSQL DATABASE_URL/DIRECT_URL");
}

const host = new URL(connectionString).hostname;
if (!host.endsWith(".neon.tech")) {
  throw new Error(`Сид разрешён только для Neon, получен хост: ${host}`);
}

const client = new pg.Client({ connectionString });

const STATUSES = ["new", "needs_review", "recognized", "confirmed"];
const INCOMING_PURPOSES = [
  "Оплата по счёту за услуги продвижения",
  "Оплата по договору за аналитические услуги",
  "Частичная оплата за производство контента",
  "Предоплата за PR-сопровождение",
  "Оплата за консультационные услуги",
  "Возврат ошибочно перечисленных средств",
];
const OUTGOING_PURPOSES = [
  "Оплата услуг исполнителя по договору",
  "Оплата подписки на сервис",
  "Комиссия банка за обслуживание счёта",
  "Оплата рекламного кабинета",
  "Оплата аренды и административных расходов",
  "Оплата подрядчику за производство контента",
  "Возврат клиенту излишне перечисленных средств",
  "Единый налоговый платёж",
];
const INTERNAL_BASES = [
  "ПЕРЕВОД СОБСТВЕННЫХ СРЕДСТВ",
  "ПЕРЕВОД МЕЖДУ СВОИМИ СЧЕТАМИ",
  "ПЕРЕВОД СРЕДСТВ МЕЖДУ СЧЕТАМИ",
];

function dateFor(index) {
  const date = new Date(Date.UTC(2025, 0, 10));
  date.setUTCDate(date.getUTCDate() + ((index * 11) % 610));
  return date;
}

function formatDate(date) {
  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    date.getUTCFullYear(),
  ].join(".");
}

function amountFor(index, offset = 0) {
  const whole = 850 + ((index * 7919 + offset * 3571) % 480000);
  const cents = (index * 17 + offset * 13) % 100;
  return whole + cents / 100;
}

function accountNumber(index) {
  return (40702810000000000000n + BigInt(index + 1)).toString();
}

function inn(index) {
  return (7700000000 + (index * 7919) % 99999999).toString().padStart(10, "0");
}

function pick(rows, index, offset = 0) {
  return rows[(index + offset) % rows.length];
}

function operation({
  id,
  index,
  kind,
  account,
  counterparty,
  project,
  workType,
  amount,
  date,
  internal = false,
  transferSource = null,
  paymentOrder = null,
  paymentPurpose = null,
  basis = null,
  recognized = true,
  chargeMatch = null,
}) {
  const status = STATUSES[index % STATUSES.length];
  const rawCounterparty = counterparty?.name ?? `Неопознанный контрагент ${index + 1}`;
  const linked = recognized ? counterparty : null;
  const description =
    index % 6 === 0
      ? null
      : kind === "incoming"
        ? `Поступление по проекту ${project?.name ?? "без проекта"}`
        : `Работы: ${workType?.name ?? "не определены"}`;

  return {
    id,
    bankAccountId: account.id,
    transferSource,
    amount,
    date,
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
    kind,
    isInternalTransfer: internal,
    counterpartyName: rawCounterparty,
    counterpartyType: linked?.kind ?? null,
    counterpartyId: linked?.id ?? null,
    projectId: project?.id ?? null,
    workTypeId: workType?.id ?? null,
    workDescription: description,
    paymentOrder,
    paymentPurpose,
    basis,
    status,
    chargeMatch,
    comment: index % 10 === 0 ? "Демо-операция для проверки интерфейса" : null,
    confirmedAt: status === "confirmed" ? date : null,
    confirmedByName: status === "confirmed" ? "Демо-сид" : null,
    rawDocNumber: `DEMO-${String(index + 1).padStart(4, "0")}`,
    rawDate: formatDate(date),
    rawAmount: amount.toFixed(2).replace(".", ","),
    rawCurrency: account.currency,
    rawOperationType: kind === "incoming" ? "Кредит" : "Дебет",
    rawCounterparty,
    rawInn: inn(index),
    rawAccount: accountNumber(index),
    rawBik: String(440000000 + (index % 999999)).padStart(9, "0"),
    rawPurpose: basis ?? paymentPurpose ?? INCOMING_PURPOSES[index % INCOMING_PURPOSES.length],
    rawCategory: internal ? "Переводы" : kind === "incoming" ? "Поступления" : "Расходы",
    traceCounterparty: linked ? "опознан по имени контрагента" : null,
    traceProject: project ? "проект из карточки контрагента" : null,
    traceWorkType: workType ? "вид работ определён по правилу" : null,
    updatedAt: new Date(),
  };
}

await client.connect();

try {
  const accountsResult = await client.query(
    `SELECT id, name, currency FROM bank_accounts WHERE status = 'active' ORDER BY name`
  );
  const projectsResult = await client.query(
    `SELECT id, name FROM projects WHERE status = 'active' ORDER BY name`
  );
  const counterpartiesResult = await client.query(`
    SELECT c.id, c.name, c."bankAccountId",
      CASE
        WHEN c."clientId" IS NOT NULL THEN 'client'
        WHEN c."bankAccountId" IS NOT NULL THEN 'own_account'
        WHEN e.type = 'service' THEN 'service'
        WHEN e.type = 'bank' THEN 'bank'
        ELSE 'executor'
      END AS kind
    FROM counterparties c
    LEFT JOIN executors e ON e.id = c."executorId"
    WHERE c.status = 'active'
    ORDER BY c.name
  `);
  const workTypesResult = await client.query(
    `SELECT id, name FROM work_types WHERE status = 'active' ORDER BY name`
  );
  const chargesResult = await client.query(
    `SELECT id, "chargeNumber", amount FROM charges ORDER BY "createdAt" DESC`
  );

  const accounts = accountsResult.rows;
  const projects = projectsResult.rows;
  const counterparties = counterpartiesResult.rows;
  const workTypes = workTypesResult.rows;
  const charges = chargesResult.rows;
  const externalCounterparties = counterparties.filter((row) => row.kind !== "own_account");
  const ownCounterpartyByAccount = new Map(
    counterparties
      .filter((row) => row.kind === "own_account" && row.bankAccountId)
      .map((row) => [row.bankAccountId, row])
  );
  const ownAccounts = accounts.filter((row) => ownCounterpartyByAccount.has(row.id));

  if (!accounts.length || !projects.length || !externalCounterparties.length || !workTypes.length) {
    throw new Error("В Neon недостаточно справочных данных для создания демо-операций");
  }
  if (ownAccounts.length < 2) {
    throw new Error("Для внутренних переводов нужны минимум два активных собственных счёта");
  }

  const rows = [];
  const pairs = [];
  const chargeLinks = [];

  for (let index = 0; index < INCOMING_COUNT; index += 1) {
    const account = pick(accounts, index);
    const counterparty = pick(externalCounterparties, index, 3);
    const project = index % 5 === 0 ? null : pick(projects, index, 2);
    const workType = index % 4 === 0 ? null : pick(workTypes, index, 1);
    const hasCharge = charges.length > 0 && index < 30;
    const amount = amountFor(index, 1);
    const id = `${PREFIX}incoming-${String(index + 1).padStart(3, "0")}`;

    rows.push(
      operation({
        id,
        index,
        kind: "incoming",
        account,
        counterparty,
        project,
        workType,
        amount,
        date: dateFor(index),
        transferSource: `${counterparty.name} · ${accountNumber(index + 500)}`,
        paymentOrder: `ПП-${2025000 + index + 1}`,
        recognized: index % 8 !== 0,
        chargeMatch: hasCharge ? "confirmed" : index % 3 === 0 ? "no_charge" : "not_linked",
      })
    );

    if (hasCharge) {
      const first = pick(charges, index);
      chargeLinks.push({
        bankOperationId: id,
        chargeId: first.id,
        amount: index % 4 === 0 ? Math.round(amount * 60) / 100 : null,
        reason: "Демо-сопоставление начисления",
      });
      if (index % 5 === 0 && charges.length > 1) {
        const second = pick(charges, index, 1);
        chargeLinks.push({
          bankOperationId: id,
          chargeId: second.id,
          amount: Math.round(amount * 40) / 100,
          reason: "Демо: одно поступление связано с несколькими начислениями",
        });
      }
    }
  }

  for (let index = 0; index < OUTGOING_COUNT; index += 1) {
    const operationIndex = INCOMING_COUNT + index;
    const account = pick(accounts, index, 4);
    const counterparty = pick(externalCounterparties, index, 17);
    const project = index % 6 === 0 ? null : pick(projects, index, 7);
    const workType = index % 5 === 0 ? null : pick(workTypes, index, 3);
    const purpose = OUTGOING_PURPOSES[index % OUTGOING_PURPOSES.length];

    rows.push(
      operation({
        id: `${PREFIX}outgoing-${String(index + 1).padStart(3, "0")}`,
        index: operationIndex,
        kind: "outgoing",
        account,
        counterparty,
        project,
        workType,
        amount: amountFor(index, 2),
        date: dateFor(operationIndex),
        paymentPurpose: purpose,
        recognized: index % 7 !== 0,
        chargeMatch: null,
      })
    );
  }

  for (let index = 0; index < TRANSFER_PAIR_COUNT; index += 1) {
    const operationIndex = INCOMING_COUNT + OUTGOING_COUNT + index * 2;
    const sourceAccount = pick(ownAccounts, index);
    const targetAccount = pick(ownAccounts, index, 1);
    const sourceCounterparty = ownCounterpartyByAccount.get(sourceAccount.id);
    const targetCounterparty = ownCounterpartyByAccount.get(targetAccount.id);
    const project = index % 3 === 0 ? null : pick(projects, index, 5);
    const workType = index % 4 === 0 ? null : pick(workTypes, index, 6);
    const amount = amountFor(index, 3);
    const date = dateFor(operationIndex);
    const basis = INTERNAL_BASES[index % INTERNAL_BASES.length];
    const outgoingId = `${PREFIX}transfer-out-${String(index + 1).padStart(3, "0")}`;
    const incomingId = `${PREFIX}transfer-in-${String(index + 1).padStart(3, "0")}`;

    rows.push(
      operation({
        id: outgoingId,
        index: operationIndex,
        kind: "outgoing",
        account: sourceAccount,
        counterparty: targetCounterparty,
        project,
        workType,
        amount,
        date,
        internal: true,
        transferSource: sourceAccount.name,
        basis,
        chargeMatch: "no_charge",
      }),
      operation({
        id: incomingId,
        index: operationIndex + 1,
        kind: "incoming",
        account: targetAccount,
        counterparty: sourceCounterparty,
        project,
        workType,
        amount,
        date,
        internal: true,
        transferSource: sourceAccount.name,
        basis,
        chargeMatch: "no_charge",
      })
    );
    pairs.push({ outgoingId, incomingId });
  }

  console.log(
    `План: ${rows.length} строк (${INCOMING_COUNT} поступлений, ${OUTGOING_COUNT} списаний, ` +
      `${TRANSFER_PAIR_COUNT} внутренних переводов), связей с начислениями: ${chargeLinks.length}.`
  );

  if (!apply) {
    console.log("Это dry-run. Для применения добавьте --apply.");
    process.exitCode = 0;
  } else {
    const columns = [
      "id",
      "bankAccountId",
      "transferSource",
      "amount",
      "date",
      "month",
      "year",
      "kind",
      "isInternalTransfer",
      "counterpartyName",
      "counterpartyType",
      "counterpartyId",
      "projectId",
      "workTypeId",
      "workDescription",
      "paymentOrder",
      "paymentPurpose",
      "basis",
      "status",
      "chargeMatch",
      "comment",
      "confirmedAt",
      "confirmedByName",
      "rawDocNumber",
      "rawDate",
      "rawAmount",
      "rawCurrency",
      "rawOperationType",
      "rawCounterparty",
      "rawInn",
      "rawAccount",
      "rawBik",
      "rawPurpose",
      "rawCategory",
      "traceCounterparty",
      "traceProject",
      "traceWorkType",
      "updatedAt",
    ];
    const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");

    await client.query("BEGIN");
    try {
      await client.query(
        `UPDATE bank_operations SET "pairedOperationId" = NULL WHERE id LIKE $1`,
        [`${PREFIX}%`]
      );
      await client.query(
        `DELETE FROM bank_operation_charges WHERE "bankOperationId" LIKE $1`,
        [`${PREFIX}%`]
      );
      await client.query(`DELETE FROM bank_operations WHERE id LIKE $1`, [`${PREFIX}%`]);

      for (const row of rows) {
        await client.query(
          `INSERT INTO bank_operations (${quotedColumns}) VALUES (${placeholders})`,
          columns.map((column) => row[column] ?? null)
        );
      }

      for (const pair of pairs) {
        await client.query(
          `UPDATE bank_operations SET "pairedOperationId" = $1 WHERE id = $2`,
          [pair.incomingId, pair.outgoingId]
        );
        await client.query(
          `UPDATE bank_operations SET "pairedOperationId" = $1 WHERE id = $2`,
          [pair.outgoingId, pair.incomingId]
        );
      }

      for (const link of chargeLinks) {
        await client.query(
          `INSERT INTO bank_operation_charges
            ("bankOperationId", "chargeId", amount, link, reason)
           VALUES ($1, $2, $3, 'confirmed', $4)`,
          [link.bankOperationId, link.chargeId, link.amount, link.reason]
        );
      }

      await client.query("COMMIT");
      console.log(`Готово: в Neon записано ${rows.length} демо-строк.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
