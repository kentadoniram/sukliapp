// Crypto Earn: automatic subscriptions and hourly earnings, always on UTC+8 (the exchange clock), never the phone's own timezone.
// A subscription at 15:09 starts earning at 16:00 and the first hourly payout is recorded at 17:00 (both rules can be changed per product).
// Hourly payouts are kept in a small log (settings.earnLog). After midnight UTC+8 each finished day becomes ONE entry, so Entries stays short.
import { get, balances, stamp, rateFor, findOrAddCategory, nowStamp, uid } from './core.js';
export const H = 3600e3, E8 = 8 * H, YEAR_H = 8760;
const p2 = (n) => String(n).padStart(2, '0');
const r8 = (n) => Math.round(n * 1e8) / 1e8;
export const floorHour = (ms) => Math.floor(ms / H) * H, ceilHour = (ms) => Math.ceil(ms / H) * H;
// UTC+8 clock reading of an instant, using UTC getters only so the phone's timezone cannot leak in
export function e8(ms, off = 8) { const d = new Date(ms + off * H); return { day: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`, hm: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`, hh: d.getUTCHours() }; }
export const e8Label = (ms, off = 8) => { const x = e8(ms, off); return `${x.day} ${x.hm}`; };
export const e8Ms = (day, hm, off = 8) => { const [y, m, d] = day.split('-').map(Number), [h, mi] = hm.split(':').map(Number); return Date.UTC(y, m - 1, d, h, mi) - off * H; };
const addDay = (day, n) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// entries keep the phone's local clock as text; this turns it back into the exact instant
export function localMs(s) { const m = String(s).match(/^(\d+)-(\d+)-(\d+)[ T](\d+):(\d+)(?::(\d+))?/); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime() : 0; }
// each exchange keeps its own clock: settings.platformTz[platform] = hours from UTC; until chosen, Binance and Bybit are UTC+0 and the rest UTC+8
export const tzOf = (db, a) => { const ex = (a && a.exchange) || '', m = (db.settings && db.settings.platformTz) || {}, k = Object.keys(m).find((x) => x.toLowerCase() === ex.toLowerCase());
  if (k != null && Number.isFinite(+m[k])) return +m[k]; return /binance|bybit/i.test(ex) ? 0 : 8; };
export const tzName = (off) => `UTC${off < 0 ? '−' : '+'}${Math.abs(off)}`;
export const DEFAULT = { on: false, apy: 0, subOn: false, slots: ['03:00', '15:00'], subAmt: 'all', payTo: 'spot', from: '', startRule: 'nextHour', startLagH: 0, firstLagH: 1 };
export const cfgOf = (a) => ({ ...DEFAULT, ...(a && a.earn ? a.earn : {}) });
export const isEarnOn = (a) => !!(a && !a.deleted && a.earn && a.earn.on);
export const logOf = (db, id) => ((db.settings.earnLog = db.settings.earnLog || {})[id] = (db.settings.earnLog[id] || { hours: [], days: [] }));
// every amount that arrived in this account, with the three times that matter
// when earning starts for money that arrived at `sub`. 'nextHour': the next full hour on the clock (15:00 and 15:09 both start 16:00,
// because the hour in progress never counts). 'midnight': the exchange's next midnight in its timezone (some products start the next day).
export function earnStartOf(sub, c, off) {
  if (c.startRule === 'midnight') return e8Ms(addDay(e8(sub, off).day, 1), '00:00', off) + c.startLagH * H;
  return floorHour(sub) + H + c.startLagH * H;
}
// the account an automatic subscription moves from when none was chosen: the same coin in the Spot wallet of this platform (else any other wallet of it)
export function defaultFrom(db, a) {
  const l = db.accounts.filter((x) => !x.deleted && !x.archived && x.id !== a.id && x.cur === a.cur && (x.exchange || '') === (a.exchange || ''));
  return l.find((x) => (x.wallet || 'Spot') === 'Spot') || l[0] || null;
}
export function subscriptions(db, a) {
  const c = cfgOf(a), off = tzOf(db, a), out = [];
  for (const t of db.txs) {
    if (t.deleted || t.kind !== 'transfer' || t.toAcct !== a.id) continue;
    const sub = t.earnSubAt || localMs(t.date), start = earnStartOf(sub, c, off), first = start + c.firstLagH * H;
    out.push({ id: t.id, amt: t.toAmount != null ? t.toAmount : t.amount, sub, start, first, auto: !!t.earnAuto });
  }
  if ((a.open || 0) > 0 && c.trackFrom) out.push({ id: 'open', amt: a.open, sub: 0, start: 0, first: 0, auto: false, open: true });
  return out.sort((x, y) => x.sub - y.sub);
}
// what earns in the hour that ends at T: only amounts whose first payout time has come, never more than the account holds
export function principalAt(db, a, T, subs = subscriptions(db, a)) {
  let p = 0; for (const s of subs) if (s.first <= T) p += s.amt;
  return Math.max(0, Math.min(p, balances(db).get(a.id) || 0));
}
export function slotTimes(c, fromMs, toMs, off = 8) {
  const out = [], list = [...new Set(c.slots || [])].filter((s) => /^\d\d:\d\d$/.test(s)).sort();
  for (let d = addDay(e8(fromMs, off).day, -1); d <= e8(toMs, off).day; d = addDay(d, 1)) for (const s of list) { const ms = e8Ms(d, s, off); if (ms > fromMs && ms <= toMs) out.push(ms); }
  return out.sort((x, y) => x - y);
}
// where the interest is credited: the Spot account of the same coin on this platform (made when missing), or this Earn account itself when payTo is 'earn'
export function payDest(db, a, c = cfgOf(a)) {
  if (c.payTo === 'earn') return a;
  const low = (a.exchange || '').toLowerCase();
  let sp = db.accounts.find((x) => !x.deleted && x.id !== a.id && x.cur === a.cur && (x.exchange || '').toLowerCase() === low && (x.wallet || 'Spot') === 'Spot');
  if (!sp) { sp = stamp({ id: uid(), name: `${a.exchange || 'Spot'} ${a.cur}`, wallet: 'Spot', cur: a.cur, type: a.type, assetType: a.assetType, market: a.market, exchange: a.exchange, open: 0, include: false, archived: false, invtab: true }); db.accounts.push(sp); }
  return sp;
}
// the hours behind one day's Interest Earned entry: [[hourMs, amount]], oldest first, plus the clock it was kept on
export function dayHours(db, t) {
  const id = t.earnAcct, log = (db.settings.earnLog || {})[id] || { hours: [], days: [] }, d = log.days.find((x) => x.day === t.earnDay);
  if (d) return { hours: d.hours.slice().sort((p, q) => p[0] - q[0]), z: d.z, done: true };
  const hs = log.hours.filter((x) => e8(x.h - 1, x.z != null ? x.z : 0).day === t.earnDay).sort((p, q) => p.h - q.h);
  return { hours: hs.map((x) => [x.h, x.amt]), z: hs[0] && hs[0].z, done: false };
}
export function earnDue(db, now = Date.now()) {
  return db.accounts.some((a) => { if (!isEarnOn(a)) return false; const c = cfgOf(a);
    return c.lastHour == null || floorHour(now) > c.lastHour || (c.subOn && c.lastSlot != null && slotTimes(c, c.lastSlot, now, tzOf(db, a)).length > 0); });
}
// A day's Interest Earned entry keeps growing, so its date moves forward. If an automatic subscription already swept the interest-so-far from Spot,
// the entry must stay dated BEFORE that sweep (the sweep took part of it); otherwise Spot would show a negative balance in between.
// Only the date is held back: the amount keeps growing, the sweep stays its own internal transfer, and balances do not change.
function holdBeforeSweep(db, dest, a, t, firstMs, natural) {
  let first = null;
  for (const x of db.txs) if (!x.deleted && x.earnAuto && x.toAcct === a.id && x.acct === dest.id && x.earnSubAt >= firstMs && (first === null || x.earnSubAt < first)) first = x.earnSubAt;
  if (first === null) return natural;
  const lim = nowStamp(new Date(first - 1000));
  return lim < natural ? lim : natural;
}
export function runEarn(db, now = Date.now()) {
  const made = { subs: 0, hours: 0, days: 0 };
  for (const a of db.accounts) {
    if (!isEarnOn(a)) continue;
    const c = cfgOf(a), log = logOf(db, a.id), E = a.earn, off = tzOf(db, a);
    if (E.lastHour == null) { E.lastHour = floorHour(now); E.trackFrom = E.trackFrom || now; }
    if (E.lastSlot == null) E.lastSlot = now;
    // 1. automatic subscriptions at the chosen UTC+8 times (the real slot time is used, even if the app was closed then)
    if (c.subOn) {
      const src = db.accounts.find((x) => x.id === c.from && !x.deleted && x.cur === a.cur && x.id !== a.id) || defaultFrom(db, a);
      if (src) for (const ms of slotTimes(c, Math.max(E.lastSlot, now - 14 * 24 * H), now, off)) {
        const id = `earnsub-${a.id}-${ms}`; if (db.txs.some((t) => t.id === id)) continue;
        const bal = r8(balances(db).get(src.id) || 0), amt = bal;   // always everything that is available
        if (!(amt > 0)) continue;
        db.txs.push(stamp({ id, kind: 'transfer', date: nowStamp(new Date(ms)), acct: src.id, toAcct: a.id, cur: a.cur, amount: amt, fx: rateFor(db, a.cur) || 1, name: 'Auto subscribe to Earn', earnAuto: true, earnSubAt: ms })); made.subs++;
      }
    }
    E.lastSlot = now;
    // 2. hourly payouts, one per full hour that has passed
    const upto = floorHour(now), subs = subscriptions(db, a);
    for (let T = Math.max(E.lastHour + H, upto - 24 * 60 * H); T <= upto; T += H) {
      const prin = principalAt(db, a, T, subs), amt = r8(prin * (c.apy || 0) / 100 / YEAR_H);
      if (amt > 0 && !log.hours.some((x) => x.h === T)) { log.hours.push({ h: T, amt, prin, z: off }); made.hours++; }
    }
    E.lastHour = Math.max(E.lastHour, upto);
    // 3. one "Interest Earned" entry per day (the platform's clock), credited to Spot. Today's entry exists from the first payout and grows every hour
    //    (earnOpen: true, "still adding up"); at midnight it is closed. The hours behind it stay in the log and open when the entry is tapped.
    const dest = payDest(db, a, c), by = new Map();
    for (const x of log.hours) { const z = x.z != null ? x.z : off, d = e8(x.h - 1, z).day; x.z = z; if (!by.has(d)) by.set(d, []); by.get(d).push(x); }
    for (const [day, hs] of [...by].sort()) {
      const z = hs[0].z, finished = day < e8(now, z).day, amt = r8(hs.reduce((q, x) => q + x.amt, 0)), id = `earn-${a.id}-${day}`;
      let tx = db.txs.find((t) => t.id === id);
      if (amt > 0 && !(tx && tx.deleted)) {
        const last = Math.max(...hs.map((x) => x.h));
        if (!tx) { const cat = findOrAddCategory(db, 'Earn', 'Crypto earned', 'income'); tx = stamp({ id, kind: 'income', date: finished ? `${day} 23:55:00` : nowStamp(new Date(last)), acct: dest.id, cur: a.cur, amount: amt, fx: rateFor(db, a.cur) || 1, cat: cat.id, name: 'Interest Earned', auto: true, earnDay: day, earnAcct: a.id, earnOpen: !finished }); db.txs.push(tx); made.days++; }
        else if (tx.earnOpen) { tx.amount = amt; tx.fx = rateFor(db, a.cur) || tx.fx || 1; tx.earnOpen = !finished; tx.earnAcct = a.id; tx.date = finished ? `${day} 23:55:00` : nowStamp(new Date(last)); stamp(tx); if (finished) made.days++; }
      }
      if (tx && !tx.deleted && amt > 0) { const nd = holdBeforeSweep(db, dest, a, tx, Math.min(...hs.map((x) => x.h)), tx.date); if (nd !== tx.date) { tx.date = nd; stamp(tx); } }
      if (finished) { log.days.push({ day, amt, tx: id, z, hours: hs.sort((p, q) => p.h - q.h).map((x) => [x.h, x.amt]) }); log.hours = log.hours.filter((x) => !hs.includes(x)); }
    }
    for (const d of log.days) { const tx = d.tx && db.txs.find((t) => t.id === d.tx); if (!tx || tx.deleted || !d.hours.length) continue;   // days saved before this fix
      const nd = holdBeforeSweep(db, dest, a, tx, Math.min(...d.hours.map((x) => x[0])), tx.date); if (nd !== tx.date) { tx.date = nd; stamp(tx); } }
    log.days.sort((p, q) => (p.day < q.day ? 1 : -1));
    stamp(a);
  }
  return made;
}
