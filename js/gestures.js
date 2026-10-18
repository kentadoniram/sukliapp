// Small global helpers: a clear "×" on text fields, a floating menu button that shows after a short
// upward scroll, and a swipe from the left edge that opens the menu.
import { ACT, ic, topOverlayOpen } from './ui.js';

const CLEARABLE = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]):not([type=date]):not([type=time]):not([type=datetime-local]):not([type=button]):not([type=submit]), textarea';

export function initGestures() {
  // ---- clear button: one floating × that follows the focused field ----
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'clrbtn'; btn.setAttribute('aria-label', 'Clear field'); btn.textContent = '×';
  document.body.appendChild(btn);
  let cur = null;
  const eligible = (el) => el && el.matches && el.matches(CLEARABLE) && !el.readOnly && !el.disabled && !el.closest('[data-noclear]') && el.type !== 'password';
  function place() {
    if (!cur || !document.contains(cur) || !cur.value) { btn.classList.remove('show'); return; }
    const r = cur.getBoundingClientRect();
    if (r.width < 60 || r.bottom < 0 || r.top > innerHeight) { btn.classList.remove('show'); return; }
    const top = cur.tagName === 'TEXTAREA' ? r.top + 6 : r.top + (r.height - 26) / 2;
    btn.style.top = top + 'px';
    btn.style.left = (r.right - 32) + 'px';
    btn.classList.add('show');
  }
  document.addEventListener('focusin', (e) => { cur = eligible(e.target) ? e.target : null; if (cur && !cur.dataset.clr) { cur.dataset.clr = '1'; cur.style.paddingRight = Math.max(parseFloat(getComputedStyle(cur).paddingRight) || 0, 34) + 'px'; } place(); });
  document.addEventListener('focusout', () => setTimeout(() => { if (document.activeElement !== cur) { cur = null; place(); } }, 0));
  document.addEventListener('input', (e) => { if (e.target === cur) place(); }, true);
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);
  // pointerdown + preventDefault keeps the keyboard open and the field focused
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!cur) return;
    cur.value = '';
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    cur.dispatchEvent(new Event('change', { bubbles: true }));
    cur.focus(); place();
  });

  // ---- floating menu button: appears after scrolling up a little ----
  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'fabmenu'; fab.setAttribute('aria-label', 'Open menu'); fab.innerHTML = ic('menu');
  fab.onclick = () => { const a = ACT.menu; if (a) a(); fab.classList.remove('show'); };
  document.body.appendChild(fab);
  let lastY = scrollY, upSum = 0, hideT = 0;
  window.addEventListener('scroll', () => {
    const y = scrollY, dy = y - lastY; lastY = y;
    if (dy < 0) upSum += -dy; else upSum = 0;
    if (y > 200 && upSum > 60 && !topOverlayOpen()) { fab.classList.add('show'); clearTimeout(hideT); hideT = setTimeout(() => fab.classList.remove('show'), 4000); }
    if (dy > 12 || y < 120) fab.classList.remove('show');
  }, { passive: true });

  // ---- swipe from the left edge ----
  let sx = 0, sy = 0, tracking = false;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    tracking = e.touches.length === 1 && t.clientX < 18 && !topOverlayOpen() && !e.target.closest('svg.scrub, .scrub, [data-noswipe]');
    sx = t.clientX; sy = t.clientY;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const t = e.touches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (dy > 40) { tracking = false; return; }
    if (dx > 60 && dx > dy * 2) { tracking = false; if (ACT.menu) ACT.menu(); }
  }, { passive: true });
}
