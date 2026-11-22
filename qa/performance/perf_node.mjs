// PERFORMANCE (calculation side): time the heavy functions on the sample CSV and on a 20,000-entry copy of it.
import fs from 'node:fs'; import path from 'node:path';
import { ok, readCsv, done } from '../lib.mjs';
import { emptyDb, balances, live } from '../../js/core.js';
import { importBluecoins, exportCSV } from '../../js/importer.js';
import { netWorth, balanceTrail, accountHistory, monthlySeries, forecastNext } from '../../js/finance.js';
import { tradeBook } from '../../js/tradecalc.js';
const B = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'perf_budget.json'), 'utf8')).node;
const time = (fn, n = 3) => { let best = Infinity, r; for (let i = 0; i < n; i++) { const t = performance.now(); r = fn(); best = Math.min(best, performance.now() - t); } return [best, r]; };
const check = (name, ms, budget) => { console.log(`INFO PERF ${name}=${ms.toFixed(1)}ms (budget ${budget})`); ok(ms <= budget, `${name}: ${ms.toFixed(0)} ms (limit ${budget} ms)`); };
const csv = readCsv();
const [tImp, db] = time(() => { const d = emptyDb(); importBluecoins(d, csv); return d; }, 2);
check('import_csv_3k', tImp, B.import_csv_3k);
check('balances_3k', time(() => balances(db))[0], B.balances_3k);
check('net_worth_3k', time(() => netWorth(db))[0], B.net_worth_3k);
check('balance_trail_3k', time(() => { db.txs.forEach((t) => (t.updatedAt = (t.updatedAt || 0))); return balanceTrail(db); }, 1)[0], B.balance_trail_3k);
// 20k entries: the sample repeated with fresh ids, spread over the same dates
const big = JSON.parse(JSON.stringify(db)); const base = big.txs.slice(); let k = 0;
while (big.txs.length < 20000) for (const t of base) { if (big.txs.length >= 20000) break; big.txs.push({ ...t, id: 'x' + k++ }); }
check('balances_20k', time(() => balances(big))[0], B.balances_20k);
check('net_worth_20k', time(() => netWorth(big))[0], B.net_worth_20k);
check('balance_trail_20k', time(() => { big.txs.forEach((t, i) => { t.updatedAt = i + 1; }); return balanceTrail(big); }, 1)[0], B.balance_trail_20k);
check('trade_book_20k', time(() => tradeBook(big.txs))[0], B.trade_book_20k);
const a0 = live(big.accounts).find((a) => big.txs.some((t) => t.acct === a.id));
check('account_history_20k', time(() => accountHistory(big, a0.id))[0], 300);
check('monthly_series_20k', time(() => monthlySeries(big))[0], 300);
check('forecast_20k', time(() => forecastNext(big))[0], 1000);
check('export_csv_20k', time(() => exportCSV(big), 1)[0], 800);
const rows = live(big.txs).length; ok(rows >= 20000, `scale set holds ${rows} entries`);
// big imports must stay roughly linear: 3k -> 20k is about 7x, allow 15x
const [tBig] = time(() => { const d = emptyDb(); importBluecoins(d, exportCSV(big)); return d; }, 1);
console.log(`INFO PERF import_csv_20k=${tBig.toFixed(1)}ms (budget ${B.import_csv_20k})`); ok(tBig <= B.import_csv_20k, `import_csv_20k: ${tBig.toFixed(0)} ms (limit ${B.import_csv_20k} ms)`);
ok(tBig < tImp * 15 + 200, `import time grows about in step with the data (3k ${tImp.toFixed(0)} ms, 20k ${tBig.toFixed(0)} ms)`);
done();
