// Searchable account list: type to find an account, or filter by currency. Works across all currencies,
// so picking an account also settles the currency if you had not chosen it yet.
import { acctPic } from './pictures.js';
import { platIcon } from './platicons.js';
import { assetIcon } from './curpicker.js';
import { platformOf, isEarnAcct, get, groupColor, groupLetter, accLabel, walletOf, balances, fmt, priv } from './core.js';
// investment accounts first when the transfer starts from an investment account or from the Investments tab; then banks, cash, e-wallets
const INV = (a) => !!a && (a.type === 'crypto' || a.type === 'invest' || !!a.invtab);
import { typeNames } from './accpage.js';
import { sheet, esc } from './ui.js';
import { button } from './components.js';
import { isLiability, isOwed } from './finance.js';

// one account row, the same in the entry account list and in the Buy/Sell/Convert tree
export const acctRow = (a, { selected = '', skip = '', bal = balances(get()) } = {}) =>
  `${button({ kind: 'plain', cls: 'row cur', disabled: a.id === skip, attr: { 'data-id': a.id, ...(a.id === skip ? { 'aria-disabled': 'true' } : {}) }, html: `<i class="badge sm ${platformOf(a) && !a.icon ? 'coinbadge' : ''}" style="background:${platformOf(a) && !a.icon && assetIcon(a, get().settings.tickers || {}).coin ? 'transparent' : groupColor(a.type)}">${platformOf(a) ? assetIcon(a, get().settings.tickers || {}).html : acctPic(a)}</i><span class="rmain"><strong>${esc(platformOf(a) ? accLabel(a) : a.name)}${a.id === selected ? ' ✓' : ''}</strong><small>${a.id === skip ? 'Already chosen on the other side' : esc(typeNames[a.type] || a.type) + ' · ' + a.cur + (a.exchange ? ' · ' + esc(accLabel({ exchange: a.exchange, wallet: a.wallet, name: '' }).replace(/^ · /, '')) : '')}</small></span><span class="ramt"><b class="${(bal.get(a.id) || 0) < 0 ? 'neg' : ''}">${esc(fmt(bal.get(a.id) || 0, a.cur, { force: !priv.on }))}</b><small>balance</small></span>` })}`;
export function openAccountPicker({ selected = '', skip = '', cur = '', only = '', title = 'Account', add = null }, onPick) {
  const db = get(), bal = balances(db);
  const list = db.accounts.filter((a) => !a.deleted && (!a.archived || a.id === selected) && (!isEarnAcct(a) || a.id === selected) && (!only || (only === 'debt' ? isLiability(a) : only === 'owed' ? isOwed(a) : !isLiability(a) && !isOwed(a))));   // the account on the other side stays in the list (greyed), so it never looks missing
  const curs = [...new Set(list.map((a) => a.cur))];
  let chip = cur && curs.includes(cur) ? cur : '', fold = false;
  try { fold = localStorage.getItem('sukli-acchips-fold') === '1'; } catch { /* private window: stay open */ }
  const s = sheet(`<input type="search" id="acq" class="search" data-noclear="1" placeholder="Search account, type or currency" autocomplete="off" autofocus>
    ${button({ label: `Currency: ${chip || 'All'} ${fold ? '▸' : '▾'}`, kind: 'link', cls: 'chipfold', id: 'chipnow', attr: { 'data-chipfold': '', 'aria-expanded': String(!fold), 'aria-controls': 'acchips' } })}
    <div class="seg sm scrollx acchips" id="acchips" role="group" aria-label="Currency" ${fold ? 'hidden' : ''}>${['', ...curs].map((c) => button({ label: c || 'All', kind: 'plain', attr: { 'data-chip': c } })).join('')}</div>
    ${add ? `${button({ label: `+ ${add.label}`, kind: 'ghost', cls: 'wide addnew', attr: { 'data-addnew': true } })}` : ''}<div id="aclist"></div>`, { title, cls: 'pickfix' });
  const draw = () => {
    const q = s.el.querySelector('#acq').value.trim().toLowerCase();
    { const q2 = q ? '' : chip, cn = s.el.querySelector('#chipnow'); if (cn) cn.textContent = `Currency: ${q2 || 'All'} ${fold ? '▸' : '▾'}`; }
    s.el.querySelectorAll('[data-chip]').forEach((b) => { const on = b.dataset.chip === (q ? '' : chip); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const hit = list.filter((a) => (q ? `${a.name} ${accLabel(a)} ${typeNames[a.type] || a.type} ${a.cur} ${a.exchange || ''} ${a.wallet || ''}`.toLowerCase().includes(q) : !chip || a.cur === chip));
    const invFirst = INV(db.accounts.find((a) => a.id === selected)) || INV(db.accounts.find((a) => a.id === skip)) || /^#\/invest/.test(location.hash);
    const order = invFirst ? ['bank', 'cash', 'ewallet', 'ic', ...Object.keys(typeNames).filter((k) => !['bank', 'cash', 'ewallet', 'ic'].includes(k))] : Object.keys(typeNames), groups = new Map();
    const gk = (a) => (a.exchange ? `\u0001${a.exchange} · ${walletOf(a)}` : a.type);   // platform > wallet for investments, the account type for the rest
    for (const a of hit) { const k = gk(a); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
    const html = [...groups.entries()].sort((x, y) => { const ix = (k) => (k.startsWith('\u0001') ? (invFirst ? -1 : 99) : order.indexOf(k)), mine = (k) => (k.startsWith('\u0001') && selected && db.accounts.some((a) => a.id === selected && `\u0001${a.exchange} · ${walletOf(a)}` === k) ? 0 : 1); return ix(x[0]) - ix(y[0]) || mine(x[0]) - mine(y[0]) || x[0].localeCompare(y[0]); }).map(([t, as]) =>
      `<h3>${t.startsWith('\u0001') ? `${platIcon(t.slice(1).split(' · ')[0], 'xs')}` : ''}${esc(t.startsWith('\u0001') ? t.slice(1) : (typeNames[t] || t))}</h3><div class="rows plain">${as.sort((x, y) => (y.id === selected) - (x.id === selected) || x.name.localeCompare(y.name)).map((a) =>
        acctRow(a, { selected, skip, bal })).join('')}</div>`).join('');
    s.el.querySelector('#aclist').innerHTML = html || '<p class="empty">No account matches. Try another name or currency.</p>';
  };
  s.el.querySelector('#acq').addEventListener('input', draw);
  s.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-addnew]')) { s.close(); add.run(); return; }
    if (e.target.closest('[data-chipfold]')) { fold = !fold; const bx = s.el.querySelector('#acchips'), bt = s.el.querySelector('[data-chipfold]'); bx.hidden = fold; bt.setAttribute('aria-expanded', String(!fold)); draw(); try { localStorage.setItem('sukli-acchips-fold', fold ? '1' : '0'); } catch { /* not saved */ } return; }
    const c = e.target.closest('[data-chip]'); if (c) { chip = c.dataset.chip; draw(); return; }
    const r = e.target.closest('[data-id]'); if (r) { s.close(); onPick(r.dataset.id); }
  });
  draw();
}
