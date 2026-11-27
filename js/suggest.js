import { button } from './components.js';
// Suggestion list that matches the app (16.37). Any <input list="…"> is shown with this instead of the phone's own suggestion strip.
// The suggestions still come from the page's <datalist>, so every place that fills a datalist keeps working; the native list is switched off by moving the "list" attribute to data-list.
const MAX = 7;
let pop = null, inp = null, items = [], at = -1;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const listOf = (el) => { const id = el.dataset.list; const dl = id && document.getElementById(id); return dl ? [...dl.options].map((o) => ({ v: o.value, l: o.label && o.label !== o.value ? o.label : '' })) : []; };
function rank(all, q) {
  const t = q.trim().toLowerCase(); if (!t) return all.slice(0, MAX);
  const out = [];
  for (const o of all) {
    const s = `${o.v} ${o.l}`.toLowerCase(), v = o.v.toLowerCase();
    if (v === t) continue;                                   // already typed in full
    const k = v.startsWith(t) ? 0 : v.split(/[\s·\-/]+/).some((w) => w.startsWith(t)) ? 1 : s.includes(t) ? 2 : -1;
    if (k >= 0) out.push({ ...o, k });
  }
  return out.sort((a, b) => a.k - b.k).slice(0, MAX);
}
function hide() { if (pop) { pop.remove(); pop = null; } inp = null; items = []; at = -1; }
function place() {
  if (!pop || !inp) return;
  const r = inp.getBoundingClientRect(), vh = window.innerHeight, room = vh - r.bottom, h = pop.offsetHeight;
  pop.style.width = `${r.width}px`; pop.style.left = `${r.left}px`;
  pop.style.top = room < h + 12 && r.top > room ? `${Math.max(8, r.top - h - 4)}px` : `${r.bottom + 4}px`;
}
function paint() {
  pop.innerHTML = items.map((o, i) => `${button({ kind: 'plain', cls: `sgopt${i === at ? ' on' : ''}`, attr: { role: 'option', 'data-i': i, 'aria-selected': String(i === at) }, html: `<span class="sgv">${mark(o.v, inp.value)}</span>${o.l ? `<small class="muted">${esc(o.l)}</small>` : ''}` })}`).join('');
}
function mark(v, q) { const t = q.trim(); if (!t) return esc(v); const i = v.toLowerCase().indexOf(t.toLowerCase()); return i < 0 ? esc(v) : `${esc(v.slice(0, i))}<b>${esc(v.slice(i, i + t.length))}</b>${esc(v.slice(i + t.length))}`; }
function show(el) {
  items = rank(listOf(el), el.value);
  if (!items.length) { hide(); return; }
  if (!pop) { pop = document.createElement('div'); pop.className = 'sgpop'; pop.setAttribute('role', 'listbox'); document.body.appendChild(pop); }
  inp = el; at = -1; paint(); place();
}
function pick(i) {
  const o = items[i], el = inp; if (!o || !el) return;
  el.value = o.v; hide();
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  el.focus();
}
const isField = (el) => el && el.tagName === 'INPUT' && (el.dataset.list || el.getAttribute('list'));
document.addEventListener('focusin', (e) => {
  const el = e.target; if (!isField(el)) return;
  if (el.getAttribute('list')) { el.dataset.list = el.getAttribute('list'); el.removeAttribute('list'); }   // switch the phone's own list off
  el.setAttribute('aria-autocomplete', 'list'); show(el);
});
document.addEventListener('input', (e) => { if (isField(e.target) && e.target === document.activeElement) show(e.target); });
document.addEventListener('focusout', (e) => { if (e.target === inp) setTimeout(() => { if (document.activeElement !== inp) hide(); }, 120); });
document.addEventListener('pointerdown', (e) => { const b = e.target.closest && e.target.closest('.sgpop:not(.sgdrop) .sgopt'); if (b) { e.preventDefault(); pick(+b.dataset.i); } });
document.addEventListener('keydown', (e) => {
  if (!pop || e.target !== inp) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); at = (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; paint(); }
  else if (e.key === 'Enter' && at >= 0) { e.preventDefault(); pick(at); }
  else if (e.key === 'Escape') { e.stopPropagation(); hide(); }
}, true);
window.addEventListener('resize', place); document.addEventListener('scroll', place, true);
