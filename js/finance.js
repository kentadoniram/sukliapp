// Money logic added in v5: account history, net worth, automatic interest, credit cards,
// transfer-fee prediction, next-month forecast and behaviour notes. Pure maths, nothing leaves the device.
import {
  BASE, CUR, accountMap, balances, catMap, deltaFor, feeOf, findOrAddCategory, live, monthParts,
  nowStamp, rateFor, shiftMonth, stamp, thisMonth, daysInMonth, fmt,
} from './core.js';
import { totals, baselineMonths } from './insights.js';

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const today = () => nowStamp().slice(0, 10);
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
const sum = (a) => a.reduce((s, x) => s + x, 0);

export const ASSET_TYPES = new Set(['cash', 'bank', 'ewallet', 'invest', 'crypto', 'other', 'asset']);
export const isLiability = (a) => a.type === 'card' || a.type === 'loan';

// ---------- one account's story ----------
// newest first, each row with the change to this account and the balance right after it
export function accountHistory(db, id) {
  const a = db.accounts.find((x) => x.id === id);
  const rows = live(db.txs).filter((t) => t.acct === id || t.toAcct === id && t.kind === 'transfer')
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : (x.updatedAt || 0) - (y.updatedAt || 0)));
  let bal = a ? a.open || 0 : 0;
  const out = rows.map((t) => { const d = deltaFor(t, id); bal += d; return { t, d, bal }; });
  return out.reverse();
}

// ---------- net worth ----------
export function netWorth(db) {
  const bal = balances(db), items = [];
  let assets = 0, debts = 0, missing = 0;  // assets and debts are totalled below, after every account is in
  for (const a of live(db.accounts)) {
    if (a.archived && !(bal.get(a.id) || 0)) continue;
    const r = rateFor(db, a.cur), v = bal.get(a.id) || 0;
    if (!r && v) missing++;
    const base = v * (r || 0);
    items.push({ a, v, base, liab: isLiability(a) || base < 0 });
  }
  debts = Math.abs(sum(items.filter((i) => i.liab && i.base < 0).map((i) => i.base)));
  assets = sum(items.filter((i) => i.base > 0).map((i) => i.base));
  return { items, assets, debts, net: assets - debts, missing };
}

// ---------- automatic interest ----------
// Accounts with a yearly rate (a.apy, in %) get one income entry per day, compounding on that day's balance.
// Ids are fixed per account and day, so two devices never double-post.
export function postInterest(db, upTo = today()) {
  const made = [];
  const cats = live(db.categories);
  for (const a of live(db.accounts)) {
    if (!(a.apy > 0) || a.archived) continue;
    const dec = (CUR[a.cur] || { dec: 2 }).dec;
    const places = a.type === 'crypto' ? Math.max(dec, 6) : dec;
    let from = a.interestFrom || upTo;
    const lastAuto = live(db.txs).filter((t) => t.auto && t.acct === a.id).reduce((m, t) => (t.date.slice(0, 10) > m ? t.date.slice(0, 10) : m), '');
    if (lastAuto) from = addDays(lastAuto, 1);
    if (from > upTo) continue;
    // never back-fill more than 400 days in one go
    if (from < addDays(upTo, -400)) from = addDays(upTo, -400);
    const catName = a.type === 'crypto' ? 'Crypto earned' : 'Interest';
    let cat = cats.find((c) => c.group === 'Earn' && c.name === catName);
    for (let d = from; d <= upTo; d = addDays(d, 1)) {
      const id = `int-${a.id}-${d}`;
      if (db.txs.some((t) => t.id === id)) continue;
      const stop = d + ' 23:59:59';
      const b = balances(db, stop).get(a.id) || 0;
      if (b <= 0) continue;
      const amt = +(b * a.apy / 100 / 365).toFixed(places);
      if (!(amt > 0)) continue;
      if (!cat) cat = findOrAddCategory(db, 'Earn', catName, 'income');
      const t = stamp({ id, kind: 'income', date: d + ' 23:59:59', acct: a.id, cur: a.cur, amount: amt, fx: rateFor(db, a.cur) || 1, cat: cat.id, name: catName, auto: true });
      db.txs.push(t); made.push(t);
    }
  }
  return made;
}

// ---------- credit cards ----------
// a.limit (credit limit), a.dueDay (1-31), a.stmtDay (statement closes)
export function cardInfo(db, a, bal) {
  const owed = Math.max(0, -(bal != null ? bal : (balances(db).get(a.id) || 0)));
  const limit = a.limit > 0 ? a.limit : 0;
  const used = limit ? Math.min(100, Math.round(owed / limit * 100)) : null;
  const t0 = today(), [y, m] = t0.split('-').map(Number);
  const mk = (yy, mm, day) => `${yy}-${p2(mm)}-${p2(Math.min(day, new Date(yy, mm, 0).getDate()))}`;
  const gap = (x, z) => Math.round((new Date(x) - new Date(z)) / 864e5);
  let due = null, days = null, cycle = null;
  if (a.stmtDay > 0 && a.dueDay > 0) {
    // billing cycle: the latest statement on or before today, and the due date that follows it
    let st = mk(y, m, a.stmtDay);
    if (st > t0) { const p = new Date(y, m - 2, 1); st = mk(p.getFullYear(), p.getMonth() + 1, a.stmtDay); }
    const [sy, sm] = st.split('-').map(Number);
    let dd = mk(sy, sm, a.dueDay);
    if (dd <= st) { const n = new Date(sy, sm, 1); dd = mk(n.getFullYear(), n.getMonth() + 1, a.dueDay); }
    const stmtBal = Math.max(0, -((balances(db, st + ' 23:59:59').get(a.id)) || 0));
    // money that came into the card after the statement (payments, partial payments, refunds) reduces what is still due
    const paid = accountHistory(db, a.id).filter((h) => h.d > 0 && h.t.date > st + ' 23:59:59').reduce((n, h) => n + h.d, 0);
    const amountDue = Math.max(0, Math.round((stmtBal - paid) * 100) / 100);
    const toDue = gap(dd, t0);
    cycle = { stmtDate: st, dueDate: dd, stmtBal, paid: Math.min(paid, stmtBal), amountDue, days: toDue, overdue: toDue < 0 && amountDue > 0 };
    due = dd; days = toDue;
  } else if (a.dueDay > 0) {
    due = mk(y, m, a.dueDay);
    if (due < t0) { const n = new Date(y, m, 1); due = mk(n.getFullYear(), n.getMonth() + 1, a.dueDay); }
    days = gap(due, t0);
  }
  return { owed, limit, avail: limit ? limit - owed : null, used, due, days, cycle };
}

// cards to remind about: payment still unpaid and due within `window` days (or overdue), or 80%+ of the limit used.
// Once the statement amount is paid in full the reminder disappears by itself; a partial payment keeps it with the rest.
export function cardReminders(db, window = 3) {
  const bal = balances(db), out = [];
  for (const a of live(db.accounts)) {
    if (a.type !== 'card' || a.archived) continue;
    const c = cardInfo(db, a, bal.get(a.id));
    const need = c.cycle ? c.cycle.amountDue > 0 : c.owed > 0;
    if (c.due && need && c.days <= window) out.push({ a, ...c });
    else if (c.used != null && c.used >= 80) out.push({ a, ...c, high: true });
  }
  return out.sort((x, y) => (x.days ?? 99) - (y.days ?? 99));
}

// an .ics file with a yearly-repeating monthly reminder for each card due date
export function cardIcs(db) {
  const rows = [];
  const stampNow = nowStamp().replace(/[-: ]/g, '').replace(/^(\d{8})(\d{6})$/, '$1T$2');
  for (const a of live(db.accounts)) {
    if (a.type !== 'card' || !(a.dueDay > 0) || a.archived) continue;
    const c = cardInfo(db, a);
    const d0 = (c.due || today()).replace(/-/g, '');
    rows.push('BEGIN:VEVENT', `UID:sukli-card-${a.id}@sukli`, `DTSTAMP:${stampNow}`, `DTSTART;VALUE=DATE:${d0}`,
      `RRULE:FREQ=MONTHLY;BYMONTHDAY=${a.dueDay}`, `SUMMARY:Pay credit card: ${String(a.name).replace(/[,;\n]/g, ' ')}`,
      'BEGIN:VALARM', 'TRIGGER:-P3D', 'ACTION:DISPLAY', 'DESCRIPTION:Credit card payment due in 3 days', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-P2D', 'ACTION:DISPLAY', 'DESCRIPTION:Credit card payment due in 2 days', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Credit card payment due tomorrow', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-P0D', 'ACTION:DISPLAY', 'DESCRIPTION:Credit card payment due today', 'END:VALARM', 'END:VEVENT');
  }
  if (!rows.length) return '';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sukli//EN', ...rows, 'END:VCALENDAR'].join('\r\n');
}

// ---------- transfer fees ----------
// Look at earlier transfers between the same two accounts (else from the same account) and suggest the usual fee.
export function predictFee(db, from, to, amount) {
  const past = live(db.txs).filter((t) => t.kind === 'transfer' && t.fee > 0 && t.feeCat);
  const pick = (arr) => {
    if (!arr.length) return null;
    const recent = arr.sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 8);
    const vals = recent.map((t) => t.fee), first = vals[0];
    const same = vals.filter((v) => Math.abs(v - first) < 1e-9).length;
    let fee = first;
    if (same < 2 && recent.length >= 3) {          // not a flat fee: try a share of the amount
      const rs = recent.map((t) => t.fee / t.amount).sort((x, y) => x - y), med = rs[Math.floor(rs.length / 2)];
      if (amount > 0) fee = +(amount * med).toFixed(2);
    }
    return { fee, feeCat: recent[0].feeCat, feeBy: recent[0].feeBy || 'from', n: arr.length };
  };
  return pick(past.filter((t) => t.acct === from && t.toAcct === to)) || pick(past.filter((t) => t.acct === from)) || null;
}

// ---------- forecast ----------
// Next month by group: average of up to 3 recent complete months, nudged by the recent direction.
export function forecastNext(db, ym = thisMonth()) {
  const next = shiftMonth(ym, 1);
  const past = [];
  for (let i = 1; i <= 12 && past.length < 3; i++) { const m = shiftMonth(ym, -i); if (totals(db, m).total > 0) past.push(m); }
  const live0 = totals(db, ym);
  const usedMonths = past.length ? past : [];
  const by = new Map();
  for (const m of usedMonths) for (const [g, v] of totals(db, m).by) by.set(g, (by.get(g) || 0) + v / usedMonths.length);
  const total = sum([...by.values()]);
  const incomeAvg = usedMonths.length ? sum(usedMonths.map((m) => totals(db, m, 'income').total)) / usedMonths.length : 0;
  const fixed = []; // repeated names in each of the base months (rent, subscriptions…)
  if (usedMonths.length >= 2) {
    const sets = usedMonths.map((m) => new Map(monthParts(db, m).filter((p) => p.kind === 'expense' && p.t.name).map((p) => [p.t.name.trim().toLowerCase(), p])));
    for (const [k, p] of sets[0]) if (sets.every((s) => s.has(k))) fixed.push({ name: p.t.name, v: sum(sets.map((s) => s.get(k).v)) / sets.length });
  }
  return { next, months: usedMonths, total, by, incomeAvg, fixed: fixed.sort((a, b) => b.v - a.v).slice(0, 5), thisSoFar: live0.total };
}

// ---------- behaviour notes: warnings, tips and a bit of praise ----------
export function behaviorNotes(db, ym = thisMonth()) {
  const out = [], money = (n) => fmt(n, BASE, { round: true });
  const f = forecastNext(db, ym);
  if (!f.months.length) return [{ tone: 'note', text: 'Add a month or two of entries and Sukli will start forecasting.' }];
  const [last, ...older] = [shiftMonth(ym, -1), shiftMonth(ym, -2), shiftMonth(ym, -3)];
  const t = (m, k = 'expense') => totals(db, m, k);
  const cur = t(ym), prev = t(last);
  const inc = f.incomeAvg;
  // overspending against income
  if (inc > 0 && f.total > inc) out.push({ tone: 'warn', text: `Forecast ${money(f.total)} is more than the ${money(inc)} that usually comes in. Trim about ${money(f.total - inc)} or expect to dip into savings.` });
  else if (inc > 0) out.push({ tone: 'good', text: `Forecast leaves about ${money(inc - f.total)} (${Math.round((inc - f.total) / inc * 100)}% of usual income) unspent.` });
  // streak of rising groups
  const rising = [];
  for (const g of f.by.keys()) {
    const v = [3, 2, 1].map((i) => t(shiftMonth(ym, -i)).by.get(g) || 0);
    if (v[0] < v[1] && v[1] < v[2] && v[2] > 1000) rising.push({ g, from: v[0], to: v[2] });
  }
  rising.sort((a, b) => (b.to - b.from) - (a.to - a.from));
  if (rising[0]) out.push({ tone: 'warn', text: `${rising[0].g} has gone up three months in a row (${money(rising[0].from)} → ${money(rising[0].to)}). Watch it.` });
  // weekend / payday style spikes
  const byDay = new Map();
  for (const p of monthParts(db, last)) if (p.kind === 'expense') { const d = +p.t.date.slice(8, 10); byDay.set(d, (byDay.get(d) || 0) + p.v); }
  const dayVals = [...byDay.values()], avg = sum(dayVals) / Math.max(1, daysInMonth(last));
  const spikes = [...byDay.entries()].filter(([, v]) => v > avg * 4).length;
  if (spikes >= 2) out.push({ tone: 'note', text: `${spikes} days last month were each over 4× your daily average. Planning big purchases for fewer days makes them easier to see.` });
  // tip: biggest discretionary group
  const disc = [...f.by.entries()].filter(([g]) => /entertain|shop|personal|dining|travel|hobby/i.test(g)).sort((a, b) => b[1] - a[1])[0];
  if (disc && disc[1] > 1000) out.push({ tone: 'note', text: `Tip: ${disc[0]} is your biggest flexible group (about ${money(disc[1])}). Cutting 10% frees ${money(disc[1] * 0.1)}.` });
  // reward
  if (prev.total > 0 && cur.total > 0 && cur.total < prev.total * 0.9 && ym !== thisMonth()) out.push({ tone: 'good', text: `Nice: spending fell ${Math.round((1 - cur.total / prev.total) * 100)}% from last month. Treat yourself to something small within the forecast.` });
  const room = inc > 0 ? inc - f.total : 0;
  if (room > 0) out.push({ tone: 'good', text: `Reward budget: if you keep to the forecast you could spend up to ${money(Math.min(room * 0.2, room))} on something you want and still stay positive.` });
  return out.slice(0, 6);
}
