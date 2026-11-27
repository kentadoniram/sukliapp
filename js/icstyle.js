// v16.44: category / account picture style (Settings > Pictures). Every round coloured badge that holds a line picture gets its colour copied into --c,
// and the style chosen in Settings (html[data-icstyle]) draws it as solid, duotone, dimensional, sticker, clay, glass or ring. The picture itself never changes.
export const ICON_STYLES = [
  ['duotone', 'Duotone', 'Tinted tile, coloured picture. Calm and easy to read in lists.'],
  ['solid', 'Solid circle', 'The original: colour circle with a white outline picture.'],
  ['gradient', 'Dimensional', 'Gradient tile with a soft gloss and a drop shadow.'],
  ['sticker', 'Sticker', 'Bold outline with an offset shadow. Playful and illustrated.'],
  ['clay', 'Clay', 'Rounded 3D bubble with inner light and shade.'],
  ['glass', 'Glass tile', 'Soft translucent tile with a coloured glow.'],
  ['ring', 'Ring', 'A thin ring. The lightest weight.'],
];
export const ICON_STYLE_KEYS = ICON_STYLES.map((s) => s[0]);
const SEL = '[style*="background"]:has(> svg.cico)';
function one(el) {
  if (el.dataset.ic) return;
  const bg = el.style.background || el.style.backgroundColor;
  if (!bg || bg === 'transparent' || el.style.color) return;
  el.style.setProperty('--c', bg); el.dataset.ic = '1';
}
function scan(root) { if (root.nodeType !== 1) return; if (root.matches(SEL)) one(root); root.querySelectorAll(SEL).forEach(one); }
export function initIconStyle() {
  scan(document.documentElement);
  let q = [], t = 0;
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) q.push(n); if (!t) t = requestAnimationFrame(() => { t = 0; const l = q; q = []; l.forEach(scan); }); }).observe(document.documentElement, { childList: true, subtree: true });
}
