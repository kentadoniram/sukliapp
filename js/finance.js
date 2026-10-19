// Money logic added in v5: account history, net worth, automatic interest, credit cards,
// transfer-fee prediction, next-month forecast and behaviour notes. Pure maths, nothing leaves the device.
import {
  BASE, HOME, homeFx, CUR, accountMap, balances, catMap, deltaFor, feeOf, findOrAddCategory, live, monthParts, partsBetween,
  nowStamp, rateFor, shiftMonth, stamp, thisMonth, daysInMonth, fmt,
} from './core.js';
import { totals } from './insights.js';
import { forecastSeries } from './forecasting.js';

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
  let bal = a ? a.open || 0 : 0;
  const out = rows.map((t) => { const d = deltaFor(t, id); bal += d; return { t, d, bal }; });
  return out.reverse();
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
// Forecast complete calendar months only. Zero-spend months are real observations, not missing data.
// A small set of methods is compared by rolling-origin backtesting; no model is assumed to be best.
export function forecastNext(db, ym = thisMonth()) {
  const next = shiftMonth(ym, 1);
  const previousMonth = shiftMonth(ym, -1);
  const dated = live(db.txs).filter((t) => !t.reval && t.date && t.date.slice(0, 7) < ym).map((t) => t.date.slice(0, 7)).sort();
  const firstMonth = dated[0] || previousMonth;
  const historyMonths = [];
  for (let m = firstMonth; m <= previousMonth; m = shiftMonth(m, 1)) historyMonths.push(m);
  const usedMonths = historyMonths.slice(-24);
  const groups = new Set();
  const monthByGroup = new Map();
  const expenseSeries = [], incomeSeries = [];
  for (const m of usedMonths) {
    const ex = totals(db, m, 'expense');
    const inc = totals(db, m, 'income');
    expenseSeries.push(ex.total);
    incomeSeries.push(inc.total);
    for (const [g, v] of ex.by) {
      groups.add(g);
      if (!monthByGroup.has(g)) monthByGroup.set(g, new Map());
      monthByGroup.get(g).set(m, v);
    }
  }
  const by = new Map();
  const groupModels = new Map();
  for (const g of groups) {
    const map = monthByGroup.get(g) || new Map();
    const series = usedMonths.map((m) => map.get(m) || 0);
    const fc = forecastSeries(series);
    if (fc.value > 0.005) by.set(g, fc.value);
    groupModels.set(g, fc);
  }
  const groupTotal = sum([...by.values()]);
  const totalModel = forecastSeries(expenseSeries);
  const total = totalModel.value;
  // Keep the displayed category estimates consistent with the separately backtested total forecast.
  if (groupTotal > 0 && total >= 0) {
    const scale = total / groupTotal;
    for (const [g, v] of by) by.set(g, v * scale);
  }
  const rangeLower = totalModel.mae == null ? null : Math.max(0, total - totalModel.mae);
  const rangeUpper = totalModel.mae == null ? null : total + totalModel.mae;
  const incomeModel = forecastSeries(incomeSeries);
  const recentMonths = usedMonths.slice(-3);

  // Aggregate repeated same-name expenses within each month; a Map of raw transactions used to lose duplicates.
  const monthlyNames = recentMonths.map((m) => {
    const names = new Map();
    for (const p of monthParts(db, m)) {
      if (p.kind !== 'expense' || p.split || !p.t.name) continue;
      const key = p.t.name.trim().toLowerCase();
      const old = names.get(key) || { name: p.t.name.trim(), v: 0 };
      old.v += p.v;
      names.set(key, old);
    }
    return names;
  });
  const fixed = [];
  if (monthlyNames.length >= 2) {
    for (const [k, p] of monthlyNames[0]) {
      if (monthlyNames.every((m) => m.has(k))) {
        fixed.push({ name: p.name, v: sum(monthlyNames.map((m) => m.get(k).v)) / monthlyNames.length });
      }
    }
  }
  const thisSoFar = totals(db, ym).total;
  return {
    next, months: recentMonths, historyMonths: usedMonths, total, by,
    incomeAvg: incomeModel.value, incomeForecast: incomeModel.value,
    fixed: fixed.sort((a, b) => b.v - a.v).slice(0, 5), thisSoFar,
    method: totalModel.method, error: totalModel.mae,
    lower: rangeLower, upper: rangeUpper,
    backtestCount: totalModel.backtestCount, historyCount: totalModel.historyCount,
    dataCoverage: totalModel.dataCoverage,
    modelScores: totalModel.scores || [], groupModels,
  };
}

// Descriptive behavior signals from actual logged expenses. These are observations, not diagnoses.
export function behaviorPatterns(db, asOf = today()) {
  const rows = live(db.txs).filter((t) => t.kind === 'expense' && !t.auto && !t.reval && t.name && t.date.slice(0, 10) <= asOf);
  const byName = new Map();
  for (const t of rows) {
    const key = String(t.name).trim().toLowerCase();
    if (!key) continue;
    const e = byName.get(key) || { name: t.name.trim(), dates: [], count: 0 };
    e.dates.push(t.date.slice(0, 10)); e.count++;
    byName.set(key, e);
  }
  const dayNo = (s) => Math.floor(new Date(s + 'T12:00:00').getTime() / 86400000);
  const now = dayNo(asOf), out = [];
  for (const e of byName.values()) {
    const dates = [...new Set(e.dates)].sort();
    if (dates.length < 4) continue;
    const lastDays = now - dayNo(dates[dates.length - 1]);
    if (lastDays < 0 || lastDays > 90) continue;
    const gaps = [];
    for (let i = 1; i < dates.length; i++) gaps.push(dayNo(dates[i]) - dayNo(dates[i - 1]));
    const sorted = gaps.sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
    const usualGap = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const threshold = Math.max(7, usualGap * 1.8);
    if (usualGap <= 35 && lastDays > threshold) {
      out.push({ type: 'routine-gap', tone: 'note', name: e.name, daysSince: lastDays, usualGap: Math.round(usualGap), text: `No “${e.name}” purchase has been recorded for ${lastDays} days; it was previously recorded about every ${Math.max(1, Math.round(usualGap))} days. Your routine may have changed.` });
    }
  }
  return out.sort((a, b) => b.daysSince / Math.max(1, b.usualGap) - a.daysSince / Math.max(1, a.usualGap)).slice(0, 2);
}

// ---------- behaviour notes: warnings, tips and a bit of praise ----------
export function behaviorNotes(db, ym = thisMonth()) {
  const out = [], money = (n) => fmt(n, HOME, { round: true });
  const f = forecastNext(db, ym);
  if (!f.historyMonths.length) return [{ tone: 'note', text: 'Add a few months of entries and Sukli will start forecasting.' }];
  const [last] = [shiftMonth(ym, -1)];
  const t = (m, k = 'expense') => totals(db, m, k);
  const cur = t(ym), prev = t(last);
  const inc = f.incomeAvg;
  if (inc > 0 && f.total > inc) out.push({ tone: 'warn', text: `Forecast ${money(f.total)} is more than the ${money(inc)} that usually comes in. Trim about ${money(f.total - inc)} or expect to dip into savings.` });
  else if (inc > 0) out.push({ tone: 'good', text: `Forecast leaves about ${money(inc - f.total)} (${Math.round((inc - f.total) / inc * 100)}% of usual income) unspent.` });
  const rising = [];
  for (const g of f.by.keys()) {
    const v = [3, 2, 1].map((i) => t(shiftMonth(ym, -i)).by.get(g) || 0);
    if (v[0] < v[1] && v[1] < v[2] && v[2] > 1000) rising.push({ g, from: v[0], to: v[2] });
  }
  rising.sort((a, b) => (b.to - b.from) - (a.to - a.from));
  if (rising[0]) out.push({ tone: 'warn', text: `${rising[0].g} has gone up three months in a row (${money(rising[0].from)} → ${money(rising[0].to)}). Watch it.` });
  const byDay = new Map();
  for (const p of monthParts(db, last)) if (p.kind === 'expense') { const d = +p.t.date.slice(8, 10); byDay.set(d, (byDay.get(d) || 0) + p.v); }
  const dayVals = [...byDay.values()], avg = sum(dayVals) / Math.max(1, daysInMonth(last));
  const spikes = [...byDay.entries()].filter(([, v]) => v > avg * 4).length;
  if (spikes >= 2) out.push({ tone: 'note', text: `${spikes} days last month were each over 4× your daily average. Planning big purchases for fewer days makes them easier to see.` });
  const disc = [...f.by.entries()].filter(([g]) => /entertain|shop|personal|dining|travel|hobby/i.test(g)).sort((a, b) => b[1] - a[1])[0];
  if (disc && disc[1] > 1000) out.push({ tone: 'note', text: `Tip: ${disc[0]} is your biggest flexible group (about ${money(disc[1])}). Cutting 10% frees ${money(disc[1] * 0.1)}.` });
  if (prev.total > 0 && cur.total > 0 && cur.total < prev.total * 0.9 && ym !== thisMonth()) out.push({ tone: 'good', text: `Nice: spending fell ${Math.round((1 - cur.total / prev.total) * 100)}% from last month. Treat yourself to something small within the forecast.` });
  const room = inc > 0 ? inc - f.total : 0;
  if (room > 0) out.push({ tone: 'good', text: `Reward budget: if you keep to the forecast you could spend up to ${money(Math.min(room * 0.2, room))} on something you want and still stay positive.` });
  if (f.lower != null && f.upper != null) out.push({ tone: 'note', text: `Rough historical error range: about ${money(f.lower)}–${money(f.upper)}, based on past forecast errors. Method: ${f.method}; tested on ${f.backtestCount} historical months.` });
  out.push(...behaviorPatterns(db).map((x) => ({ tone: x.tone, text: x.text })));
  return out.slice(0, 6);
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
