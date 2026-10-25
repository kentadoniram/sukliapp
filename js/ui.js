// Small UI helpers: escaping, icons, toast, bottom sheet, action registry.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const P = {
  left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', plus: 'M12 5v14M5 12h14', gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3', check: 'M5 13l4 4L19 7', x: 'M6 6l12 12M18 6L6 18',
  home: 'M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  wallet: 'M3 7a2 2 0 012-2h13v4M3 7v10a2 2 0 002 2h14a1 1 0 001-1v-3M3 7h15a2 2 0 012 2v2h-4a2 2 0 100 4h4', chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  swap: 'M7 7h13l-4-4M17 17H4l4 4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  calendar: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 10h16M8 3v4M16 3v4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  pie: 'M12 3a9 9 0 109 9h-9zM15 3.5A9 9 0 0120.5 9H15z', flow: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01', down: 'M6 9l6 6 6-6', gearsm: 'M12 15a3 3 0 100-6 3 3 0 000 6z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z',
  calc: 'M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeoff: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 4M6.5 6.6A17 17 0 002 12s4 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 004.2 4.2', split: 'M6 4v6a4 4 0 004 4h8M18 10l-4 4 4 4M6 20v-2',
};
export const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n] || ''}"/></svg>`;

// ---- actions: buttons carry data-act="name"; modules register handlers ----
export const ACT = {};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});

// ---- toast ----
let toastEl, toastTimer;
export function toast(msg, { undo, ms = 4500 } = {}) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" class="linkbtn">Undo</button>' : ''}`;
  toastEl.classList.add('show');
  const b = toastEl.querySelector('button');
  if (b) b.onclick = () => { undo(); toastEl.classList.remove('show'); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// ---- sheet ----
const stack = [];
// Back button support: every open sheet owns one history entry (depth = stack.length).
// Phone Back / browser Back closes the top sheet; closing with the X pops the entry again.
let hdepth = 0, ignorePop = 0, reconcileTimer = 0, baseHash = '', afterPop = null, pending = [];
function reconcile() {
  clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(() => {
    const extra = hdepth - stack.filter((x) => !x.pend).length;
    if (extra <= 0) return;
    // if the page changed while a sheet was open, step back first and then go to the new page,
    // so the history stays [page, new page] with no leftover sheet entries
    const target = !stack.length && location.hash !== baseHash ? location.hash : null;
    ignorePop++; hdepth -= extra;
    if (target !== null) afterPop = () => { location.hash = target; };
    history.go(-extra);
  }, 0);
}
// a sheet opened while a history step is still in flight waits for it, so the two cannot cross
function pushFor(api) {
  try { if (hdepth === 0) baseHash = location.hash; history.pushState({ sk: stack.length }, ''); hdepth++; } catch (e) { /* no history available */ }
}
window.addEventListener('popstate', () => {
  if (ignorePop > 0) {
    ignorePop--;
    if (ignorePop === 0) {
      if (afterPop) { const f = afterPop; afterPop = null; f(); }
      const p = pending; pending = [];
      for (const api of p) if (stack.includes(api)) { api.pend = false; pushFor(api); }
      reconcile();
    }
    return;
  }
  if (hdepth > 0) hdepth--;
  const top = [...stack].reverse().find((x) => !x.pend);
  if (top) top.dispose(true);
});
export function sheet(html, { title = '', onClose, wide = false, cls = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'scrim';
  wrap.innerHTML = `<div class="sheet ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="iconbtn" data-close aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-body">${html}</div></div>`;
  document.body.appendChild(wrap);
  hideTip();
  document.body.classList.add('noscroll');
  let gone = false;
  const api = {
    el: wrap.querySelector('.sheet-body'),
    root: wrap,
    // remove without calling onClose (used by dialogs that already answered)
    dispose(fromPop) {
      if (gone) return false; gone = true;
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      wrap.remove();
      if (!stack.length) document.body.classList.remove('noscroll');
      if (api.pend) { api.pend = false; pending = pending.filter((x) => x !== api); } else if (!fromPop) reconcile();
      return true;
    },
    close() { if (api.dispose()) if (onClose) onClose(); },
  };
  const origDispose = api.dispose;
  api.dispose = function (fromPop) { const r = origDispose(fromPop); if (r && fromPop && onClose && !api.silent) onClose(); return r; };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) api.close(); });
  wrap.querySelector('[data-close]').onclick = () => api.close();
  stack.push(api);
  if (ignorePop > 0) { api.pend = true; pending.push(api); } else pushFor(api);
  const first = wrap.querySelector('[autofocus]') || wrap.querySelector('input,select,textarea,button:not([data-close])');
  if (first && matchMedia('(pointer:fine)').matches) first.focus();
  return api;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
});

export function confirmDialog(message, okLabel = 'Confirm', danger = false) {
  return new Promise((res) => {
    const s = sheet(`<p class="confirm-text">${esc(message)}</p>
      <div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button>
      <button type="button" class="btn ${danger ? 'danger' : ''}" data-yes>${esc(okLabel)}</button></div>`, { title: 'Please confirm', onClose: () => res(false) });
    s.el.querySelector('[data-no]').onclick = () => s.close();
    s.el.querySelector('[data-yes]').onclick = () => { s.silent = true; s.dispose(); res(true); };
  });
}

export function promptDialog(label, value = '', { type = 'text', okLabel = 'Save', hint = '' } = {}) {
  return new Promise((res) => {
    const s = sheet(`<form><label class="field"><span>${esc(label)}</span>
      <input name="v" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(value)}" autofocus></label>
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
      <div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn">${esc(okLabel)}</button></div></form>`,
      { title: label, onClose: () => res(null) });
    s.el.querySelector('[data-no]').onclick = () => s.close();
    s.el.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const v = e.target.v.value;
      s.dispose();
      res(v);
    };
  });
}

// 2026-10-25-1213: the date and the time (HHMM) so two exports on one day never share a name
export const fileStamp = (d = new Date()) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
export function download(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---- tooltips: hover (mouse) or tap (touch) anything with data-tip; line charts with class "scrub" follow the finger ----
let tipEl, tipTimer;
export function hideTip() {
  if (tipEl) tipEl.classList.remove('show');
  document.querySelectorAll('svg .scrubcur').forEach((n) => n.remove());
}
function showTip(text, cx, top) {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
  tipEl.textContent = text;
  tipEl.classList.add('show');
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  const x = Math.max(8, Math.min(innerWidth - w - 8, cx - w / 2));
  const y = top - h - 8 < 8 ? top + 28 : top - h - 8;
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
}
function tipFor(el) { const r = el.getBoundingClientRect(); showTip(el.dataset.tip, r.left + r.width / 2, r.top); }
document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (t) tipFor(t);
});
document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && e.target.closest && e.target.closest('[data-tip]')) hideTip(); });
document.addEventListener('pointerdown', (e) => {
  const sc = e.target.closest && e.target.closest('svg.scrub');
  if (sc) { scrub(sc, e); return; }
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (t && e.pointerType !== 'mouse' && !t.closest('[data-act]')) { tipFor(t); clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 2600); }
  else if (!t) hideTip();
});
document.addEventListener('pointermove', (e) => {
  const sc = e.target.closest && e.target.closest('svg.scrub');
  if (sc && (e.pointerType === 'mouse' || e.buttons)) scrub(sc, e);
});
// line chart: data-pts = [[x, y, "label", "text"], ...] in viewBox units
function scrub(svg, e) {
  let pts; try { pts = JSON.parse(svg.dataset.pts || '[]'); } catch { return; }
  if (!pts.length) return;
  const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
  const vx = (e.clientX - r.left) / r.width * vb.width;
  let best = 0;
  pts.forEach((p, i) => { if (Math.abs(p[0] - vx) < Math.abs(pts[best][0] - vx)) best = i; });
  const p = pts[best];
  svg.querySelectorAll('.scrubcur').forEach((n) => n.remove());
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'scrubcur');
  const ln = document.createElementNS(ns, 'line'); ln.setAttribute('x1', p[0]); ln.setAttribute('x2', p[0]); ln.setAttribute('y1', 0); ln.setAttribute('y2', vb.height); ln.setAttribute('stroke', 'var(--ink2)'); ln.setAttribute('stroke-dasharray', '2 3');
  const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 4.5); c.setAttribute('fill', 'var(--line)'); c.setAttribute('stroke', 'var(--sheet)'); c.setAttribute('stroke-width', 2);
  g.append(ln, c); svg.appendChild(g);
  showTip(p[2] + '  ' + p[3], r.left + p[0] / vb.width * r.width, r.top + p[1] / vb.height * r.height - 6);
  clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 3000);
}

// A non-sheet overlay (like the menu drawer) that should also close on the Back button.
export function pushOverlay(remove) {
  let gone = false;
  const api = { dispose(fromPop) { if (gone) return false; gone = true; const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1); remove(); if (api.pend) { api.pend = false; pending = pending.filter((x) => x !== api); } else if (!fromPop) reconcile(); return true; }, close() { api.dispose(); } };
  stack.push(api);
  if (ignorePop > 0) { api.pend = true; pending.push(api); } else pushFor(api);
  return api;
}
export const topOverlayOpen = () => stack.length > 0;
window.__hd = () => [hdepth, stack.length, ignorePop];

// ---- clear (x) button on text boxes: one floating button follows the focused field ----
(() => {
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'clearx'; btn.setAttribute('aria-label', 'Clear'); btn.hidden = true; btn.textContent = '×';
  let cur = null;
  const ok = (el) => el && el.tagName === 'INPUT' && /^(text|search|email|tel|url|number)$/.test(el.type) && !el.readOnly && !el.dataset.noclear && !el.closest('.amtwrap, .keypad');
  // The button lives inside the field's own parent and is placed with the field's offsets, so it moves with the field by itself (a fixed button went astray on the iPhone home-screen app when the keyboard panned the page).
  let last = '', raf = 0, host = null, hostAdded = false;
  const release = () => { btn.hidden = true; if (btn.parentNode) btn.remove(); if (host && hostAdded) host.classList.remove('clearhost'); host = null; hostAdded = false; last = ''; };
  const attach = (el) => { const h = el.parentElement; if (!h) return false; if (h !== host) { release(); host = h; if (getComputedStyle(h).position === 'static') { h.classList.add('clearhost'); hostAdded = true; } } if (btn.parentNode !== h) h.appendChild(btn); return true; };
  const place = () => {
    if (!cur || !document.body.contains(cur) || !cur.value) { btn.hidden = true; last = ''; return; }
    if (!attach(cur)) { btn.hidden = true; return; }
    if (cur.offsetParent !== host && cur.offsetParent !== btn.offsetParent) { btn.hidden = true; return; }
    const l = cur.offsetLeft + cur.offsetWidth - 30, t = cur.offsetTop + cur.offsetHeight / 2 - 13, key = [l, t, cur.offsetHeight].join();
    if (key === last && !btn.hidden) return; last = key;
    btn.style.left = l + 'px'; btn.style.top = t + 'px'; btn.hidden = false;
  };
  const loop = () => { raf = 0; if (!cur) return; place(); raf = requestAnimationFrame(loop); };
  const track = () => { if (!raf) raf = requestAnimationFrame(loop); };
  document.addEventListener('focusin', (e) => { const x = e.target; if (x && x.tagName === 'INPUT' && /^(decimal|numeric)$/.test(x.getAttribute('inputmode') || '') && x.value && !x.readOnly) setTimeout(() => { try { x.select(); x.setSelectionRange(0, 99999); } catch { /* not selectable */ } }, 30); });
  document.addEventListener('focusin', (e) => { if (ok(e.target)) { cur = e.target; last = ''; place(); track(); } else { cur = null; release(); } });
  document.addEventListener('input', (e) => { if (e.target === cur) place(); });
  document.addEventListener('focusout', () => setTimeout(() => { if (document.activeElement !== btn && !ok(document.activeElement)) { cur = null; release(); } }, 150));
  window.addEventListener('resize', place);
  btn.addEventListener('pointerdown', (e) => e.preventDefault());
  btn.addEventListener('click', () => { if (!cur) return; cur.value = ''; cur.dispatchEvent(new Event('input', { bubbles: true })); cur.focus(); last = ''; place(); });
})();
