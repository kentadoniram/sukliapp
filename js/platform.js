// Exchange settings: tap an exchange's name on its card in Investments to see and change everything for the whole exchange at once
// (instead of opening each asset account one by one).
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
      <div class="chips">${accountTypesOf(db, ex).map((w) => { const mine = ((db.settings.acctTypes || {})[Object.keys(db.settings.acctTypes || {}).find((x) => x.toLowerCase() === ex.toLowerCase())] || []).includes(w) && !wallets.includes(w); return `<span class="chip ${wallets.includes(w) ? 'on' : ''}">${esc(w)}${mine ? ` <button type="button" class="linkbtn" data-p="deltype" data-v="${esc(w)}" aria-label="Remove ${esc(w)}">✕</button>` : ''}</span>`; }).join('')}<button type="button" class="chip" data-p="addtype">+ Add Account Type</button></div>
      <p class="hint">Exchanges add new products from time to time. Add the name here (for example Copy Trading) and it appears in From, To and when adding assets for ${esc(ex)}.</p>
      <h3>Actions</h3>
      <div class="btnrow left"><button type="button" class="btn sm" data-act="plat-do" data-do="inv-add" data-ex="${esc(ex)}">Record</button><button type="button" class="btn sm ghost" data-act="plat-do" data-do="inv-coin" data-ex="${esc(ex)}">+ Asset</button><button type="button" class="btn sm ghost" data-act="plat-do" data-do="inv-internal" data-ex="${esc(ex)}">Internal Transfer</button></div>
      <label class="field"><span>Timezone of ${esc(ex)}</span><select data-p="tz">${Array.from({ length: 27 }, (_, i) => i - 12).map((z) => `<option value="${z}" ${z === off ? 'selected' : ''}>${tzName(z)}</option>`).join('')}</select></label>
      <p class="hint">Used for every Earn product here: subscription times and hourly earnings follow this clock.</p>
      ${earn.length ? `<h3>Earn Products</h3><ul class="calfacts">${earn.map((a) => `<li><span>${esc(a.cur)} <small class="muted">${a.earn && a.earn.on ? 'On' : 'Off'}</small></span><button type="button" class="btn sm ghost" data-act="plat-do" data-do="earn-open" data-id="${a.id}">Subscription Settings</button></li>`).join('')}</ul>` : ''}
      <h3>Platform</h3>
      <div class="btnrow left"><button type="button" class="btn sm ghost" data-act="plat-do" data-do="inv-rename" data-ex="${esc(ex)}">Rename</button>${accts.length ? '' : `<button type="button" class="btn sm ghost danger" data-act="plat-do" data-do="inv-platdel" data-ex="${esc(ex)}">Remove</button>`}</div>
      <div class="btnrow"><button type="button" class="btn primary" data-p="done">Done</button></div>`;
  };
  draw();
  root.addEventListener('change', (e) => { if (e.target.dataset.p !== 'tz') return; commit((d) => { (d.settings.platformTz = d.settings.platformTz || {})[ex] = +e.target.value; }); toast(`Timezone of ${ex} saved.`); draw(); });
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-p=done]')) { s.close(); return; }
    if (e.target.closest('[data-p=addtype]')) { const v = await promptDialog('New account type', '', { okLabel: 'Add', hint: `A product name on ${ex}, for example Copy Trading, Launchpool or Margin (Isolated).` }); if (v && addAccountType(ex, v)) { toast(`${v.trim()} added to ${ex}.`); draw(); } return; }
    const dt = e.target.closest('[data-p=deltype]'); if (dt) { removeAccountType(ex, dt.dataset.v); draw(); } });
}
ACT['plat-open'] = (el) => openPlatform(el.dataset.ex);
// a button inside the sheet runs the same action as the one on the card, then the sheet gets out of the way
ACT['plat-do'] = (el) => { const fn = ACT[el.dataset.do]; if (!fn) return; const sh = el.closest('.sheet'); if (sh && sh.querySelector('.platset')) { const x = sh.querySelector('[data-p=done]'); x && x.click(); } fn(el); };
