// Settings > Merchants: add a merchant before you use it, rename one (everywhere), merge two spellings, or remove one from your entries.
import { get, commit, stamp } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { norm } from './merchants.js';
import { cachedAddress } from './geo.js';
// a saved point shows as its address when one is known; the numbers stay out of sight
const ptTxt = (p) => cachedAddress(get(), p) || 'saved (the address shows once an entry at this spot has looked it up)';
import { merchantList, canonMerchant } from './merchantpick.js';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const redraw = () => window.dispatchEvent(new Event('sukli-render'));
const count = (db, name) => db.txs.filter((t) => !t.deleted && t.merchant && norm(t.merchant) === norm(name)).length;

export function merchantsSection(db) {
  const list = merchantList(db);
  return `<section id="merch-set"><h2>Merchants</h2>
    <p class="hint">Where you bought something (Shopee, Lazada, wet market, mall). The category still says what it was. Add one here, or tap one to rename it or take it off your entries.</p>
    ${list.length ? `<div class="rows plain">${list.map((m) => `<button type="button" class="row cur ln1" data-act="mer-edit" data-m="${esc(m.name)}"><span class="rmain"><strong>${esc(m.name)}</strong><small>${m.n ? `${m.n} ${m.n === 1 ? 'entry' : 'entries'}` : 'Added by you, not used yet'}</small></span></button>`).join('')}</div>` : '<p class="hint">No merchants yet. They appear here once you use the Merchant row on an expense.</p>'}
    <div class="btnrow left"><button type="button" class="btn ghost" data-act="mer-add">Add a merchant</button></div></section>`;
}

ACT['mer-add'] = () => {
  const s = sheet(`<form novalidate><label class="field"><span>Merchant name</span><input name="m" autocomplete="off" autocapitalize="words" placeholder="e.g. Shopee" autofocus></label>
    <p class="hint">It will show in the Merchant list when you add an expense.</p><div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn">Add</button></div></form>`, { title: 'Add a Merchant' });
  s.el.querySelector('[data-no]').onclick = () => s.close();
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault(); const v = clean(e.target.m.value); if (!v) return; s.dispose();
    const name = canonMerchant(get(), v);
    if (merchantList(get()).some((m) => norm(m.name) === norm(name))) { toast('Already in your list.'); return; }
    commit((d) => { d.settings.merchants = [...(d.settings.merchants || []), name]; }); toast('Added.');
  };
};

// ---- branches: one merchant (Life, 7-Eleven) with many places (Tsukagoshi, Kawasaki Station); settings.merchantInfo[merchant] = { place, loc, branches: { name: { place, loc } } }
const infoOf = (db, m) => ((db.settings.merchantInfo || {})[m] || { branches: {} });
export function branchesOf(db, m) {
  const out = new Map(), info = infoOf(db, m).branches || {};
  for (const b of Object.keys(info)) out.set(b, { name: b, n: 0, sum: 0 });
  for (const t of db.txs) if (!t.deleted && t.merchant && t.branch && norm(t.merchant) === norm(m)) { const o = out.get(t.branch) || { name: t.branch, n: 0, sum: 0 }; o.n++; out.set(t.branch, o); }
  return [...out.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
const setInfo = (d, m, fn) => { const all = (d.settings.merchantInfo = d.settings.merchantInfo || {}); const o = (all[m] = all[m] || { branches: {} }); o.branches = o.branches || {}; fn(o); };
async function placeFields(cur) {
  return `<label class="field"><span>Place (Optional)</span><input name="place" autocomplete="off" value="${esc(cur.place || '')}" placeholder="e.g. Tsukagoshi, Saiwai Ward, Kawasaki, Kanagawa"></label>
    <div class="btnrow left"><button type="button" class="btn ghost sm" data-here>Use Where I Am Now</button><small class="muted" data-pt>${cur.loc ? `Saved location: ${ptTxt(cur.loc)}` : 'No point saved.'}</small></div>`;
}
function openBranch(m, b) {
  const db = get(), cur = (infoOf(db, m).branches || {})[b] || {}, n = db.txs.filter((t) => !t.deleted && t.branch === b && t.merchant && norm(t.merchant) === norm(m)).length;
  let loc = cur.loc || null;
  placeFields({ place: cur.place, loc }).then((pf) => {
    const s = sheet(`<form novalidate><label class="field"><span>Branch Name</span><input name="b" autocomplete="off" value="${esc(b)}"></label>${pf}
      <p class="hint">${n} ${n === 1 ? 'entry' : 'entries'} at this branch of ${esc(m)}. Renaming changes them all.</p>
      <div class="btnrow"><button type="button" class="btn ghost danger" data-rm>Remove Branch</button><button class="btn">Save</button></div></form>`, { title: `${m}: ${b}` });
    const q = s.el.querySelector('form');
    q.querySelector('[data-here]').onclick = async () => { const { hereWhy } = await import('./loc.js'); const r = await hereWhy(); if (r.p) { loc = r.p; q.querySelector('[data-pt]').textContent = `Saved location: ${ptTxt(r.p)}`; } else toast('Could not get your location. Type the place instead.'); };
    q.querySelector('[data-rm]').onclick = () => { s.dispose(); commit((d) => { for (const t of d.txs) if (!t.deleted && t.branch === b && t.merchant && norm(t.merchant) === norm(m)) { delete t.branch; stamp(t); } setInfo(d, m, (o) => { delete o.branches[b]; }); }); toast('Branch removed. Entries keep the merchant.'); };
    q.onsubmit = (e) => { e.preventDefault(); const nb = clean(q.b.value); if (!nb) return; s.dispose();
      commit((d) => { for (const t of d.txs) if (!t.deleted && t.branch === b && t.merchant && norm(t.merchant) === norm(m)) { t.branch = nb; stamp(t); }
        setInfo(d, m, (o) => { delete o.branches[b]; o.branches[nb] = { place: clean(q.place.value), ...(loc ? { loc } : {}) }; }); }); toast('Saved.'); };
  });
}
ACT['mer-branch'] = (el) => openBranch(el.dataset.m, el.dataset.b);
ACT['mer-edit'] = (el) => {
  const db = get(), name = el.dataset.m, n = count(db, name), info = infoOf(db, name), bl = branchesOf(db, name); let loc = info.loc || null;
  placeFields({ place: info.place, loc }).then((pf) => {
  const s = sheet(`<form novalidate><label class="field"><span>Merchant Name</span><input name="m" autocomplete="off" autocapitalize="words" value="${esc(name)}" autofocus></label>
    <label class="field"><span>Branch (Optional)</span><input name="br" autocomplete="off" autocapitalize="words" placeholder="e.g. Tsukagoshi"></label>
    <p class="hint">${n ? `Renaming changes it on ${n} ${n === 1 ? 'entry' : 'entries'}. If the new name is already in your list, the two are joined.` : 'Not used on any entry yet.'} For a name like “Life Tsukagoshi”, type <b>Life</b> as the merchant and <b>Tsukagoshi</b> as the branch: all ${n || ''} entries keep their link and get the branch.</p>
    ${pf}
    ${bl.length ? `<h3>Branches</h3><div class="rows plain">${bl.map((b) => `<button type="button" class="row cur" data-act="mer-branch" data-m="${esc(name)}" data-b="${esc(b.name)}"><span class="rmain"><strong>${esc(b.name)}</strong><small>${b.n} ${b.n === 1 ? 'entry' : 'entries'}${((infoOf(db, name).branches || {})[b.name] || {}).place ? ' · ' + esc(infoOf(db, name).branches[b.name].place) : ''}</small></span></button>`).join('')}</div>` : ''}
    <div class="btnrow left"><button type="button" class="btn ghost sm" data-addbr>Add a Branch</button></div>
    <div class="btnrow"><button type="button" class="btn ghost danger" data-rm>${n ? 'Remove from entries' : 'Delete'}</button><button class="btn">Save</button></div></form>`, { title: name });
  const q = s.el.querySelector('form');
  q.querySelector('[data-here]').onclick = async () => { const { hereWhy } = await import('./loc.js'); const r = await hereWhy(); if (r.p) { loc = r.p; q.querySelector('[data-pt]').textContent = `Saved location: ${ptTxt(r.p)}`; } else toast('Could not get your location. Type the place instead.'); };
  q.querySelector('[data-addbr]').onclick = async () => { const v = clean((await promptDialog('New branch', '', { okLabel: 'Add', hint: `A place of ${name}, for example Kawasaki Station.` })) || ''); if (!v) return; s.dispose(); commit((d) => setInfo(d, name, (o) => { o.branches[v] = o.branches[v] || {}; })); toast('Branch added.'); };
  q.querySelector('[data-rm]').onclick = async () => {
    s.dispose();
    if (!(await confirmDialog(n ? `Take “${name}” off ${n} ${n === 1 ? 'entry' : 'entries'} and remove it from the list? The entries stay, only the merchant is cleared.` : `Delete “${name}” from your list?`, n ? 'Remove' : 'Delete', true))) return;
    const ids = db.txs.filter((t) => !t.deleted && t.merchant && norm(t.merchant) === norm(name)).map((t) => t.id), keep = (db.settings.merchants || []).slice();
    commit((d) => { for (const t of d.txs) if (ids.includes(t.id)) { delete t.merchant; delete t.branch; stamp(t); } d.settings.merchants = (d.settings.merchants || []).filter((x) => norm(x) !== norm(name)); });
    toast('Removed.', { ms: 6000, undo: () => commit((d) => { for (const t of d.txs) if (ids.includes(t.id)) { t.merchant = name; stamp(t); } d.settings.merchants = keep; }) });
  };
  q.onsubmit = async (e) => {
    e.preventDefault(); const raw = clean(q.m.value), br = clean(q.br.value), place = clean(q.place.value);
    if (!raw) return;
    const other = merchantList(db).find((m) => norm(m.name) === norm(raw) && norm(m.name) !== norm(name));
    const to = other ? other.name : (norm(raw) === norm(name) ? raw : canonMerchant(db, raw));
    s.dispose();
    if (other && !(await confirmDialog(`“${other.name}” is already in your list. Join “${name}” into it?`, 'Join them'))) return;
    const ids = db.txs.filter((t) => !t.deleted && t.merchant && norm(t.merchant) === norm(name)).map((t) => t.id), keep = (db.settings.merchants || []).slice(), keepInfo = JSON.stringify(db.settings.merchantInfo || null);
    commit((d) => {
      for (const t of d.txs) if (ids.includes(t.id)) { t.merchant = to; if (br) t.branch = br; stamp(t); }
      const had = (d.settings.merchants || []).some((x) => norm(x) === norm(name)); let l = (d.settings.merchants || []).filter((x) => norm(x) !== norm(name));
      if (had && !l.some((x) => norm(x) === norm(to))) l.push(to); if (l.length) d.settings.merchants = l; else delete d.settings.merchants;
      // the place information moves with the name; a typed branch gets the place, otherwise the merchant does
      const all = (d.settings.merchantInfo = d.settings.merchantInfo || {}), old = all[name];
      if (to !== name && old) { const dst = (all[to] = all[to] || { branches: {} }); dst.branches = { ...(old.branches || {}), ...(dst.branches || {}) }; if (old.place && !dst.place) dst.place = old.place; if (old.loc && !dst.loc) dst.loc = old.loc; delete all[name]; }
      setInfo(d, to, (o) => { if (br) { o.branches[br] = { ...(o.branches[br] || {}), ...(place ? { place } : {}), ...(loc ? { loc } : {}) }; } else { if (place) o.place = place; if (loc) o.loc = loc; } });
    });
    toast(br ? `${to}, branch ${br}.` : `Saved ${to}.`, { ms: 6000, undo: () => commit((d) => { for (const t of d.txs) if (ids.includes(t.id)) { t.merchant = name; if (br) delete t.branch; stamp(t); } if (keep.length) d.settings.merchants = keep; else delete d.settings.merchants; d.settings.merchantInfo = JSON.parse(keepInfo); if (!d.settings.merchantInfo) delete d.settings.merchantInfo; }) });
  };
  });
};
export { redraw };
