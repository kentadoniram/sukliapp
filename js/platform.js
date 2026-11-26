// Exchange settings: tap an exchange's name on its card in Investments to see and change everything for the whole exchange at once
// (instead of opening each asset account one by one).
import { button, selectField } from './components.js';
import { get, commit, stamp, walletOf, fmt, HOME, balances, homeFx } from './core.js';
import { ACT, sheet, esc, toast } from './ui.js';
import { exchangeOf, inInvest, typeHidden } from './invest.js';
import { tzOf, tzName } from './earn.js';
import { accountTypesOf, addAccountType, removeAccountType } from './tokens.js';
import { promptDialog } from './ui.js';
import { platIcon, customIcon } from './platicons.js';

export function openPlatform(ex) {
  const s = sheet('<div id="pset" class="platset"></div>', { title: ex, wide: true }), root = s.el.querySelector('#pset');
  const draw = () => {
    const db = get(), accts = db.accounts.filter((a) => !a.deleted && !a.archived && inInvest(a) && exchangeOf(a) === ex), bal = balances(db);
    const val = (a) => (bal.get(a.id) || 0) * (a.cur === HOME ? 1 : (homeFx(db, a.cur) || 0));
    const total = accts.reduce((t, a) => t + val(a), 0), off = tzOf(db, { exchange: ex });
    const wallets = [...new Set(accts.map(walletOf))], earn = accts.filter((a) => walletOf(a) === 'Earn');
    root.innerHTML = `
      <div class="platicon">${platIcon(ex, 'sm')}<span class="muted">${customIcon(ex) ? 'Your own logo' : 'Sukli symbol'}</span><label class="linkbtn">Upload logo<input type="file" accept="image/*" hidden data-p="logo"></label>${customIcon(ex) ? button({ label: 'Use symbol', kind: 'link', attr: { 'data-p': 'logo-reset' } }) : ''}</div>
      <p class="hint"><b>${esc(ex)}</b> › Accounts (${esc(wallets.join(', ') || 'none yet')}) › Assets · ${accts.length} asset balance${accts.length === 1 ? '' : 's'} · about <b>${esc(fmt(total, HOME))}</b>. Every coin of the top 50 can be used in any account here without adding it first.</p>
      <h3>Account Types</h3>
      <p class="hint">Tap a type to choose whether it shows in the Investments tab. <b>Selected</b> types are shown there. <b>Not selected</b> types are hidden, with their entries and balances kept. You can change this at any time.</p>
      <div class="chips typechips">${accountTypesOf(db, ex).map((w) => { const n = accts.filter((a) => walletOf(a) === w).length, off = hiddenTypes(db, ex).includes(w), mine = ((db.settings.acctTypes || {})[Object.keys(db.settings.acctTypes || {}).find((x) => x.toLowerCase() === ex.toLowerCase())] || []).includes(w) && !n;
        return `<span class="tchipw">${button({ html: `<b class="tmark" aria-hidden="true">${off ? '–' : '✓'}</b>${esc(w)}${n ? ` <small>${n}</small>` : ''}`, kind: 'chip', cls: `tchip ${off ? 'off' : 'on'}`, pressed: !off, aria: `${w}: ${off ? 'Not selected, hidden from Investments' : 'Selected, shown in Investments'}. Tap to change.`, attr: { 'data-p': 'showtype', 'data-v': w } })}${mine ? button({ label: '✕', kind: 'link', cls: 'tchipx', aria: `Remove ${w}`, attr: { 'data-p': 'deltype', 'data-v': w } }) : ''}</span>`; }).join('')}</div>
      <p class="tlegend"><span class="tchip on sample"><b class="tmark">✓</b>Selected</span> shown in Investments &nbsp; <span class="tchip off sample"><b class="tmark">–</b>Not selected</span> hidden</p>
      <div class="chips">${button({ label: '+ Add Account Type', kind: 'chip', attr: { 'data-p': 'addtype' } })}</div>
      <p class="hint">Exchanges add new products from time to time. Add the name here (for example Copy Trading) and it appears in From, To and when adding assets for ${esc(ex)}.</p>
      <h3>Actions</h3>
      <div class="btnrow left">${button({ label: 'Record', kind: 'primary', size: 'sm', act: 'plat-do', attr: { 'data-do': 'inv-add', 'data-ex': ex } })}${button({ label: '+ Asset', kind: 'ghost', size: 'sm', act: 'plat-do', attr: { 'data-do': 'inv-coin', 'data-ex': ex } })}${button({ label: 'Internal Transfer', kind: 'ghost', size: 'sm', act: 'plat-do', attr: { 'data-do': 'inv-internal', 'data-ex': ex } })}</div>
      ${selectField({ label: `Timezone of ${ex}`, aria: null, attr: { 'data-p': 'tz' }, optionsHtml: Array.from({ length: 27 }, (_, i) => i - 12).map((z) => `<option value="${z}" ${z === off ? 'selected' : ''}>${tzName(z)}</option>`).join('') })}
      <p class="hint">Used for every Earn product here: subscription times and hourly earnings follow this clock.</p>
      ${earn.length ? `<h3>Earn Products</h3><ul class="calfacts">${earn.map((a) => `<li><span>${esc(a.cur)} <small class="muted">${a.earn && a.earn.on ? 'On' : 'Off'}</small></span>${button({ label: 'Subscription Settings', kind: 'ghost', size: 'sm', act: 'plat-do', attr: { 'data-do': 'earn-open', 'data-id': a.id } })}</li>`).join('')}</ul>` : ''}
      ${accts.length ? `<h3>Hide Accounts</h3><p class="hint">A hidden account stays in Sukli with its entries and balance. It is only left out of the Investments tab. Tick the ones to hide, even if they hold something.</p>
      <div class="hidelist">${accts.slice().sort((a, b) => (walletOf(a) + a.cur).localeCompare(walletOf(b) + b.cur)).map((a) => `<label class="check"><input type="checkbox" data-p="hide" data-id="${a.id}" ${a.invHidden ? 'checked' : ''}> <span>${esc(a.cur)} <small class="muted">${esc(walletOf(a))}${(bal.get(a.id) || 0) ? ' · ' + esc(fmt(bal.get(a.id) || 0, a.cur)) : ''}</small></span></label>`).join('')}</div>` : ''}
      <h3>Platform</h3>
      <p class="hint">Rename Platform changes the name of the whole exchange. It does not rename your individual accounts (Spot, Margin, Earn…).</p>
      <div class="btnrow left">${button({ label: 'Rename Platform', kind: 'ghost', size: 'sm', act: 'plat-do', attr: { 'data-do': 'inv-rename', 'data-ex': ex } })}${accts.length ? '' : `<button type="button" class="btn sm ghost danger" data-act="plat-do" data-do="inv-platdel" data-ex="${esc(ex)}">Remove Platform</button>`}</div>
      <div class="btnrow">${button({ label: 'Done', kind: 'primary', cls: 'primary', attr: { 'data-p': 'done' } })}</div>`;
  };
  draw();
  root.addEventListener('change', (e) => { if (e.target.dataset.p === 'logo') { const f = e.target.files && e.target.files[0]; if (!f) return; const img = new Image(), url = URL.createObjectURL(f);
      img.onload = () => { const c = document.createElement('canvas'), k = Math.min(1, 96 / Math.max(img.width, img.height)); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        commit((d) => { (d.settings.platformIcons = d.settings.platformIcons || {})[ex] = c.toDataURL('image/png'); }); toast(`Logo saved for ${ex}.`); draw(); document.dispatchEvent(new Event('sukli-render')); };
      img.onerror = () => toast('That file could not be read as an image.'); img.src = url; return; } if (e.target.dataset.p === 'hide') { const id = e.target.dataset.id, on = e.target.checked; commit((d) => { const a = d.accounts.find((x) => x.id === id); if (a) { if (on) a.invHidden = true; else delete a.invHidden; stamp(a); } }); toast(on ? 'Hidden from Investments.' : 'Shown in Investments again.'); return; }
    if (e.target.dataset.p !== 'tz') return; commit((d) => { (d.settings.platformTz = d.settings.platformTz || {})[ex] = +e.target.value; }); toast(`Timezone of ${ex} saved.`); draw(); });
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-p=done]')) { s.close(); return; }
    if (e.target.closest('[data-p=logo-reset]')) { commit((d) => { if (d.settings.platformIcons) delete d.settings.platformIcons[ex]; }); toast('Using the Sukli symbol again.'); draw(); return; }
    const st = e.target.closest('[data-p=showtype]'); if (st) { const w = st.dataset.v, on = st.getAttribute('aria-pressed') !== 'true'; commit((d) => { const m = (d.settings.invHiddenTypes = d.settings.invHiddenTypes || {}), l = new Set(m[ex] || []); if (on) l.delete(w); else l.add(w); if (l.size) m[ex] = [...l]; else delete m[ex]; }); toast(on ? `${w} is shown in Investments.` : `${w} is hidden from Investments.`); draw(); return; }
    if (e.target.closest('[data-p=addtype]')) { const v = await promptDialog('New account type', '', { okLabel: 'Add', hint: `A product name on ${ex}, for example Copy Trading, Launchpool or Margin (Isolated).` }); if (v && addAccountType(ex, v)) { toast(`${v.trim()} added to ${ex}.`); draw(); } return; }
    const dt = e.target.closest('[data-p=deltype]'); if (dt) { removeAccountType(ex, dt.dataset.v); draw(); } });
}
ACT['plat-open'] = (el) => openPlatform(el.dataset.ex);
// a button inside the sheet runs the same action as the one on the card, then the sheet gets out of the way
ACT['plat-do'] = (el) => { const fn = ACT[el.dataset.do]; if (!fn) return; const sh = el.closest('.sheet'); if (sh && sh.querySelector('.platset')) { const x = sh.querySelector('[data-p=done]'); x && x.click(); } fn(el); };

// the way back for accounts hidden from Investments (a platform whose accounts are all hidden has no card, so this list lives on the page itself)
const hiddenTypes = (db, ex) => ((db.settings || {}).invHiddenTypes || {})[ex] || [];
export function hiddenInvLink(db) {
  const n = db.accounts.filter((a) => !a.deleted && !a.archived && inInvest(a) && (a.invHidden || typeHidden(db, a))).length;
  return n ? `<p class="hint hiddenlink">${n} account${n === 1 ? ' is' : 's are'} hidden from this tab. ${button({ label: 'Show Hidden Accounts', kind: 'link', act: 'inv-hidden' })}</p>` : '';
}
ACT['inv-hidden'] = () => {
  const s = sheet('<div id="hl"></div>', { title: 'Hidden Accounts' }), root = s.el.querySelector('#hl');
  const draw = () => { const db = get(), bal = balances(db), l = db.accounts.filter((a) => !a.deleted && !a.archived && inInvest(a) && a.invHidden);
    const ht = Object.entries((db.settings.invHiddenTypes) || {}).flatMap(([ex, ws]) => ws.map((w) => [ex, w]));
    root.innerHTML = `${ht.length ? `<h3>Hidden Account Types</h3><p class="hint">These types are Not selected. Tap one to show it in Investments again.</p><div class="chips typechips">${ht.map(([ex, w]) => button({ html: `<b class="tmark" aria-hidden="true">–</b>${esc(ex)} · ${esc(w)}`, kind: 'chip', cls: 'tchip off', pressed: false, attr: { 'data-hx': ex, 'data-w': w } })).join('')}</div>` : ''}${l.length ? `<h3>Hidden Accounts</h3><p class="hint">Untick an account to show it in Investments again. Nothing is deleted.</p><div class="hidelist">${l.map((a) => `<label class="check"><input type="checkbox" data-id="${a.id}" checked> <span>${esc(exchangeOf(a))} · ${esc(a.cur)} <small class="muted">${esc(walletOf(a))}${(bal.get(a.id) || 0) ? ' · ' + esc(fmt(bal.get(a.id) || 0, a.cur)) : ''}</small></span></label>`).join('')}</div>` : (ht.length ? '' : '<p class="empty">No hidden accounts.</p>')}
      <div class="btnrow">${button({ label: 'Done', kind: 'primary', attr: { 'data-done': true } })}</div>`; };
  draw();
  root.addEventListener('change', (e) => { const id = e.target.dataset.id; if (!id) return; commit((d) => { const a = d.accounts.find((x) => x.id === id); if (a) { if (e.target.checked) a.invHidden = true; else delete a.invHidden; stamp(a); } }); toast('Saved.'); });
  root.addEventListener('click', (e) => { const hc = e.target.closest('[data-hx]'); if (hc) { const ex = hc.dataset.hx, w = hc.dataset.w; commit((d) => { const m = d.settings.invHiddenTypes || {}; m[ex] = (m[ex] || []).filter((x) => x !== w); if (!m[ex].length) delete m[ex]; }); toast(`${w} is shown in Investments.`); draw(); return; } if (e.target.closest('[data-done]')) s.close(); });
};
