// REGRESSION: key figures from the sample CSV are compared with a saved "golden" copy. A change in any number means behaviour moved:
// either a bug just came in, or a deliberate change needs `python3 qa/run_qa.py regression --update-golden` after you have checked it.
import fs from 'node:fs'; import path from 'node:path';
import { ok, near, readCsv, done } from '../lib.mjs';
import { emptyDb, balances, live, r9, thisMonth, shiftMonth, monthOf } from '../../js/core.js';
import { importBluecoins } from '../../js/importer.js';
import { netWorth, monthlySeries } from '../../js/finance.js';
import { tradeBook } from '../../js/tradecalc.js';
const here = path.dirname(new URL(import.meta.url).pathname), file = path.join(here, 'golden.json');
const db = emptyDb(); importBluecoins(db, readCsv());
const txs = live(db.txs), bal = balances(db), nw = netWorth(db), book = tradeBook(db.txs);
const byKind = {}; for (const t of txs) byKind[t.kind] = (byKind[t.kind] || 0) + 1;
const perMonth = {}; for (const t of txs) if (t.kind === 'expense') { const m = monthOf(t.date), cur = t.cur; (perMonth[m] ||= {})[cur] = r9(((perMonth[m] || {})[cur] || 0) + t.amount); }
const months = Object.keys(perMonth).sort().slice(-6);
const acctBal = {}; for (const a of live(db.accounts)) acctBal[a.name + '|' + a.cur] = r9((acctBal[a.name + '|' + a.cur] || 0) + (bal.get(a.id) || 0));
const snap = { entries: txs.length, accounts: live(db.accounts).length, categories: live(db.categories || []).length, byKind,
  netWorth: r9(nw.net), assets: r9(nw.assets), debts: r9(nw.debts), realizedTotal: r9(book.total), realizedCount: book.realized.length,
  lastSixMonthsExpense: Object.fromEntries(months.map((m) => [m, perMonth[m]])), accountBalances: acctBal };
if (process.argv.includes('--update') || !fs.existsSync(file)) { fs.writeFileSync(file, JSON.stringify(snap, null, 1)); console.log('INFO golden file written: ' + file); }
const gold = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const k of ['entries', 'accounts', 'categories', 'realizedCount']) ok(snap[k] === gold[k], `${k}: ${snap[k]} (golden ${gold[k]})`);
ok(JSON.stringify(snap.byKind) === JSON.stringify(gold.byKind), `entries by kind ${JSON.stringify(snap.byKind)}`);
for (const k of ['netWorth', 'assets', 'debts', 'realizedTotal']) ok(near(snap[k], gold[k], 0.01), `${k}: ${snap[k]} (golden ${gold[k]})`);
ok(JSON.stringify(snap.lastSixMonthsExpense) === JSON.stringify(gold.lastSixMonthsExpense), 'expense totals per month and currency, last six months, unchanged');
const diff = Object.keys({ ...snap.accountBalances, ...gold.accountBalances }).filter((k) => !near(snap.accountBalances[k] ?? NaN, gold.accountBalances[k] ?? NaN, 0.01));
ok(diff.length === 0, `all ${Object.keys(gold.accountBalances).length} account balances unchanged (${diff.length} moved ${diff.slice(0, 3).map((k) => `${k}: ${gold.accountBalances[k]} -> ${snap.accountBalances[k]}`)})`);
done();
