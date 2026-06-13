import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve('C:/Users/lisof/Desktop/кпд/Смета_23.xlsx');
let wb;
try {
  wb = XLSX.readFile(filePath);
} catch(e) {
  // try with encoded name
  const fs = require('fs');
  const dir = 'C:/Users/lisof/Desktop/кпд';
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.includes('23') && f.endsWith('.xlsx'));
  console.log('Found file:', match);
  wb = XLSX.readFile(path.join(dir, match));
}

console.log('\n=== SHEETS ===');
wb.SheetNames.forEach((name, i) => {
  const ws = wb.Sheets[name];
  const range = ws['!ref'];
  console.log(`[${i}] "${name}" — range: ${range}`);
});

// Show first few rows of sheets that look like spending plan
const planKeywords = ['план', 'расход', 'budget', 'spend', 'бюджет'];
for (const name of wb.SheetNames) {
  const lower = name.toLowerCase();
  if (planKeywords.some(k => lower.includes(k))) {
    console.log(`\n=== PREVIEW: "${name}" ===`);
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    rows.slice(0, 10).forEach((row, i) => {
      console.log(`Row ${i+1}:`, row.slice(0, 15));
    });
  }
}
