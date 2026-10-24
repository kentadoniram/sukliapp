// Searchable account list: type to find an account, or filter by currency. Works across all currencies,
// so picking an account also settles the currency if you had not chosen it yet.
import { get, groupColor, groupLetter, accLabel, walletOf, balances, fmt, priv } from './core.js';
// investment accounts first when the transfer starts from an investment account or from the Investments tab; then banks, cash, e-wallets
const INV = (a) => !!a && (a.type === 'crypto' || a.type === 'invest' || !!a.invtab);
import { typeNames } from './accpage.js';
import { sheet, esc } from './ui.js';

export function openAccountPicker({ selected = '', skip = '', cur = '', title = 'Account' }, onPick) {
  const db = get(), bal = balances(db);
  const list = db.accounts.filter((a) => !a.deleted && (!a.archived || a.id === selected));   // the account on the other side stays in the list (greyed), so it never looks missing
  const curs = [...new Set(list.map((a) => a.cur))];
  let chip = cur && curs.includes(cur) ? cur : '';
  const s = sheet(`<input type="search" id="acq" class="search" data-noclear="1" placeholder="Search account, type or currency" autocomplete="off" autofocus>
    <div class="seg sm scrollx acchips" role="group" aria-label="Currency">${['', ...curs].map((c) => `<button type="button" data-chip="${esc(c)}">${c || 'All'}</button>`).join('')}</div>
    <div id="aclist"></div>`, { title, cls: 'pickfix' });
  const draw = () => {
    const q = s.el.querySelector('#acq').value.trim().toLowerCase();
    s.el.querySelectorAll('[data-chip]').forEach((b) => { const on = b.dataset.chip === (q ? '' : chip); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const hit = list.filter((a) => (q ? `${a.name} ${accLabel(a)} ${typeNames[a.type] || a.type} ${a.cur} ${a.exchange || ''} ${a.wallet || ''}`.toLowerCase().includes(q) : !chip || a.cur === chip));
    const invFirst = INV(db.accounts.find((a) => a.id === selected)) || INV(db.accounts.find((a) => a.id === skip)) || /^#\/invest/.test(location.hash);
    const order = invFirst ? ['bank', 'cash', 'ewallet', ...Object.keys(typeNames).filter((k) => !['bank', 'cash', 'ewallet'].includes(k))] : Object.keys(typeNames), groups = new Map();
    const gk = (a) => (a.exchange ? `\u0001${a.exchange} · ${walletOf(a)}` : a.type);   // platform > wallet for investments, the account type for the rest
    for (const a of hit) { const k = gk(a); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
    const html = [...groups.entries()].sort((x, y) => { const ix = (k) => (k.startsWith('\u0001') ? (invFirst ? -1 : 99) : order.indexOf(k)), mine = (k) => (k.startsWith('\u0001') && selected && db.accounts.some((a) => a.id === selected && `\u0001${a.exchange} · ${walletOf(a)}` === k) ? 0 : 1); return ix(x[0]) - ix(y[0]) || mine(x[0]) - mine(y[0]) || x[0].localeCompare(y[0]); }).map(([t, as]) =>
      `<h3>${esc(t.startsWith('\u0001') ? t.slice(1) : (typeNames[t] || t))}</h3><div class="rows plain">${as.sort((x, y) => (y.id === selected) - (x.id === selected) || x.name.localeCompare(y.name)).map((a) =>
        `<button type="button" class="row cur" data-id="${a.id}" ${a.id === skip ? 'disabled aria-disabled="true"' : ''}><i class="badge sm" style="background:${groupColor(a.type)}">${esc(groupLetter(typeNames[a.type] || a.type))}</i><span class="rmain"><strong>${esc(a.name)}${a.id === selected ? ' ✓' : ''}</strong><small>${a.id === skip ? 'Already chosen on the other side' : esc(typeNames[a.type] || a.type) + ' · ' + a.cur + (a.exchange ? ' · ' + esc(accLabel({ exchange: a.exchange, wallet: a.wallet, name: '' }).replace(/^ · /, '')) : '')}</small></span><span class="ramt"><b class="${(bal.get(a.id) || 0) < 0 ? 'neg' : ''}">${esc(fmt(bal.get(a.id) || 0, a.cur, { force: !priv.on }))}</b><small>balance</small></span></button>`).join('')}</div>`).join('');
    s.el.querySelector('#aclist').innerHTML = html || '<p class="empty">No account matches. Try another name or currency.</p>';
  };
  s.el.querySelector('#acq').addEventListener('input', draw);
  s.el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-chip]'); if (c) { chip = c.dataset.chip; draw(); return; }
    const r = e.target.closest('[data-id]'); if (r) { s.close(); onPick(r.dataset.id); }
  });
  draw();
}
