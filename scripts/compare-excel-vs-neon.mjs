/**
 * compare-excel-vs-neon.mjs — Excel (после сверки LS) vs Neon после миграции
 *
 * Сравнивает:
 *   - сумму выставленных работ (works)
 *   - сумму выплат (payments; прочие траты отдельно)
 *   - по каждому исполнителю: работы vs выплаты
 *   - привязку work.paymentId (ожидание из LS + Excel UID)
 *
 * Запуск: node scripts/compare-excel-vs-neon.mjs
 */
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pg from "pg";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envContent = fs.readFileSync(path.resolve(__dirname, "../.env.production"), "utf8");
const DB_URL = envContent.match(/DIRECT_URL="([^"]+)"/)?.[1];
if (!DB_URL) {
  console.error("❌ DIRECT_URL не найден");
  process.exit(1);
}

const EXCEL_PATH =
  process.env.EXCEL_PATH ?? path.resolve(__dirname, "../../Смета_23.xlsx");
const LS_FOLDER =
  process.env.LS_FOLDER ?? path.join(path.dirname(EXCEL_PATH), "personal-sheets");
const LS_SHEET = "Текущий год";

function str(v) {
  return v == null || v === "" ? null : String(v).trim();
}
function num(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
function normKey(s) {
  return str(s)?.toLowerCase().replace(/\s+/g, " ") ?? "";
}
function col(hdr, ...names) {
  for (const n of names) {
    const i = hdr.indexOf(n);
    if (i >= 0) return i;
  }
  for (const n of names) {
    const i = hdr.findIndex((h) => h && String(h).startsWith(n.replace("*", "")));
    if (i >= 0) return i;
  }
  return -1;
}
function isRealPayment(amount) {
  return amount != null && amount > 0;
}

function readExcelSheet(wb, sheet, identifyBy, dataOffset = 1) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null });
  const hi = rows.findIndex((r) => r?.includes(identifyBy));
  if (hi < 0) return { hdr: [], data: [] };
  const hdr = rows[hi];
  const data = [];
  for (const r of rows.slice(hi + 1 + dataOffset)) {
    if (!r) continue;
    const obj = {};
    hdr.forEach((h, j) => {
      if (h) obj[h] = r[j];
    });
    if (Object.values(obj).some((v) => v != null)) data.push(obj);
  }
  return { hdr, data };
}

function buildLSLinks() {
  const links = new Map();
  let files = [];
  try {
    files = fs.readdirSync(LS_FOLDER).filter((f) => f.toLowerCase().endsWith(".xlsx"));
  } catch {
    return links;
  }
  for (const f of files) {
    const lwb = XLSX.readFile(path.join(LS_FOLDER, f), { cellDates: false });
    if (!lwb.SheetNames.includes(LS_SHEET)) continue;
    const rows = XLSX.utils.sheet_to_json(lwb.Sheets[LS_SHEET], { header: 1, defval: null });
    let hi = -1;
    let uidCol = -1;
    for (let i = 0; i < 10; i++) {
      const idx = rows[i]?.indexOf("__SRC_UID");
      if (idx >= 0) {
        hi = i;
        uidCol = idx;
        break;
      }
    }
    if (hi < 0) continue;
    const hdr = rows[hi];
    const payCol = col(hdr, "Выплата");
    const paidCol = col(hdr, "Дата оплаты");
    const pending = [];
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[uidCol]) continue;
      const uid = String(r[uidCol]);
      const ps = paidCol >= 0 ? r[paidCol] : null;
      if (uid.startsWith("ls|")) {
        pending.push({ uid, ps });
      } else if (uid.startsWith("pay|")) {
        const amount = num(r[payCol]);
        if (isRealPayment(amount)) {
          for (const w of pending) {
            if (ps != null && w.ps != null && Math.abs(w.ps - ps) > 0) continue;
            links.set(w.uid, uid);
          }
        }
        pending.length = 0;
      }
    }
  }
  return links;
}

console.log("Excel vs Neon (после миграции)\n");

const wb = XLSX.readFile(EXCEL_PATH, { cellDates: false });
const { data: xlWorksRaw } = readExcelSheet(wb, "БД_Выставленные_работы", "Исполнитель", 2);
const { data: xlPaysRaw } = readExcelSheet(wb, "БД_Выплаты", "Исполнитель", 1);

const xlWorks = xlWorksRaw.filter((r) => str(r["Тип сметы"]) !== "Прочие траты");
const xlOtherFromWorks = xlWorksRaw.filter((r) => str(r["Тип сметы"]) === "Прочие траты");
const xlPays = xlPaysRaw.filter((r) => str(r["Тип сметы"]) !== "Прочие траты" && isRealPayment(num(r["Выплата"])));
const xlOtherPays = xlPaysRaw.filter((r) => str(r["Тип сметы"]) === "Прочие траты");

const xlWorkByExec = {};
const xlWorkByUid = new Map();
for (const r of xlWorks) {
  const exec = str(r["Исполнитель"]);
  const amt = num(r["Сумма к выплате"]);
  const uid = str(r["__SRC_UID"]);
  if (!exec || amt == null) continue;
  xlWorkByExec[exec] = (xlWorkByExec[exec] || 0) + amt;
  if (uid) xlWorkByUid.set(uid, r);
}

const xlPayByExec = {};
const xlPayByUid = new Map();
for (const r of xlPays) {
  const exec = str(r["Исполнитель"]);
  const amt = num(r["Выплата"]);
  const uid = str(r["__SRC_UID"]);
  if (!exec || amt == null) continue;
  xlPayByExec[exec] = (xlPayByExec[exec] || 0) + amt;
  if (uid?.startsWith("pay|")) xlPayByUid.set(uid, r);
}

const xlWorksTotal = xlWorks.reduce((a, r) => a + (num(r["Сумма к выплате"]) || 0), 0);
const xlPaysTotal = xlPays.reduce((a, r) => a + (num(r["Выплата"]) || 0), 0);

const lsLinks = buildLSLinks();
const expectedLinks = [];
for (const [workUid, payUid] of lsLinks) {
  if (xlWorkByUid.has(workUid) && xlPayByUid.has(payUid)) {
    expectedLinks.push({ workUid, payUid });
  }
}

const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const worksRes = await client.query(`
  SELECT e.name AS exec, w.amount, w."paymentId" AS payment_id, w."workStatus" AS work_status,
         w."executionYear" AS execution_year, w."executionMonth" AS execution_month
  FROM works w JOIN executors e ON e.id = w."executorId"
`);
const paysRes = await client.query(`
  SELECT e.name AS exec, p.id, p.amount, p."periodYear" AS period_year,
         p."periodMonth" AS period_month, p."paymentStatus" AS payment_status
  FROM payments p JOIN executors e ON e.id = p."executorId"
`);
const otherRes = await client.query(`
  SELECT e.name AS exec, o.amount, o."paymentAmount", o."paymentStatus"
  FROM other_expenses o JOIN executors e ON e.id = o."executorId"
`);

await client.end();

const dbWorkByExec = {};
for (const r of worksRes.rows) {
  dbWorkByExec[r.exec] = (dbWorkByExec[r.exec] || 0) + Number(r.amount);
}
const dbPayByExec = {};
const dbPayById = new Map();
for (const r of paysRes.rows) {
  dbPayByExec[r.exec] = (dbPayByExec[r.exec] || 0) + Number(r.amount);
  dbPayById.set(r.id, r);
}

const dbWorksTotal = worksRes.rows.reduce((a, r) => a + Number(r.amount), 0);
const dbPaysTotal = paysRes.rows.reduce((a, r) => a + Number(r.amount), 0);
const dbOtherAmt = otherRes.rows.reduce((a, r) => a + Number(r.amount), 0);
const dbOtherPayAmt = otherRes.rows.reduce((a, r) => a + (Number(r.paymentamount) || 0), 0);

// paymentId grouping
const worksByPayment = new Map();
let linkedWorks = 0;
let unlinkedWorks = 0;
for (const w of worksRes.rows) {
  if (w.payment_id) {
    linkedWorks++;
    const pid = w.payment_id;
    if (!worksByPayment.has(pid)) worksByPayment.set(pid, []);
    worksByPayment.get(pid).push(w);
  } else {
    unlinkedWorks++;
  }
}

let linkSumMismatch = 0;
let linkSumOk = 0;
for (const [pid, wlist] of worksByPayment) {
  const pay = dbPayById.get(pid);
  if (!pay) continue;
  const wSum = wlist.reduce((a, w) => a + Number(w.amount), 0);
  if (Math.abs(wSum - Number(pay.amount)) > 1) linkSumMismatch++;
  else linkSumOk++;
}

// Per executor diff
const allExecs = new Set([
  ...Object.keys(xlWorkByExec),
  ...Object.keys(xlPayByExec),
  ...Object.keys(dbWorkByExec),
  ...Object.keys(dbPayByExec),
]);
const execDiffs = [];
for (const exec of allExecs) {
  const xw = Math.round(xlWorkByExec[exec] || 0);
  const xp = Math.round(xlPayByExec[exec] || 0);
  const dw = Math.round(dbWorkByExec[exec] || 0);
  const dp = Math.round(dbPayByExec[exec] || 0);
  if (Math.abs(xw - dw) > 1 || Math.abs(xp - dp) > 1) {
    execDiffs.push({ exec, xw, xp, dw, dp, dWork: xw - dw, dPay: xp - dp });
  }
}
execDiffs.sort((a, b) => Math.max(Math.abs(b.dWork), Math.abs(b.dPay)) - Math.max(Math.abs(a.dWork), Math.abs(a.dPay)));

console.log("=== ИТОГО ===");
console.log(`Works:     Excel ${Math.round(xlWorksTotal).toLocaleString("ru")} | Neon ${Math.round(dbWorksTotal).toLocaleString("ru")} | Δ ${Math.round(xlWorksTotal - dbWorksTotal).toLocaleString("ru")}`);
console.log(`           Excel строк: ${xlWorks.length} | Neon строк: ${worksRes.rows.length}`);
console.log(`Payments:  Excel ${Math.round(xlPaysTotal).toLocaleString("ru")} | Neon ${Math.round(dbPaysTotal).toLocaleString("ru")} | Δ ${Math.round(xlPaysTotal - dbPaysTotal).toLocaleString("ru")}`);
console.log(`           Excel строк: ${xlPays.length} | Neon строк: ${paysRes.rows.length}`);
console.log(`Other exp: Excel works-прочие ${xlOtherFromWorks.length} | Neon other_expenses ${otherRes.rows.length} (${Math.round(dbOtherAmt).toLocaleString("ru")} ₽)`);

console.log("\n=== ПРИВЯЗКА work.paymentId ===");
console.log(`LS→Excel ожидаемых связей: ${expectedLinks.length}`);
console.log(`Neon works с paymentId:    ${linkedWorks}`);
console.log(`Neon works без paymentId:  ${unlinkedWorks}`);
console.log(`Групп paymentId:           ${worksByPayment.size}`);
console.log(`  сумма работ = выплата:   ${linkSumOk}`);
console.log(`  сумма работ ≠ выплата:   ${linkSumMismatch}`);

// Статусы привязки
const paidUnlinked = worksRes.rows.filter((w) => w.work_status === "paid" && !w.payment_id).length;
const checkedUnlinked = worksRes.rows.filter((w) => w.work_status === "checked" && !w.payment_id).length;

console.log(`Не привязаны (paid):    ${paidUnlinked}`);
console.log(`Не привязаны (checked): ${checkedUnlinked}`);

if (execDiffs.length) {
  console.log(`\n=== РАСХОЖДЕНИЯ ПО ИСПОЛНИТЕЛЮ (${execDiffs.length}) ===`);
  execDiffs.slice(0, 20).forEach((x) => {
    console.log(
      `  ${x.exec.padEnd(28)} works XL ${x.xw.toLocaleString("ru").padStart(10)} / DB ${x.dw.toLocaleString("ru").padStart(10)} Δ ${x.dWork.toLocaleString("ru").padStart(8)} | pays XL ${x.xp.toLocaleString("ru").padStart(10)} / DB ${x.dp.toLocaleString("ru").padStart(10)} Δ ${x.dPay.toLocaleString("ru").padStart(8)}`,
    );
  });
  if (execDiffs.length > 20) console.log(`  ... ещё ${execDiffs.length - 20}`);
} else {
  console.log("\n✅ По исполнителям works/payments — совпадает");
}

const ok =
  Math.abs(xlWorksTotal - dbWorksTotal) < 1 &&
  Math.abs(xlPaysTotal - dbPaysTotal) < 1 &&
  execDiffs.length === 0;
console.log(`\n${ok ? "✅ Excel = Neon" : "⚠️  Есть расхождения Excel vs Neon"}`);
