// Day trip or commute? Reads the rides of a Pasmo / Suica screenshot (plus your earlier train entries) and decides, day by day.
// Two clues, never one alone:
//   1. DISTANCE: how far the farthest station of the day is from Home (straight line, haversine formula on the station's position).
//   2. PATTERN:  a pair of stations you ride again and again on different weekdays is a commute, however far it is.
// A ride is never a trip just because it is a train ride. A station that is not in js/stations.js has no distance: then only the pattern speaks.
import { findStation, stationKey } from './stations.js';
import { distKm } from './loc.js';

export const FAR_KM = 25, NEAR_KM = 12, COMMUTE_DAYS = 3;
const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const pairKey = (a, b) => [stationKey(a), stationKey(b)].sort().join('|');
const isWeekday = (d) => { const w = new Date(d).getDay(); return w >= 1 && w <= 5; };

// pairs ridden on COMMUTE_DAYS or more different weekdays: [{from, to, when}] -> Set of pair keys
export function commutePairs(rides) {
  const m = new Map();
  for (const r of rides) { if (!r.from || !r.to || !isWeekday(r.when)) continue; const k = pairKey(r.from, r.to); if (!m.has(k)) m.set(k, new Set()); m.get(k).add(ymd(r.when)); }
  return new Set([...m].filter(([, d]) => d.size >= COMMUTE_DAYS).map(([k]) => k));
}
// home: { la, lo } or null. rides: the new ones. history: older rides [{from, to, when}] that show the usual pattern.
// Returns Map(date -> { kind: 'daytrip' | 'maybe' | 'commute' | 'regular', km, far, why })
export function classifyDays(rides, home, history = []) {
  const commute = commutePairs([...history, ...rides]), days = new Map(), out = new Map();
  for (const r of rides) { const d = ymd(r.when); if (!days.has(d)) days.set(d, []); days.get(d).push(r); }
  for (const [d, rs] of days) {
    const stops = [...new Set(rs.flatMap((r) => [r.from, r.to]).filter(Boolean))].map((n) => ({ n, s: findStation(n) }));
    let far = null;
    if (home) for (const x of stops) if (x.s) { const km = distKm(home, x.s); if (!far || km > far.km) far = { name: x.s.name, km, la: x.s.la, lo: x.s.lo }; }
    const usual = rs.every((r) => commute.has(pairKey(r.from, r.to))), weekend = !isWeekday(d + 'T12:00:00'), km = far ? Math.round(far.km) : null;
    let kind = 'regular', why = '';
    if (usual) { kind = 'commute'; why = 'You ride this route on many weekdays.'; }
    else if (far && far.km >= FAR_KM) { kind = 'daytrip'; why = `${far.name} is about ${km} km from home and this is not a route you ride often.`; }
    else if (far && far.km >= NEAR_KM && (weekend || rs.length >= 3)) { kind = 'maybe'; why = `${far.name} is about ${km} km from home, on ${weekend ? 'a weekend' : 'a day with many rides'}.`; }
    else if (!far && !usual && weekend && rs.length >= 2) { kind = 'maybe'; why = 'A weekend with several rides on stations Sukli does not know yet.'; }
    out.set(d, { kind, km, far, why });
  }
  return out;
}
