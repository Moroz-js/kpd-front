/**
 * Применяет таблицу банковских счетов из тикета: статус + комментарий по каждому счёту,
 * недостающие счета создаёт (валюта RUB, статус из таблицы).
 *
 * Идемпотентен: повторный запуск ничего не меняет. Сопоставление по имени
 * без учёта регистра, «ё»/«е» и повторных пробелов — в таблице и в КПД
 * написания расходятся («Счёт 4dev» / «Счёт 4DEV»).
 *
 *   node scripts/apply-bank-accounts-table.mjs            # только план, ничего не пишет
 *   node scripts/apply-bank-accounts-table.mjs --apply    # применить
 *
 * База берётся из DATABASE_URL (см. scripts/database-url.mjs): по умолчанию
 * локальная SQLite, для Neon — запускать с DATABASE_URL стенда.
 */

import { PrismaClient } from "@prisma/client";

// [имя в тикете, статус, комментарий, создавать ли, если не найден]
const TABLE = [
  ["ОПЕРАЦИОННЫЙ СЧЕТ", "active", "Подключено к роботу, почта — Т-Банк, business@emails.tinkoff.ru, операции 2026 есть", false],
  ["Пока не известен", "archived", "заведён только в СУП", false],
  ["Счёт 4dev", "archived", "заводится руками; в Роботе только операции 2025", false],
  ["Счёт Банк Локобанк", "archived", "заведён только в СУП", false],
  ["Счёт Банк Модуль", "archived", "заведён только в СУП", false],
  ["Счёт Банк Уралсиб", "archived", "заведён только в СУП", false],
  ["Счёт БРОНЬ", "archived", "задублирован на 2 вкладки в Роботе, операций нет", false],
  ["Счёт Зарплатный", "archived", "вероятно = вкладка «ЗП» (имя другое), операций в Роботе нет", false],
  ["Счёт ИП Дьяков", "active", "в Роботе операции 2025 и 2026", false],
  ["Счёт Крипта", "archived", "заводится руками; в Роботе только операции 2025", false],
  ["Счёт Оборотный фонд", "archived", "заведён только в СУП", false],
  ["Счёт ООО ВПД", "archived", "заведён только в СУП", false],
  ["Счёт ООО МКВ", "archived", "заведён только в СУП", false],
  ["Счёт ООО РВИ", "archived", "заведён только в СУП", false],
  ["Счёт ОТП Банк Рубли", "archived", "в Роботе операций нет", false],
  ["Счёт ОТП Банк KZT", "archived", "в Роботе операций нет", false],
  ["Счёт Проектный", "active", "почта — Т-Банк, business@emails.tinkoff.ru; в настройках Робота лист «Проектный счёт», фактическая вкладка «Счёт Проектный (карта)» — имя не совпадает дословно; операции 2026 есть", false],
  ["Счёт Расчёт с исполнителями", "archived", "почта — Т-Банк, business@emails.tinkoff.ru; в Роботе вкладка пустая, операций нет", false],
  ["Счёт ТОО Казахстан - доллары БЦК Банк", "active", "почта — elena.r@dcp.company, в Роботе операции 2026", false],
  ["Счёт ТОО Казахстан - евро БЦК Банк", "active", "почта — elena.r@dcp.company, в Роботе операции 2026", false],
  ["Счёт ТОО Казахстан - рубли БЦК Банк", "archived", "в Роботе только операции 2025", false],
  ["Счёт ТОО Казахстан - тенге БЦК Банк", "active", "почта — elena.r@dcp.company, в Роботе операции 2025 и 2026", false],
  ["Счёт ТОО Казахстан - тенге Форте Банк", "active", "в Роботе, операции 2026", false],
  ["Счёт ТОО Казахстан - тенге Фридом Банк", "archived", "в Роботе, только операции 2025", false],
  ["Счёт ТОО Казахстан - Форте Банк Доллары", "active", "в Роботе, операции 2025 и 2026", false],
  ["Счёт ТОО Казахстан - Форте Банк Евро", "active", "в Роботе, операции 2026", false],
  ["Счёт ТОО Казахстан - Форте банк Карта проектная", "active", "соответствие не 1:1 — в Роботе 3 задублированные вкладки на 2 счёта-карты в КПД, среди них есть операции 2026", false],
  ["Счёт ТОО Казахстан - Форте банк карта сервисов", "active", "соответствие не 1:1 — см. «Карта проектная»", false],
  ["Счёт ТОО Казахстан - юани БЦК Банк", "archived", "в Роботе, только операции 2024", false],
  ["Счёт EasyStaff", "archived", "заведён только в СУП", false],
  ["Счёт TalentPay", "archived", "заведён только в СУП", false],
  ["Счёт Zapad Banka - корп карта", "active", "в Роботе, операции 2025 и 2026", false],
  ["Счёт Zapad Banka - счёт DOO", "active", "почта — elena.r@dcp.company, в Роботе, операции 2026", false],
  ["Счёт ИП Бойченко", "archived", "в Роботе, только операции 2025", true],
  ["Счёт ИП Рябкин", "archived", "в Роботе, только операции 2025", true],
  ["Счёт ИП Помялов", "archived", "в Роботе, только операции 2025", true],
  ["Счёт ИП Клопков", "archived", "в Роботе, только операции 2025", true],
  ["Счёт ИП Михайлова", "archived", "в Роботе, только операции 2025", true],
  ["Счёт ИП Дубровская Анна", "archived", "в Роботе, только операции 2025", true],
  ["Счёт ИП Дубровская Светлана (патент, Моск. обл.)", "archived", "в Роботе, только операции 2025", true],
  ["Счёт КЕБ - рубли", "archived", "в Роботе вкладка существует, операций нет вообще", true],
  ["Счёт ООО Видеопроизводство", "active", "в Роботе, операции 2026", true],
  ["Счёт ИП Пырова, имя не подтверждено", "archived", "вкладка без названия, идентифицирована по содержимому строк", true],
];

const norm = (s) =>
  s.toLowerCase().replace(/ё/g, "е").replace(/[\s\u00a0]+/g, " ").trim();

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

const existing = await prisma.bankAccount.findMany({
  select: { id: true, name: true, status: true, comment: true, isDefault: true },
});
const byName = new Map(existing.map((a) => [norm(a.name), a]));

const toCreate = [];
const toUpdate = [];
const missing = [];
const untouched = [];

for (const [name, status, comment, creatable] of TABLE) {
  const found = byName.get(norm(name));
  if (!found) {
    if (creatable) toCreate.push({ name, status, comment });
    else missing.push(name);
    continue;
  }
  const patch = {};
  if (found.status !== status) patch.status = status;
  if ((found.comment ?? "") !== comment) patch.comment = comment;
  if (Object.keys(patch).length === 0) untouched.push(found.name);
  else toUpdate.push({ ...found, patch });
}

const inTable = new Set(TABLE.map(([name]) => norm(name)));
const notInTable = existing.filter((a) => !inTable.has(norm(a.name)));

console.log(`Счетов в КПД: ${existing.length}. Строк в таблице тикета: ${TABLE.length}.\n`);

console.log(`Создать (${toCreate.length}):`);
for (const c of toCreate) console.log(`  + ${c.name} [${c.status}, RUB]`);

console.log(`\nОбновить (${toUpdate.length}):`);
for (const u of toUpdate) {
  const parts = [];
  if (u.patch.status) parts.push(`статус ${u.status} → ${u.patch.status}`);
  if (u.patch.comment !== undefined) parts.push("комментарий");
  console.log(`  ~ ${u.name}: ${parts.join(", ")}${u.isDefault ? "  ⚠ счёт по умолчанию" : ""}`);
}

console.log(`\nБез изменений (${untouched.length}).`);

if (missing.length) {
  console.log(`\n⚠ Есть в таблице, но не найдены в КПД и не помечены «создать» (${missing.length}):`);
  for (const m of missing) console.log(`  ? ${m}`);
}

if (notInTable.length) {
  console.log(`\n⚠ Есть в КПД, но нет в таблице тикета (${notInTable.length}) — не тронуты:`);
  for (const a of notInTable) console.log(`  ? ${a.name} [${a.status}]`);
}

const defaultsToArchive = toUpdate.filter((u) => u.isDefault && u.patch.status === "archived");
if (defaultsToArchive.length) {
  console.log(
    `\n⚠ Архивируется счёт по умолчанию (${defaultsToArchive.length}) — флаг isDefault будет снят, назначьте новый счёт по умолчанию.`
  );
}

if (!apply) {
  console.log("\nЭто план. Для применения: node scripts/apply-bank-accounts-table.mjs --apply");
  await prisma.$disconnect();
  process.exit(0);
}

for (const c of toCreate) {
  await prisma.bankAccount.create({
    data: { name: c.name, status: c.status, comment: c.comment, currency: "RUB" },
  });
}

for (const u of toUpdate) {
  await prisma.bankAccount.update({
    where: { id: u.id },
    data: {
      ...u.patch,
      // архивный счёт не может оставаться дефолтным (см. lib/services/bankAccounts.ts)
      ...(u.patch.status === "archived" && u.isDefault ? { isDefault: false } : {}),
    },
  });
}

console.log(`\nГотово: создано ${toCreate.length}, обновлено ${toUpdate.length}.`);
await prisma.$disconnect();
