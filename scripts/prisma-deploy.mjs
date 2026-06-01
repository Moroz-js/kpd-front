import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getDatabaseUrl,
  getMigrationDatabaseUrl,
  isPostgresUrl,
} from "./database-url.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = getDatabaseUrl();
const onVercel = process.env.VERCEL === "1";

if (!isPostgresUrl(url)) {
  if (onVercel) {
    console.error("[prisma] На Vercel нужен DATABASE_URL с postgresql:// (Neon).");
    process.exit(1);
  }
  console.log("[prisma] migrate deploy — только для PostgreSQL (Neon / прод).");
  console.log("[prisma] Локально (SQLite): npm run db:push");
  process.exit(0);
}

const migrationUrl = getMigrationDatabaseUrl();
console.log("[prisma] db push →", migrationUrl.split("@")[1]?.split("?")[0] ?? "postgres");

execSync("node scripts/set-prisma-provider.mjs", { stdio: "inherit", cwd: root, env: process.env });

execSync("npx prisma db push --skip-generate", {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env, DATABASE_URL: migrationUrl },
});
