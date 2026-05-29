import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDatabaseUrl } from "./load-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = getDatabaseUrl();
const migration = "20260529120000_init";

if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.log("[prisma] recover — нужен DATABASE_URL с postgresql://");
  process.exit(1);
}

execSync("node scripts/set-prisma-provider.mjs", { stdio: "inherit", cwd: root });
console.log(`[prisma] resolve --rolled-back ${migration}`);
execSync(`npx prisma migrate resolve --rolled-back ${migration}`, {
  stdio: "inherit",
  cwd: root,
});
execSync("node scripts/prisma-deploy.mjs", { stdio: "inherit", cwd: root });
