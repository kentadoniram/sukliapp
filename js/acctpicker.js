// Searchable account list: type to find an account, or filter by currency. Works across all currencies,
// so picking an account also settles the currency if you had not chosen it yet.
import { get, groupColor, groupLetter } from './core.js';
import { typeNames } from './accpage.js';
import { sheet, esc } from './ui.js';

export function openAccountPicker({ selected = '', skip = '', cur = '', title = 'Account' }, onPick) {
  const db = get();
  const list = db.accounts.filter((a) => !a.deleted && a.id !== skip && (!a.archived || a.id === selected));
  const curs = [...new Set(list.map((a) => a.cur))];
  let chip = cur && curs.includes(cur) ? cur : '';
  const s = sheet(`<input type="search" id="acq" class="search" data-noclear="1" placeholder="Search account, type or currency" autocomplete="off" autofocus>
    <div class="seg sm scrollx acchips" role="group" aria-label="Currency">${['', ...curs].map((c) => `<button type="button" data-chip="${esc(c)}">${c || 'All'}</button>`).join('')}</div>
    <div id="aclist"></div>`, { title });
  const draw = () => {
    const q = s.el.querySelector('#acq').value.trim().toLowerCase();
    s.el.querySelectorAll('[data-chip]').forEach((b) => { const on = b.dataset.chip === (q ? '' : chip); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const hit = list.filter((a) => (q ? `${a.name} ${typeNames[a.type] || a.type} ${a.cur} ${a.exchange || ''}`.toLowerCase().includes(q) : !chip || a.cur === chip));
    const order = Object.keys(typeNames), groups = new Map();
    for (const a of hit) { if (!groups.has(a.type)) groups.set(a.type, []); groups.get(a.type).push(a); }
    const html = [...groups.entries()].sort((x, y) => order.indexOf(x[0]) - order.indexOf(y[0])).map(([t, as]) =>
      `<h3>${esc(typeNames[t] || t)}</h3><div class="rows plain">${as.sort((x, y) => (y.id === selected) - (x.id === selected) || x.name.localeCompare(y.name)).map((a) =>
        `<button type="button" class="row cur" data-id="${a.id}"><i class="badge sm" style="background:${groupColor(a.type)}">${esc(groupLetter(typeNames[a.type] || a.type))}</i><span class="rmain"><strong>${esc(a.name)}${a.id === selected ? ' ✓' : ''}</strong><small>${esc(typeNames[a.type] || a.type)} · ${a.cur}${a.exchange ? ' · ' + esc(a.exchange) : ''}</small></span></button>`).join('')}</div>`).join('');
    s.el.querySelector('#aclist').innerHTML = html || '<p class="empty">No account matches. Try another name or currency.</p>';
  };
  s.el.querySelector('#acq').addEventListener('input', draw);
  s.el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-chip]'); if (c) { chip = c.dataset.chip; draw(); return; }
    const r = e.target.closest('[data-id]'); if (r) { s.close(); onPick(r.dataset.id); }
  });
  draw();
}
