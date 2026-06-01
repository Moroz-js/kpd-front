import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** .env не перезаписывает process.env (Vercel / shell). .env.local — локальные override. */
export function loadEnv() {
  const baseFiles = [".env"];
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    baseFiles.push(".env.production");
  }
  for (const file of baseFiles) {
    const path = join(root, file);
    if (existsSync(path)) {
      config({ path, override: false });
    }
  }
  const localPath = join(root, ".env.local");
  if (existsSync(localPath)) {
    config({ path: localPath, override: true });
  }
}
