// A calendar card for picking a date (and optionally a time). Used by the entry sheet and the analytics filters.
import { esc, sheet } from './ui.js';
import { nowStamp, monthLabel, shiftMonth } from './core.js';

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const prettyDate = (s, time = true) => {
  const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
  const t = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return time && String(s).length >= 16 ? `${t} · ${String(s).slice(11, 16)}` : t;
};

// value: 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS'. onPick gets the same shape back. opts.time false = date only.
export function openDatePicker(value, onPick, { time = true, title = 'Choose a date', min = '', max = '', marks = null } = {}) {
  const v = value || nowStamp();
  let sel = v.slice(0, 10), view = sel.slice(0, 7);
  let hh = +(v.slice(11, 13) || 12), mm = +(v.slice(14, 16) || 0);
  const today = nowStamp().slice(0, 10);
  const s = sheet('<div id="dp"></div>', { title });
  const root = s.el.querySelector('#dp');
  const draw = () => {
    const [y, m] = view.split('-').map(Number);
    const first = new Date(y, m - 1, 1), start = first.getDay(), dim = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < start; i++) cells.push('<span></span>');
    for (let d = 1; d <= dim; d++) {
      const ds = `${view}-${p2(d)}`, off = (min && ds < min) || (max && ds > max);
      cells.push(`<button type="button" class="dpday ${ds === sel ? 'sel' : ''} ${ds === today ? 'today' : ''} ${marks && marks.has(ds) ? 'mark' : ''}" data-d="${ds}" ${off ? 'disabled' : ''} aria-label="${prettyDate(ds, false)}" aria-pressed="${ds === sel}">${d}</button>`);
    }
    root.innerHTML = `<div class="dpquick"><button type="button" class="chip" data-q="0">Today</button><button type="button" class="chip" data-q="-1">Yesterday</button><button type="button" class="chip" data-q="-7">A week ago</button></div>
      ${time ? `<div class="dpquick dpago"><span class="muted">Hours ago</span>${[1, 2, 3, 6, 12].map((n) => `<button type="button" class="chip" data-ago="${n}">${n} h</button>`).join('')}<input id="dp-ago" inputmode="numeric" placeholder="other" aria-label="Hours ago" data-noclear="1"></div>` : ''}
      <div class="dphead"><button type="button" class="iconbtn" data-m="-12" aria-label="Previous year">«</button><button type="button" class="iconbtn" data-m="-1" aria-label="Previous month">‹</button>
        <strong>${esc(monthLabel(view))}</strong><button type="button" class="iconbtn" data-m="1" aria-label="Next month">›</button><button type="button" class="iconbtn" data-m="12" aria-label="Next year">»</button></div>
      <div class="dpgrid dpdow">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x) => `<span>${x}</span>`).join('')}</div>
      <div class="dpgrid">${cells.join('')}</div>
      ${time ? `<div class="dptime"><span>Time</span><select id="dp-h" aria-label="Hour">${Array.from({ length: 24 }, (_, i) => `<option ${i === hh ? 'selected' : ''} value="${i}">${p2(i)}</option>`).join('')}</select>:<select id="dp-m" aria-label="Minute">${Array.from({ length: 60 }, (_, i) => `<option ${i === mm ? 'selected' : ''} value="${i}">${p2(i)}</option>`).join('')}</select><button type="button" class="chip" data-now>Now</button></div>` : ''}
      <p class="dpsel">${esc(prettyDate(sel, false))}</p>
      <div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button type="button" class="btn" data-ok>Set</button></div>`;
  };
  const setAgo = (n) => { if (!(n >= 0)) return; const d = new Date(Date.now() - n * 3600 * 1000); hh = d.getHours(); mm = d.getMinutes(); sel = ymd(d); view = sel.slice(0, 7); draw(); };
  draw();
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.d) { sel = b.dataset.d; view = sel.slice(0, 7); draw(); }
    else if (b.dataset.m) { view = shiftMonth(view, +b.dataset.m); draw(); }
    else if (b.dataset.q != null) { const d = new Date(); d.setDate(d.getDate() + +b.dataset.q); sel = ymd(d); view = sel.slice(0, 7); draw(); }
    else if (b.dataset.ago) { setAgo(+b.dataset.ago); }
    else if (b.hasAttribute('data-now')) { const n = new Date(); hh = n.getHours(); mm = n.getMinutes(); sel = ymd(n); view = sel.slice(0, 7); draw(); }
    else if (b.hasAttribute('data-no')) s.close();
    else if (b.hasAttribute('data-ok')) { s.close(); onPick(time ? `${sel} ${p2(hh)}:${p2(mm)}:00` : sel); }
  });
  root.addEventListener('change', (e) => { if (e.target.id === 'dp-h') hh = +e.target.value; if (e.target.id === 'dp-m') mm = +e.target.value; if (e.target.id === 'dp-ago') setAgo(parseFloat(e.target.value)); });
  return s;
}
