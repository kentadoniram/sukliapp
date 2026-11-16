import './nodeenv.mjs';
// Forecast models (v15.54): each one on made-up data where the right answer is known.
import { emptyDb, stamp, HOME, findOrAddCategory, thisMonth, shiftMonth, daysInMonth } from '../js/core.js';
import { trend, levelShift, chooseMethod, rangeFor, forecastSeries, METHODS, CHOOSE } from '../js/stats.js';
import { fixedItems, groupSplit, forecastNext, predictFee, calendarEffects, safeToSpend, accuracy, nextLog, monthlySeries } from '../js/finance.js';
import { pace, paceProfile } from '../js/insights.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const p2 = (n) => String(n).padStart(2, '0');
const ym0 = thisMonth(), today = new Date().toISOString().slice(0, 10);
function life(open = 0) {
  const db = emptyDb(); db.accounts.push(stamp({ id: 'bank', name: 'Bank', cur: HOME, type: 'bank', open, include: true, archived: false, openDate: '2020-01-01' }));
  const n = { v: 0 }, C = (g, nm, k = 'expense') => findOrAddCategory(db, g, nm, k).id;
  const exp = (date, cat, amount, name = 'x') => db.txs.push(stamp({ id: 'e' + n.v++, kind: 'expense', date: date + ' 12:00:00', acct: 'bank', cat, cur: HOME, fx: 1, amount, name }));
  const inc = (date, cat, amount) => db.txs.push(stamp({ id: 'i' + n.v++, kind: 'income', date: date + ' 09:00:00', acct: 'bank', cat, cur: HOME, fx: 1, amount, name: 'Pay' }));
  return { db, C, exp, inc, n };
}
// ---- trend: Theil-Sen + Mann-Kendall
{ const t = trend([10, 20, 30, 40, 50, 60, 70, 80]); ok(t.conf === 'high' && t.dir === 'up' && Math.abs(t.slope - 10) < 1e-9, 'trend: a clean rise is high confidence, slope 10');
  const f = trend([100, 100, 100, 900, 100, 100, 100, 100]); ok(f.conf === 'low' && Math.abs(f.slope) < 1, 'trend: one huge month does not make a trend');
  ok(trend([1, 2, 3]).conf === 'none', 'trend: under 4 months says none'); }
// ---- level shift
{ const s = levelShift([50, 52, 48, 51, 49, 150, 148, 152, 149, 151]); ok(s && s.at === 5 && s.to > 140 && s.from < 55, 'level shift: found at month 5, 50 to 150');
  ok(levelShift([50, 52, 48, 51, 49, 53, 47, 50, 52, 51]) === null, 'level shift: a steady series has none');
  ok(levelShift([50, 52, 48, 51, 49, 53, 400, 50, 52, 51]) === null, 'level shift: one spike is not a shift');
  ok(levelShift([50, 52, 48, 51, 49, 150, 148]) === null, 'level shift: only 2 months at the new level is not enough yet');
  const fc = forecastSeries([50, 52, 48, 51, 49, 150, 148, 152, 149, 151]); ok(fc.usedFrom === 5 && fc.value > 140 && fc.value < 160, 'forecast restarts after the shift: ' + Math.round(fc.value)); }
// ---- safer choice
{ const flat = [100, 104, 97, 103, 99, 101, 98, 102, 100, 103, 99, 101]; const c = chooseMethod(flat); ok(c.name === CHOOSE.fallback || (c.tests >= CHOOSE.minTests && c.best.mae <= CHOOSE.margin * c.base.mae), 'choice: another method is used only when it passes both tests (' + c.name + ')');
  const twin = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100]; ok(chooseMethod(twin).name === CHOOSE.fallback, 'choice: when methods tie, the median stays');
  const ramp = Array.from({ length: 16 }, (_, i) => 100 + 25 * i); const r = chooseMethod(ramp); ok(r.name === 'trend' && r.tests >= 6, 'choice: a clear ramp with 6+ tests uses the trend (' + r.name + ' / ' + r.tests + ' tests)');
  const few = Array.from({ length: 9 }, (_, i) => 100 + 25 * i); const fw = chooseMethod(few); ok(fw.name === CHOOSE.fallback && /tests/.test(fw.why), 'choice: under 6 tests keeps the median: ' + fw.why);
  ok(chooseMethod([100, 120]).name === CHOOSE.fallback, 'choice: 2 months, median'); }
// ---- honest range
{ const s = [100, 120, 90, 110, 95, 130, 105, 115, 100, 125, 98, 112], v = METHODS.median3.f(s), g = rangeFor(s, METHODS.median3.f, v);
  ok(g.basis === 'tested' && g.low < v && g.high > v && g.high / v >= 1.14 && g.widen > 1, `range: tested, ${Math.round(g.low)} to ${Math.round(g.high)} around ${Math.round(v)}`);
  const d = rangeFor([100, 110, 90, 105, 100], METHODS.median3.f, 100); ok(d.basis === 'default' && Math.abs(d.low - 60) < 1e-9 && Math.abs(d.high - 140) < 1e-9, 'range: under 4 tests is a plain 40% either way');
  const wide = rangeFor([100, 400, 90, 500, 95, 450, 105, 480, 100, 420], METHODS.median3.f, 100); ok(wide.high - 100 > g.high - v, 'range: a noisier history gives a wider range'); }
// ---- fixed + variable, shrinkage, forecast
{ const { db, C, exp, inc } = life(), f = C('Food', 'Groceries'), r = C('Home', 'Rent'), t = C('Travel', 'Trip');
  for (let i = 8; i >= 1; i--) { const m = shiftMonth(ym0, -i); exp(`${m}-02`, r, 10000, 'Rent'); exp(`${m}-10`, f, 3000 + (i % 4) * 4500, 'Shop'); exp(`${m}-12`, f, 2000, 'Shop'); exp(`${m}-20`, f, 500 + (i % 5) * 600, 'Lunch'); if (i === 2) exp(`${m}-15`, t, 30000, 'Trip'); inc(`${m}-27`, C('Work', 'Salary', 'income'), 60000); }
  const fx = fixedItems(db, ym0); ok(fx.items.length === 1 && fx.items[0].name === 'Rent' && fx.items[0].v === 10000, 'fixed: only the rent is fixed, value = median of the monthly sums');
  const gs = groupSplit(db, ym0), tr = gs.rows.find((x) => x.g === 'Travel'); ok(tr && tr.seen === 1 && tr.est < tr.recent + 1 && tr.est < tr.long * 2, 'shrinkage: a group seen once is pulled toward its 6-month average');
  const fn = forecastNext(db, ym0); ok(fn.total > 15000 && fn.total < 45000 && fn.fixedAll.length === 1 && fn.low != null && fn.high > fn.low, 'forecast total is sensible: ' + Math.round(fn.total));
  ok(Math.abs([...fn.by.values()].reduce((a, b) => a + b, 0) - fn.total) < 1, 'groups add up to the total');
  const fvOk = METHODS.fixvar.f(fx.values, fx.history); ok(fvOk > 15000 && fvOk < 45000, 'fixed+variable method gives ' + Math.round(fvOk));
  ok(accuracy(db, ym0).replay.length >= 1, 'accuracy: replay has rows');
  const nl = nextLog(db, ym0); ok(nl && nl[shiftMonth(ym0, 1)] && nl[shiftMonth(ym0, 1)].value > 0, 'accuracy log: next month recorded');
  db.settings.forecastLog = { [shiftMonth(ym0, -1)]: { made: today, value: 20000, low: 15000, high: 25000, method: 'median3' } }; const ac = accuracy(db, ym0); ok(ac.real.length === 1 && ac.realSum && ac.realSum.n === 1, 'accuracy: a recorded forecast is compared with the month that happened'); }
// ---- partial first month
{ const { db, C, exp } = life(), f = C('Food', 'Groceries'); for (let i = 6; i >= 1; i--) { const m = shiftMonth(ym0, -i); exp(`${m}-${i === 6 ? '25' : '03'}`, f, i === 6 ? 500 : 5000, 'x'); }
  ok(monthlySeries(db, ym0, 'expense', 36, true).months.length === 5 && monthlySeries(db, ym0).months.length === 6, 'a first month that began after the 7th is left out of the forecast only'); }
// ---- pace by monthly pattern
{ const { db, C, exp } = life(), f = C('Food', 'Groceries'), day = +today.slice(8, 10);
  for (let i = 4; i >= 1; i--) { const m = shiftMonth(ym0, -i); for (let d = 1; d <= daysInMonth(m); d++) exp(`${m}-${p2(d)}`, f, d === 1 ? 6000 : 100, 'x'); }
  for (let d = 1; d <= day; d++) exp(`${ym0}-${p2(d)}`, f, d === 1 ? 6000 : 100, 'x');
  const p = pace(db, ym0), want = 6000 + 100 * (daysInMonth(ym0) - 1);
  if (day >= 3) { ok(p.method === 'monthly pattern' && Math.abs(p.projected - want) / want < 0.04, `pace: front-loaded month projects ${Math.round(p.projected)} (true ${want}), straight line would say ${Math.round(p.projectedLinear)}`); ok(p.low <= p.projected && p.high >= p.projected && p.chanceOverUsual != null, 'pace: has a range and a chance above usual'); }
  ok(paceProfile(db, ym0, 10).n === 4, 'pace profile uses the 4 earlier months'); }
// ---- fee model
{ const { db } = life(); db.accounts.push(stamp({ id: 'b2', name: 'B2', cur: HOME, type: 'bank', include: true, openDate: '2020-01-01' }), stamp({ id: 'b3', name: 'B3', cur: HOME, type: 'bank', include: true, openDate: '2020-01-01' }), stamp({ id: 'b4', name: 'B4', cur: HOME, type: 'bank', include: true, openDate: '2020-01-01' }));
  const tx = (to, i, amount, fee) => db.txs.push(stamp({ id: 'f' + to + i, kind: 'transfer', date: `2026-0${1 + (i % 9)}-1${i % 9} 10:00:00`, acct: 'bank', toAcct: to, cur: HOME, fx: 1, amount, toAmount: amount, fee, feeCat: 'x', feeBy: 'from', name: 'move' }));
  [1000, 5000, 2500, 8000, 300, 4000].forEach((a, i) => tx('b2', i, a, 50)); [1000, 5000, 2500, 8000, 300, 4000].forEach((a, i) => tx('b3', i, a, a * 0.01)); [100, 5000, 2500, 8000, 300, 4000, 1500, 700].forEach((a, i) => tx('b4', i, a, Math.max(15, a * 0.01)));
  const a = predictFee(db, 'bank', 'b2', 9000), b = predictFee(db, 'bank', 'b3', 10000), c = predictFee(db, 'bank', 'b4', 200);
  ok(a.model === 'flat' && a.fee === 50, 'fee: a flat fee is found (' + a.model + ' ' + a.fee + ')'); ok(b.model === 'percent' && Math.abs(b.fee - 100) < 0.5, 'fee: a percent fee is found (' + b.model + ' ' + b.fee + ')'); ok(c.model === 'minpct' && c.fee === 15, 'fee: a minimum plus percent fee is found (' + c.model + ' ' + c.fee + ')'); }
// ---- safe to spend
{ const { db } = life(30000); const s = safeToSpend(db, `${ym0}-10`); ok(s.have === 30000 && s.days >= 1 && Math.abs(s.perDay - 30000 / s.days) < 1e-6 && s.bills.length === 0, 'safe to spend: cash over the days to the end of the month (' + s.days + ' days)'); }
// ---- calendar effects
{ const { db, C, exp } = life(), f = C('Food', 'Groceries'); for (let i = 30; i >= 1; i--) { const m = shiftMonth(ym0, -i), mm = +m.slice(5); exp(`${m}-10`, f, mm === 12 ? 15000 : 10000, 'x'); }
  const ce = calendarEffects(db, ym0); ok(ce.active && ce.idx[12] && ce.idx[12].index > 1.15 && ce.idx[12].index <= 1.3 && ce.idx[6].index < 1.05, 'calendar: December index ' + (ce.idx[12] && ce.idx[12].index.toFixed(2)) + ' once there are 24+ months');
  const short = life(); short.exp(`${shiftMonth(ym0, -2)}-05`, short.C('A', 'B'), 10, 'x'); ok(calendarEffects(short.db, ym0).active === false, 'calendar: off with under 24 months'); }
console.log(bad ? `${bad} FAILED` : 'all ok'); process.exit(bad ? 1 : 0);
