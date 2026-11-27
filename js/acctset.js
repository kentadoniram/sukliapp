// Accounts Settings: one page to manage every account (assets and liabilities) without opening each account card.
// Add, edit, delete, hide, change type, tag, and switch the two usage flags (counts in Spendable, shows in Investments).
import { button, card as uiCard } from './components.js';
import { get, commit, stamp, live, balances, groupColor, softDelete, HOME, fmt } from './core.js';
import { isLiability } from './finance.js';
import { typeNames, openAccount, openReclass, inInvestAcct } from './accpage.js';
import { acctPic } from './pictures.js';
import { exchangeOf } from './invest.js';
import { hdr, ui } from './screens.js';
import { parseTags } from './tags.js';
import { esc, ACT, sheet, toast, confirmDialog } from './ui.js';

const st = { f: 'all', tag: '', q: '' };
const render = () => window.dispatchEvent(new Event('sukli-render'));
const tagsOf = (a) => (Array.isArray(a.tags) ? a.tags : parseTags(a.tags));
const usedBy = (db, id) => db.txs.filter((t) => !t.deleted && (t.acct === id || t.toAcct === id)).length;
export const accountTagCounts = (db) => { const m = new Map(); for (const a of live(db.accounts)) for (const t of tagsOf(a)) m.set(t, (m.get(t) || 0) + 1); return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0])); };

function row(db, a, bal) {
  const used = usedBy(db, a.id), tg = tagsOf(a), liab = isLiability(a), ex = exchangeOf(a);
  const val = bal.get(a.id) || 0;
  const flags = [a.archived ? 'Hidden' : '', !liab && a.include ? 'Spendable' : '', inInvestAcct(a) ? 'Investments' : ''].filter(Boolean);
  return `<div class="asrow${a.archived ? ' dim' : ''}" data-id="${a.id}">
    <div class="ashead"><i class="badge sm" style="background:${groupColor(a.type)}">${acctPic(a)}</i>
      <span class="astx"><b>${esc(a.name)}</b><small>${esc(typeNames[a.type] || a.type)} · ${esc(a.cur)}${ex ? ' · ' + esc(ex) : ''} · ${used} entr${used === 1 ? 'y' : 'ies'}</small></span>
      <span class="asbal${val < 0 ? ' neg' : ''}">${esc(fmt(val, a.cur))}</span></div>
    ${tg.length || flags.length ? `<div class="aschips">${tg.map((t) => `<span class="chip tag">#${esc(t)}</span>`).join('')}${flags.map((x) => `<span class="chip flag">${x}</span>`).join('')}</div>` : ''}
    <div class="asact">${button({ label: 'Edit', kind: 'ghost', size: 'sm', act: 'as-edit', attr: { 'data-id': a.id } })}${button({ label: 'Tags', kind: 'ghost', size: 'sm', act: 'as-tags', attr: { 'data-id': a.id } })}${button({ label: 'Type', kind: 'ghost', size: 'sm', act: 'as-type', attr: { 'data-id': a.id } })}${liab ? '' : button({ label: 'Spendable', kind: 'chip', on: !!a.include, pressed: !!a.include, act: 'as-spend', attr: { 'data-id': a.id } })}${button({ label: 'Investments', kind: 'chip', on: inInvestAcct(a), pressed: inInvestAcct(a), act: 'as-inv', disabled: ['crypto', 'invest'].includes(a.type), attr: { 'data-id': a.id } })}${button({ label: a.archived ? 'Show' : 'Hide', kind: 'ghost', size: 'sm', act: 'as-hide', attr: { 'data-id': a.id } })}${button({ label: 'Delete', kind: 'danger-ghost', size: 'sm', act: 'as-del', attr: { 'data-id': a.id } })}</div></div>`;
}

export function accountSettings(db) {
  const all = live(db.accounts), bal = balances(db), tags = accountTagCounts(db);
  const nA = all.filter((a) => !isLiability(a)).length, nL = all.length - nA, nH = all.filter((a) => a.archived).length;
  const q = st.q.trim().toLowerCase();
  const pass = (a) => (st.f === 'all' || (st.f === 'assets' && !isLiability(a)) || (st.f === 'liabs' && isLiability(a)) || (st.f === 'hidden' && a.archived)) && (!st.tag || tagsOf(a).some((t) => t.toLowerCase() === st.tag.toLowerCase())) && (!q || `${a.name} ${a.cur} ${typeNames[a.type] || a.type} ${exchangeOf(a)} ${tagsOf(a).join(' ')}`.toLowerCase().includes(q)) && (st.f === 'hidden' || st.f === 'all' ? true : !a.archived || false);
  const list = all.filter(pass).sort((a, b) => a.name.localeCompare(b.name));
  const side = (title, arr) => arr.length ? `<section class="assec"><h2>${title} <small class="muted">${arr.length}</small></h2>${arr.map((a) => row(db, a, bal)).join('')}</section>` : '';
  const A = list.filter((a) => !isLiability(a)), L = list.filter(isLiability);
  return `${hdr('Accounts settings')}
    <p class="hint">Every account in one place. Assets are what you have, liabilities are what you owe (cards, loans, debts). Change an account here without opening its card.</p>
    <div class="assum"><span><b>${nA}</b><small>Assets</small></span><span><b>${nL}</b><small>Liabilities</small></span><span><b>${nH}</b><small>Hidden</small></span><span><b>${tags.length}</b><small>Tags</small></span></div>
    ${button({ label: '+ New account', kind: 'primary', cls: 'wide', act: 'as-new' })}
    <div class="seg asfilter" role="group" aria-label="Show">${[['all', 'All'], ['assets', 'Assets'], ['liabs', 'Liabilities'], ['hidden', 'Hidden']].map(([v, l]) => button({ label: l, kind: 'plain', cls: st.f === v ? 'on' : '', pressed: st.f === v, act: 'as-filter', attr: { 'data-v': v } })).join('')}</div>
    <div class="field"><span>Find an account</span><input id="as-q" type="search" autocomplete="off" placeholder="Name, type, platform or tag" value="${esc(st.q)}" aria-label="Find an account"></div>
    ${tags.length ? `<div class="chips astags">${button({ label: 'All tags', kind: 'chip', on: !st.tag, pressed: !st.tag, act: 'as-tagf', attr: { 'data-v': '' } })}${tags.map(([t, n]) => button({ label: `#${t} · ${n}`, kind: 'chip', on: st.tag.toLowerCase() === t.toLowerCase(), pressed: st.tag.toLowerCase() === t.toLowerCase(), act: 'as-tagf', attr: { 'data-v': t } })).join('')}</div>` : ''}
    ${side('Assets', A)}${side('Liabilities', L)}
    ${list.length ? '' : '<p class="hint">No account matches. Clear the search or the filter.</p>'}
    ${tags.length ? `<section class="assec"><h2>Account tags</h2><p class="hint">Rename a tag to change it on every account at once, or delete it from all accounts.</p>${tags.map(([t, n]) => `<div class="astag"><b>#${esc(t)}</b><small class="muted">${n} account${n === 1 ? '' : 's'}</small><span>${button({ label: 'Rename', kind: 'ghost', size: 'sm', act: 'as-tag-ren', attr: { 'data-v': t } })}${button({ label: 'Delete', kind: 'danger-ghost', size: 'sm', act: 'as-tag-del', attr: { 'data-v': t } })}</span></div>`).join('')}</section>` : ''}
    <p class="hint">Account types (rename, add your own, asset or liability) are in <a href="#/settings">Settings → Account Types</a>.</p>`;
}

const edit = (id, fn) => commit((d) => { const x = d.accounts.find((q) => q.id === id); if (x) { fn(x); stamp(x); } });
ACT['as-new'] = () => openAccount();
ACT['as-edit'] = (el) => openAccount(el.dataset.id);
ACT['as-type'] = (el) => openReclass(el.dataset.id);
ACT['as-filter'] = (el) => { st.f = el.dataset.v; render(); };
ACT['as-tagf'] = (el) => { st.tag = el.dataset.v; render(); };
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'as-q') { st.q = e.target.value; const pos = e.target.selectionStart; render(); setTimeout(() => { const i = document.getElementById('as-q'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) { /* ignore */ } } }, 30); } });
ACT['as-spend'] = (el) => edit(el.dataset.id, (x) => { x.include = !x.include; });
ACT['as-inv'] = (el) => edit(el.dataset.id, (x) => { x.invtab = !inInvestAcct(x); });
ACT['as-hide'] = (el) => edit(el.dataset.id, (x) => { x.archived = !x.archived; });
ACT['as-del'] = async (el) => {
  const db = get(), a = db.accounts.find((x) => x.id === el.dataset.id); if (!a) return;
  const n = usedBy(db, a.id);
  if (n) { if (await confirmDialog(`${a.name} has ${n} entr${n === 1 ? 'y' : 'ies'}, so it cannot be deleted without losing them. Hide it instead? Its history stays.`, 'Hide it')) { edit(a.id, (x) => { x.archived = true; }); toast('Account hidden'); } return; }
  if (await confirmDialog(`Delete ${a.name}? It has no entries.`, 'Delete', true)) { commit((d) => { softDelete(d.accounts.find((x) => x.id === a.id)); }); toast('Account deleted'); }
};
ACT['as-tags'] = (el) => {
  const id = el.dataset.id, db = get(), a = db.accounts.find((x) => x.id === id); if (!a) return;
  const known = accountTagCounts(db).map(([t]) => t), cur = new Set(tagsOf(a));
  const s = sheet(`<form id="as-tagform"><div class="chips" id="as-tagchips"></div>
    <div class="field"><span>Add a tag</span><input name="t" list="as-taglist" autocomplete="off" placeholder="e.g. Daily, Travel, Savings" aria-label="Add a tag"><datalist id="as-taglist">${known.map((t) => `<option value="${esc(t)}"></option>`).join('')}</datalist></div>
    <div class="btnrow">${button({ label: 'Add', kind: 'ghost', attr: { 'data-add': true } })}${button({ label: 'Save', kind: 'primary', submit: true })}</div></form>`, { title: `Tags for ${a.name}` });
  const form = s.el.querySelector('#as-tagform'), box = s.el.querySelector('#as-tagchips');
  const paint = () => { box.innerHTML = [...cur].map((t) => button({ label: `#${t} ✕`, kind: 'chip', attr: { 'data-rm': t, type: 'button' } })).join('') || '<small class="muted">No tags yet.</small>'; };
  const add = () => { for (const t of parseTags(form.t.value)) cur.add(t); form.t.value = ''; paint(); };
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { cur.delete(b.dataset.rm); paint(); } });
  form.querySelector('[data-add]').onclick = add;
  form.onsubmit = (e) => { e.preventDefault(); add(); edit(id, (x) => { x.tags = [...cur]; }); s.close(); };
  paint();
};
ACT['as-tag-ren'] = async (el) => {
  const old = el.dataset.v, { promptDialog } = await import('./ui.js'), nv = await promptDialog('Rename tag', old, { okLabel: 'Rename' }); if (nv == null) return;
  const t = parseTags(nv)[0]; if (!t || t === old) return;
  commit((d) => { for (const a of d.accounts) if (!a.deleted && tagsOf(a).some((x) => x.toLowerCase() === old.toLowerCase())) { a.tags = [...new Set(tagsOf(a).map((x) => (x.toLowerCase() === old.toLowerCase() ? t : x)))]; stamp(a); } });
  if (st.tag.toLowerCase() === old.toLowerCase()) st.tag = t;
};
ACT['as-tag-del'] = async (el) => {
  const old = el.dataset.v; if (!(await confirmDialog(`Remove the tag #${old} from every account?`, 'Remove', true))) return;
  commit((d) => { for (const a of d.accounts) if (!a.deleted && tagsOf(a).some((x) => x.toLowerCase() === old.toLowerCase())) { a.tags = tagsOf(a).filter((x) => x.toLowerCase() !== old.toLowerCase()); stamp(a); } });
  if (st.tag.toLowerCase() === old.toLowerCase()) st.tag = '';
};
