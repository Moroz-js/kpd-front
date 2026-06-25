/**
 * compare-ls-vs-big.mjs — сверка личных смет (LS) с большой сметой (Смета_23.xlsx)
 *
 * Правила:
 *   - только лист «Текущий год» (архив не участвует в синках)
 *   - month-smart линковка (как migrate-excel.mjs)
 *
 * Запуск: node scripts/compare-ls-vs-big.mjs
 */
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
function excelDate(serial) {
  if (serial == null || typeof serial !== "number") return null;
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
}
function isRealPayment(amount) {
  return amount != null && amount > 0;
}

function readBD(wb, sheet, identifyBy, dataOffset) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null });
  const hi = rows.findIndex((r) => r?.includes(identifyBy));
  if (hi < 0) return [];
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
  return data;
}

function lsMonthKey(r, hdr) {
  const yrCol = col(hdr, "Год выполнения");
  const moCol = col(hdr, "Месяц выполнения");
  const yr = r[yrCol];
  const m = String(r[moCol] ?? "").match(/^(\d{1,2})/);
  if (yr == null || !m) return null;
  return `${yr}-${m[1].padStart(2, "0")}`;
}

function lsSerialMatch(a, b) {
  return a != null && b != null && Math.abs(Number(a) - Number(b)) <= 0;
}

function lsSumClose(a, b, tol = 1) {
  return a != null && b != null && Math.abs(a - b) <= tol;
}

function lsLinkPool(pool, payAmount, payPaid, payPlanned) {
  if (!pool.length || !isRealPayment(payAmount)) return [];
  const poolSum = pool.reduce((s, w) => s + (w.amount ?? 0), 0);
  const byPaid = pool.filter((w) => lsSerialMatch(w.paidSerial, payPaid));
  const byPlan = pool.filter((w) => lsSerialMatch(w.plannedSerial, payPlanned));
  if (lsSumClose(poolSum, payAmount)) return pool;
  if (byPaid.length) return byPaid;
  if (byPlan.length) return byPlan;
  if (pool.length === 1) return pool;
  return [];
}

function readLSFolder() {
  const lsWorks = new Map();
  const lsPays = new Map();
  const lsLinks = new Map();

  let files = [];
  try {
    files = fs.readdirSync(LS_FOLDER).filter((f) => f.toLowerCase().endsWith(".xlsx"));
  } catch {
    console.error("❌ Папка LS не найдена:", LS_FOLDER);
    process.exit(1);
  }

  for (const f of files) {
    const execName = f.replace(/ Личная смета_.*$/i, "").replace(/ \(.*\).*$/i, "");
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
    const amtCol = col(hdr, "Сумма к выплате*", "Сумма к выплате");
    const payCol = col(hdr, "Выплата");
    const paidCol = col(hdr, "Дата оплаты");
    const plannedCol = col(hdr, "Дата оплаты план");
    const pending = [];

    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[uidCol]) continue;
      const uid = String(r[uidCol]);
      const paidSerial = paidCol >= 0 ? r[paidCol] : null;
      const plannedSerial = plannedCol >= 0 ? r[plannedCol] : null;

      if (uid.startsWith("ls|")) {
        lsWorks.set(uid, { uid, exec: execName, amount: num(r[amtCol]), file: f });
        pending.push({
          uid,
          monthKey: lsMonthKey(r, hdr),
          paidSerial,
          plannedSerial,
          amount: num(r[amtCol]),
        });
      } else if (uid.startsWith("pay|")) {
        const amount = num(r[payCol]);
        if (isRealPayment(amount)) {
          lsPays.set(uid, {
            uid,
            exec: execName,
            amount,
            paidAt: excelDate(paidSerial),
            file: f,
          });
          const payMonthKey = lsMonthKey(r, hdr);
          const pool = payMonthKey != null
            ? pending.filter((w) => w.monthKey === payMonthKey)
            : [];
          for (const w of lsLinkPool(pool, amount, paidSerial, plannedSerial)) {
            lsLinks.set(w.uid, uid);
          }
        }
        pending.length = 0;
      }
    }
  }

  return { lsWorks, lsPays, lsLinks };
}

if (!fs.existsSync(EXCEL_PATH)) {
  console.error("❌ Excel не найден:", EXCEL_PATH);
  process.exit(1);
}

console.log("Сверка LS ↔ большая смета");
console.log("  Excel:", EXCEL_PATH);
console.log("  LS:", LS_FOLDER);
console.log("  Лист LS:", LS_SHEET, "| month-smart линковка | выплаты с 0 — пропускаем\n");

const wb = XLSX.readFile(EXCEL_PATH, { cellDates: false });
const worksBD = readBD(wb, "БД_Выставленные_работы", "Исполнитель", 2);
const paysBD = readBD(wb, "БД_Выплаты", "Исполнитель", 1);

const bdWorks = new Map(
  worksBD.map((r) => [str(r["__SRC_UID"]), r]).filter(([k]) => k),
);
const bdPays = new Map(
  paysBD
    .filter((r) => isRealPayment(num(r["Выплата"])))
    .map((r) => [str(r["__SRC_UID"]), r])
    .filter(([k]) => k),
);

const { lsWorks, lsPays, lsLinks } = readLSFolder();

const missingWorks = [];
const missingPays = [];
const amtDiff = [];
let linkedOk = 0;
const linkedBroken = [];

for (const [uid, ls] of lsWorks) {
  const bd = bdWorks.get(uid);
  if (!bd) {
    missingWorks.push(ls);
    continue;
  }
  const bdAmt = num(bd["Сумма к выплате"]);
  if (ls.amount != null && bdAmt != null && Math.abs(ls.amount - bdAmt) > 1) {
    amtDiff.push({ type: "work", exec: ls.exec, ls: ls.amount, bd: bdAmt, uid });
  }
}

for (const [uid, ls] of lsPays) {
  const bd = bdPays.get(uid);
  if (!bd) {
    missingPays.push(ls);
    continue;
  }
  const bdAmt = num(bd["Выплата"]);
  if (ls.amount != null && bdAmt != null && Math.abs(ls.amount - bdAmt) > 1) {
    amtDiff.push({ type: "pay", exec: ls.exec, ls: ls.amount, bd: bdAmt, uid });
  }
}

for (const [wUid, pUid] of lsLinks) {
  const w = bdWorks.get(wUid);
  const p = bdPays.get(pUid);
  if (!w || !p) {
    linkedBroken.push({
      exec: lsWorks.get(wUid)?.exec,
      wIn: !!w,
      pIn: !!p,
      payUid: pUid,
    });
  } else {
    linkedOk++;
  }
}

const tLS = [...lsWorks.values()].reduce((a, x) => a + (x.amount || 0), 0);
const tBD = worksBD
  .filter((r) => str(r["Тип сметы"]) !== "Прочие траты")
  .reduce((a, r) => a + (num(r["Сумма к выплате"]) || 0), 0);
const missPaySum = missingPays.reduce((a, x) => a + (x.amount || 0), 0);

console.log("=== СВОДКА ===");
console.log(`LS: ${lsWorks.size} работ, ${lsPays.size} выплат, ${lsLinks.size} связей`);
console.log(`БД: ${bdWorks.size} работ (uid), ${bdPays.size} выплат (pay|, >0)`);
console.log(`Missing works: ${missingWorks.length}`);
console.log(`Missing pays:  ${missingPays.length} (${Math.round(missPaySum).toLocaleString("ru")} ₽)`);
console.log(`Amt diff >1₽:  ${amtDiff.length}`);
console.log(`Links OK: ${linkedOk} | Broken: ${linkedBroken.length}`);
console.log(
  `Total works: LS ${Math.round(tLS).toLocaleString("ru")} | BD ${Math.round(tBD).toLocaleString("ru")} | Δ ${Math.round(tLS - tBD).toLocaleString("ru")}`,
);

const ok =
  missingWorks.length === 0 &&
  missingPays.length === 0 &&
  amtDiff.length === 0 &&
  linkedBroken.length === 0;
console.log(`\n${ok ? "✅ Всё сведено" : "⚠️  Есть расхождения"}`);

if (missingWorks.length) {
  console.log("\n— Missing works —");
  missingWorks.forEach((x) => console.log(`  ${x.exec}: ${Math.round(x.amount || 0).toLocaleString("ru")} ₽`));
}
if (missingPays.length) {
  console.log("\n— Missing pays —");
  missingPays.forEach((x) =>
    console.log(`  ${x.exec}: ${Math.round(x.amount || 0).toLocaleString("ru")} ₽${x.paidAt ? ` (${x.paidAt})` : ""}`),
  );
}
if (amtDiff.length) {
  console.log("\n— Amount diffs —");
  amtDiff.forEach((x) => console.log(`  ${x.type} ${x.exec}: LS ${x.ls} vs BD ${x.bd}`));
}
if (linkedBroken.length) {
  console.log("\n— Broken links —");
  linkedBroken.forEach((x) => console.log(`  ${x.exec}: work=${x.wIn} pay=${x.pIn}`));
}
