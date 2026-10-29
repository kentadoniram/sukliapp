// Settings > Merchants: add a merchant before you use it, rename one (everywhere), merge two spellings, or remove one from your entries.
import { get, commit, stamp } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { norm } from './merchants.js';
import { merchantList, canonMerchant } from './merchantpick.js';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const redraw = () => window.dispatchEvent(new Event('sukli-render'));
const count = (db, name) => db.txs.filter((t) => !t.deleted && t.merchant && norm(t.merchant) === norm(name)).length;

export function merchantsSection(db) {
  const list = merchantList(db);
  return `<section id="merch-set"><h2>Merchants</h2>
    <p class="hint">Where you bought something (Shopee, Lazada, wet market, mall). The category still says what it was. Add one here, or tap one to rename it or take it off your entries.</p>
    ${list.length ? `<div class="rows plain">${list.map((m) => `<button type="button" class="row cur" data-act="mer-edit" data-m="${esc(m.name)}"><span class="rmain"><strong>${esc(m.name)}</strong><small>${m.n ? `${m.n} ${m.n === 1 ? 'entry' : 'entries'}` : 'Added by you, not used yet'}</small></span></button>`).join('')}</div>` : '<p class="hint">No merchants yet. They appear here once you use the Merchant row on an expense.</p>'}
    <div class="btnrow left"><button type="button" class="btn ghost" data-act="mer-add">Add a merchant</button></div></section>`;
}

ACT['mer-add'] = () => {
  const s = sheet(`<form novalidate><label class="field"><span>Merchant name</span><input name="m" autocomplete="off" autocapitalize="words" placeholder="e.g. Shopee" autofocus></label>
    <p class="hint">It will show in the Merchant list when you add an expense.</p><div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn">Add</button></div></form>`, { title: 'Add a merchant' });
  s.el.querySelector('[data-no]').onclick = () => s.close();
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault(); const v = clean(e.target.m.value); if (!v) return; s.dispose();
    const name = canonMerchant(get(), v);
    if (merchantList(get()).some((m) => norm(m.name) === norm(name))) { toast('Already in your list.'); return; }
    commit((d) => { d.settings.merchants = [...(d.settings.merchants || []), name]; }); toast('Added.');
  };
};

ACT['mer-edit'] = (el) => {
  const db = get(), name = el.dataset.m, n = count(db, name);
  const s = sheet(`<form novalidate><label class="field"><span>Merchant name</span><input name="m" autocomplete="off" autocapitalize="words" value="${esc(name)}" autofocus></label>
    <p class="hint">${n ? `Renaming changes it on ${n} ${n === 1 ? 'entry' : 'entries'}. If the new name is already in your list, the two are joined.` : 'Not used on any entry yet.'}</p>
    <div class="btnrow"><button type="button" class="btn ghost danger" data-rm>${n ? 'Remove from entries' : 'Delete'}</button><button class="btn">Save</button></div></form>`, { title: name });
  s.el.querySelector('[data-rm]').onclick = async () => {
    s.dispose();
    if (!(await confirmDialog(n ? `Take “${name}” off ${n} ${n === 1 ? 'entry' : 'entries'} and remove it from the list? The entries stay, only the merchant is cleared.` : `Delete “${name}” from your list?`, n ? 'Remove' : 'Delete', true))) return;
    const ids = db.txs.filter((t) => !t.deleted && t.merchant && norm(t.merchant) === norm(name)).map((t) => t.id), keep = (db.settings.merchants || []).slice();
    commit((d) => { for (const t of d.txs) if (ids.includes(t.id)) { delete t.merchant; stamp(t); } d.settings.merchants = (d.settings.merchants || []).filter((x) => norm(x) !== norm(name)); });
    toast('Removed.', { ms: 6000, undo: () => commit((d) => { for (const t of d.txs) if (ids.includes(t.id)) { t.merchant = name; stamp(t); } d.settings.merchants = keep; }) });
  };
  s.el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault(); const raw = clean(e.target.m.value); if (!raw || raw === name) { s.close(); return; }
    const other = merchantList(db).find((m) => norm(m.name) === norm(raw) && norm(m.name) !== norm(name));
    const to = other ? other.name : (norm(raw) === norm(name) ? raw : canonMerchant(db, raw));
    s.dispose();
    if (other && !(await confirmDialog(`“${other.name}” is already in your list. Join “${name}” into it?`, 'Join them'))) return;
    const ids = db.txs.filter((t) => !t.deleted && t.merchant && norm(t.merchant) === norm(name)).map((t) => t.id), keep = (db.settings.merchants || []).slice();
    commit((d) => {
      for (const t of d.txs) if (ids.includes(t.id)) { t.merchant = to; stamp(t); }
      const had = (d.settings.merchants || []).some((x) => norm(x) === norm(name)); let l = (d.settings.merchants || []).filter((x) => norm(x) !== norm(name));
      if (had && !l.some((x) => norm(x) === norm(to))) l.push(to); if (l.length) d.settings.merchants = l; else delete d.settings.merchants;
    });
    toast(`Renamed to ${to}.`, { ms: 6000, undo: () => commit((d) => { for (const t of d.txs) if (ids.includes(t.id)) { t.merchant = name; stamp(t); } if (keep.length) d.settings.merchants = keep; else delete d.settings.merchants; }) });
  };
};
export { redraw };
