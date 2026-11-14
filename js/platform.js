// Exchange settings: tap an exchange's name on its card in Investments to see and change everything for the whole exchange at once
// (instead of opening each asset account one by one).
import { button } from './components.js';
import { get, commit, stamp, walletOf, fmt, HOME, balances, homeFx } from './core.js';
import { ACT, sheet, esc, toast } from './ui.js';
import { exchangeOf, inInvest } from './invest.js';
import { tzOf, tzName } from './earn.js';
import { accountTypesOf, addAccountType, removeAccountType } from './tokens.js';
import { promptDialog } from './ui.js';

export function openPlatform(ex) {
  const s = sheet('<div id="pset" class="platset"></div>', { title: ex, wide: true }), root = s.el.querySelector('#pset');
  const draw = () => {
    const db = get(), accts = db.accounts.filter((a) => !a.deleted && !a.archived && inInvest(a) && exchangeOf(a) === ex), bal = balances(db);
    const val = (a) => (bal.get(a.id) || 0) * (a.cur === HOME ? 1 : (homeFx(db, a.cur) || 0));
    const total = accts.reduce((t, a) => t + val(a), 0), off = tzOf(db, { exchange: ex });
    const wallets = [...new Set(accts.map(walletOf))], earn = accts.filter((a) => walletOf(a) === 'Earn');
    root.innerHTML = `
      <p class="hint"><b>${esc(ex)}</b> › Accounts (${esc(wallets.join(', ') || 'none yet')}) › Assets · ${accts.length} asset balance${accts.length === 1 ? '' : 's'} · about <b>${esc(fmt(total, HOME))}</b>. Every coin of the top 50 can be used in any account here without adding it first.</p>
      <h3>Account Types</h3>
      <div class="chips">${accountTypesOf(db, ex).map((w) => { const mine = ((db.settings.acctTypes || {})[Object.keys(db.settings.acctTypes || {}).find((x) => x.toLowerCase() === ex.toLowerCase())] || []).includes(w) && !wallets.includes(w); return `<span class="chip ${wallets.includes(w) ? 'on' : ''}">${esc(w)}${mine ? ` ${button({ label: '✕', kind: 'link', aria: `Remove ${w}`, attr: { 'data-p': 'deltype', 'data-v': w } })}` : ''}</span>`; }).join('')}${button({ label: '+ Add Account Type', kind: 'chip', attr: { 'data-p': 'addtype' } })}</div>
      <p class="hint">Exchanges add new products from time to time. Add the name here (for example Copy Trading) and it appears in From, To and when adding assets for ${esc(ex)}.</p>
      <h3>Actions</h3>
      <div class="btnrow left">${button({ label: 'Record', kind: 'primary', size: 'sm', act: 'plat-do', attr: { 'data-do': 'inv-add', 'data-ex': ex } })}${button({ label: '+ Asset', kind: 'ghost', size: 'sm', act: 'plat-do', attr: { 'data-do': 'inv-coin', 'data-ex': ex } })}${button({ label: 'Internal Transfer', kind: 'ghost', size: 'sm', act: 'plat-do', attr: { 'data-do': 'inv-internal', 'data-ex': ex } })}</div>
      <label class="field"><span>Timezone of ${esc(ex)}</span><select data-p="tz">${Array.from({ length: 27 }, (_, i) => i - 12).map((z) => `<option value="${z}" ${z === off ? 'selected' : ''}>${tzName(z)}</option>`).join('')}</select></label>
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
  root.addEventListener('change', (e) => { if (e.target.dataset.p === 'hide') { const id = e.target.dataset.id, on = e.target.checked; commit((d) => { const a = d.accounts.find((x) => x.id === id); if (a) { if (on) a.invHidden = true; else delete a.invHidden; stamp(a); } }); toast(on ? 'Hidden from Investments.' : 'Shown in Investments again.'); return; }
    if (e.target.dataset.p !== 'tz') return; commit((d) => { (d.settings.platformTz = d.settings.platformTz || {})[ex] = +e.target.value; }); toast(`Timezone of ${ex} saved.`); draw(); });
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-p=done]')) { s.close(); return; }
    if (e.target.closest('[data-p=addtype]')) { const v = await promptDialog('New account type', '', { okLabel: 'Add', hint: `A product name on ${ex}, for example Copy Trading, Launchpool or Margin (Isolated).` }); if (v && addAccountType(ex, v)) { toast(`${v.trim()} added to ${ex}.`); draw(); } return; }
    const dt = e.target.closest('[data-p=deltype]'); if (dt) { removeAccountType(ex, dt.dataset.v); draw(); } });
}
ACT['plat-open'] = (el) => openPlatform(el.dataset.ex);
// a button inside the sheet runs the same action as the one on the card, then the sheet gets out of the way
ACT['plat-do'] = (el) => { const fn = ACT[el.dataset.do]; if (!fn) return; const sh = el.closest('.sheet'); if (sh && sh.querySelector('.platset')) { const x = sh.querySelector('[data-p=done]'); x && x.click(); } fn(el); };

// the way back for accounts hidden from Investments (a platform whose accounts are all hidden has no card, so this list lives on the page itself)
export function hiddenInvLink(db) {
  const n = db.accounts.filter((a) => !a.deleted && !a.archived && inInvest(a) && a.invHidden).length;
  return n ? `<p class="hint hiddenlink">${n} account${n === 1 ? ' is' : 's are'} hidden from this tab. ${button({ label: 'Show or Hide Accounts', kind: 'link', act: 'inv-hidden' })}</p>` : '';
}
ACT['inv-hidden'] = () => {
  const s = sheet('<div id="hl"></div>', { title: 'Hidden Accounts' }), root = s.el.querySelector('#hl');
  const draw = () => { const db = get(), bal = balances(db), l = db.accounts.filter((a) => !a.deleted && !a.archived && inInvest(a) && a.invHidden);
    root.innerHTML = `${l.length ? `<p class="hint">Untick an account to show it in Investments again. Nothing is deleted.</p><div class="hidelist">${l.map((a) => `<label class="check"><input type="checkbox" data-id="${a.id}" checked> <span>${esc(exchangeOf(a))} · ${esc(a.cur)} <small class="muted">${esc(walletOf(a))}${(bal.get(a.id) || 0) ? ' · ' + esc(fmt(bal.get(a.id) || 0, a.cur)) : ''}</small></span></label>`).join('')}</div>` : '<p class="empty">No hidden accounts.</p>'}
      <div class="btnrow">${button({ label: 'Done', kind: 'primary', attr: { 'data-done': true } })}</div>`; };
  draw();
  root.addEventListener('change', (e) => { const id = e.target.dataset.id; if (!id) return; commit((d) => { const a = d.accounts.find((x) => x.id === id); if (a) { if (e.target.checked) a.invHidden = true; else delete a.invHidden; stamp(a); } }); toast('Saved.'); });
  root.addEventListener('click', (e) => { if (e.target.closest('[data-done]')) s.close(); });
};
