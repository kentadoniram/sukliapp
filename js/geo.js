// Readable address for a saved point. Nothing is looked up on its own: the point is sent to OpenStreetMap's free Nominatim service ONLY when you tap "Show Address",
// one time per place (the answer is kept in settings.geoCache, so the same place is never asked twice). You can always type your own address; yours is kept for that place.
import { get, commitQuiet } from './core.js';
export const geoKey = (p) => `${(+p.la).toFixed(2)},${(+p.lo).toFixed(2)}`;
export const cachedAddress = (db, p) => { const c = p && ((db.settings || {}).geoCache || {})[geoKey(p)]; return c ? c.t : ''; };
export function saveAddress(p, text, edited = true) {
  const t = String(text || '').replace(/\s+/g, ' ').trim(); if (!p) return;
  commitQuiet((d) => { const c = (d.settings.geoCache = d.settings.geoCache || {}); if (t) c[geoKey(p)] = { t, at: Date.now(), ...(edited ? { edited: true } : {}) }; else delete c[geoKey(p)]; });
}
let lastCall = 0;
// returns { text } or { err: 'offline' | 'none' | 'busy' }; a saved answer comes back at once with no network call
export async function lookupAddress(p, fetcher = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null)) {
  const hit = cachedAddress(get(), p); if (hit) return { text: hit, cached: true };
  if (!fetcher) return { err: 'offline' };
  const wait = lastCall + 1100 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));   // the service allows one request a second
  lastCall = Date.now();
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetcher(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=en&lat=${(+p.la).toFixed(5)}&lon=${(+p.lo).toFixed(5)}`, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t); if (!r.ok) return { err: r.status === 429 ? 'busy' : 'offline' };
    const j = await r.json(), a = j.address || {};
    // short and readable: the place, the neighbourhood, the city and the region (no country, no postcode)
    const parts = [a.amenity || a.shop || a.building || a.road, a.neighbourhood || a.suburb || a.quarter, a.city_district || a.ward, a.city || a.town || a.village || a.county, a.state].filter(Boolean);
    const text = (parts.length ? [...new Set(parts)].join(', ') : String(j.display_name || '').split(',').slice(0, 4).join(',')).trim();
    if (!text) return { err: 'none' };
    saveAddress(p, text, false); return { text };
  } catch { return { err: 'offline' }; }
}

// Saved entries that have a point but no address yet (added offline, or before this existed): fill them in the background,
// one place at a time, at most `max` new lookups per call. An answer already in the cache costs no request. Safe to call often.
let backfilling = false;
export async function backfillAddresses(max = 6) {
  if (backfilling || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0;
  backfilling = true; let looked = 0, filled = 0;
  try {
    const todo = new Map();
    for (const t of get().txs) if (!t.deleted && t.loc && !t.place && isFinite(t.loc.la) && isFinite(t.loc.lo)) { const k = geoKey(t.loc); if (!todo.has(k)) todo.set(k, t.loc); }
    for (const [k, p] of todo) {
      const cached = cachedAddress(get(), p);
      if (!cached) { if (looked >= max) continue; looked++; }
      const r = cached ? { text: cached } : await lookupAddress(p);
      if (r.err === 'busy') break;
      if (r.text) { commitQuiet((d) => { for (const t of d.txs) if (!t.deleted && t.loc && !t.place && geoKey(t.loc) === k) { t.place = r.text; filled++; } }); }
    }
  } finally { backfilling = false; }
  return filled;
}

// Search for a place by name (used by "Pick a Place"). Only sent when you press Search. Returns { list: [{ text, la, lo }] } or { err }.
export async function searchPlaces(q, fetcher = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null)) {
  q = String(q || '').trim(); if (!q) return { err: 'empty' };
  if (!fetcher) return { err: 'offline' };
  const wait = lastCall + 1100 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetcher(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=en&q=${encodeURIComponent(q)}`, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t); if (!r.ok) return { err: r.status === 429 ? 'busy' : 'offline' };
    const j = await r.json();
    const list = (Array.isArray(j) ? j : []).map((x) => ({ text: String(x.display_name || '').split(',').slice(0, 4).join(',').trim(), la: +x.lat, lo: +x.lon })).filter((x) => isFinite(x.la) && isFinite(x.lo));
    return list.length ? { list } : { err: 'none' };
  } catch { return { err: 'offline' }; }
}
