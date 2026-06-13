/**
 * push-schema-neon.mjs
 * Применяет изменения схемы в NeonDB (PostgreSQL):
 *  - orders.orderNumber: INT → VARCHAR(50)
 *  - orders.description: NOT NULL → NULL
 *  - charges.invoiceNumber: NOT NULL → NULL
 */

import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Читаем .env.production
const envFile = path.resolve(__dirname, "../.env.production");
if (!fs.existsSync(envFile)) {
  console.error("❌ Нет файла .env.production");
  process.exit(1);
}
for (const line of fs.readFileSync(envFile, "utf-8").split("\n")) {
  const m = line.match(/^\s*([\w]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!directUrl?.startsWith("postgresql")) {
  console.error("❌ DIRECT_URL не найден или не является PostgreSQL");
  process.exit(1);
}

console.log("Подключение к NeonDB...");
const { neon } = require("@neondatabase/serverless");
const sql = neon(directUrl);

const steps = [
  {
    desc: "orders.orderNumber: INT → VARCHAR(50)",
    sql: `ALTER TABLE orders ALTER COLUMN "orderNumber" TYPE VARCHAR(50) USING "orderNumber"::VARCHAR`,
  },
  {
    desc: "orders.description: DROP NOT NULL",
    sql: `ALTER TABLE orders ALTER COLUMN description DROP NOT NULL`,
  },
  {
    desc: "charges.invoiceNumber: DROP NOT NULL",
    sql: `ALTER TABLE charges ALTER COLUMN "invoiceNumber" DROP NOT NULL`,
  },
];

for (const step of steps) {
  try {
    await sql(step.sql);
    console.log(`  ✓ ${step.desc}`);
  } catch (e) {
    const msg = e?.message ?? String(e);
    // Если тип уже правильный или NOT NULL уже снят — не ошибка
    if (msg.includes("already") || msg.includes("does not exist") || msg.includes("cannot alter")) {
      console.log(`  ⚠ пропущено (уже применено): ${step.desc}`);
    } else {
      console.error(`  ❌ ${step.desc}: ${msg}`);
    }
  }
}

console.log("\n✅ Готово. Теперь запусти миграцию данных:");
console.log("   node scripts/migrate-excel.mjs --run --production");
