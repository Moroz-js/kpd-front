import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const fs = require('fs');
const files = fs.readdirSync('C:/Users/lisof/Desktop/кпд');
const match = files.find(f => f.includes('23') && f.endsWith('.xlsx'));
const wb = XLSX.readFile('C:/Users/lisof/Desktop/кпд/' + match);

const ws = wb.Sheets['БД_Исполнители'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// Find header row with 'Исполнитель' in it
const hIdx = rows.findIndex(r => r.some(c => String(c).trim() === 'Исполнитель'));
console.log('Header row index:', hIdx, '| content:', JSON.stringify(rows[hIdx]?.slice(0,6)));

const allNames = rows.slice(hIdx+1).map(r => String(r[0]).trim()).filter(n => n.length > 1);
const hasPoka = allNames.find(n => n.toLowerCase().includes('пока'));
console.log('Placeholder executor:', hasPoka ?? 'NOT FOUND');
console.log('Первые 10 имён:', allNames.slice(0,10));
console.log('Всего исполнителей:', allNames.length);
