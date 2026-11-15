import './nodeenv.mjs';
// Worth Knowing engine: every finder on a made-up life where the answer is known, quiet when there is nothing to say, and the history rules.
import { emptyDb, stamp, HOME, findOrAddCategory } from '../js/core.js';
import { worthCandidates, chooseWorth, noteShown, dismiss, worthInsights } from '../js/worth.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const TODAY = '2026-11-16';
const p2 = (n) => String(n).padStart(2, '0'), ym = (i) => { const d = new Date(Date.UTC(2026, 10 - i, 1)); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}`; };   // i months before November
function life(open = 0) {
  const db = emptyDb(); db.accounts.push(stamp({ id: 'bank', name: 'Bank', cur: HOME, type: 'bank', open, include: true, archived: false, openDate: '2025-01-01' }));
  const C = (g, n, k = 'expense') => findOrAddCategory(db, g, n, k).id, n = { v: 0 };
  const exp = (date, cat, amount, name = 'x') => db.txs.push(stamp({ id: 'e' + n.v++, kind: 'expense', date: date + ' 12:00:00', acct: 'bank', cat, cur: HOME, fx: 1, amount, name }));
  const inc = (date, cat, amount) => db.txs.push(stamp({ id: 'i' + n.v++, kind: 'income', date: date + ' 09:00:00', acct: 'bank', cat, cur: HOME, fx: 1, amount, name: 'Pay' }));
  return { db, C, exp, inc };
}
const get = (db, key) => (worthCandidates(db, TODAY).items.find((i) => i.key === key) || null);
const MONTHS = [6, 5, 4, 3, 2, 1];   // Nov minus these = May to October, the whole months before today

// no data, and too little data
{ const { db } = life(); const r = worthCandidates(db, TODAY); ok(!r.enough && r.items.length === 0, 'an empty file gives nothing and says it needs history'); }
{ const { db, C, exp, inc } = life(); for (let d = 1; d <= 20; d++) exp(`2026-10-${p2(d)}`, C('Food', 'Groceries'), 500); inc('2026-10-25', C('Income', 'Salary', 'income'), 100000);
  ok(!worthCandidates(db, TODAY).enough, 'one month of entries is not enough: nothing is guessed'); }

// 1 small weekday purchases beat whole weekends
{ const { db, C, exp } = life(); const cafe = C('Food', 'Coffee'), out = C('Entertainment', 'Outing');
  for (let d = 0; d < 150; d++) { const dt = new Date(Date.UTC(2026, 10, 15) - d * 864e5), s = dt.toISOString().slice(0, 10), w = dt.getUTCDay(); if (w === 6) exp(s, out, 1200, 'Mall'); else if (w >= 1 && w <= 5) { exp(s, cafe, 300, 'Cafe Aoi'); exp(s, cafe, 300, 'Cafe Aoi'); } }
  const it = get(db, 'smallweekday'); ok(!!it && /more than your weekends/.test(it.title) && it.evidence.join(' ').includes('Cafe Aoi'), 'small weekday purchases found, and the merchant behind them named'); ok(it && it.kind === 'fact' && it.matters && it.action && it.evidence.length >= 2, 'it carries evidence, why it matters and something to do, and is marked as counted'); }

// 2 spending down but the mix moved
{ const { db, C, exp } = life(); const rent = C('Housing', 'Rent'), fun = C('Entertainment', 'Hobby');
  for (const i of [4, 3, 2]) { exp(`${ym(i)}-02`, rent, 50000); exp(`${ym(i)}-10`, fun, 20000); } exp(`${ym(5)}-02`, rent, 50000); exp(`${ym(5)}-10`, fun, 20000);
  exp(`${ym(1)}-02`, rent, 30000); exp(`${ym(1)}-10`, fun, 26000);
  const it = get(db, 'mixshift'); ok(!!it && /less overall/.test(it.title) && /essentials/.test(it.title), 'less overall but more discretionary: the saving came from essentials'); }

// 3 how long the cash lasts: 300,000 held, 100,000 a month, income equal to spending
{ const { db, C, exp, inc } = life(300000); const f = C('Food', 'Groceries'), s = C('Income', 'Salary', 'income');
  for (const i of MONTHS) { exp(`${ym(i)}-05`, f, 100000); inc(`${ym(i)}-01`, s, 100000); }
  const it = get(db, 'resilience'); ok(!!it && /about 3\.0 months/.test(it.title) && it.kind === 'estimate', 'cash cover is 3.0 months and is labelled an estimate'); }

// 4 income rose, the share kept did not
{ const { db, C, exp, inc } = life(); const f = C('Food', 'Groceries'), s = C('Income', 'Salary', 'income');
  MONTHS.forEach((i, k) => { inc(`${ym(i)}-01`, s, k < 3 ? 100000 : 115000); exp(`${ym(i)}-05`, f, k < 3 ? 80000 : 95000); });
  const it = get(db, 'savingsrate'); ok(!!it && /income rose 15%/.test(it.title) && /20%/.test(it.title), 'income up 15%, share kept 20% before and about 17% now'); }
{ const { db, C, exp, inc } = life(); const f = C('Food', 'Groceries'), s = C('Income', 'Salary', 'income');
  MONTHS.forEach((i, k) => { inc(`${ym(i)}-01`, s, 100000); exp(`${ym(i)}-05`, f, k < 3 ? 90000 : 78000); });
  ok(/keep 22%/.test((get(db, 'savingsrate') || {}).title || ''), 'flat income and lower spending: the better share is credited to spending'); }

// 5 a cut brings a goal closer
{ const { db, C, exp } = life(); const fun = C('Entertainment', 'Hobby'), f = C('Food', 'Groceries');
  for (const i of MONTHS) { exp(`${ym(i)}-05`, fun, 20000); exp(`${ym(i)}-06`, f, 30000); }
  db.goals.push(stamp({ id: 'g1', name: 'New laptop', target: 600000, start: 0, created: '2026-06-01', log: [{ amt: 100000, date: '2026-06-02' }] }));
  const it = get(db, 'goalcost'); ok(!!it && /Entertainment/.test(it.title) && /“New laptop”/.test(it.title) && it.kind === 'projection', 'trimming the biggest flexible group moves the goal, labelled a projection'); }

// 6 a regular payment crept up
{ const { db, C, exp } = life(); const sub = C('Bills', 'Subscriptions'), gym = C('Health', 'Gym'), ph = C('Bills', 'Phone');
  MONTHS.concat([0]).forEach((i, k) => { if (i === 0) return; exp(`${ym(i)}-05`, sub, k < 4 ? 1000 : 1200, 'Streamly'); exp(`${ym(i)}-12`, gym, 8000, 'City Gym'); exp(`${ym(i)}-20`, ph, 3000, 'MobileCo'); });
  exp(`${ym(7)}-05`, sub, 1000, 'Streamly'); exp(`${ym(8)}-05`, sub, 1000, 'Streamly'); exp(`${ym(7)}-12`, gym, 8000, 'City Gym'); exp(`${ym(7)}-20`, ph, 3000, 'MobileCo');
  const it = get(db, 'committed'); ok(!!it && /Streamly/.test(it.title) && /1,200/.test(it.title) && /1,000/.test(it.title), 'a subscription that went from 1,000 to 1,200 is called out'); }

// 7 a group that moved and stayed (not a one-off)
{ const { db, C, exp } = life(); const fun = C('Entertainment', 'Hobby'), f = C('Food', 'Groceries');
  MONTHS.forEach((i, k) => { exp(`${ym(i)}-05`, fun, [20000, 21000, 19000, 30000, 31000, 32000][k]); exp(`${ym(i)}-06`, f, 60000); });
  const it = get(db, 'levelshift'); ok(!!it && /Entertainment/.test(it.title) && /higher level/.test(it.title), 'a persistent rise is called a new level');
  const one = life(); const f1 = one.C('Food', 'Groceries'), e1 = one.C('Entertainment', 'Hobby'); MONTHS.forEach((i, k) => { one.exp(`${ym(i)}-05`, e1, k === 5 ? 45000 : 20000); one.exp(`${ym(i)}-06`, f1, 60000); });
  ok(!get(one.db, 'levelshift'), 'a single high month is not called a new level'); }

// 8 more visits, not bigger tickets
{ const { db, C, exp } = life(); const dn = C('Food', 'Dining'), r = C('Housing', 'Rent');
  MONTHS.forEach((i, k) => { for (let d = 1; d <= (k < 3 ? 5 : 10); d++) exp(`${ym(i)}-${p2(d * 2)}`, dn, 1000); exp(`${ym(i)}-01`, r, 60000); });
  const it = get(db, 'visits'); ok(!!it && /Food/.test(it.title) && /more days with a purchase/.test(it.title), 'more days with a purchase, same price each, is found'); }

// 9 a few big choices carry the quarter
{ const { db, C, exp } = life(); const fun = C('Entertainment', 'Hobby'), f = C('Food', 'Groceries');
  MONTHS.forEach((i) => { exp(`${ym(i)}-03`, f, 40000); for (let d = 1; d <= 25; d++) exp(`${ym(i)}-${p2(d + 3)}`, fun, 500); });
  for (const d of ['2026-09-10', '2026-10-05', '2026-08-20', '2026-10-20']) exp(d, fun, 40000, 'Camera');
  const it = get(db, 'bigfew'); ok(!!it && /purchases out of/.test(it.title), 'four big discretionary purchases carrying 40% are found'); }

// 10 the week after payday
{ const { db, C, exp, inc } = life(); const fun = C('Entertainment', 'Hobby'), s = C('Income', 'Salary', 'income');
  for (const i of [7].concat(MONTHS)) { inc(`${ym(i)}-25`, s, 100000); }
  for (const i of MONTHS) { const m = new Date(Date.UTC(2026, 10 - i - 1, 25)); for (let d = 0; d < 6; d++) exp(new Date(m.getTime() + d * 864e5).toISOString().slice(0, 10), fun, 5000); for (let d = 12; d < 14; d++) exp(`${ym(i)}-${d}`, fun, 1500); }
  const it = get(db, 'payday'); ok(!!it && /7 days after your main pay/.test(it.title), 'most discretionary spending right after payday is found'); }

// 11 income swings
{ const { db, C, exp, inc } = life(); const s = C('Income', 'Salary', 'income'), f = C('Food', 'Groceries');
  MONTHS.forEach((i, k) => { inc(`${ym(i)}-01`, s, [40000, 100000, 30000, 120000, 50000, 90000][k]); exp(`${ym(i)}-05`, f, 60000); });
  const it = get(db, 'incomeswing'); ok(!!it && /30,000/.test(it.title), 'uneven income: the weakest month is named'); }

// quiet life: steady income and spending says nothing about habits
{ const { db, C, exp, inc } = life(500000); const s = C('Income', 'Salary', 'income'), f = C('Food', 'Groceries'), r = C('Housing', 'Rent');
  for (const i of MONTHS) { inc(`${ym(i)}-01`, s, 200000); exp(`${ym(i)}-03`, r, 60000); exp(`${ym(i)}-10`, f, 30000); }
  const keys = worthCandidates(db, TODAY).items.map((i) => i.key); ok(!keys.some((k) => ['levelshift', 'visits', 'mixshift', 'savingsrate', 'incomeswing', 'smallweekday', 'bigfew', 'payday'].includes(k)), 'a steady life produces no pattern claims (' + keys.join(',') + ')'); }

// history and ranking
const mkc = (key, sig, impact, o = {}) => ({ key, sig, topic: o.topic || key, impact, rel: 0.8, conf: 0.8, title: sig, ...o });
{ const c = [mkc('a', 'a1', 0.5), mkc('b', 'b1', 0.9), mkc('c', 'c1', 0.7)];
  ok(chooseWorth(c, {}, TODAY).map((x) => x.sig).join() === 'b1,c1,a1', 'higher impact first');
  const log = {}; noteShown(log, [c[1]], '2026-11-10'); ok(!chooseWorth(c, log, TODAY).some((x) => x.sig === 'b1'), 'the same family is not repeated within 3 weeks');
  ok(chooseWorth(c, log, '2026-12-10').some((x) => x.sig === 'b1'), 'and may come back after the pause');
  const log2 = {}; noteShown(log2, [c[1]], TODAY); ok(chooseWorth(c, log2, TODAY).some((x) => x.sig === 'b1'), 'what was shown today stays visible all day');
  const log3 = {}; dismiss(log3, 'b1', TODAY); ok(!chooseWorth(c, log3, '2027-03-01').some((x) => x.sig === 'b1'), 'a dismissed insight stays gone');
  ok(chooseWorth([mkc('a', 'a2', 0.5)], log3, TODAY).length === 1, 'a different version of the same family is a new insight');
  const many = [mkc('a', 'a', 0.9, { topic: 't' }), mkc('b', 'b', 0.8, { topic: 't' }), mkc('c', 'c', 0.7, { topic: 't' }), mkc('d', 'd', 0.6, { topic: 'u' })];
  ok(chooseWorth(many, {}, TODAY).map((x) => x.sig).join() === 'a,b,d', 'no more than two insights on the same topic'); 
  const g = [mkc('a', 'a', 0.9, { grp: 'Food' }), mkc('b', 'b', 0.8, { grp: 'Food' }), mkc('c', 'c', 0.5)]; ok(chooseWorth(g, {}, TODAY).map((x) => x.sig).join() === 'a,c', 'one insight per spending group');
  const lg = {}; ok(noteShown(lg, [c[0]], TODAY) === true && noteShown(lg, [c[0]], TODAY) === false, 'recording what was shown changes nothing the second time that day'); }
{ const { db, C, exp, inc } = life(300000); const f = C('Food', 'Groceries'), s = C('Income', 'Salary', 'income'); for (const i of MONTHS) { exp(`${ym(i)}-05`, f, 100000); inc(`${ym(i)}-01`, s, 100000); }
  const a = worthInsights(db, TODAY); db.settings.worthLog = {}; noteShown(db.settings.worthLog, a.items, TODAY);
  const b = worthInsights(db, TODAY); ok(a.items.map((x) => x.sig).join() === b.items.map((x) => x.sig).join(), 'after being recorded as shown, the same items are still shown that day');
  ok(worthInsights(db, '2026-11-20').items.every((x) => x.key !== 'resilience'), 'and are not shown again four days later'); }
console.log(bad ? 'FAILED ' + bad : 'all passed'); process.exit(bad ? 1 : 0);
