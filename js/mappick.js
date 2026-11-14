// Pick a place on a map. The map pictures come from OpenStreetMap only while this window is open (they need the internet);
// the point you choose is rounded to about 1 km like every other saved place, and stays on this device and in your Sukli CSV.
import { button } from './components.js';
import { get } from './core.js';
import { sheet, toast, esc } from './ui.js';
import { here, placesOf } from './loc.js';
import { searchPlaces } from './geo.js';

let loading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = 'vendor/leaflet/leaflet.js'; js.onload = () => res(window.L); js.onerror = () => { loading = null; rej(new Error('map')); }; document.head.appendChild(js);
  });
  return loading;
}
const r2 = (n) => Math.round(n * 100) / 100;
// where the map first looks: the point already on the entry, else your Home, else the latest entry that has a place, else Tokyo
function startPoint(db, pt) {
  if (pt && isFinite(pt.la)) return { p: pt, z: 14 };
  const h = placesOf(db).home; if (h) return { p: h, z: 12 };
  const l = (db.txs || []).filter((t) => !t.deleted && t.loc).sort((a, b) => (a.date < b.date ? 1 : -1))[0]; if (l) return { p: l.loc, z: 12 };
  return { p: { la: 35.68, lo: 139.76 }, z: 9 };
}
// resolves to { la, lo } or null when closed without choosing
export async function pickOnMap(pt) {
  let L; try { L = await loadLeaflet(); } catch { toast('The map could not load. Check your internet, or type the place instead.'); return null; }
  return new Promise((resolve) => {
    let chosen = pt && isFinite(pt.la) ? { la: pt.la, lo: pt.lo } : null, done = false;
    const s = sheet(`<div class="mpsearch"><input type="search" id="mp-q" class="mpq" placeholder="Search a place, station or address" aria-label="Search a place" autocomplete="off">${button({ label: 'Search', kind: 'ghost', attr: { 'data-mp': 'find' } })}</div>
      <div id="mp-res" class="mpres" role="listbox" aria-label="Search results"></div>
      <p class="hint">Search above, or tap the map to put the pin on a place, or drag the pin. Saved as about 1 km, like your other places.</p>
      <div id="mp-map" class="mpmap" role="application" aria-label="Map"></div>
      <p class="hint" id="mp-txt"></p>
      <div class="btnrow">${button({ label: 'Where I Am', kind: 'ghost', attr: { 'data-mp': 'me' } })}${button({ label: 'Use This Place', kind: 'primary', disabled: true, attr: { 'data-mp': 'use' } })}</div>`,
      { title: 'Pick a Place', wide: true, onClose: () => { if (!done) resolve(null); } });
    const el = s.el.querySelector('#mp-map'), txt = s.el.querySelector('#mp-txt'), use = s.el.querySelector('[data-mp=use]'), st = startPoint(get(), chosen);
    const map = L.map(el, { zoomControl: true }).setView([st.p.la, st.p.lo], st.z);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
    L.Icon.Default.prototype.options.imagePath = 'vendor/leaflet/images/';
    let mk = null;
    const show = () => { txt.textContent = chosen ? `Pin at about ${r2(chosen.la).toFixed(2)}, ${r2(chosen.lo).toFixed(2)}` : 'No pin yet.'; use.disabled = !chosen; };
    const put = (la, lo, pan) => { chosen = { la, lo }; if (!mk) { mk = L.marker([la, lo], { draggable: true }).addTo(map); mk.on('dragend', () => { const q = mk.getLatLng(); chosen = { la: q.lat, lo: q.lng }; show(); }); } else mk.setLatLng([la, lo]); if (pan) map.setView([la, lo], Math.max(map.getZoom(), 14)); show(); };
    if (chosen) put(chosen.la, chosen.lo, false); else show();
    map.on('click', (e) => put(e.latlng.lat, e.latlng.lng, false));
    setTimeout(() => map.invalidateSize(), 120);
    const res = s.el.querySelector('#mp-res'), qi = s.el.querySelector('#mp-q');
    const runSearch = async () => {
      res.innerHTML = '<p class="hint">Searching…</p>';
      const r = await searchPlaces(qi.value);
      if (r.err) { res.innerHTML = `<p class="hint">${r.err === 'none' ? 'No place found. Try another spelling, or tap the map.' : r.err === 'empty' ? 'Type a place first.' : r.err === 'busy' ? 'Too many searches. Wait a moment.' : 'Could not search. Check your internet, or tap the map.'}</p>`; return; }
      res.innerHTML = r.list.map((x) => button({ label: x.text, kind: 'plain', cls: 'row mpitem', attr: { 'data-mp': 'pick', 'data-la': x.la, 'data-lo': x.lo } })).join('');
    };
    qi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
    window.__mapPick = { map, put, get: () => chosen };       // lets the tests tap the map without real tiles
    s.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-mp]'); if (!b) return;
      if (b.dataset.mp === 'pick') { const la = +b.dataset.la, lo = +b.dataset.lo; put(la, lo, true); map.setView([la, lo], 16); res.innerHTML = ''; return; }
      if (b.dataset.mp === 'find') { await runSearch(); return; }
      if (b.dataset.mp === 'me') { txt.textContent = 'Finding where you are…'; const p = await here(8000); if (p) put(p.la, p.lo, true); else { txt.textContent = 'Could not find you. Tap the map instead.'; } }
      if (b.dataset.mp === 'use' && chosen) { done = true; resolve({ la: r2(chosen.la), lo: r2(chosen.lo) }); s.close(); }
    });
  });
}
