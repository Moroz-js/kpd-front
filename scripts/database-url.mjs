import { loadEnv } from "./load-env.mjs";

/** Убирает параметры, ломающие Prisma на serverless (Vercel). */
export function sanitizePostgresUrl(url) {
  if (!/^postgres(ql)?:\/\//i.test(url)) return url;
  let out = url;
  out = out.replace(/([?&])channel_binding=[^&]*/gi, "");
  out = out.replace(/\?&/g, "?").replace(/&&+/g, "&").replace(/[?&]$/g, "");
  return out;
}

/** Для migrate / db push на Neon — direct endpoint, не pooler. */
export function toDirectPostgresUrl(url) {
  if (!/^postgres(ql)?:\/\//i.test(url)) return url;
  let out = url.replace(/-pooler(?=[.-])/gi, "");
  // ep-xxx-pooler.eu-central-1... (без точки после pooler)
  out = out.replace(/-pooler(?=@)/gi, "");
  return sanitizePostgresUrl(out);
}

export function getDatabaseUrl() {
  loadEnv();
  const raw = process.env.DATABASE_URL?.trim();
  if (raw) return sanitizePostgresUrl(raw.replace(/^["']|["']$/g, ""));

  if (process.env.VERCEL === "1" || process.env.CI === "true") {
    console.error(
      "[prisma] DATABASE_URL не задан. В Vercel включите переменную для Production и Build."
    );
    process.exit(1);
  }

  return "file:./kpd.db";
}

export function getMigrationDatabaseUrl() {
  const direct = process.env.DIRECT_URL?.trim()?.replace(/^["']|["']$/g, "");
  if (direct) return sanitizePostgresUrl(direct);
  return toDirectPostgresUrl(getDatabaseUrl());
}

export function isPostgresUrl(url) {
  return /^postgres(ql)?:\/\//i.test(url);
}
