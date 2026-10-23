// Input history: entries listed by WHEN THEY WERE TYPED IN (not by the date of the entry), so an entry added with the wrong date
// (a year ago, say) is easy to find, fix, put back to what it was, or delete. The Entries tab keeps showing entries by their own date.
import { get, commit, stamp, accountMap, catMap, fmt, HOME, restoreRec, softDelete } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { openEntry } from './entry.js';

const st = { f: 'all', limit: 40 };
const day = (ms) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const when = (ms) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const gap = (t) => { const typed = new Date(t.createdAt || t.updatedAt), d = new Date(t.date.replace(' ', 'T')); return Math.round((typed - d) / 864e5); };
const label = (n) => { const a = Math.abs(n); const span = a >= 365 ? `${Math.round(a / 365 * 10) / 10} years` : a >= 60 ? `${Math.round(a / 30)} months` : `${a} days`; return n > 0 ? `${span} before it was typed in` : `${span} after it was typed in (future date)`; };

export function inputHistory(db) {
  const am = accountMap(db), cm = catMap(db);
  let list = db.txs.filter((t) => t.updatedAt && !t.purged && (t.date || t.deleted));
  const odd = (t) => Math.abs(gap(t)) > 31;
  if (st.f === 'odd') list = list.filter((t) => !t.deleted && odd(t) && !t.src);
  else if (st.f === 'edited') list = list.filter((t) => !t.deleted && t.rev && t.rev.length);
  else if (st.f === 'deleted') list = list.filter((t) => t.deleted);
  list.sort((a, b) => (b.deletedAt && st.f === 'deleted' ? b.deletedAt : b.updatedAt) - (a.deletedAt && st.f === 'deleted' ? a.deletedAt : a.updatedAt));
  const shown = list.slice(0, st.limit); let html = '', last = '';
  for (const t of shown) {
    const d = day(t.updatedAt); if (d !== last) { html += `<h3 class="subh">${esc(d === day(Date.now()) ? 'Today' : d)}</h3>`; last = d; }
    const a = am.get(t.acct), c = cm.get(t.cat), g = t.date ? gap(t) : 0, old = !t.deleted && !t.src && Math.abs(g) > 31;
    const amt = t.kind === 'transfer' ? fmt(t.amount, t.cur) : fmt(t.kind === 'income' ? t.amount : -t.amount, t.cur);
    const how = t.deleted ? 'Deleted' : t.src ? 'Imported' : t.rev && t.rev.length ? 'Edited' : 'Added';
    html += `<div class="ihrow ${old ? 'odd' : ''}"><button type="button" class="row ihmain" data-act="ih-edit" data-id="${t.id}"><i class="badge sm" style="background:var(--line)">${esc(how[0])}</i>
      <span class="rmain"><strong>${esc(t.name || (c && c.name) || (t.kind === 'transfer' ? 'Transfer' : 'Entry'))}</strong>
      <small>${esc(how)} ${esc(when(t.deleted ? t.deletedAt || t.updatedAt : t.updatedAt))} · dated <b>${esc((t.date || '').slice(0, 10))}</b>${a ? ' · ' + esc(a.name) : ''}</small>
      ${old ? `<small class="ihwarn">Unusual date: ${esc(label(g))}</small>` : ''}</span><span class="ramt"><b>${amt}</b></span></button>
      <div class="ihact">${t.deleted ? `<button type="button" class="linkbtn" data-act="ih-restore" data-id="${t.id}">Restore</button>` : ''}${!t.deleted && t.rev && t.rev.length ? `<button type="button" class="linkbtn" data-act="ih-revert" data-id="${t.id}">Put back the earlier version (${esc((t.rev[0].date || '').slice(0, 10))}, ${fmt(t.rev[0].kind === 'income' || t.rev[0].kind === 'transfer' ? t.rev[0].amount : -t.rev[0].amount, t.rev[0].cur || t.cur)})</button>` : ''}</div></div>`;
  }
  const chips = [['all', 'All'], ['odd', 'Odd dates'], ['edited', 'Edited'], ['deleted', 'Deleted']];
  return `<p class="hint">Listed by when you typed them in. “Odd dates” are entries dated far from the day they were typed in, like a wrong year.</p>
    <div class="filters" role="group" aria-label="Show">${chips.map(([v, l]) => `<button type="button" class="chip ${st.f === v ? 'on' : ''}" data-act="ih-filter" data-v="${v}">${l}</button>`).join('')}</div>
    <div id="ihlist">${html || '<p class="empty">Nothing here.</p>'}</div>${list.length > shown.length ? `<button class="btn ghost wide" data-act="ih-more">Show more (${list.length - shown.length} left)</button>` : ''}`;
}
let sh = null;
const redraw = () => { if (sh && sh.el.isConnected) sh.el.innerHTML = inputHistory(get()); };
export function openInputHistory() { st.f = 'all'; st.limit = 40; sh = sheet(inputHistory(get()), { title: 'Input history', wide: true }); }
ACT['ih-open'] = () => openInputHistory();
ACT['ih-filter'] = (el) => { st.f = el.dataset.v; st.limit = 40; redraw(); };
ACT['ih-more'] = () => { st.limit += 60; redraw(); };
ACT['ih-edit'] = (el) => { const t = get().txs.find((x) => x.id === el.dataset.id); if (t && !t.deleted) openEntry({ id: t.id }); };
ACT['ih-restore'] = (el) => { commit((d) => { const t = d.txs.find((x) => x.id === el.dataset.id); if (t) restoreRec(t); }); toast('Restored.'); redraw(); };
ACT['ih-revert'] = async (el) => {
  const t = get().txs.find((x) => x.id === el.dataset.id); if (!t || !t.rev || !t.rev.length) return;
  const r = t.rev[0];
  if (!(await confirmDialog(`Put this entry back to how it was before the last change?\nNow: ${(t.date || '').slice(0, 10)}, ${fmt(t.amount, t.cur)}\nBefore: ${(r.date || '').slice(0, 10)}, ${fmt(r.amount, r.cur || t.cur)}`, 'Yes, put it back'))) return;
  commit((d) => { const x = d.txs.find((q) => q.id === t.id); const { at, ...old } = x.rev[0]; const now = {}; for (const k of Object.keys(old)) if (x[k] !== undefined) now[k] = x[k];
    x.rev = [{ at: Date.now(), ...now }, ...x.rev.slice(1)].slice(0, 5); Object.assign(x, old); stamp(x); });
  toast('Put back.'); redraw();
};
