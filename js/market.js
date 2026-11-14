// Market tabs on Investments: "All" plus tabs you make yourself (Stocks, MP2, Deposits, Retirement ...).
// A tab is { id, name, ids: [account ids] } kept in settings.marketTabs. An investment can be in more than one tab. "All" always shows everything.
import { get, commit, uid } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog, promptDialog } from './ui.js';
import { button, tabs } from './components.js';
export const tabList = (db) => (db.settings.marketTabs || []).filter((t) => t && t.id && t.name);
export function curTab(db) { let v = 'all'; try { v = localStorage.getItem('sukli-mtab') || 'all'; } catch (e) { /* storage blocked */ } return v !== 'all' && tabList(db).some((t) => t.id === v) ? v : 'all'; }
const setTab = (v) => { try { localStorage.setItem('sukli-mtab', v); } catch (e) { /* storage blocked */ } };
// does this account show under the tab that is open?
export const inMarketTab = (db, a) => { const c = curTab(db); if (c === 'all') return true; const t = tabList(db).find((x) => x.id === c); return !!t && (t.ids || []).includes(a.id); };
export function marketBar(db) {
  const l = tabList(db), c = curTab(db);
  const items = [{ label: 'All', value: 'all' }, ...l.map((t) => ({ label: t.name, value: t.id }))];
  return `<div class="mktbar">${l.length ? tabs({ items, value: c, act: 'inv-mtab', aria: 'Investment markets' }) : ''}${button({ label: l.length ? 'Edit Market Tabs' : '+ Market Tab', kind: 'link', act: 'inv-mtabs' })}</div>`;
}
ACT['inv-mtab'] = (el) => { setTab(el.dataset.v); window.dispatchEvent(new Event('sukli-render')); };
const inv = (db) => db.accounts.filter((a) => !a.deleted && !a.archived && (a.type === 'crypto' || a.type === 'invest' || a.invtab));
function manage() {
  const db = get(), l = tabList(db), accts = inv(db);
  const s = sheet(`<p class="hint">Make a tab for a kind of market, then tick what belongs in it. "All" always shows everything.</p>
    ${l.map((t) => `<div class="cardbox mkt" data-id="${esc(t.id)}"><div class="othhead"><b>${esc(t.name)}</b><span>${button({ label: 'Rename', kind: 'ghost', size: 'sm', act: 'mkt-ren', v: t.id })}${button({ label: 'Delete', kind: 'danger-ghost', size: 'sm', act: 'mkt-del', v: t.id })}</span></div>
      <div class="rows plain">${accts.map((a) => `<label class="check"><input type="checkbox" class="mkt-ck" data-t="${esc(t.id)}" data-a="${esc(a.id)}" ${(t.ids || []).includes(a.id) ? 'checked' : ''}> <span>${esc(a.name)}</span></label>`).join('') || '<p class="muted">No investments yet.</p>'}</div></div>`).join('')}
    <div class="btnrow">${button({ label: '+ New Tab', kind: 'secondary', act: 'mkt-add' })}${button({ label: 'Done', kind: 'primary', attr: { 'data-done': true } })}</div>`, { title: 'Market Tabs', wide: true });
  s.el.querySelector('[data-done]').onclick = () => { s.close(); window.dispatchEvent(new Event('sukli-render')); };
  s.el.addEventListener('change', (e) => { const c = e.target.closest('.mkt-ck'); if (!c) return; commit((d) => { const t = (d.settings.marketTabs || []).find((x) => x.id === c.dataset.t); if (!t) return; const set = new Set(t.ids || []); if (c.checked) set.add(c.dataset.a); else set.delete(c.dataset.a); t.ids = [...set]; }); });
  window.__mktSheet = s;
}
const again = () => { if (window.__mktSheet) { window.__mktSheet.close(); } setTimeout(manage, 60); };
ACT['inv-mtabs'] = () => manage();
ACT['mkt-add'] = async () => { const n = ((await promptDialog('Name of the tab', '', { okLabel: 'Add', hint: 'For example Stocks, MP2, Deposits.' })) || '').replace(/\s+/g, ' ').trim(); if (!n) return; if (tabList(get()).some((t) => t.name.toLowerCase() === n.toLowerCase())) { toast('That tab already exists.'); return; } const id = uid(); commit((d) => { d.settings.marketTabs = [...(d.settings.marketTabs || []), { id, name: n, ids: [] }]; }); setTab(id); again(); };
ACT['mkt-ren'] = async (el) => { const t = tabList(get()).find((x) => x.id === el.dataset.v); if (!t) return; const n = ((await promptDialog('New name', t.name, { okLabel: 'Rename' })) || '').replace(/\s+/g, ' ').trim(); if (!n) return; commit((d) => { const x = d.settings.marketTabs.find((q) => q.id === t.id); if (x) x.name = n; }); again(); };
ACT['mkt-del'] = async (el) => { const t = tabList(get()).find((x) => x.id === el.dataset.v); if (!t || !(await confirmDialog(`Delete the tab ${t.name}? Your investments stay; only the tab goes.`, 'Delete'))) return; commit((d) => { d.settings.marketTabs = d.settings.marketTabs.filter((q) => q.id !== t.id); }); setTab('all'); again(); };
