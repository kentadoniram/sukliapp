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
export function sheet(html, { title = '', onClose, wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'scrim';
  wrap.innerHTML = `<div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="iconbtn" data-close aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-body">${html}</div></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('noscroll');
  const api = {
    el: wrap.querySelector('.sheet-body'),
    root: wrap,
    close() {
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      wrap.remove();
      if (!stack.length) document.body.classList.remove('noscroll');
      if (onClose) onClose();
    },
  };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) api.close(); });
  wrap.querySelector('[data-close]').onclick = () => api.close();
  stack.push(api);
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
    s.el.querySelector('[data-yes]').onclick = () => { s.root.remove(); document.body.classList.remove('noscroll'); stack.splice(stack.indexOf(s), 1); res(true); };
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
      s.root.remove(); document.body.classList.remove('noscroll'); stack.splice(stack.indexOf(s), 1);
      res(v);
    };
  });
}

export function download(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
