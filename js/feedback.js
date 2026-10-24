// Tap feedback: a short buzz where the phone allows it, a quick flash on whatever you touched, and an optional soft click.
// Safari on iPhone has no vibrate(); it gets a tiny haptic through a hidden switch control when the system supports it, and the flash and click always work.
const KEY = 'sukli-fb';
const DEF = { haptic: true, visual: true, sound: false };
const read = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEF }; } };
let cfg = read();
export const feedbackCfg = () => cfg;
export const setFeedback = (k, v) => { cfg = { ...cfg, [k]: v }; try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* blocked */ } };

let ac = null, sw = null;
function buzz(strong) {
  if (!cfg.haptic) return;
  try { if (navigator.vibrate && navigator.vibrate(strong ? 14 : 8)) return; } catch { /* not supported */ }
  try {                                                         // iOS 17.4+: switching a "switch" checkbox gives a light tap
    if (!sw) { const l = document.createElement('label'); l.setAttribute('aria-hidden', 'true'); l.style.cssText = 'position:fixed;left:-99px;top:-99px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; l.appendChild(i); document.body.appendChild(l); sw = l; }
    sw.click();
  } catch { /* no haptics on this device */ }
}
function click() {
  if (!cfg.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.04;
    o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.05); o.stop(ac.currentTime + 0.06);
  } catch { /* no audio */ }
}
const TARGET = 'button, .chip, .row, a.btn, summary, [data-act], [data-e], label.check, .swatch';
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest && e.target.closest(TARGET);
  if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true' || t.classList.contains('clearx')) return;
  const strong = !!t.closest('.keypad') || t.classList.contains('btn');
  buzz(strong); click();
  if (cfg.visual) { t.classList.remove('fbflash'); void t.offsetWidth; t.classList.add('fbflash'); t.addEventListener('animationend', () => t.classList.remove('fbflash'), { once: true }); }
}, { passive: true, capture: true });
document.addEventListener('change', (e) => { const k = e.target && e.target.dataset && e.target.dataset.fb; if (k) { setFeedback(k, e.target.checked); if (e.target.checked) { buzz(true); click(); } } });
