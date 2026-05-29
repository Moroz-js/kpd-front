import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDatabaseUrl } from "./load-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = getDatabaseUrl();
const isPostgres = /^postgres(ql)?:\/\//i.test(url);

execSync("node scripts/set-prisma-provider.mjs", { stdio: "inherit", cwd: root });

if (isPostgres) {
  execSync("npx prisma migrate reset --force", { stdio: "inherit", cwd: root });
} else {
  for (const file of ["kpd.db", "kpd.db-journal"]) {
    const path = join(root, "prisma", file);
    if (existsSync(path)) unlinkSync(path);
  }
  execSync("npx prisma db push", { stdio: "inherit", cwd: root });
  execSync("npx prisma db seed", { stdio: "inherit", cwd: root });
}
