import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDatabaseUrl } from "./load-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = getDatabaseUrl();

if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.log("[prisma] migrate deploy — только для PostgreSQL (Neon / прод).");
  console.log("[prisma] Сейчас DATABASE_URL:", url.split("?")[0]);
  console.log("[prisma] Локально (SQLite): npm run db:push");
  console.log("[prisma] Neon (PowerShell):");
  console.log('  $env:DATABASE_URL="postgresql://..."; npm run db:migrate');
  process.exit(0);
}

execSync("node scripts/set-prisma-provider.mjs", { stdio: "inherit", cwd: root });
execSync("npx prisma migrate deploy", { stdio: "inherit", cwd: root });
