// Crypto Earn: automatic subscriptions and hourly earnings, always on UTC+8 (the exchange clock), never the phone's own timezone.
// A subscription at 15:09 starts earning at 16:00 and the first hourly payout is recorded at 17:00 (both rules can be changed per product).
// Hourly payouts are kept in a small log (settings.earnLog). After midnight UTC+8 each finished day becomes ONE entry, so Entries stays short.
import { get, balances, stamp, rateFor, findOrAddCategory, nowStamp } from './core.js';
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
export const DEFAULT = { on: false, apy: 0, subOn: false, slots: ['03:00', '15:00'], subAmt: 'all', from: '', startRule: 'nextHour', startLagH: 0, firstLagH: 1 };
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
export function earnDue(db, now = Date.now()) {
  return db.accounts.some((a) => { if (!isEarnOn(a)) return false; const c = cfgOf(a);
    return c.lastHour == null || floorHour(now) > c.lastHour || (c.subOn && c.lastSlot != null && slotTimes(c, c.lastSlot, now, tzOf(db, a)).length > 0); });
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
      const src = db.accounts.find((x) => x.id === c.from && !x.deleted && x.cur === a.cur && x.id !== a.id);
      if (src) for (const ms of slotTimes(c, Math.max(E.lastSlot, now - 14 * 24 * H), now, off)) {
        const id = `earnsub-${a.id}-${ms}`; if (db.txs.some((t) => t.id === id)) continue;
        const bal = r8(balances(db).get(src.id) || 0), amt = c.subAmt === 'all' ? bal : Math.min(bal, r8(parseFloat(c.subAmt) || 0));
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
    // 3. finished days (UTC+8) become one entry each; a payout at 00:00 belongs to the day that just ended
    const by = new Map();
    for (const x of log.hours) { const z = x.z != null ? x.z : off, d = e8(x.h - 1, z).day; if (d < e8(now, z).day) { x.z = z; if (!by.has(d)) by.set(d, []); by.get(d).push(x); } }
    for (const [day, hs] of [...by].sort()) {
      const amt = r8(hs.reduce((s, x) => s + x.amt, 0)), id = `earn-${a.id}-${day}`;
      if (amt > 0 && !db.txs.some((t) => t.id === id)) {
        const cat = findOrAddCategory(db, 'Earn', 'Crypto earned', 'income');
        db.txs.push(stamp({ id, kind: 'income', date: `${day} 23:55:00`, acct: a.id, cur: a.cur, amount: amt, fx: rateFor(db, a.cur) || 1, cat: cat.id, name: 'Earn interest', auto: true, earnDay: day })); made.days++;
      }
      log.days.push({ day, amt, tx: id, z: hs[0].z, hours: hs.sort((p, q) => p.h - q.h).map((x) => [x.h, x.amt]) });
      log.hours = log.hours.filter((x) => !hs.includes(x));
    }
    log.days.sort((p, q) => (p.day < q.day ? 1 : -1));
    stamp(a);
  }
  return made;
}
