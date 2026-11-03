// Optional location (off by default). When it is on, Sukli notes roughly where you were (rounded to about 1 km) when you saved an entry,
// on this device and in your Sukli CSV only. It uses the phone's own location, not a map service, so it costs nothing and nothing is sent anywhere.
// From those points Sukli learns where you usually are in the evening (home) and on weekdays in the daytime (work), unless you set Home yourself.
// How far an entry is from home or work is one clue for the trip engine; it never decides alone.
import { get, commit, commitQuiet } from './core.js';
import { ACT, esc, toast, confirmDialog } from './ui.js';

export const locOn = (db) => !!(db.settings && db.settings.locOn);
const R = 6371, rad = (x) => (x * Math.PI) / 180;
export const distKm = (a, b) => {
  const dLa = rad(b.la - a.la), dLo = rad(b.lo - a.lo), h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.la)) * Math.cos(rad(b.la)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
const r2 = (n) => Math.round(n * 100) / 100;       // about 1 km: enough to tell home from a day trip, too coarse to point at a house

// ask the phone where it is; resolves to null when it is not allowed or takes too long (an entry never waits for this)
export function here(ms = 6000) {
  return new Promise((res) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return res(null);
    const t = setTimeout(() => res(null), ms + 500);
    try { navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); res({ la: r2(p.coords.latitude), lo: r2(p.coords.longitude) }); }, () => { clearTimeout(t); res(null); }, { enableHighAccuracy: false, timeout: ms, maximumAge: 10 * 60 * 1000 }); } catch { clearTimeout(t); res(null); }
  });
}
// like here(), but says why it failed: { p } or { err: 'denied' | 'unavailable' | 'timeout' }
export function hereWhy(ms = 8000) {
  return new Promise((res) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return res({ err: 'unavailable' });
    try { navigator.geolocation.getCurrentPosition((p) => res({ p: { la: r2(p.coords.latitude), lo: r2(p.coords.longitude) } }), (e) => res({ err: e && e.code === 1 ? 'denied' : e && e.code === 3 ? 'timeout' : 'unavailable' }), { enableHighAccuracy: false, timeout: ms, maximumAge: 10000 }); } catch { res({ err: 'unavailable' }); }
  });
}
// 'granted' | 'denied' | 'prompt' | 'unknown' (some phones cannot tell until you ask)
export async function permState() { try { return (await navigator.permissions.query({ name: 'geolocation' })).state; } catch { return 'unknown'; } }
export const parsePt = (t) => { const m = String(t).match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/); if (!m) return null; const la = +m[1], lo = +m[2]; return Math.abs(la) <= 90 && Math.abs(lo) <= 180 ? { la: r2(la), lo: r2(lo) } : null; };
const hourOf = (d) => +String(d).slice(11, 13) || 0;
const dowOf = (d) => new Date(String(d).slice(0, 10) + 'T12:00:00').getDay();
const withLoc = (db) => (db.txs || []).filter((t) => !t.deleted && t.loc && isFinite(t.loc.la) && isFinite(t.loc.lo));
// the busiest ~2 km patch among some points, as the average of its points
function densest(pts, minN) {
  const cells = new Map();
  for (const p of pts) { const k = Math.round(p.la / 0.02) + ':' + Math.round(p.lo / 0.02); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(p); }
  let best = null; for (const v of cells.values()) if (!best || v.length > best.length) best = v;
  if (!best || best.length < minN) return null;
  return { la: r2(best.reduce((s, p) => s + p.la, 0) / best.length), lo: r2(best.reduce((s, p) => s + p.lo, 0) / best.length), n: best.length };
}
// {home, work}: each { la, lo, n, src: 'set' | 'learned' } or null
export function placesOf(db) {
  const st = db.settings || {}, pts = withLoc(db), out = { home: null, work: null };
  if (st.homeLoc && isFinite(st.homeLoc.la)) out.home = { ...st.homeLoc, src: 'set' };
  else { const h = densest(pts.filter((t) => { const hr = hourOf(t.date); return hr >= 20 || hr < 7; }).map((t) => t.loc), 3) || densest(pts.map((t) => t.loc), 8); if (h) out.home = { ...h, src: 'learned' }; }
  const day = pts.filter((t) => { const hr = hourOf(t.date), dw = dowOf(t.date); return dw >= 1 && dw <= 5 && hr >= 9 && hr < 18 && (!out.home || distKm(t.loc, out.home) > 3); }).map((t) => t.loc);
  const w = densest(day, 5); if (w) out.work = { ...w, src: 'learned' };
  return out;
}
// how far from home and work an entry was (km), or null when unknown
export function farKm(places, loc) {
  if (!loc || !places) return null; const ds = [places.home, places.work].filter(Boolean).map((p) => distKm(loc, p)); return ds.length ? Math.min(...ds) : null;
}
// right after saving: note where you are, only for an entry made now (a back-dated entry was not made where you are)
export function captureLoc(db, id, date) {
  if (!locOn(db) || !id) return;
  const t = new Date(String(date).replace(' ', 'T')).getTime(); if (!isFinite(t) || Math.abs(Date.now() - t) > 2 * 3600e3) return;
  here().then((p) => { if (!p) return; commitQuiet((d) => { const x = d.txs.find((q) => q.id === id); if (x && !x.deleted) x.loc = p; }); });
}

const fmtPt = (p) => `${p.la.toFixed(2)}, ${p.lo.toFixed(2)}`;
export function locSection(db) {
  const on = locOn(db), pl = placesOf(db), n = withLoc(db).length;
  const line = (label, p, none) => `<li><span>${label}</span><b>${p ? `about ${fmtPt(p)}<small> ${p.src === 'set' ? 'you set it' : `learned from ${p.n} entries`}</small>` : `<small>${none}</small>`}</b></li>`;
  return `<section id="loc-set" class="adv-only"><h2>Location (Optional)</h2>
    <p class="hint">When it is on, Sukli notes roughly where you are (to about 1 km) when you save an entry. It is kept on this device and in your Sukli CSV, never sent anywhere, and it needs your phone's permission. Far from home or work is one clue that a day was a trip; it never decides alone, and a nearby mall visit is not a trip.</p>
    <div class="btnrow left"><button type="button" class="btn ${on ? 'ghost' : ''}" data-act="loc-toggle">${on ? 'Turn off' : 'Turn on'}</button></div>
    ${on || n ? `<ul class="calfacts">${line('Home', pl.home, 'not known yet. Sukli learns it from where you usually save entries in the evening.')}${line('Work', pl.work, 'not known yet. Learned from weekday daytime entries.')}<li><span>Entries with a place</span><b>${n}</b></li></ul>
    <div class="btnrow left"><button type="button" class="btn ghost sm" data-act="loc-sethome">Use where I am now as Home</button>${db.settings.homeLoc ? '<button type="button" class="btn ghost sm" data-act="loc-clearhome">Let Sukli learn Home</button>' : ''}${n ? '<button type="button" class="btn ghost danger sm" data-act="loc-forget">Forget all saved places</button>' : ''}</div>` : ''}</section>`;
}
ACT['loc-toggle'] = async () => {
  const on = locOn(get());
  if (!on) { const p = await here(8000); if (!p) { toast('Could not get your location. Allow location for Sukli in your phone settings, then try again.'); return; } }
  commit((d) => { d.settings.locOn = !on; }); toast(on ? 'Location is off. Saved places stay until you forget them.' : 'Location is on.');
};
ACT['loc-sethome'] = async () => { const p = await here(8000); if (!p) { toast('Could not get your location.'); return; } commit((d) => { d.settings.homeLoc = { la: p.la, lo: p.lo, n: 0 }; }); toast('Home set.'); };
ACT['loc-clearhome'] = () => { commit((d) => { delete d.settings.homeLoc; }); toast('Sukli will learn Home from your entries.'); };
ACT['loc-forget'] = async () => {
  if (!(await confirmDialog('Forget every saved place?', 'Forget', true, 'Keep'))) return;
  commit((d) => { for (const t of d.txs) if (t.loc) delete t.loc; delete d.settings.homeLoc; }); toast('Saved places removed.');
};
