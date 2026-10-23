// Field-by-field: every row of the original Bluecoins CSV must come back from our export (compared as a multiset of rows).
import fs from 'node:fs';
import { emptyDb } from '../js/core.js';
import { importBluecoins, parseCSV, exportCSV } from '../js/importer.js';
const text = fs.readFileSync(process.argv[2], 'utf8'), db = emptyDb(); importBluecoins(db, text);
const out = parseCSV(exportCSV(db)), src = parseCSV(text);
const cols = ['Type', 'Date', 'Name', 'Amount', 'Currency', 'Category Group', 'Category', 'Account', 'Notes', 'Labels'];
const ix = (h, c) => (h.indexOf(c) >= 0 ? h.indexOf(c) : c === 'Category Group' ? h.indexOf('Category Type') : -1);
const key = (h, r, extra) => cols.map((c) => (r[ix(h, c)] || '').trim().replace(/^-0\.00$/, '0.00')).concat(extra ? [] : []).join('|');
const hs = src.shift(), ho = out.shift();
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const bag = new Map(); for (const r of src) { const k = key(hs, r); bag.set(k, (bag.get(k) || 0) + 1); }
let missing = 0, extra = 0, rateOff = 0, sb = 0; const samp = [];
const bag2 = new Map(); for (const r of out) { const k = key(ho, r); bag2.set(k, (bag2.get(k) || 0) + 1); }
for (const [k, n] of bag) { const m = bag2.get(k) || 0; if (m < n) { missing += n - m; if (samp.length < 6) samp.push('MISSING ' + k); } }
for (const [k, n] of bag2) { const m = bag.get(k) || 0; if (m < n) { if (k.startsWith('Starting Balance')) { sb += n - m; continue; } extra += n - m; if (samp.length < 12) samp.push('EXTRA   ' + k); } }
// exchange rate column compared numerically on matching keys
const rs = new Map(); for (const r of src) rs.set(key(hs, r), num(r[hs.indexOf('Exchange Rate')]));
for (const r of out) { const k = key(ho, r); if (rs.has(k)) { const a = rs.get(k), b = num(r[ho.indexOf('Exchange Rate')]); if (a && Math.abs(a - b) / a > 1e-6) rateOff++; } }
console.log('source rows', src.length, 'export rows', out.length, 'missing from export', missing, 'extra in export', extra, '(plus', sb, 'Starting Balance rows we add)', 'rate mismatches', rateOff);
console.log(samp.join('\n'));
console.log(missing === 0 ? 'PASS every source row is in the export' : 'FAIL some rows differ');
