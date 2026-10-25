// Money logic added in v5: account history, net worth, automatic interest, credit cards,
// transfer-fee prediction, next-month forecast and behaviour notes. Pure maths, nothing leaves the device.
import {
  BASE, HOME, homeFx, CUR, accountMap, balances, openDates, catMap, deltaFor, feeOf, findOrAddCategory, live, monthParts, partsBetween,
  nowStamp, rateFor, shiftMonth, stamp, thisMonth, daysInMonth, fmt,
} from './core.js';
import { totals, baselineMonths } from './insights.js';
import { sum as ssum, median, mad, robustZ, trend, forecastSeries } from './stats.js';
import { merchantKey } from './merchants.js';
import { hasRate, rateAt, activePromos, isPeriodEnd, nominalFromEar, COMP_LABEL } from './interest.js';

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const today = () => nowStamp().slice(0, 10);
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
const sum = (a) => a.reduce((s, x) => s + x, 0);

export const ASSET_TYPES = new Set(['cash', 'bank', 'ewallet', 'invest', 'crypto', 'other', 'asset']);
const LIAB = new Set(['card', 'loan']);
export const setLiab = (keys) => { LIAB.clear(); for (const k of ['card', 'loan', ...keys]) LIAB.add(k); };
export const isLiability = (a) => LIAB.has(a.type);

// ---------- one account's story ----------
// newest first, each row with the change to this account and the balance right after it
export function accountHistory(db, id) {
  const a = db.accounts.find((x) => x.id === id);
  const rows = live(db.txs).filter((t) => t.acct === id || t.toAcct === id && t.kind === 'transfer')
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : (x.updatedAt || 0) - (y.updatedAt || 0)));
  const od = a ? openDates(db).get(a.id) || '' : '', open = a ? a.open || 0 : 0;
  let bal = od ? 0 : open, opened = !od;
  const out = rows.map((t) => { if (!opened && t.date.slice(0, 10) >= od) { bal += open; opened = true; } const d = deltaFor(t, id); bal += d; return { t, d, bal }; });
  out.reverse(); out.opening = od && open ? { date: od, amount: open } : null;   // shown as its own line in the account's history
  return out;
}

// the balance of each account right after each entry: txId -> [{ id, before, after }] (one item per affected account).
// Same order as an account's history (date, then when it was saved), so the numbers match the account page.
let _trailKey = '', _trail = null;
export function balanceTrail(db) {
  let mx = 0; for (const t of db.txs) if ((t.updatedAt || 0) > mx) mx = t.updatedAt;
  const key = `${db.txs.length}:${mx}:${db.accounts.length}:${db.accounts.map((a) => (a.open || 0) + (a.openDate || '')).join(',')}`;
  if (key === _trailKey && _trail) return _trail;
  const ods = openDates(db), bal = new Map(), opened = new Map(), out = new Map();
  for (const a of db.accounts) { const od = ods.get(a.id) || ''; bal.set(a.id, od ? 0 : a.open || 0); opened.set(a.id, !od); }
  const open = new Map(db.accounts.map((a) => [a.id, a.open || 0]));
  const rows = live(db.txs).slice().sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : (x.updatedAt || 0) - (y.updatedAt || 0)));
  for (const t of rows) {
    const ids = [t.acct]; if (t.kind === 'transfer' && t.toAcct && t.toAcct !== t.acct) ids.push(t.toAcct);
    const list = [];
    for (const id of ids) { if (!bal.has(id)) continue;
      if (!opened.get(id) && t.date.slice(0, 10) >= (ods.get(id) || '')) { bal.set(id, bal.get(id) + open.get(id)); opened.set(id, true); }
      const before = bal.get(id), after = before + deltaFor(t, id); bal.set(id, after); list.push({ id, before, after }); }
    if (list.length) out.set(t.id, list);
  }
  _trailKey = key; _trail = out; return out;
}

// ---------- net worth ----------
export function netWorth(db) {
  const bal = balances(db), items = [];
  let assets = 0, debts = 0, missing = 0;
  for (const a of live(db.accounts)) {
    if (a.archived && !(bal.get(a.id) || 0)) continue;
    const r = homeFx(db, a.cur), v = bal.get(a.id) || 0;
    if (!r && v) missing++;
    const base = v * (r || 0);
    items.push({ a, v, base, liab: isLiability(a) || base < 0 });
    if (isLiability(a) || base < 0) debts += Math.min(0, base) + (isLiability(a) && base > 0 ? 0 : 0); else assets += base;
  }
  debts = Math.abs(sum(items.filter((i) => i.liab && i.base < 0).map((i) => i.base)));
  assets = sum(items.filter((i) => i.base > 0).map((i) => i.base));
  return { items, assets, debts, net: assets - debts, missing };
}

// ---------- automatic interest ----------
// Accounts with a yearly rate (a.apy, in %) get one income entry per day, compounding on that day's balance.
// Ids are fixed per account and day, so two devices never double-post.
// tax withheld on interest, in %. Local banks take it before crediting (20% is the usual rate in the Philippines and Japan); crypto, e-wallets and the like default to none. Set per account.
export const interestTaxPct = (a) => (a.taxPct != null && a.taxPct !== '' ? Math.max(0, +a.taxPct || 0) : (a.type === 'bank' ? 20 : 0));
// one day's interest before tax on balance b: the promo rate on money deposited in a promo window, the normal rate on the rest
const promoDeposits = (db, a) => new Map((a.promos || []).map((p) => [p, p && p.depFrom && p.depTo
  ? live(db.txs).filter((t) => !t.auto && t.date.slice(0, 10) >= p.depFrom && t.date.slice(0, 10) <= p.depTo && ((t.kind === 'income' && t.acct === a.id) || (t.kind === 'transfer' && t.toAcct === a.id)))
    .map((t) => ({ date: t.date.slice(0, 10), amt: t.kind === 'transfer' ? (t.toAmount != null ? t.toAmount : t.amount) : t.amount })) : []]));
// lock terms of a promo: each deposit is locked for lockDays after it arrives, or until one fixed date (lockEnd). '' = no lock.
export const lockEndOf = (p, date) => (p.lockEnd ? p.lockEnd : (+p.lockDays > 0 ? addDays(date, +p.lockDays) : ''));
// the part of a promo's deposits that is earning the promo rate on day d: arrived by d, and (with a lock) not yet past its lock end
const promoPrinAt = (p, list, d) => (list || []).reduce((m, x) => (x.date <= d && (!lockEndOf(p, x.date) || d <= lockEndOf(p, x.date)) ? m + x.amt : m), 0);
const grossFor = (a, d, b, prin) => { if (!(b > 0)) return 0; let rest = b, g = 0; for (const p of activePromos(a, d)) { const x = Math.min(rest, promoPrinAt(p, prin.get(p), d)); if (x > 0) { g += x * p.rate / 100 / 365; rest -= x; } } return g + rest * rateAt(a, d) / 100 / 365; };
// money still under a promo lock on a day (never more than the balance), when the next part unlocks, and what is free to take out
export function lockInfo(db, a, day = today()) {
  const prin = promoDeposits(db, a), bal = balances(db, day + ' 23:59:59').get(a.id) || 0; let locked = 0, next = '';
  const items = [];
  for (const p of a.promos || []) { if (!p || !(+p.lockDays > 0 || p.lockEnd)) continue;
    for (const x of prin.get(p) || []) { const e = lockEndOf(p, x.date); if (x.date <= day && e && e >= day) { locked += x.amt; items.push({ amt: x.amt, until: e }); if (!next || e < next) next = e; } } }
  locked = Math.min(locked, Math.max(0, bal));
  return { locked, nextUnlock: next, available: Math.max(0, bal - locked), balance: bal, items };
}
const nextPeriodEnd = (d, comp) => { let x = d; for (let i = 0; i < 400; i++, x = addDays(x, 1)) if (isPeriodEnd(x, comp)) return x; return d; };
// what the next days will earn if the balance stays as it is today (rate changes and promo ends are applied on their dates)
export function interestPreview(db, a, days = 7) {
  const b = balances(db).get(a.id) || 0, prin = promoDeposits(db, a), taxPct = interestTaxPct(a), dec = (CUR[a.cur] || { dec: 2 }).dec, places = a.type === 'crypto' ? Math.max(dec, 6) : dec;
  const rows = []; let prev = null;
  for (let i = 0; i < days; i++) {
    const d = addDays(today(), i), g = grossFor(a, d, b, prin), r = rateAt(a, d), pr = activePromos(a, d).length > 0;
    const note = prev && r !== prev.r ? `Rate changes to ${r}%` : prev && prev.pr && !pr ? 'Promo ends' : (!prev || prev.pr === pr ? '' : 'Promo starts');
    rows.push({ date: d, rate: r, promo: pr, gross: +g.toFixed(places + 2), net: +(g * (1 - taxPct / 100)).toFixed(places + 2), note }); prev = { r, pr };
  }
  return { rows, balance: b, taxPct, comp: a.compound || 'daily', nextCredit: nextPeriodEnd(today(), a.compound || 'daily') };
}
// promo status for the account page: waiting, collecting deposits, earning, or ended
export function promoStatus(db, a) {
  const t = today(), dep = promoDeposits(db, a);
  return (a.promos || []).filter((p) => p && p.depFrom && p.depTo).map((p) => ({ p, deposited: (dep.get(p) || []).reduce((m, x) => m + x.amt, 0), lock: +p.lockDays > 0 ? `Locked ${p.lockDays} days after each deposit` : (p.lockEnd ? `Locked until ${p.lockEnd}` : ''), status: t < p.depFrom ? 'Starts ' + p.depFrom : t <= p.depTo ? 'Collecting deposits until ' + p.depTo : (!p.until || t <= p.until) ? 'Earning' + (p.until ? ' until ' + p.until : '') : 'Ended ' + p.until }));
}
export const rateHistory = (a) => [{ from: a.interestFrom || '', rate: +a.apy || 0, base: true }, ...[...(a.rates || [])].filter((r) => r && r.from).sort((x, y) => (x.from < y.from ? -1 : 1)).map((r) => ({ from: r.from, rate: +r.rate }))];
// a debt's interest: when it starts, and what the next days add
export function debtPreview(db, a, days = 7) {
  const D = a.debtInt || {}, owed = Math.max(0, -(balances(db).get(a.id) || 0)), comp = D.comp || 'monthly', nominal = D.kind === 'addon' ? +D.rate : nominalFromEar(+D.rate, comp);
  const rows = [];
  for (let i = 0; i < days; i++) { const d = addDays(today(), i), on = debtActive(db, a, d, owed); rows.push({ date: d, on, charge: on ? +(((D.kind === 'addon' && +D.principal > 0 ? +D.principal : owed) * nominal / 100 / 365)).toFixed(4) : 0 }); }
  return { rows, owed, comp, nextCharge: nextPeriodEnd(today(), comp), nominal };
}
// interest on a debt is running on this day: after the deadline date, or (cards) after a payment due date that passed with money still owed
const dueCache = new Map();
function debtActive(db, a, d, owedNow) {
  const D = a.debtInt || {}; if (!D.on) return false;
  if (D.fromDue && a.dueDay > 0) {
    const [y, m, day] = d.split('-').map(Number); const dd = Math.min(a.dueDay, 28 + 3), pad = (n) => String(n).padStart(2, '0');
    const lastDay = (yy, mm) => new Date(yy, mm, 0).getDate();
    let yy = y, mm = m; if (day < Math.min(a.dueDay, lastDay(y, m))) { mm--; if (mm < 1) { mm = 12; yy--; } }
    const due = `${yy}-${pad(mm)}-${pad(Math.min(a.dueDay, lastDay(yy, mm)))}`;
    if (D.start && due < D.start) return false;
    if (d <= due) return false;
    const key = `${a.id}|${due}|${db.txs.length}`; if (!dueCache.has(key)) { if (dueCache.size > 200) dueCache.clear(); dueCache.set(key, Math.max(0, -(balances(db, due + ' 23:59:59').get(a.id) || 0)) > 0); }
    return dueCache.get(key) && owedNow > 0;
  }
  return d >= (D.start || '0000-00-00');
}

// Interest is posted just before midnight (23:55). Today's entry waits until then; earlier days are filled in when the app opens.
const postDay = (upTo) => (upTo === today() && nowStamp().slice(11, 16) < '23:55' ? addDays(upTo, -1) : upTo);
export function postInterest(db, upTo = today()) {
  const made = [];
  upTo = postDay(upTo);
  const cats = live(db.categories);
  for (const a of live(db.accounts)) {
    if (!hasRate(a) || a.archived || isLiability(a)) continue;
    const dec = (CUR[a.cur] || { dec: 2 }).dec;
    const places = a.type === 'crypto' ? Math.max(dec, 6) : dec;
    const comp = a.compound || 'daily';
    let from = a.interestFrom || upTo;
    const lastAuto = live(db.txs).filter((t) => t.auto && t.acct === a.id).reduce((m, t) => (t.date.slice(0, 10) > m ? t.date.slice(0, 10) : m), '');
    if (lastAuto) from = addDays(lastAuto, 1);
    if (from > upTo) continue;
    // never back-fill more than 400 days in one go
    if (from < addDays(upTo, -400)) from = addDays(upTo, -400);
    const catName = a.type === 'crypto' ? 'Crypto earned' : 'Interest';
    let cat = cats.find((c) => c.group === 'Earn' && c.name === catName);
    const promoPrin = promoDeposits(db, a);
    let acc = 0;
    for (let d = from; d <= upTo; d = addDays(d, 1)) {
      const b = balances(db, d + ' 23:59:59').get(a.id) || 0;
      acc += grossFor(a, d, b, promoPrin);
      if (!isPeriodEnd(d, comp)) continue;
      const id = `int-${a.id}-${d}`;
      if (db.txs.some((t) => t.id === id)) { acc = 0; continue; }
      const gross = +acc.toFixed(places), taxPct = interestTaxPct(a), tax = +(gross * taxPct / 100).toFixed(places), amt = +(gross - tax).toFixed(places);
      acc = 0;
      if (!(amt > 0)) continue;
      if (!cat) cat = findOrAddCategory(db, 'Earn', catName, 'income');
      const t = stamp({ id, kind: 'income', date: d + ' 23:55:00', acct: a.id, cur: a.cur, amount: amt, fx: rateFor(db, a.cur) || 1, cat: cat.id, name: catName, auto: true, ...(tax > 0 ? { gross, tax, taxPct, notes: `Interest ${gross}, tax withheld ${tax} (${taxPct}%), credited ${amt}` } : {}) });
      db.txs.push(t); made.push(t);
    }
  }
  return made;
}
// Interest on what you owe. Starts on the deadline (a.debtInt.start) when something is still owed, and is added to the debt as a charge.
// kind "effective": the rate already includes compounding; "addon": a flat rate on the original amount.
export const hasDebtInt = (a) => !!(a && a.debtInt && a.debtInt.on && +a.debtInt.rate > 0);
export function postDebtInterest(db, upTo = today()) {
  const made = [];
  upTo = postDay(upTo);
  for (const a of live(db.accounts)) {
    if (!hasDebtInt(a) || a.archived || !isLiability(a)) continue;
    const D = a.debtInt, comp = D.comp || 'monthly', start = D.start || today(), dec = (CUR[a.cur] || { dec: 2 }).dec;
    const lastAuto = live(db.txs).filter((t) => t.autoDebt && t.acct === a.id).reduce((m, t) => (t.date.slice(0, 10) > m ? t.date.slice(0, 10) : m), '');
    let from = lastAuto ? addDays(lastAuto, 1) : (D.fromDue ? addDays(upTo, -62) : start);
    if (from < start && !D.fromDue) from = start;
    if (from > upTo) continue;
    if (from < addDays(upTo, -400)) from = addDays(upTo, -400);
    const nominal = D.kind === 'addon' ? +D.rate : nominalFromEar(+D.rate, comp === 'daily' ? 'daily' : comp);
    let cat = null, acc = 0;
    for (let d = from; d <= upTo; d = addDays(d, 1)) {
      const owed = Math.max(0, -(balances(db, d + ' 23:59:59').get(a.id) || 0));
      if (owed > 0 && debtActive(db, a, d, owed)) acc += (D.kind === 'addon' && +D.principal > 0 ? +D.principal : owed) * nominal / 100 / 365;
      if (!isPeriodEnd(d, comp)) continue;
      const id = `dint-${a.id}-${d}`;
      if (db.txs.some((t) => t.id === id)) { acc = 0; continue; }
      const amt = +acc.toFixed(dec); acc = 0;
      if (!(amt > 0)) continue;
      if (!cat) cat = findOrAddCategory(db, 'Financial loss', 'Interest charge', 'expense');
      const t = stamp({ id, kind: 'expense', date: d + ' 23:55:00', acct: a.id, cur: a.cur, amount: amt, fx: rateFor(db, a.cur) || 1, cat: cat.id, name: 'Interest charge', autoDebt: true, notes: `Interest on what you owe: ${D.rate}% a year (${D.kind === 'addon' ? 'add-on' : 'effective'}), added ${COMP_LABEL[comp] ? COMP_LABEL[comp].toLowerCase() : comp}` });
      db.txs.push(t); made.push(t);
    }
  }
  return made;
}

// change the tax rate of an account and recompute every interest entry it already earned (gross stays, tax and net follow)
export function retaxInterest(db, acctId, pct) {
  const a = db.accounts.find((x) => x.id === acctId); if (!a) return 0;
  const dec = (CUR[a.cur] || { dec: 2 }).dec, places = a.type === 'crypto' ? Math.max(dec, 6) : dec; let n = 0;
  for (const t of db.txs) {
    if (t.deleted || !t.auto || t.acct !== acctId || t.kind !== 'income') continue;
    const gross = t.gross != null ? t.gross : t.amount, tax = +(gross * pct / 100).toFixed(places), net = +(gross - tax).toFixed(places);
    if (net === t.amount && (t.taxPct || 0) === pct) continue;
    t.gross = gross; t.tax = tax; t.taxPct = pct; t.amount = net; t.notes = pct > 0 ? `Interest ${gross}, tax withheld ${tax} (${pct}%), credited ${net}` : ''; stamp(t); n++;
  }
  return n;
}

// ---------- credit cards ----------
// a.limit (credit limit), a.stmtDay (statement closes), a.dueDay (payment due).
// Buying with a card is an expense when it happens. Paying the card is a transfer INTO the card account, so it lowers
// what is owed without counting as spending a second time.
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const dstr = (y, m, d) => `${y}-${p2(m)}-${p2(Math.min(d, lastDay(y, m)))}`;
export function cardBilling(db, a, bal0, asOf = today()) {
  const bal = bal0 != null ? bal0 : (balances(db).get(a.id) || 0);
  const owed = Math.max(0, -bal);
  const [y, m, d] = asOf.split('-').map(Number);
  let stmt = null, nextStmt = null;
  if (a.stmtDay > 0) {
    stmt = dstr(y, m, a.stmtDay);
    if (stmt > asOf) { const pm = m === 1 ? [y - 1, 12] : [y, m - 1]; stmt = dstr(pm[0], pm[1], a.stmtDay); }
    const sm = +stmt.slice(5, 7), sy = +stmt.slice(0, 4);
    nextStmt = sm === 12 ? dstr(sy + 1, 1, a.stmtDay) : dstr(sy, sm + 1, a.stmtDay);
  }
  let owedAtStmt = owed, paid = 0, dueAmount = owed;
  if (stmt) {
    owedAtStmt = Math.max(0, -(balances(db, stmt + ' 23:59:59').get(a.id) || 0));
    for (const t of db.txs) if (!t.deleted && t.kind === 'transfer' && t.toAcct === a.id && t.date.slice(0, 10) > stmt) paid += (t.toAmount != null ? t.toAmount : t.amount) - (t.feeBy === 'to' ? feeOf(t) : 0);
    dueAmount = Math.min(owed, Math.max(0, owedAtStmt - paid));
  }
  let due = null, days = null;
  if (a.dueDay > 0) {
    if (stmt) {
      const sm = +stmt.slice(5, 7), sy = +stmt.slice(0, 4);
      due = a.dueDay > a.stmtDay ? dstr(sy, sm, a.dueDay) : (sm === 12 ? dstr(sy + 1, 1, a.dueDay) : dstr(sy, sm + 1, a.dueDay));
    } else {
      due = dstr(y, m, a.dueDay);
      if (due < asOf) due = m === 12 ? dstr(y + 1, 1, a.dueDay) : dstr(y, m + 1, a.dueDay);
    }
    days = Math.round((new Date(due) - new Date(asOf)) / 864e5);
  }
  const limit = a.limit > 0 ? a.limit : 0;
  return {
    owed, limit, avail: limit ? limit - owed : null, used: limit ? Math.min(100, Math.round(owed / limit * 100)) : null,
    stmt, nextStmt, owedAtStmt, paid, dueAmount, due, days, overdue: !!(due && days < 0 && dueAmount > 0),
  };
}
export const cardInfo = (db, a, bal) => cardBilling(db, a, bal);

// cards that need attention: payment due within `window` days (or overdue) with something still unpaid, or limit nearly used
export function cardReminders(db, window = 3) {
  const bal = balances(db), out = [];
  for (const a of live(db.accounts)) {
    if (a.type !== 'card' || a.archived) continue;
    const c = cardBilling(db, a, bal.get(a.id));
    if (c.due && c.dueAmount > 0.005 && c.days <= window) out.push({ a, ...c });
    else if (c.used != null && c.used >= 80) out.push({ a, ...c, high: true });
  }
  return out.sort((x, y) => (x.days ?? 99) - (y.days ?? 99));
}

// an .ics file: a monthly reminder per card, with alerts 3, 2 and 1 days before, in the morning of the due day and that evening
export function cardIcs(db) {
  const rows = [];
  const stampNow = nowStamp().replace(/[-: ]/g, '').replace(/^(\d{8})(\d{6})$/, '$1T$2');
  for (const a of live(db.accounts)) {
    if (a.type !== 'card' || !(a.dueDay > 0) || a.archived) continue;
    const c = cardBilling(db, a);
    const d0 = (c.due || today()).replace(/-/g, '');
    const alarm = (t, text) => ['BEGIN:VALARM', `TRIGGER:${t}`, 'ACTION:DISPLAY', `DESCRIPTION:${text}`, 'END:VALARM'];
    const name = String(a.name).replace(/[,;\n]/g, ' ');
    rows.push('BEGIN:VEVENT', `UID:sukli-card-${a.id}@sukli`, `DTSTAMP:${stampNow}`, `DTSTART:${d0}T090000`, `DTEND:${d0}T093000`,
      `RRULE:FREQ=MONTHLY;BYMONTHDAY=${a.dueDay}`, `SUMMARY:Pay credit card: ${name}`,
      ...alarm('-P3D', `${name} payment due in 3 days`), ...alarm('-P2D', `${name} payment due in 2 days`), ...alarm('-P1D', `${name} payment due tomorrow`),
      ...alarm('PT0S', `${name} payment due today`), ...alarm('PT11H', `${name} payment due tonight, before midnight`), 'END:VEVENT');
  }
  if (!rows.length) return '';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sukli//EN', ...rows, 'END:VCALENDAR'].join('\r\n');
}

// groups for account pickers and the Accounts page
export const TYPE_GROUP = {
  bank: ['Banks', 1], ewallet: ['E-wallets', 2], crypto: ['Crypto exchanges and wallets', 3], cash: ['Cash', 4],
  invest: ['Investments', 5], asset: ['Assets', 6], card: ['Credit cards', 7], loan: ['Loans and money owed', 8], other: ['Other', 9],
};
export const typeGroupName = (t) => (TYPE_GROUP[t] || TYPE_GROUP.other)[0];
export const typeGroupOrder = (t) => (TYPE_GROUP[t] || TYPE_GROUP.other)[1];

// ---------- transfers you make again and again ----------
export function transferHints(db) {
  const byName = new Map(), routes = new Map();
  const list = live(db.txs).filter((t) => t.kind === 'transfer').sort((x, y) => (x.date < y.date ? -1 : 1));
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  for (const t of list) {
    const nk = (t.name || '').trim().toLowerCase();
    if (nk) {
      const e = byName.get(nk) || { name: t.name.trim(), n: 0, from: new Map(), to: new Map(), amts: [], last: '' };
      e.n++; e.last = t.date; e.from.set(t.acct, (e.from.get(t.acct) || 0) + 1); e.to.set(t.toAcct, (e.to.get(t.toAcct) || 0) + 1); e.amts.push(t.amount); byName.set(nk, e);
    }
    const rk = t.acct + '>' + t.toAcct;
    const r = routes.get(rk) || { from: t.acct, to: t.toAcct, n: 0, amts: [], last: '', names: new Map() };
    r.n++; r.last = t.date; r.amts.push(t.amount); if (t.name) r.names.set(t.name.trim(), (r.names.get(t.name.trim()) || 0) + 1); routes.set(rk, r);
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    names: [...byName.values()].map((e) => ({ name: e.name, n: e.n, from: top(e.from), to: top(e.to), amount: med(e.amts), last: e.last })),
    routes: [...routes.values()].map((r) => ({ from: r.from, to: r.to, n: r.n, amount: med(r.amts), last: r.last, name: top(r.names) || '' })),
  };
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
// Complete monthly totals from your first month of data, zero months kept (a month with no spending is real information).
export function monthlySeries(db, ym = thisMonth(), kind = 'expense', max = 36) {
  let first = null;
  for (const t of db.txs) if (!t.deleted && t.kind === kind && (!first || t.date < first)) first = t.date;
  if (!first) return { months: [], values: [] };
  const months = [];
  for (let i = 1; i <= max; i++) { const m = shiftMonth(ym, -i); if (m < first.slice(0, 7)) break; months.unshift(m); }
  return { months, values: months.map((m) => totals(db, m, kind).total) };
}
// Next month: the method that would have predicted your own past months best (backtested), with a rough error range.
// By group it still follows your recent months, scaled to that total.
export function forecastNext(db, ym = thisMonth()) {
  const next = shiftMonth(ym, 1), ser = monthlySeries(db, ym), fc = forecastSeries(ser.values);
  const past = [];
  for (let i = 1; i <= 12 && past.length < 3; i++) { const m = shiftMonth(ym, -i); if (totals(db, m).total > 0) past.push(m); }
  const live0 = totals(db, ym), usedMonths = past, by = new Map();
  for (const m of usedMonths) for (const [g, v] of totals(db, m).by) by.set(g, (by.get(g) || 0) + v / usedMonths.length);
  let total = ssum([...by.values()]);
  if (fc && ser.values.some((v) => v > 0)) { const k = total > 0 ? fc.value / total : 0; if (total > 0) for (const [g, v] of by) by.set(g, v * k); total = fc.value; }
  const incSer = monthlySeries(db, ym, 'income').values.slice(-6).filter((v) => v > 0);
  const incomeAvg = incSer.length ? median(incSer) : 0;
  // repeated every month: the SUM per name per month (three coffees with one name are not one fixed bill), and a steady amount
  const fixed = [], base = ser.months.slice(-6);
  if (base.length >= 3) {
    const per = base.map((m) => { const mp = new Map(); for (const p of monthParts(db, m)) if (p.kind === 'expense' && p.t.name) { const k = p.t.name.trim().toLowerCase(); const e = mp.get(k) || { name: p.t.name, v: 0, n: 0 }; e.v += p.v; e.n++; mp.set(k, e); } return mp; });
    for (const [k, e0] of per[per.length - 1]) {
      const rows = per.map((mp) => mp.get(k)).filter(Boolean);
      if (rows.length < Math.min(base.length, 3) || rows.length < base.length - 1) continue;
      const vals = rows.map((r) => r.v), med = median(vals);
      if (med > 0 && mad(vals) / med <= 0.15) fixed.push({ name: e0.name, v: med });
    }
  }
  return { next, months: usedMonths, total, by, incomeAvg, fixed: fixed.sort((a, b) => b.v - a.v).slice(0, 5), thisSoFar: live0.total, method: fc ? fc.label : null, tested: fc ? fc.tested : 0, low: fc ? fc.low : null, high: fc ? fc.high : null, mae: fc ? fc.mae : null };
}

// ---------- habits and rhythms (robust: your own median and spread, never a fixed rule) ----------
const gapDays = (a, b) => Math.round((new Date(a) - new Date(b)) / 864e5);
// Weeks (rolling 7-day windows ending today) of purchase counts per category. Window 0 is the latest.
function weeklyCounts(db, now, weeks = 13) {
  const from = addDays(now, -7 * weeks + 1), cm = catMap(db), per = new Map(), all = Array(weeks).fill(0);
  for (const p of partsBetween(db, from, now)) {
    if (p.kind !== 'expense') continue;
    const w = Math.floor(gapDays(now, p.t.date.slice(0, 10)) / 7); if (w < 0 || w >= weeks) continue;
    const c = cm.get(p.cat); if (!c) continue;
    if (!per.has(c.name)) per.set(c.name, Array(weeks).fill(0));
    per.get(c.name)[w]++; all[w]++;
  }
  return { per, all };
}
// A gap in something you usually do, noticed only when the last 7 days sit well outside your own range.
// It never guesses why: you may be travelling, ill, or simply did not log.
export function habitGaps(db, now = today()) {
  const { per, all } = weeklyCounts(db, now), out = [];
  const histAll = all.slice(1), medAll = median(histAll);
  if (histAll.filter((v) => v > 0).length < 8) return out;                          // not enough history to know your rhythm
  if (all[0] < Math.max(3, medAll * 0.4)) return out;                               // very few entries lately overall: travelling or not logging, so stay quiet
  for (const [name, wk] of per) {
    const hist = wk.slice(1), med = median(hist), zeroShare = hist.filter((v) => v === 0).length / hist.length;
    if (med < 1 || zeroShare > 0.15 || wk[0] > 0) continue;                         // only things you did almost every week
    const z = robustZ(wk[0], hist, 0.7);
    if (z <= -2.5) out.push({ tone: 'note', score: -z * med, text: `No ${name} entries in the last 7 days. You usually log about ${Math.round(med)} a week, so this stands out. Just a gentle heads-up: nothing says it is a problem.` });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 2);
}
// Weekday vs weekend, and the week after payday vs the week before it.
export function rhythm(db, now = today()) {
  const days = new Map(), from = addDays(now, -84);
  for (const p of partsBetween(db, from, addDays(now, -1))) if (p.kind === 'expense') { const d = p.t.date.slice(0, 10); days.set(d, (days.get(d) || 0) + p.v); }
  const wd = [], we = [];
  for (let i = 1; i <= 84; i++) { const d = addDays(now, -i), dow = new Date(d + 'T12:00:00').getDay(); (dow === 0 || dow === 6 ? we : wd).push(days.get(d) || 0); }
  const out = { weekday: median(wd), weekend: median(we), weekendRatio: median(wd) > 0 ? median(we) / median(wd) : null, weekdayMean: ssum(wd) / wd.length, weekendMean: ssum(we) / we.length };
  // payday = the usual day of the month the biggest income arrives
  const byMonth = new Map();
  for (const p of partsBetween(db, addDays(now, -200), now)) if (p.kind === 'income') { const m = p.t.date.slice(0, 7), e = byMonth.get(m); if (!e || p.v > e.v) byMonth.set(m, { v: p.v, day: +p.t.date.slice(8, 10) }); }
  const pd = [...byMonth.values()].map((x) => x.day);
  if (pd.length >= 3 && mad(pd) <= 2) {
    const day = Math.round(median(pd)), after = [], before = [];
    for (const m of [...byMonth.keys()].slice(0, -1)) { const [y, mo] = m.split('-').map(Number), pdate = `${m}-${p2(Math.min(day, daysInMonth(m)))}`; let a = 0, b = 0;
      for (let i = 0; i < 7; i++) a += days.get(addDays(pdate, i)) || 0;
      for (let i = 1; i <= 7; i++) b += days.get(addDays(pdate, -i)) || 0;
      if (a + b > 0) { after.push(a); before.push(b); } }
    if (after.length >= 2) out.payday = { day, after: median(after), before: median(before) };
  }
  return out;
}
// Is a category really rising or falling over the months? Says so only with real evidence.
export function categoryTrends(db, ym = thisMonth()) {
  const ser = monthlySeries(db, ym), months = ser.months.slice(-8), out = [];
  if (months.length < 5) return out;
  const groups = new Set(); for (const m of months) for (const g of totals(db, m).by.keys()) groups.add(g);
  for (const g of groups) {
    const v = months.map((m) => totals(db, m).by.get(g) || 0), t = trend(v), mn = ssum(v) / v.length;
    if (mn >= 1000 && t.conf !== 'low' && t.conf !== 'none' && Math.abs(t.rel) >= 0.04) out.push({ g, dir: t.dir, conf: t.conf, per: Math.abs(t.slope), rel: t.rel });
  }
  return out.sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel));
}

// ---------- regular payments: subscriptions and bills found from timing and amount ----------
const CADENCE = [['weekly', 7, 1, 52 / 12], ['every 2 weeks', 14, 2, 26 / 12], ['monthly', 30.4, 3, 1], ['every 3 months', 91, 6, 1 / 3], ['yearly', 365, 8, 1 / 12]];
export function detectRecurring(db, now = today()) {
  const by = new Map();
  for (const p of partsBetween(db, addDays(now, -800), now)) {
    if (p.kind !== 'expense' || !p.t.name) continue;
    const key = merchantKey(p.t.name); if (!key) continue;
    const day = p.t.date.slice(0, 10), e = by.get(key) || { name: p.t.name, days: new Map() };
    e.days.set(day, (e.days.get(day) || 0) + p.v);               // same merchant, same day = one payment (two coffees are not two subscriptions)
    by.set(key, e);
  }
  const out = [];
  for (const [key, e] of by) {
    const days = [...e.days.keys()].sort(), amts = days.map((d) => e.days.get(d));
    if (days.length < 3 && !(days.length === 2 && gapDays(days[1], days[0]) > 300)) continue;
    const gaps = days.slice(1).map((d, i) => gapDays(d, days[i])), g = median(gaps), spread = mad(gaps);
    const cad = CADENCE.find(([, n, tol]) => Math.abs(g - n) <= tol && spread <= Math.max(1, tol * 0.7)); if (!cad) continue;
    const med = median(amts), rel = med > 0 ? mad(amts) / med : 1;
    if (rel > 0.4 || (rel > 0.12 && g < 25)) continue;   // weekly habits (dinners, groceries) are not subscriptions; only monthly or longer bills may vary
    const last = days[days.length - 1], next = addDays(last, Math.round(g)), since = gapDays(now, last);
    out.push({ key, name: e.name, every: cad[0], amount: med, steady: rel <= 0.12, monthly: med * cad[3], last, next, count: days.length, active: since <= g * 1.6 });
  }
  return out.filter((r) => r.active).sort((a, b) => b.monthly - a.monthly);
}

// ---------- correlations: which weekly habits move together (patterns, never causes) ----------
const ranks = (a) => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; };
const pearson = (x, y) => { const n = x.length, mx = ssum(x) / n, my = ssum(y) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0; };
export function correlations(db, now = today(), weeks = 26) {
  const cm = catMap(db), per = new Map();
  for (const p of partsBetween(db, addDays(now, -7 * weeks + 1), now)) {
    if (p.kind !== 'expense') continue; const c = cm.get(p.cat); if (!c) continue;
    const w = Math.floor(gapDays(now, p.t.date.slice(0, 10)) / 7); if (w < 0 || w >= weeks) continue;
    if (!per.has(c.name)) per.set(c.name, Array(weeks).fill(0)); per.get(c.name)[w] += p.v;
  }
  const names = [...per.entries()].filter(([, v]) => v.filter((x) => x > 0).length >= weeks * 0.5).sort((a, b) => ssum(b[1]) - ssum(a[1])).slice(0, 8), out = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const rho = pearson(ranks(names[i][1]), ranks(names[j][1])), t = rho * Math.sqrt((weeks - 2) / Math.max(1e-9, 1 - rho * rho));
    if (Math.abs(rho) >= 0.5 && Math.abs(t) >= 3.2) out.push({ a: names[i][0], b: names[j][0], rho, weeks });   // strict cut-off: many pairs are tried
  }
  return out.sort((x, y) => Math.abs(y.rho) - Math.abs(x.rho)).slice(0, 3);
}

// ---------- behaviour notes: warnings, tips and a bit of praise ----------
export function behaviorNotes(db, ym = thisMonth()) {
  const out = [], money = (n) => fmt(n, HOME, { round: true });
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
  // evidence-based trend (replaces "three months in a row")
  const tr = categoryTrends(db, ym).find((x) => x.dir === 'up');
  if (tr && !out.some((o) => o.text.startsWith(tr.g))) out.push({ tone: 'warn', text: `${tr.g} has been climbing by about ${money(tr.per)} a month over the last months (${tr.conf} confidence). That is a pattern, not a one-off.` });
  for (const g of habitGaps(db)) out.push(g);
  const co = correlations(db)[0];
  if (co) out.push({ tone: 'note', text: co.rho < 0 ? `Over ${co.weeks} weeks, when you spend more on ${co.a} you tend to spend less on ${co.b}, and the other way round. A pattern in your entries, not a cause.` : `Over ${co.weeks} weeks, ${co.a} and ${co.b} tend to rise and fall together. A pattern in your entries, not a cause.` });
  const rh = rhythm(db);
  if (rh.weekendRatio != null && (rh.weekendRatio >= 1.5 || rh.weekendRatio <= 0.6)) out.push({ tone: 'note', text: `A typical weekend day costs ${money(rh.weekend)} against ${money(rh.weekday)} on a weekday (median of the last 12 weeks). This is a pattern in your entries, not a verdict.` });
  if (rh.payday && rh.payday.before > 0 && rh.payday.after / rh.payday.before >= 1.3) out.push({ tone: 'note', text: `Spending in the week after payday (around the ${rh.payday.day}th) is about ${(rh.payday.after / rh.payday.before).toFixed(1)}x the week before it. Setting savings aside first may help.` });
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
  return out.slice(0, 7);
}

// ---------- spending safety: warnings while you enter an expense ----------
export const SAFETY_DEFAULT = { on: true, mode: 'month', limit: 0, warnPct: 80, cardPct: 50, essentials: [] };
export const safetyCfg = (db) => ({ ...SAFETY_DEFAULT, ...(db.settings.safety || {}) });
const ESSENTIAL_RX = /food|household|util|transport|rent|health|grocer|medical|insur/i;
export function safetyCheck(db, { amount, acctId, kind = 'expense', date, group = '' }) {
  const cfg = safetyCfg(db);
  if (!cfg.on || kind !== 'expense' || !(amount > 0)) return [];
  const money = (n) => fmt(n, HOME, { round: true, force: true });
  const a = db.accounts.find((x) => x.id === acctId); if (!a) return [];
  const day = (date || nowStamp()).slice(0, 10);
  let from, to;
  if (cfg.mode === 'rolling') { to = day; from = addDays(day, -29); } else { from = day.slice(0, 7) + '-01'; to = day.slice(0, 7) + '-31'; }
  const parts = partsBetween(db, from, to);
  const income = sum(parts.filter((p) => p.kind === 'income').map((p) => p.v));
  const spent = sum(parts.filter((p) => p.kind === 'expense').map((p) => p.v));
  const amt = amount * (a.cur === HOME ? 1 : (homeFx(db, a.cur) || 0));
  const isCard = a.type === 'card';
  const bal = balances(db);
  let cash = 0, cardOwed = 0, dueSoon = 0;
  for (const x of live(db.accounts)) {
    if (x.archived) continue;
    const v = (bal.get(x.id) || 0) * (homeFx(db, x.cur) || 0);
    if (x.type === 'card') { cardOwed += Math.max(0, -v); const b = cardBilling(db, x, bal.get(x.id)); if (b.due && b.dueAmount > 0 && b.days <= 14) dueSoon += b.dueAmount * (homeFx(db, x.cur) || 0); }
    else if (['cash', 'bank', 'ewallet'].includes(x.type) && x.include) cash += Math.max(0, v);
  }
  const cardInPeriod = sum(parts.filter((p) => p.kind === 'expense' && (db.accounts.find((x) => x.id === p.t.acct) || {}).type === 'card').map((p) => p.v));
  const cardAfter = cardOwed + (isCard ? amt : 0);
  const out = [];
  const add = (level, text) => out.push({ level, text });
  const after = spent + amt;
  if (cfg.limit > 0) {
    if (after > cfg.limit) add('danger', `This puts you ${money(after - cfg.limit)} over your ${money(cfg.limit)} spending limit for this period.`);
    else if (after >= cfg.limit * cfg.warnPct / 100) add('warn', `You are at ${Math.round(after / cfg.limit * 100)}% of your ${money(cfg.limit)} spending limit (${money(cfg.limit - after)} left after this).`);
  }
  const bud = db.budgets.find((x) => !x.deleted && x.group === group);
  if (bud && bud.amount > 0 && cfg.mode === 'month') {
    const g = sum(parts.filter((p) => p.kind === 'expense' && p.group === group).map((p) => p.v)) + amt;
    if (g > bud.amount) add('danger', `${group} would be ${money(g - bud.amount)} over its ${money(bud.amount)} budget.`);
    else if (g >= bud.amount * cfg.warnPct / 100) add('warn', `${group} would reach ${Math.round(g / bud.amount * 100)}% of its budget.`);
  }
  if (income > 0 && after > income) add('danger', `Spending this period would be ${money(after)}, more than the ${money(income)} that came in. You may need to cut back or use savings.`);
  else if (income === 0 && after > 0 && cfg.mode === 'rolling') add('info', 'No income is recorded in the last 30 days, so spending comes out of savings.');
  if (income > 0 && cardAfter > income) add('danger', `Credit card balances would total ${money(cardAfter)}, more than this period’s income (${money(income)}). Reduce card spending so the bills do not eat into savings.`);
  else if (income > 0 && cardAfter > income * cfg.cardPct / 100) add('warn', `Credit card balances would be ${money(cardAfter)}, ${Math.round(cardAfter / income * 100)}% of this period’s income (your warning is ${cfg.cardPct}%).`);
  const monthsBack = [1, 2, 3].map((i) => shiftMonth(day.slice(0, 7), -i));
  const eg = cfg.essentials && cfg.essentials.length ? (g) => cfg.essentials.includes(g) : (g) => ESSENTIAL_RX.test(g);
  const essMonthly = sum(monthsBack.map((m) => sum(monthParts(db, m).filter((p) => p.kind === 'expense' && eg(p.group)).map((p) => p.v)))) / 3;
  const cashAfter = cash - (isCard ? 0 : amt) - dueSoon;
  const reserve = essMonthly * 14 / 30;
  if (dueSoon > 0 && cashAfter < 0) add('danger', `Card payments due in the next 14 days (${money(dueSoon)}) are more than the cash you would have left (${money(cash - (isCard ? 0 : amt))}).`);
  else if (dueSoon > 0 && reserve > 0 && cashAfter < reserve) add('warn', `After upcoming card payments (${money(dueSoon)}) you would have about ${money(cashAfter)} of cash, under two weeks of essentials (about ${money(reserve)}).`);
  else if (!dueSoon && reserve > 0 && cash - (isCard ? 0 : amt) < reserve) add('warn', `Cash would fall to ${money(cash - (isCard ? 0 : amt))}, under two weeks of essentials (about ${money(reserve)}).`);
  if (income > 0) {
    const earlier = Math.max(0, cardOwed - cardInPeriod);   // card bills from before this period still to be paid
    const shortfall = after + earlier - income;
    if (shortfall > 0 && !out.some((x) => /more than the .* that came in/.test(x.text))) add(shortfall > cash ? 'danger' : 'warn', `With earlier card bills (${money(earlier)}), spending would exceed income by about ${money(shortfall)}, which would have to come from savings.`);
  }
  const rank = { danger: 0, warn: 1, info: 2 };
  return out.sort((x, y) => rank[x.level] - rank[y.level]).slice(0, 4);
}
