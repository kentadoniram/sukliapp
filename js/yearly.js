// Yearly events (15.37): things that come back every year (a birthday, a festival, Obon, New Year, an annual fee).
// You give the event a name and a date. Entries carrying that name as a tag (Tags / events in the entry form) are what it cost that year.
// Sukli shows when it comes next, what it cost in earlier years, and what to put aside. It never adds entries by itself.
import { get, commit, uid, stamp, nowStamp, fmt, HOME, factorFor, softDelete } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { button, textField, selectField } from './components.js';
import { parseTags } from './tags.js';

const live = (l) => (l || []).filter((x) => !x.deleted);
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dn = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Math.round(new Date(y, m - 1, d).getTime() / 864e5); };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, new Date(y, m, 0).getDate())).padStart(2, '0')}`;
const money = (n) => fmt(n, HOME, { round: true });

// what the event cost in each past year: expenses tagged with its name
export function eventCosts(db, ev) {
  const key = String(ev.name || '').trim().toLowerCase(), by = new Map(); if (!key) return [];
  for (const t of db.txs || []) {
    if (t.deleted || t.kind !== 'expense' || !t.labels) continue;
    if (!parseTags(t.labels).some((x) => x.toLowerCase() === key)) continue;
    const y = +String(t.date).slice(0, 4); by.set(y, (by.get(y) || 0) + t.amount * factorFor(db, t));
  }
  return [...by.entries()].sort((a, b) => b[0] - a[0]).map(([year, total]) => ({ year, total }));
}
// the next time it comes round (today counts), how many days away, and what to expect
export function nextYearly(db, ev, today = nowStamp().slice(0, 10)) {
  const y = +today.slice(0, 4); let date = iso(y, ev.month, ev.day); if (dn(date) < dn(today)) date = iso(y + 1, ev.month, ev.day);
  const costs = eventCosts(db, ev).filter((c) => c.year < +date.slice(0, 4)), last = costs[0] || null;
  const expect = costs.length ? costs.slice(0, 3).reduce((s, c) => s + c.total, 0) / Math.min(3, costs.length) : null;
  return { ev, date, days: dn(date) - dn(today), costs, last, expect };
}
export const upcomingYearly = (db, within = 60, today) => live((db.settings || {}).yearlyEvents ? [] : []).concat((((db.settings || {}).yearlyEvents) || []).filter((e) => !e.deleted).map((e) => nextYearly(db, e, today)).filter((x) => x.days <= within).sort((a, b) => a.days - b.days));
export function yearlyCard(db) {
  const l = upcomingYearly(db, 60); if (!l.length) return '';
  return `<section class="card yearlycard"><h2>Coming Up Every Year</h2><ul class="calfacts">${l.map((x) => `<li><span>${esc(x.ev.name)}<small> ${x.days === 0 ? 'today' : x.days === 1 ? 'tomorrow' : `in ${x.days} days`}</small></span><b>${x.expect != null ? `about ${money(x.expect)}` : '<small class="muted">no past cost yet</small>'}</b></li>`).join('')}</ul>
    <p class="hint">What it cost in earlier years comes from entries tagged with the event name. ${button({ label: 'Yearly Events', kind: 'link', act: 'yearly-open' })}</p></section>`;
}
export function yearlySection(db) {
  const list = (((db.settings || {}).yearlyEvents) || []).filter((e) => !e.deleted);
  return `<section id="yearly"><h2>Yearly Events</h2><p class="hint">Things that come back every year: a birthday, Obon, New Year, an annual fee. Sukli reminds you before each one and shows what it cost before.</p>
    ${list.length ? `<div class="rows plain">${list.map((e) => { const n = nextYearly(db, e); return `${button({ html: `<span class="rmain"><strong>${esc(e.name)}</strong><small>${MON[e.month - 1]} ${e.day} · ${n.days === 0 ? 'today' : `in ${n.days} days`}${n.last ? ` · last time ${money(n.last.total)}` : ''}</small></span>`, kind: 'plain', cls: 'row', act: 'yearly-edit', data: 'id', v: e.id })}`; }).join('')}</div>` : ''}
    <div class="btnrow left">${button({ label: 'Add a Yearly Event', kind: 'ghost', act: 'yearly-new' })}</div></section>`;
}
function openYearly(id) {
  const db = get(), old = id ? (db.settings.yearlyEvents || []).find((e) => e.id === id) : null, ev = old ? { ...old } : { id: uid(), name: '', month: +nowStamp().slice(5, 7), day: +nowStamp().slice(8, 10) };
  const s = sheet(`<form novalidate>${textField({ label: 'Name (also the tag to put on its entries)', name: 'n', value: ev.name, placeholder: 'e.g. Obon, Mom birthday, New Year', attr: { autocapitalize: 'words' } })}
    ${selectField({ label: 'Month', id: 'ye-m', name: 'm', value: String(ev.month), options: MON.map((n, i) => ({ value: String(i + 1), label: n })) })}
    ${textField({ label: 'Day', name: 'd', value: String(ev.day), attr: { inputmode: 'numeric', autocomplete: 'off' } })}
    ${old ? button({ label: 'Remove This Event', kind: 'danger-link', attr: { 'data-del': true } }) : ''}
    <div class="btnrow">${button({ label: 'Cancel', kind: 'ghost', attr: { 'data-no': true } })}${button({ label: 'Save', kind: 'primary', submit: true })}</div></form>`, { title: old ? 'Edit Yearly Event' : 'New Yearly Event' });
  const form = s.el.querySelector('form');
  s.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-no]')) s.close();
    if (e.target.closest('[data-del]') && await confirmDialog('Remove this yearly event? Your entries are not touched.', 'Remove', true)) { commit((d) => { d.settings.yearlyEvents = (d.settings.yearlyEvents || []).filter((x) => x.id !== ev.id); }); s.close(); toast('Removed.'); }
  });
  form.onsubmit = (e) => {
    e.preventDefault(); const name = form.n.value.trim(), month = +form.m.value, day = parseInt(form.d.value, 10);
    if (!name) { toast('Give the event a name.'); return; }
    if (!(day >= 1 && day <= 31)) { toast('Type a day from 1 to 31.'); return; }
    commit((d) => { const l = d.settings.yearlyEvents = d.settings.yearlyEvents || [], i = l.findIndex((x) => x.id === ev.id), rec = { id: ev.id, name, month, day }; if (i >= 0) l[i] = rec; else l.push(rec); });
    s.close(); toast('Saved.');
  };
}
ACT['yearly-new'] = () => openYearly('');
ACT['yearly-edit'] = (el) => openYearly(el.dataset.id);
ACT['yearly-open'] = () => { location.hash = '#/settings'; };
