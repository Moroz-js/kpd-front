import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Как Prisma: сначала .env, затем .env.local с перезаписью */
export function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const path = join(root, file);
    if (existsSync(path)) {
      config({ path, override: file === ".env.local" });
    }
  }
}

export function getDatabaseUrl() {
  loadEnv();
  const raw = process.env.DATABASE_URL?.trim() ?? "file:./kpd.db";
  return raw.replace(/^["']|["']$/g, "");
}
