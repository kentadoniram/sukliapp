// Small global helpers: a floating menu button that shows after a short
// upward scroll, and a swipe from the left edge that opens the menu.
import { ACT, ic, topOverlayOpen } from './ui.js';

export function initGestures() {
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

  // ---- swipe down or left closes the open sheet. Forms only close from the title bar, so a stray swipe cannot lose what you typed. ----
  let g = null;
  document.addEventListener('touchstart', (e) => {
    const sh = e.target.closest && e.target.closest('.sheet'), t = e.touches[0];
    g = sh && e.touches.length === 1 ? { x: t.clientX, y: t.clientY, sh, head: !!e.target.closest('.sheet-head'), form: !!sh.querySelector('form'), skip: !!e.target.closest('svg, canvas, input, textarea, select, [data-noswipe], .scrollx, .keypad, .seg') } : null;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const s0 = g; g = null; if (!s0 || s0.skip) return;
    const t = e.changedTouches[0], dx = t.clientX - s0.x, dy = t.clientY - s0.y, body = s0.sh.querySelector('.sheet-body');
    const left = dx < -90 && Math.abs(dy) < 50 && !s0.form, down = dy > 110 && Math.abs(dx) < 60 && (s0.head || (!s0.form && body.scrollTop <= 2));
    if (!left && !down) return;
    const btns = [...document.querySelectorAll('.scrim [data-close]')], b = btns[btns.length - 1]; if (b) b.click();
  }, { passive: true });
}
