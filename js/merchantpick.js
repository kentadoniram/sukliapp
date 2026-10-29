// Merchant: where you bought something (Shopee, Lazada, wet market...), separate from the category, which says what it was.
// Pick-or-add: choose one you have used, a suggestion, or type a new one. Stored as `merchant` on an expense entry (shown in the Sukli CSV only).
import { get } from './core.js';
import { sheet, esc } from './ui.js';
import { norm } from './merchants.js';

export const STARTERS = ['Shopee', 'Lazada', 'Amazon', 'Supermarket', 'Wet market', 'Mall', 'Convenience store', 'Pharmacy'];
const BRANDS = STARTERS.slice(0, 3);   // shop names; the rest are kinds of place, only ever suggested while typing
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// merchants already used, most used first (case and spacing differences count as one)
export function merchantList(db) {
  const m = new Map();
  for (const t of db.txs) {
    if (t.deleted || !t.merchant) continue; const k = norm(t.merchant), o = m.get(k) || { name: clean(t.merchant), n: 0, last: '', spell: new Map() };
    o.n++; if (String(t.date) > o.last) o.last = String(t.date); o.spell.set(clean(t.merchant), (o.spell.get(clean(t.merchant)) || 0) + 1); m.set(k, o);
  }
  return [...m.values()].map((o) => ({ name: [...o.spell.entries()].sort((a, b) => b[1] - a[1])[0][0], n: o.n, last: o.last })).sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1));
}
// the spelling to save: one you already use if it matches (ignoring case and spaces), a suggestion's spelling, else what was typed
export function canonMerchant(db, text) {
  let t = clean(text); if (!t) return '';
  const k = norm(t), hit = merchantList(db).find((m) => norm(m.name) === k) || STARTERS.map((n) => ({ name: n })).find((m) => norm(m.name) === k);
  if (hit) return hit.name;
  return t === t.toLowerCase() ? t.replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()) : t;   // typed all in small letters: Capital Letters For Each Word
}
// a merchant named inside the entry's name ("Shopee order", "lazada"): suggested, never forced
export function guessMerchant(db, name, brandsOnly = false) {
  const n = norm(name); if (n.length < 3) return '';
  const pool = [...merchantList(db), ...(brandsOnly ? BRANDS : STARTERS).map((x) => ({ name: x, n: 0 }))];
  const hit = pool.find((m) => { const k = norm(m.name); return k.length >= 3 && (n === k || n.includes(k)); });
  return hit ? hit.name : '';
}

export function openMerchantPicker({ selected = '', title = 'Merchant' } = {}, onPick) {
  const db = get(), used = merchantList(db), usedKeys = new Set(used.map((m) => norm(m.name))), sugg = STARTERS.filter((x) => !usedKeys.has(norm(x)));
  const s = sheet(`<input type="search" id="mq" class="search" data-noclear="1" placeholder="Search or type a new merchant" autocomplete="off" autofocus>
    <div id="mlist"></div>`, { title, cls: 'pickfix' });
  const draw = () => {
    const q = s.el.querySelector('#mq').value, k = norm(q), has = (n) => !k || norm(n).includes(k);
    const row = (name, small, cls = '') => `<button type="button" class="row cur ${cls}" data-m="${esc(name)}"><span class="rmain"><strong>${esc(name)}</strong>${small ? `<small>${esc(small)}</small>` : ''}</span>${norm(name) === norm(selected) ? '<span class="ramt">✓</span>' : ''}</button>`;
    const u = used.filter((m) => has(m.name)), g = sugg.filter(has);
    const add = clean(q) && !used.some((m) => norm(m.name) === k) && !STARTERS.some((x) => norm(x) === k) ? `<h3>New</h3><div class="rows plain">${row(clean(q), 'Add as a new merchant', 'addnew')}</div>` : '';
    s.el.querySelector('#mlist').innerHTML = `${selected ? '<div class="rows plain"><button type="button" class="row cur" data-m=""><span class="rmain"><strong>No merchant</strong><small>Clear it for this entry</small></span></button></div>' : ''}
      ${u.length ? `<h3>You have used</h3><div class="rows plain">${u.map((m) => row(m.name, `${m.n} ${m.n === 1 ? 'entry' : 'entries'}`)).join('')}</div>` : ''}
      ${g.length ? `<h3>Suggestions</h3><div class="rows plain">${g.map((x) => row(x, '')).join('')}</div>` : ''}${add}
      ${!u.length && !g.length && !add ? '<p class="empty">Nothing matches. Type the merchant name to add it.</p>' : ''}`;
  };
  s.el.querySelector('#mq').addEventListener('input', draw);
  s.el.querySelector('#mq').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = clean(e.target.value); if (v) { s.close(); onPick(canonMerchant(get(), v)); } } });
  s.el.addEventListener('click', (e) => { const r = e.target.closest('[data-m]'); if (r) { s.close(); onPick(r.dataset.m === '' ? '' : canonMerchant(get(), r.dataset.m)); } });
  draw();
}

// old entries with no merchant whose name contains a merchant you use (or Shopee, Lazada...): offered once, never changed without a yes
export function fillCandidates(db) {
  const out = []; for (const t of db.txs) { if (t.deleted || t.kind !== 'expense' || t.merchant) continue; const m = guessMerchant(db, t.name, true); if (m) out.push({ id: t.id, m }); } return out;
}
