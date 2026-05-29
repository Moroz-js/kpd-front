/**
 * db-reset.mjs — дропает все данные и запускает seed заново.
 *
 * SQLite  → удаляет файл БД, prisma db push, prisma db seed
 * Postgres → prisma migrate reset --force, prisma db seed
 *
 * Использование:
 *   npm run db:reset         (через package.json)
 *   node scripts/db-reset.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDatabaseUrl } from "./load-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url  = getDatabaseUrl();
const isPg = /^postgres(ql)?:\/\//i.test(url);
const run  = (cmd) => execSync(cmd, { stdio: "inherit", cwd: root });

console.log(`[db-reset] provider: ${isPg ? "postgresql" : "sqlite"}`);

// ── Обновляем schema.prisma под текущий провайдер ────────────────────────────
run("node scripts/set-prisma-provider.mjs");
run("npx prisma generate");

if (isPg) {
  // ── PostgreSQL ─────────────────────────────────────────────────────────────
  console.log("[db-reset] Running: prisma migrate reset --force");
  run("npx prisma migrate reset --force --skip-seed");
  console.log("[db-reset] Running: prisma migrate deploy");
  run("npx prisma migrate deploy");
} else {
  // ── SQLite ─────────────────────────────────────────────────────────────────
  for (const f of ["kpd.db", "kpd.db-journal", "kpd.db-shm", "kpd.db-wal"]) {
    const p = join(root, "prisma", f);
    if (existsSync(p)) { unlinkSync(p); console.log(`[db-reset] deleted ${f}`); }
  }
  console.log("[db-reset] Running: prisma db push");
  run("npx prisma db push --accept-data-loss");
}

// ── Seed ─────────────────────────────────────────────────────────────────────
console.log("[db-reset] Running: prisma db seed");
run("npx prisma db seed");

console.log("[db-reset] done ✓");
