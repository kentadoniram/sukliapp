// Tap feedback: a short buzz where the phone allows it, a quick flash on whatever you touched, and an optional soft click.
// Safari on iPhone has no vibrate(); it gets a tiny haptic through a hidden switch control when the system supports it, and the flash and click always work.
const KEY = 'sukli-fb';
const DEF = { haptic: true, visual: true, sound: false, overlay: true };
const read = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEF }; } };
let cfg = read();
export const feedbackCfg = () => cfg;
export const setFeedback = (k, v) => { cfg = { ...cfg, [k]: v }; try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* blocked */ } if (k === 'overlay' || k === 'haptic') applyOverlay(); };

let ac = null, sw = null;
function buzz(strong) {
  if (!cfg.haptic) return;
  try { if (navigator.vibrate && navigator.vibrate(strong ? 14 : 8)) return; } catch { /* not supported */ }
  try {                                                         // iOS 17.4+: a "switch" checkbox gives a light tap when toggled through its label (same layout the WebHaptics library uses)
    if (!sw) { const id = 'fbsw' + Math.random().toString(36).slice(2, 7), st = 'position:fixed;left:-200px;top:0;opacity:0;pointer-events:none;';
      const i = document.createElement('input'); i.type = 'checkbox'; i.id = id; i.setAttribute('switch', ''); i.setAttribute('aria-hidden', 'true'); i.tabIndex = -1; i.style.cssText = st;
      const l = document.createElement('label'); l.htmlFor = id; l.className = 'fbswitch'; l.setAttribute('aria-hidden', 'true'); l.style.cssText = st; l.textContent = 'haptic';
      document.body.append(i, l); sw = l; }
    sw.click();
  } catch { /* no haptics on this device */ }
}
// iPhone system version from the browser (Safari and Chrome on iPhone both report it), or null
export const iosVersion = () => { const m = /OS (\d+)[_.](\d+)/.exec(navigator.userAgent || ''); return m && /iPhone|iPad|iPod/.test(navigator.userAgent) ? { major: +m[1], minor: +m[2] } : null; };
export const testBuzz = () => { const was = cfg.haptic; cfg = { ...cfg, haptic: true }; buzz(true); cfg = { ...cfg, haptic: was }; };
function click() {
  if (!cfg.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.04;
    o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.05); o.stop(ac.currentTime + 0.06);
  } catch { /* no audio */ }
}
const HAPTIC_ON_CLICK = true;   // iPhone Safari only allows the haptic inside a click (user activation), not on pointerdown
const TARGET = 'button, .chip, .row, a.btn, summary, [data-act], [data-e], label.check, .swatch';
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest && e.target.closest(TARGET);
  if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true' || t.classList.contains('clearx')) return;
  const strong = !!t.closest('.keypad') || t.classList.contains('btn');
  click(); if (!HAPTIC_ON_CLICK) buzz(strong);
  if (cfg.visual) { t.classList.remove('fbflash'); void t.offsetWidth; t.classList.add('fbflash'); t.addEventListener('animationend', () => t.classList.remove('fbflash'), { once: true }); }
}, { passive: true, capture: true });
document.addEventListener('click', (e) => {
  if (!HAPTIC_ON_CLICK || !e.isTrusted) return;
  const t = e.target.closest && e.target.closest(TARGET);
  if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true' || t.classList.contains('clearx') || t.closest('.fbswitch') || (e.target.classList && e.target.classList.contains('hsw'))) return;   // a tap on the real switch has already ticked
  buzz(!!t.closest('.keypad') || t.classList.contains('btn'));
}, { passive: true, capture: true });
document.addEventListener('change', (e) => { const k = e.target && e.target.dataset && e.target.dataset.fb; if (k) { setFeedback(k, e.target.checked); if (e.target.checked) { buzz(true); click(); } } });

// Real switches over the keypad keys, Save and the round + (iPhone only). From iOS 26.5 only a real tap on a switch control ticks, so a transparent switch sits inside each of these buttons:
// the finger lands on the switch (it ticks), and the click still bubbles up to the button, so the button works as before. Turn it off in Settings if it ever gets in the way.
const HSW_SEL = '.keypad button, #btns .btn, .fab';
const overlayOn = () => cfg.haptic && cfg.overlay !== false && !!iosVersion();
function dress(root) {
  if (!overlayOn() || !root || root.nodeType !== 1) return;
  const list = [...(root.matches && root.matches(HSW_SEL) ? [root] : []), ...root.querySelectorAll(HSW_SEL)];
  for (const b of list) {
    if (b.querySelector(':scope > .hsw')) continue;
    const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.className = 'hsw'; i.tabIndex = -1; i.setAttribute('aria-hidden', 'true');
    i.addEventListener('change', () => { i.checked = false; });
    b.classList.add('hsw-host'); b.appendChild(i);
  }
}
export function applyOverlay() {
  if (!overlayOn()) { document.querySelectorAll('.hsw').forEach((i) => { i.parentElement && i.parentElement.classList.remove('hsw-host'); i.remove(); }); return; }
  dress(document.body);
}
try {
  new MutationObserver((muts) => { if (!overlayOn()) return; for (const m of muts) for (const n of m.addedNodes) dress(n); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.body) applyOverlay(); else document.addEventListener('DOMContentLoaded', applyOverlay);
} catch { /* no observer */ }
