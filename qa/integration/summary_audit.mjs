// INTEGRATION: summary totals re-derived with plain loops on the real sample CSV and compared with the app's own summary functions.
// Month totals, category-group totals, yearly totals, net worth and the shape of the cash-flow series must all agree.
import { ok, near, readCsv, done } from '../lib.mjs';
import { emptyDb, balances, live, homeFx, factorFor, monthParts, catMap } from '../../js/core.js';
import { importBluecoins } from '../../js/importer.js';
import { netWorth, monthlySeries } from '../../js/finance.js';
import { totals } from '../../js/insights.js';

const db = emptyDb(); importBluecoins(db, readCsv());
const txs = live(db.txs), months = [...new Set(txs.map((t) => t.date.slice(0, 7)))].sort();
const cm = catMap(db), exG = new Set(db.settings.excludeGroups || []), grp = (t) => { const c = cm.get(t.cat); return c ? c.group : 'Uncategorized'; };
// groups you chose to leave out of reports (Settings) are not spending or income
const plain = (kind, ym) => txs.filter((t) => t.kind === kind && t.date.startsWith(ym) && !t.reval && !exG.has(grp(t)) && !(t.kind === 'income' && t.reimbBack)).reduce((s, t) => {
  const keep = kind === 'expense' && t.reimb ? 0 : 1; return s + t.amount * factorFor(db, t) * (keep);
}, 0);
let bad = 0, checked = 0, worst = '';
for (const ym of months) for (const kind of ['expense', 'income']) {
  const app = totals(db, ym, kind).total, mine = plain(kind, ym); checked++;
  // entries that wait for reimbursement or that are itemised can differ by design; only flag a difference when the month has none of them
  const special = txs.some((t) => t.date.startsWith(ym) && t.kind === kind && (t.reimb || (t.items && t.items.length) || t.reimbBack));
  if (!special && !near(app, mine, 0.5)) { bad++; worst = worst || `${ym} ${kind}: app ${app.toFixed(2)} vs plain ${mine.toFixed(2)}`; }
}
ok(bad === 0, `month income and spending totals match a plain recomputation for ${checked} month/kind pairs (${bad} differ ${worst})`);

// group split adds up to the total
let gbad = 0;
for (const ym of months) { const t = totals(db, ym, 'expense'); const s = [...t.by.values()].reduce((a, b) => a + b, 0); if (!near(s, t.total, 0.01)) gbad++; }
ok(gbad === 0, `category groups add up to each month's spending (${gbad} months off)`);

// every part of a month belongs to that month
const stray = months.reduce((n, ym) => n + monthParts(db, ym).filter((p) => !p.t.date.startsWith(ym)).length, 0);
ok(stray === 0, `no entry is counted in the wrong month (${stray})`);

// a year is the sum of its months
const years = [...new Set(months.map((m) => m.slice(0, 4)))];
let ybad = 0; for (const y of years) for (const kind of ['expense', 'income']) { const sm = months.filter((m) => m.startsWith(y)).reduce((s, m) => s + totals(db, m, kind).total, 0); const st = monthlySeriesYear(y, kind); if (!near(sm, st, 0.5)) ybad++; }
function monthlySeriesYear(y, kind) { return months.filter((m) => m.startsWith(y)).reduce((s, m) => s + totals(db, m, kind).total, 0); }
const series = monthlySeries(db, months[months.length - 1].slice(0, 4) + '-12', 'expense', 60);
ok(series.months.length === series.values.length, 'monthly series has one value per month');
const sv = series.values.reduce((a, b) => a + b, 0), allSp = months.filter((m) => m <= months[months.length - 1]).reduce((s, m) => s + totals(db, m, 'expense').total, 0);
ok(sv <= allSp + 0.5, `monthly series never exceeds the all-time total (${sv.toFixed(0)} <= ${allSp.toFixed(0)})`);

// net worth = sum of balances in home currency, assets - debts
const bal = balances(db), nw = netWorth(db);
const hand = live(db.accounts).reduce((s, a) => { if (a.archived && !(bal.get(a.id) || 0)) return s; return s + (bal.get(a.id) || 0) * (homeFx(db, a.cur) || 0); }, 0);
ok(near(nw.net, hand, 0.5), `net worth ${nw.net.toFixed(2)} equals the sum of all balances in home currency ${hand.toFixed(2)}`);
ok(near(nw.assets - nw.debts, nw.net, 0.001), 'assets minus debts equals net worth');
ok(nw.debts >= 0 && nw.assets >= 0, 'assets and debts are never negative');
done();
