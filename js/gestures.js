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
}
