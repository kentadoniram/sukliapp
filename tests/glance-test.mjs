import './nodeenv.mjs';
// Quick Glance: each finder on a made-up life where the answer is known, and the picking rules.
import { emptyDb, stamp, HOME, findOrAddCategory } from '../js/core.js';
import { glanceCandidates, pickGlances, cfg, DEFAULTS, kindOf } from '../js/glance.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const TODAY = '2026-11-16', p2 = (n) => String(n).padStart(2, '0');
const ym = (i) => { const d = new Date(Date.UTC(2026, 10 - i, 1)); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}`; };
const iso = (back) => new Date(Date.UTC(2026, 10, 16) - back * 864e5).toISOString().slice(0, 10);
function life(open = 1000000) {
  const db = emptyDb(); db.accounts.push(stamp({ id: 'bank', name: 'Bank', cur: HOME, type: 'bank', open, include: true, archived: false, openDate: '2025-01-01' }));
  const C = (g, n, k = 'expense') => findOrAddCategory(db, g, n, k).id, n = { v: 0 };
  const exp = (date, cat, amount, name = 'x', acct = 'bank') => db.txs.push(stamp({ id: 'e' + n.v++, kind: 'expense', date: date + ' 12:00:00', acct, cat, cur: HOME, fx: 1, amount, name }));
  const inc = (date, cat, amount) => db.txs.push(stamp({ id: 'i' + n.v++, kind: 'income', date: date + ' 09:00:00', acct: 'bank', cat, cur: HOME, fx: 1, amount, name: 'Pay' }));
  const tr = (date, from, to, amount) => db.txs.push(stamp({ id: 't' + n.v++, kind: 'transfer', date: date + ' 10:00:00', acct: from, toAcct: to, cur: HOME, fx: 1, amount, toAmount: amount, name: 'Pay card' }));
  return { db, C, exp, inc, tr };
}
const find = (db, kind) => glanceCandidates(db, TODAY).find((x) => kindOf(x.id) === kind) || null;
ok(glanceCandidates(emptyDb(), TODAY).length === 0, 'an empty file gives nothing to glance at');
// 30-day average: 1,500 a day on 20 of the last 30 days
{ const { db, C, exp } = life(); const f = C('Food', 'Groceries'); for (let b = 0; b < 30; b += 1.5) exp(iso(Math.floor(b)), f, 1500 * 1.5);
  const g = find(db, 'avg30'); ok(!!g && /averaging/.test(g.headline) && g.chart && g.chart.includes('rect'), 'daily average over 30 days with a bar chart'); const m = /₱([\d,]+) a day/.exec(g.headline); ok(m && Math.abs(+m[1].replace(/,/g, '') - 1500) < 40, 'and the average is right (' + (m && m[1]) + ')'); }
// card due soon, with the usual paying day
{ const { db, C, exp, tr } = life(); db.accounts.push(stamp({ id: 'card', name: 'Visa Gold', cur: HOME, type: 'card', open: 0, include: true, archived: false, stmtDay: 5, dueDay: 19 })); const f = C('Food', 'Dining');
  for (const [m, d] of [['2026-06', 17], ['2026-07', 17], ['2026-08', 16], ['2026-09', 17], ['2026-10', 17]]) { exp(`${m}-02`, f, 10000, 'Dinner', 'card'); tr(`${m}-${d}`, 'bank', 'card', 10000); }
  exp('2026-11-02', f, 12000, 'Dinner', 'card');
  const g = find(db, 'card'); ok(!!g && /Visa Gold/.test(g.headline) && /due in 3 days \(Nov 19\)/.test(g.headline), 'card bill: due in 3 days (Nov 19)'); ok(g && /usually pay around the 17th, 2 days before/.test(g.sub), 'and the usual paying day is compared with the due day (' + (g && g.sub) + ')'); }
// negative holding for 10 days
{ const { db } = life(); db.accounts.push(stamp({ id: 'btc', name: 'Binance BTC', cur: 'BTC', type: 'crypto', open: 0, include: false, archived: false, exchange: 'Binance', wallet: 'Spot', invtab: true }));
  db.txs.push(stamp({ id: 'neg1', kind: 'expense', date: iso(10) + ' 10:00:00', acct: 'btc', cat: '', cur: 'BTC', fx: 1, amount: 0.5, name: 'sold' }));
  const g = find(db, 'neg'); ok(!!g && /below zero for 10 days/.test(g.headline) && g.topic === 'invest', 'a holding below zero for 10 days is reported'); }
// net income: last month the lowest of 8
{ const { db, C, exp, inc } = life(); const f = C('Food', 'Groceries'), s = C('Income', 'Salary', 'income'); [8, 7, 6, 5, 4, 3, 2, 1].forEach((i, k) => { inc(`${ym(i)}-01`, s, 100000); exp(`${ym(i)}-05`, f, k === 7 ? 130000 : 60000); });
  const g = find(db, 'net'); ok(!!g && /lowest of the last 8 months/.test(g.headline) && g.tone === 'warn', 'last month net income is the lowest of 8 months'); }
// pace: above the usual line this month
{ const { db, C, exp } = life(); const f = C('Food', 'Groceries'); for (const i of [1, 2, 3]) exp(`${ym(i)}-15`, f, 30000); for (let d = 1; d <= 14; d++) exp(`2026-11-${p2(d)}`, f, 2000);
  const g = find(db, 'pace'); ok(!!g && /above your usual line/.test(g.headline) && g.chart.includes('path'), 'above the usual line, drawn as two lines'); }
{ const { db, C, exp } = life(); const f = C('Food', 'Groceries'); for (const i of [1, 2, 3]) exp(`${ym(i)}-15`, f, 30000); ok(!find(db, 'pace'), 'no pace card when nothing is logged this month yet'); }
// a group up 21%
{ const { db, C, exp } = life(); const d = C('Food', 'Dining'), r = C('Housing', 'Rent'); for (const i of [1, 2, 3]) { exp(`${ym(i)}-03`, d, 10000); exp(`${ym(i)}-02`, r, 20000); } exp('2026-11-03', d, 12100); exp('2026-11-02', r, 20000);
  const g = find(db, 'group'); ok(!!g && /Food is up 21% so far this month/.test(g.headline), 'Food up 21% so far this month'); }
// budget at 85%
{ const { db, C, exp } = life(); const d = C('Food', 'Dining'); db.budgets.push(stamp({ id: 'b1', cat: d, amount: 10000 })); exp('2026-11-03', d, 8500);
  const g = find(db, 'budget'); ok(!!g && /used 85% of its budget with 14 days left/.test(g.headline), 'budget 85% used with 14 days left'); }
// goal
{ const { db, C, exp } = life(); exp('2026-11-03', C('Food', 'Dining'), 100); db.goals.push(stamp({ id: 'g1', name: 'Laptop', target: 100000, start: 0, created: '2026-06-01', log: [{ amt: 62000, date: '2026-06-05' }] }));
  const g = find(db, 'goal'); ok(!!g && /“Laptop” is 62% funded/.test(g.headline), 'goal 62% funded'); }
// picking rules
const mkc = (id, topic, weight = 1, urgency = 0.2) => ({ id, topic, weight, urgency, headline: id });
const c0 = cfg({ settings: {} }); ok(c0.on && c0.freq === 'daily' && c0.charts, 'defaults: on, once a day, with charts');
{ const cs = [mkc('a:1', 'spending'), mkc('b:1', 'bills'), mkc('c:1', 'invest')];
  ok(pickGlances(cs, { ...DEFAULTS }, TODAY, () => 0.5).length === 3, 'every allowed card can be reached with Another one');
  ok(pickGlances(cs, { ...DEFAULTS, topics: { ...DEFAULTS.topics, bills: false } }, TODAY).every((x) => x.topic !== 'bills'), 'a topic switched off is never shown');
  ok(pickGlances(cs, { ...DEFAULTS, mute: { a: true } }, TODAY).every((x) => kindOf(x.id) !== 'a'), 'a kind the person stopped is never shown');
  ok(pickGlances(cs, { ...DEFAULTS, log: { 'b:1': '2026-11-15' } }, TODAY).every((x) => x.id !== 'b:1'), 'something shown yesterday is not shown again so soon');
  ok(pickGlances(cs, { ...DEFAULTS, lastTopic: 'spending' }, TODAY, () => 0)[0].topic !== 'spending', 'the topic of last time is avoided when there is a choice');
  const u = [mkc('x:1', 'spending', 1, 0.1), mkc('y:1', 'bills', 2, 1.2)]; let hits = 0; for (let i = 0; i < 200; i++) if (pickGlances(u, { ...DEFAULTS }, TODAY, () => (i + 0.5) / 200)[0].id === 'y:1') hits++;
  ok(hits > 140, 'urgent things are drawn far more often (' + hits + ' of 200)');
  ok(pickGlances([], { ...DEFAULTS }, TODAY).length === 0, 'nothing to show gives nothing'); }
console.log(bad ? 'FAILED ' + bad : 'all passed'); process.exit(bad ? 1 : 0);
