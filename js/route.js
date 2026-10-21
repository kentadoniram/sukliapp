// Trips: "San Pedro - Ayala One" is a route with a direction. The same two stops the other way round is the RETURN trip:
// related (same stops, same usual mode and fare) but never "the same", because when you travel it is not the same.
// Also: optional From / To, the home stop, and a guess of where you go next by hour of day.
import { canon } from './textnorm.js';

const SEP = /\s+[-–—~>→⇒]+\s+|\s*[→⇒]\s*|\s+to\s+/i;
const NOISE = new Set(['station', 'sta', 'stop', 'terminal', 'mrt', 'lrt', 'the', 'bus']);
// "One Ayala" and "Ayala One" are the same stop: compare the words without their order
export const placeKey = (s) => canon(s).split(' ').filter((w) => w && !NOISE.has(w)).sort().join(' ');
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const MODEPFX = /^\s*(bus|train|mrt|lrt|jeep(ney)?|taxi|grab|tricycle|trike|ferry|metro|subway|shinkansen|jr)\s*[:：]\s*/i;
export function parseRoute(name) {
  const n = clean(String(name || '').normalize('NFKC').replace(MODEPFX, ''));
  if (!n || n.length > 60) return null;
  let parts = n.split(SEP);
  if (parts.length === 1) { const m = n.match(/^([^\d-]{3,})-([^\d-]{3,})$/); if (m) parts = [m[1], m[2]]; }   // "San Pedro-Ayala One"
  if (parts.length !== 2) return null;
  const from = clean(parts[0]), to = clean(parts[1]), fk = placeKey(from), tk = placeKey(to);
  if (!fk || !tk || fk === tk) return null;
  return { from, to, fk, tk };
}
export function routeOf(t) {
  if (t && t.from && t.to) { const fk = placeKey(t.from), tk = placeKey(t.to); if (fk && tk && fk !== tk) return { from: t.from, to: t.to, fk, tk }; }
  return parseRoute(t && t.name);
}
// 'same' = one route, maybe spelled differently; 'reverse' = the way back; 'other' = a different route; null = not routes
export function routeRelation(a, b) {
  const x = parseRoute(a), y = parseRoute(b); if (!x || !y) return null;
  if (x.fk === y.fk && x.tk === y.tk) return 'same';
  if (x.fk === y.tk && x.tk === y.fk) return 'reverse';
  return 'other';
}
export const routeName = (from, to) => `${clean(from)} - ${clean(to)}`;

const median = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };
const hourOf = (d) => { const m = String(d || '').match(/[ T](\d{2}):/); return m ? +m[1] : 12; };

// every directed route you travelled: counts, hours of day, usual category, usual fare
export function routeStats(db, isTransport) {
  const dir = new Map(), places = new Map(), days = new Map();
  for (const t of db.txs) {
    if (t.deleted || t.kind !== 'expense' || !t.name || !isTransport(t.cat)) continue;
    const r = routeOf(t); if (!r) continue;
    const k = r.fk + '>' + r.tk;
    let e = dir.get(k); if (!e) { e = { fk: r.fk, tk: r.tk, from: r.from, to: r.to, n: 0, hours: new Array(24).fill(0), cats: new Map(), amts: [], last: '' }; dir.set(k, e); }
    const dk = String(t.date).slice(0, 10), dl = days.get(dk) || []; dl.push({ at: t.date, fk: r.fk, tk: r.tk }); days.set(dk, dl);
    e.n++; e.hours[hourOf(t.date)]++; e.cats.set(t.cat, (e.cats.get(t.cat) || 0) + 1); e.amts.push(t.amount); if (t.date > e.last) { e.last = t.date; e.from = r.from; e.to = r.to; }
    for (const [pk, nm] of [[r.fk, r.from], [r.tk, r.to]]) { const p = places.get(pk) || { name: nm, n: 0 }; p.n++; places.set(pk, p); }
  }
  for (const e of dir.values()) { const c = [...e.cats.entries()].sort((a, b) => b[1] - a[1])[0]; e.cat = c ? c[0] : ''; e.amount = median(e.amts); }
  return { dir, places, days };
}
// the stop you leave in the morning and come back to in the evening. You can set it yourself in Settings.
export function homeKey(db, stats) {
  const set = placeKey((db.settings && db.settings.homePlace) || '');
  if (set) return set;
  const sc = new Map();                                                  // the first trip of a day leaves home, the last one comes back
  for (const list of stats.days.values()) {
    list.sort((a, b) => (a.at < b.at ? -1 : 1));
    const first = list[0], last = list[list.length - 1];
    if (hourOf(first.at) <= 11) sc.set(first.fk, (sc.get(first.fk) || 0) + 1);
    if (list.length > 1 && hourOf(last.at) >= 15) sc.set(last.tk, (sc.get(last.tk) || 0) + 1);
  }
  const top = [...sc.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 4 ? top[0] : '';
}
const hourWeight = (hist, h) => { const tot = hist.reduce((a, b) => a + b, 0) || 1; return (0.5 * hist[(h + 23) % 24] + hist[h] + 0.5 * hist[(h + 1) % 24]) / tot; };

// Where are you going? Ranked trips for this hour. Optional: the stop you are leaving (typed), the stop you are going to, the previous trip today.
export function suggestTrips(db, isTransport, { hour = 12, from = '', to = '', prevTo = '', limit = 4, stats = routeStats(db, isTransport) } = {}) {
  const home = homeKey(db, stats), fk = placeKey(from), tk = placeKey(to), pk = placeKey(prevTo);
  const match = (key, q) => !q || key === q || key.includes(q) || q.includes(key);
  const rows = [];
  for (const e of stats.dir.values()) {
    if (!match(e.fk, fk) || !match(e.tk, tk)) continue;
    let s = Math.pow(e.n, 0.7) * (0.12 + hourWeight(e.hours, hour));
    if (home && !pk) {
      if (hour >= 4 && hour <= 11) { if (e.fk === home) s *= 2.5; if (e.tk === home) s *= 0.08; }      // you do not travel towards home at 6 am
      else if (hour >= 17) { if (e.tk === home) s *= 2.5; if (e.fk === home) s *= 0.3; }
    }
    if (pk && !fk) { if (e.fk === pk) s *= 3; else s *= 0.5; }                                           // you left the previous trip where you are now
    rows.push({ ...e, s });
  }
  const sum = rows.reduce((a, r) => a + r.s, 0) || 1;
  return rows.sort((a, b) => b.s - a.s || b.n - a.n).slice(0, limit).map((r) => ({ from: r.from, to: r.to, cat: r.cat, amount: r.amount, n: r.n, p: r.s / sum, name: routeName(r.from, r.to) }));
}
// put the likely direction first and drop the impossible one when its other way round is known ("Usual" quick picks)
export function rankRouteNames(db, isTransport, names, hour, stats = routeStats(db, isTransport)) {
  const home = homeKey(db, stats); if (!home) return names;
  const score = (n) => { const r = parseRoute(n); if (!r) return 1; const e = stats.dir.get(r.fk + '>' + r.tk); let s = 1;
    if (hour >= 4 && hour <= 11) { if (r.tk === home) s = 0.05; if (r.fk === home) s = 2; } else if (hour >= 17) { if (r.tk === home) s = 2; if (r.fk === home) s = 0.3; }
    return e ? s * (0.3 + hourWeight(e.hours, hour) * 3) : s; };
  return names.map((n, i) => ({ n, s: score(n), i })).filter((x) => x.s > 0.1).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.n);
}
export const isTransportCat = (cats) => { const m = new Map(cats.map((c) => [c.id, c])); const re = /bus|mrt|lrt|jeep|train|tricycle|taxi|grab|metro|ferry|ic card|transport/i; return (id) => { const c = m.get(id); return !!c && (c.group === 'Transportation' || re.test(c.name)); }; };

// words typed in the label that mean "a trip": bus, MRT, jeepney, taxi, Grab, train, ferry, tricycle, IC card, Suica...
export const transportWord = (t) => /(^|[^a-z])(bus|mrt|lrt|jeep(ney)?|train|tricycle|trike|taxi|grab|ferry|metro|subway|shinkansen|suica|pasmo|icoca|ic card|densha|basu)([^a-z]|$)|バス|電車|地下鉄|タクシー|新幹線|電車賃/i.test(String(t || ''));

// the kind of vehicle, from what was typed ("bus", "Train: A - B") or from the category name; "" when unknown
const MODES = { bus: 'Bus', train: 'Train', mrt: 'MRT', lrt: 'LRT', jeep: 'Jeepney', jeepney: 'Jeepney', taxi: 'Taxi', grab: 'Grab', tricycle: 'Tricycle', trike: 'Tricycle', ferry: 'Ferry', metro: 'Metro', subway: 'Subway', shinkansen: 'Shinkansen', jr: 'Train', 'ic card': 'Train', suica: 'Train', pasmo: 'Train', icoca: 'Train', basu: 'Bus', densha: 'Train', バス: 'Bus', 電車: 'Train', 地下鉄: 'Subway', タクシー: 'Taxi', 新幹線: 'Shinkansen' };
export function modeOf(text, catName = '') {
  for (const src of [String(text || ''), String(catName || '')]) {
    const t = src.toLowerCase(); let best = null;
    for (const k of Object.keys(MODES)) { const i = /^[a-z ]+$/.test(k) ? t.search(new RegExp('(^|[^a-z])' + k + '([^a-z]|$)')) : t.indexOf(k); if (i >= 0 && (best === null || i < best.i)) best = { i, k }; }
    if (best) return MODES[best.k];
  }
  return '';
}
// "Bus: One Ayala - San Pedro" with both stops, else "Bus Commute"
export const tripLabel = (mode, from, to) => {
  const m = mode || 'Transport';
  return from && to ? `${m}: ${routeName(from, to)}` : `${m} Commute`;
};
// a label that only names the vehicle ("bus", "Train", "Bus Commute") says nothing yet about the trip
export const bareMode = (text) => { const t = String(text || '').trim().toLowerCase().replace(/\s+commute$/, ''); return !!t && t.split(/\s+/).length <= 2 && !/[-–→>:]/.test(t) && !!modeOf(t) && Object.keys(MODES).some((k) => k === t || MODES[k].toLowerCase() === t); };
