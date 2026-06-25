/**
 * compare-link-strategies.mjs — сравнение стратегий линковки LS.
 * Запуск: node scripts/compare-link-strategies.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LS_FOLDER =
  process.env.LS_FOLDER ??
  path.join(path.resolve(__dirname, "../.."), "personal-sheets");
const LS_SHEET = "Текущий год";

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function execFromFile(f) {
  return f.replace(/ Личная смета_.*$/i, "").replace(/ \(.*\).*$/i, "");
}

function monthKey(r, h) {
  const moCol = h.findIndex((x) => String(x || "").startsWith("Месяц выполнения"));
  const yrCol = h.findIndex((x) => String(x || "").startsWith("Год выполнения"));
  const m = String(r[moCol] || "").match(/^(\d{1,2})/);
  return `${r[yrCol]}-${m ? m[1].padStart(2, "0") : "?"}`;
}

function paidMatch(wP, pP) {
  return wP != null && pP != null && Math.abs(Number(wP) - Number(pP)) <= 0;
}

function planMatch(wPl, pPl) {
  return wPl != null && pPl != null && Math.abs(Number(wPl) - Number(pPl)) <= 0;
}

function hybridMatch(wP, wPl, pP, pPl) {
  const w = [wP, wPl].filter((s) => s != null);
  const p = [pP, pPl].filter((s) => s != null);
  if (!w.length || !p.length) return false;
  return w.some((wd) => p.some((pd) => Math.abs(Number(wd) - Number(pd)) <= 0));
}

function sumClose(a, b, tol = 1) {
  return a != null && b != null && Math.abs(a - b) <= tol;
}

/** @returns {Map<string,string>} */
function buildMap(mode) {
  const map = new Map();
  const meta = []; // per-link: how linked

  for (const f of fs.readdirSync(LS_FOLDER).filter((x) => x.toLowerCase().endsWith(".xlsx"))) {
    const rows = XLSX.utils.sheet_to_json(
      XLSX.readFile(path.join(LS_FOLDER, f), { cellDates: false }).Sheets[LS_SHEET],
      { header: 1, defval: null },
    );
    let hdr = -1;
    let uidCol = -1;
    for (let i = 0; i < 10; i++) {
      const idx = rows[i]?.indexOf("__SRC_UID");
      if (idx >= 0) {
        hdr = i;
        uidCol = idx;
        break;
      }
    }
    if (hdr < 0) continue;

    const h = rows[hdr];
    const paidCol = h.indexOf("Дата оплаты");
    const planCol = h.indexOf("Дата оплаты план");
    const payCol = h.indexOf("Выплата");
    const amtCol = h.findIndex((x) => String(x || "").startsWith("Сумма к выплате"));

    /** @type {{uid:string,mk:string,paid:unknown,plan:unknown,amt:number|null,file:string}[]} */
    const pending = [];

    for (let i = hdr + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r?.[uidCol]) continue;
      const uid = String(r[uidCol]);

      if (uid.startsWith("ls|")) {
        pending.push({
          uid,
          mk: monthKey(r, h),
          paid: paidCol >= 0 ? r[paidCol] ?? null : null,
          plan: planCol >= 0 ? r[planCol] ?? null : null,
          amt: amtCol >= 0 ? num(r[amtCol]) : null,
          file: f,
        });
      } else if (uid.startsWith("pay|")) {
        const payAmt = payCol >= 0 ? num(r[payCol]) : null;
        const pPaid = paidCol >= 0 ? r[paidCol] ?? null : null;
        const pPlan = planCol >= 0 ? r[planCol] ?? null : null;

        if (payAmt != null && payAmt > 0) {
          const pmk = monthKey(r, h);
          const pool = pending.filter((w) => w.mk === pmk);
          /** @type {{uid:string,how:string}[]} */
          let linked = [];

          if (mode === "hybrid") {
            for (const w of pending) {
              if (hybridMatch(w.paid, w.plan, pPaid, pPlan)) {
                linked.push({ uid: w.uid, how: "hybrid-date" });
              }
            }
          } else if (mode === "month-pos") {
            // positional in month, no sum check
            linked = pool.map((w) => ({ uid: w.uid, how: "pos-month" }));
          } else if (mode === "month-smart") {
            const poolSum = pool.reduce((s, w) => s + (w.amt ?? 0), 0);
            const byPaid = pool.filter((w) => paidMatch(w.paid, pPaid));
            const byPlan = pool.filter((w) => planMatch(w.plan, pPlan));

            if (pool.length && sumClose(poolSum, payAmt)) {
              linked = pool.map((w) => ({ uid: w.uid, how: "pos-sum" }));
            } else if (byPaid.length) {
              linked = byPaid.map((w) => ({ uid: w.uid, how: "paid-month" }));
            } else if (byPlan.length) {
              linked = byPlan.map((w) => ({ uid: w.uid, how: "plan-month" }));
            } else if (pool.length === 1) {
              linked = [{ uid: pool[0].uid, how: "pos-single" }];
            }
          } else if (mode === "month-cascade") {
            // paid → plan → pos (whole pool)
            const byPaid = pool.filter((w) => paidMatch(w.paid, pPaid));
            const byPlan = pool.filter((w) => planMatch(w.plan, pPlan));
            if (byPaid.length) {
              linked = byPaid.map((w) => ({ uid: w.uid, how: "paid-month" }));
            } else if (byPlan.length) {
              linked = byPlan.map((w) => ({ uid: w.uid, how: "plan-month" }));
            } else if (pool.length) {
              linked = pool.map((w) => ({ uid: w.uid, how: "pos-month" }));
            }
          }

          for (const l of linked) {
            map.set(l.uid, uid);
            meta.push({ ...l, payUid: uid, file: f, payAmt });
          }
        }
        // always clear pending after pay row (incl. skipped — we only enter on pay>0)
        pending.length = 0;
      }
    }
  }

  return { map, meta };
}

function sumMismatch(map) {
  const bad = [];
  for (const f of fs.readdirSync(LS_FOLDER).filter((x) => x.toLowerCase().endsWith(".xlsx"))) {
    const rows = XLSX.utils.sheet_to_json(
      XLSX.readFile(path.join(LS_FOLDER, f)).Sheets[LS_SHEET],
      { header: 1, defval: null },
    );
    let hdr = -1;
    let uidCol = -1;
    for (let i = 0; i < 10; i++) {
      const idx = rows[i]?.indexOf("__SRC_UID");
      if (idx >= 0) {
        hdr = i;
        uidCol = idx;
        break;
      }
    }
    if (hdr < 0) continue;
    const h = rows[hdr];
    const payCol = h.indexOf("Выплата");
    const amtCol = h.findIndex((x) => String(x || "").startsWith("Сумма к выплате"));
    const pending = [];

    for (let i = hdr + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r?.[uidCol]) continue;
      const uid = String(r[uidCol]);
      if (uid.startsWith("ls|")) {
        pending.push({ uid, amt: amtCol >= 0 ? num(r[amtCol]) ?? 0 : 0 });
      } else if (uid.startsWith("pay|")) {
        const pay = payCol >= 0 ? num(r[payCol]) : null;
        if (pay != null && pay > 0) {
          const linked = pending.filter((w) => map.get(w.uid) === uid);
          const sum = linked.reduce((s, w) => s + w.amt, 0);
          if (linked.length && Math.abs(sum - pay) > 1) {
            bad.push({
              file: f,
              payUid: uid,
              pay: Math.round(pay),
              workSum: Math.round(sum),
              count: linked.length,
            });
          }
        }
        pending.length = 0;
      }
    }
  }
  return bad;
}

function diffMaps(oldMap, newMap) {
  const all = new Set([...oldMap.keys(), ...newMap.keys()]);
  const changed = [];
  const onlyOld = [];
  const onlyNew = [];
  for (const uid of all) {
    const o = oldMap.get(uid) ?? null;
    const n = newMap.get(uid) ?? null;
    if (o && n && o !== n) changed.push({ uid, oldPay: o, newPay: n });
    else if (o && !n) onlyOld.push({ uid, pay: o });
    else if (!o && n) onlyNew.push({ uid, pay: n });
  }
  return { changed, onlyOld, onlyNew };
}

const strategies = ["hybrid", "month-smart", "month-cascade", "month-pos"];
const results = {};
for (const s of strategies) {
  const { map, meta } = buildMap(s);
  const bad = sumMismatch(map);
  const howCounts = {};
  for (const m of meta) howCounts[m.how] = (howCounts[m.how] || 0) + 1;
  results[s] = { map, meta, bad, howCounts, size: map.size };
}

console.log("=== Сравнение стратегий линковки LS ===\n");
console.log(`Файлов: ${fs.readdirSync(LS_FOLDER).filter((f) => f.endsWith(".xlsx")).length}\n`);

console.log("Стратегия          | Связей | sum≠pay | pos-sum | paid | plan | pos-single | pos-month");
console.log("-------------------|--------|---------|---------|------|------|------------|----------");
for (const s of strategies) {
  const r = results[s];
  const h = r.howCounts;
  console.log(
    `${s.padEnd(18)} | ${String(r.size).padStart(6)} | ${String(r.bad.length).padStart(7)} | ${String(h["pos-sum"] ?? 0).padStart(7)} | ${String(h["paid-month"] ?? h["hybrid-date"] ?? 0).padStart(4)} | ${String(h["plan-month"] ?? 0).padStart(4)} | ${String(h["pos-single"] ?? 0).padStart(10)} | ${String(h["pos-month"] ?? 0).padStart(8)}`,
  );
}

const vsHybrid = diffMaps(results.hybrid.map, results["month-smart"].map);
console.log("\n--- month-smart vs hybrid (текущий) ---");
console.log(`Переназначено (работа сменила выплату): ${vsHybrid.changed.length}`);
console.log(`Только hybrid:  ${vsHybrid.onlyOld.length}`);
console.log(`Только smart:   ${vsHybrid.onlyNew.length}`);

function groupByFile(items, mapRef, label) {
  const byFile = new Map();
  for (const it of items) {
    const uid = it.uid ?? it.newPay;
    // find file from meta
    let file = "?";
    for (const m of results["month-smart"].meta) {
      if (m.uid === (it.uid ?? "") || m.payUid === it.pay) {
        file = m.file;
        break;
      }
    }
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(it);
  }
  if (items.length === 0) return;
  console.log(`\n${label} (топ):`);
  const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [file, list] of sorted.slice(0, 8)) {
    console.log(`  ${execFromFile(file)}: ${list.length}`);
  }
}

if (vsHybrid.onlyNew.length) {
  console.log("\n--- Новые связи (smart добавил, hybrid нет) ---");
  const byFile = new Map();
  for (const { uid } of vsHybrid.onlyNew) {
    const m = results["month-smart"].meta.find((x) => x.uid === uid);
    const file = m?.file ?? "?";
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push({ uid, how: m?.how, amt: m?.payAmt });
  }
  for (const [file, list] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${execFromFile(file)}: +${list.length} (${list[0]?.how})`);
  }
}

if (vsHybrid.onlyOld.length) {
  console.log("\n--- Потеряны (были в hybrid, smart нет) ---");
  const byFile = new Map();
  for (const { uid } of vsHybrid.onlyOld) {
    // find in any file
    for (const f of fs.readdirSync(LS_FOLDER)) {
      if (!f.endsWith(".xlsx")) continue;
      const rows = XLSX.utils.sheet_to_json(
        XLSX.readFile(path.join(LS_FOLDER, f)).Sheets[LS_SHEET],
        { header: 1, defval: null },
      );
      const found = rows.some((r) => r?.includes(uid));
      if (found) {
        if (!byFile.has(f)) byFile.set(f, 0);
        byFile.set(f, byFile.get(f) + 1);
      }
    }
  }
  for (const [file, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${execFromFile(file)}: −${n}`);
  }
}

// Spot checks
console.log("\n--- Spot checks (month-smart) ---");
const spots = [
  ["Михайлова", 30000],
  ["Михайлова", 35500],
  ["Дьяков", 800000],
  ["Дьяков", 161649],
  ["Шошин", 97000],
];
for (const [exec, amt] of spots) {
  for (const f of fs.readdirSync(LS_FOLDER).filter((x) => x.includes(exec))) {
    const rows = XLSX.utils.sheet_to_json(
      XLSX.readFile(path.join(LS_FOLDER, f)).Sheets[LS_SHEET],
      { header: 1, defval: null },
    );
    let uidCol = -1;
    for (let i = 0; i < 10; i++) {
      const idx = rows[i]?.indexOf("__SRC_UID");
      if (idx >= 0) {
        uidCol = idx;
        break;
      }
    }
    const amtCol = rows.find((r) => r?.includes("__SRC_UID"))?.findIndex((x) =>
      String(x || "").startsWith("Сумма к выплате"),
    );
    for (const r of rows) {
      const u = String(r?.[uidCol] || "");
      if (!u.startsWith("ls|")) continue;
      if (num(r[amtCol]) !== amt) continue;
      const m = results["month-smart"].meta.find((x) => x.uid === u);
      const hm = results.hybrid.map.has(u) ? "hybrid:yes" : "hybrid:no";
      console.log(`  ${exec} ${amt.toLocaleString("ru")}: smart=${m?.how ?? "NONE"} ${hm}`);
    }
  }
}

console.log("\n--- sum≠pay только у month-smart (первые 10) ---");
const smartBad = new Set(results["month-smart"].bad.map((b) => b.payUid));
const hybridBad = new Set(results.hybrid.bad.map((b) => b.payUid));
const newBad = results["month-smart"].bad.filter((b) => !hybridBad.has(b.payUid));
const fixedBad = results.hybrid.bad.filter((b) => !smartBad.has(b.payUid));
console.log(`Новых sum≠pay: ${newBad.length}, исправлено vs hybrid: ${fixedBad.length}`);
for (const b of newBad.slice(0, 10)) {
  console.log(`  + ${execFromFile(b.file)} pay ${b.pay} works ${b.workSum} (${b.count} шт)`);
}
for (const b of fixedBad.slice(0, 10)) {
  console.log(`  − ${execFromFile(b.file)} pay ${b.pay} works ${b.workSum} (${b.count} шт)`);
}
