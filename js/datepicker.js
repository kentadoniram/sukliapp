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
  let clock = false, stage = 'h';   /* clock: show the analog clock; stage: which hand is being set */
  const today = nowStamp().slice(0, 10);
  const s = sheet('<div id="dp"></div>', { title });
  const root = s.el.querySelector('#dp');
  let draw = () => {
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
      ${time ? `<div class="dptime"><span>Time</span><select id="dp-h" aria-label="Hour">${Array.from({ length: 24 }, (_, i) => `<option ${i === hh ? 'selected' : ''} value="${i}">${p2(i)}</option>`).join('')}</select>:<select id="dp-m" aria-label="Minute">${Array.from({ length: 60 }, (_, i) => `<option ${i === mm ? 'selected' : ''} value="${i}">${p2(i)}</option>`).join('')}</select><button type="button" class="chip" data-now>Now</button><button type="button" class="chip ${clock ? 'on' : ''}" data-clock aria-pressed="${clock}" title="Pick the time on an analog clock">🕒 Clock</button></div>
      ${clock ? '<div id="dp-clock" class="dpclock"></div>' : ''}` : ''}
      <p class="dpsel">${esc(prettyDate(sel, false))}</p>
      <div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button type="button" class="btn" data-ok>Set</button></div>`;
  };
  const setAgo = (n) => { if (!(n >= 0)) return; const d = new Date(Date.now() - n * 3600 * 1000); hh = d.getHours(); mm = d.getMinutes(); sel = ymd(d); view = sel.slice(0, 7); draw(); };
  // the analog clock: tap or drag to the hour, then the minute. It only repaints itself, so dragging is smooth.
  const paintClock = () => {
    const el = root.querySelector('#dp-clock'); if (!el) return;
    const pm = hh >= 12, h12 = hh % 12, R = 84, C = 100, pt = (deg, r) => [C + r * Math.sin(deg * Math.PI / 180), C - r * Math.cos(deg * Math.PI / 180)];
    const val = stage === 'h' ? (h12 / 12) * 360 : (mm / 60) * 360, [hx, hy] = pt(val, R - 14);
    const nums = stage === 'h' ? Array.from({ length: 12 }, (_, i) => [i === 0 ? 12 : i, i * 30]) : Array.from({ length: 12 }, (_, i) => [p2(i * 5), i * 30]);
    el.innerHTML = `<div class="dpclockhead"><button type="button" class="dpcbig ${stage === 'h' ? 'on' : ''}" data-st="h">${p2(h12 === 0 ? 12 : h12)}</button>:<button type="button" class="dpcbig ${stage === 'm' ? 'on' : ''}" data-st="m">${p2(mm)}</button>
      <span class="dpampm"><button type="button" class="chip ${!pm ? 'on' : ''}" data-ap="am">AM</button><button type="button" class="chip ${pm ? 'on' : ''}" data-ap="pm">PM</button></span></div>
      <svg viewBox="0 0 200 200" class="dpface" role="img" aria-label="Analog clock. Tap or drag to set the ${stage === 'h' ? 'hour' : 'minute'}"><circle cx="100" cy="100" r="96" class="dpfacebg"/>
      <line x1="100" y1="100" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" class="dphand"/><circle cx="100" cy="100" r="4" class="dphub"/>
      ${nums.map(([n, d]) => { const [x, y] = pt(d, R - 14); return `<text x="${x.toFixed(1)}" y="${(y + 4.5).toFixed(1)}" text-anchor="middle" class="dpnum">${n}</text>`; }).join('')}<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="15" class="dpknob"/></svg>
      <p class="hint">Tap or drag the clock: first the hour, then the minute.</p>`;
  };
  const clockAt = (e) => { const svg = root.querySelector('.dpface'); if (!svg) return; const r = svg.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2); let deg = (Math.atan2(x, -y) * 180) / Math.PI; if (deg < 0) deg += 360;
    if (stage === 'h') { const k = Math.round(deg / 30) % 12; hh = (hh >= 12 ? 12 : 0) + k; } else { mm = Math.round(deg / 6) % 60; } paintClock(); };
  let drag = false;
  root.addEventListener('pointerdown', (e) => { if (!e.target.closest('.dpface')) return; drag = true; try { root.setPointerCapture(e.pointerId); } catch { /* fine */ } clockAt(e); });
  root.addEventListener('pointermove', (e) => { if (drag) clockAt(e); });
  const endDrag = () => { if (drag && stage === 'h') { stage = 'm'; paintClock(); } drag = false; };
  root.addEventListener('pointerup', endDrag); root.addEventListener('pointercancel', () => { drag = false; });
  const drawAll = draw; draw = () => { drawAll(); paintClock(); };
  draw();
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.d) { sel = b.dataset.d; view = sel.slice(0, 7); draw(); }
    else if (b.dataset.m) { view = shiftMonth(view, +b.dataset.m); draw(); }
    else if (b.dataset.q != null) { const d = new Date(); d.setDate(d.getDate() + +b.dataset.q); sel = ymd(d); view = sel.slice(0, 7); draw(); }
    else if (b.dataset.ago) { setAgo(+b.dataset.ago); }
    else if (b.hasAttribute('data-now')) { const n = new Date(); hh = n.getHours(); mm = n.getMinutes(); sel = ymd(n); view = sel.slice(0, 7); draw(); }
    else if (b.hasAttribute('data-clock')) { clock = !clock; stage = 'h'; draw(); }
    else if (b.dataset.st) { stage = b.dataset.st; paintClock(); }
    else if (b.dataset.ap) { hh = (hh % 12) + (b.dataset.ap === 'pm' ? 12 : 0); draw(); }
    else if (b.hasAttribute('data-no')) s.close();
    else if (b.hasAttribute('data-ok')) { s.close(); onPick(time ? `${sel} ${p2(hh)}:${p2(mm)}:00` : sel); }
  });
  root.addEventListener('change', (e) => { if (e.target.id === 'dp-h') hh = +e.target.value; if (e.target.id === 'dp-m') mm = +e.target.value; if (e.target.id === 'dp-ago') setAgo(parseFloat(e.target.value)); });
  return s;
}
