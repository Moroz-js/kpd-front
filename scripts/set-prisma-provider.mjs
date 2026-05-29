import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDatabaseUrl } from "./load-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "prisma", "schema.prisma");
const url = getDatabaseUrl();
const provider = /^postgres(ql)?:\/\//i.test(url) ? "postgresql" : "sqlite";

let schema = readFileSync(schemaPath, "utf8");
const next = schema.replace(
  /(datasource db \{[\s\S]*?provider\s*=\s*)"(sqlite|postgresql)"/,
  `$1"${provider}"`
);

if (!/datasource db[\s\S]*provider\s*=\s*"(sqlite|postgresql)"/.test(schema)) {
  console.error("[prisma] provider line not found in schema.prisma");
  process.exit(1);
}

if (next === schema) {
  console.log(`[prisma] provider=${provider} (${url.split("://")[0]})`);
} else {
  writeFileSync(schemaPath, next);
  console.log(`[prisma] provider=${provider} (${url.split("://")[0]})`);
}
