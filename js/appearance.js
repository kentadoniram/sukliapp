// Look and feel: accent colour, light/dark, text size, and how "hide amounts" hides (dots or blur).
// Per device (localStorage), applied before the first paint so nothing flashes.
import { priv } from './core.js';

const KEY = 'sukli-look';
export const ACCENTS = {
  // grouped by colour family (blue, green, warm, red/pink, purple, grey) so the picker is easy to scan. New colours use the standard Tailwind 700 shade (light) and 300 shade (dark).
  blue: { n: 'Navy Blue', l: ['#1D4E89', '#E4ECF5', '#FFFFFF'], d: ['#7AB0EE', '#1A2A3B', '#0E141A'] },
  cobalt: { n: 'Cobalt Blue', l: ['#1D4ED8', '#DBEAFE', '#FFFFFF'], d: ['#93C5FD', '#14234A', '#0A1020'] },
  ocean: { n: 'Ocean Blue', l: ['#0B6E99', '#DDEEF6', '#FFFFFF'], d: ['#62C0E8', '#10303F', '#0A151B'] },
  sky: { n: 'Sky Blue', l: ['#0369A1', '#E0F2FE', '#FFFFFF'], d: ['#7DD3FC', '#0C2A3D', '#0A151B'] },
  indigo: { n: 'Indigo', l: ['#3F4BB8', '#E5E7F7', '#FFFFFF'], d: ['#9AA5F2', '#1E2240', '#0F1120'] },
  cyan: { n: 'Cyan', l: ['#0E7490', '#CFFAFE', '#FFFFFF'], d: ['#67E8F9', '#0B2F36', '#09161A'] },
  teal: { n: 'Teal', l: ['#0F6E6E', '#DFF0EE', '#FFFFFF'], d: ['#5CC9C0', '#14302F', '#0B1514'] },
  emerald: { n: 'Emerald', l: ['#047857', '#D1FAE5', '#FFFFFF'], d: ['#6EE7B7', '#0B2E22', '#08150F'] },
  green: { n: 'Leaf Green', l: ['#2E6B34', '#E3EFE2', '#FFFFFF'], d: ['#7FCB88', '#18301B', '#0C140D'] },
  forest: { n: 'Forest Green', l: ['#1F5E3B', '#DDEDE3', '#FFFFFF'], d: ['#6FD09A', '#14301F', '#0A150E'] },
  lime: { n: 'Lime Green', l: ['#4D7C0F', '#ECFCCB', '#FFFFFF'], d: ['#BEF264', '#213008', '#0F1405'] },
  gold: { n: 'Antique Gold', l: ['#8A6500', '#F5ECD3', '#FFFFFF'], d: ['#E8C45C', '#37300F', '#1A1606'] },
  amber: { n: 'Amber', l: ['#B45309', '#FEF3C7', '#FFFFFF'], d: ['#FCD34D', '#3A2C08', '#1A1405'] },
  orange: { n: 'Burnt Orange', l: ['#A8540C', '#F6E9DC', '#FFFFFF'], d: ['#F0A867', '#3A2714', '#1B120A'] },
  brown: { n: 'Espresso Brown', l: ['#78350F', '#F5EBDD', '#FFFFFF'], d: ['#D6A77A', '#33231A', '#17100B'] },
  coral: { n: 'Coral Red', l: ['#C2412D', '#F8E4DF', '#FFFFFF'], d: ['#F59A8A', '#3C1B16', '#1C0C09'] },
  red: { n: 'Crimson Red', l: ['#B91C1C', '#FEE2E2', '#FFFFFF'], d: ['#FCA5A5', '#3B1414', '#1C0B0B'] },
  burgundy: { n: 'Burgundy', l: ['#881337', '#FFE4E6', '#FFFFFF'], d: ['#FDA4AF', '#3F101C', '#1C0A0E'] },
  rose: { n: 'Rose Pink', l: ['#B03A5B', '#F6E4EA', '#FFFFFF'], d: ['#F08AA6', '#3A1B27', '#1B0D13'] },
  pink: { n: 'Hot Pink', l: ['#BE185D', '#FCE7F3', '#FFFFFF'], d: ['#F9A8D4', '#3A1429', '#1B0A13'] },
  purple: { n: 'Royal Purple', l: ['#5B3FA0', '#EBE6F5', '#FFFFFF'], d: ['#B39DF0', '#2A2140', '#120E1B'] },
  violet: { n: 'Violet', l: ['#6D28D9', '#EDE9FE', '#FFFFFF'], d: ['#C4B5FD', '#251848', '#120D1F'] },
  fuchsia: { n: 'Fuchsia', l: ['#A21CAF', '#FAE8FF', '#FFFFFF'], d: ['#F0ABFC', '#35113A', '#180A1A'] },
  plum: { n: 'Plum', l: ['#8A2D7B', '#F3E3F0', '#FFFFFF'], d: ['#E39AD6', '#341A31', '#180B16'] },
  slate: { n: 'Slate Grey', l: ['#334155', '#E2E8F0', '#FFFFFF'], d: ['#CBD5E1', '#1E293B', '#0F172A'] },
  graphite: { n: 'Graphite', l: ['#3B4650', '#E6E9EC', '#FFFFFF'], d: ['#AEBBC7', '#232B33', '#0E141A'] },
  mono: { n: 'Monochrome', l: ['#111111', '#EDEDED', '#FFFFFF'], d: ['#F2F2F2', '#262626', '#0A0A0A'] },
};

export const SIZES = [['xs', 'Extra small', 0.8], ['s', 'Small', 0.9], ['m', 'Medium', 1], ['l', 'Large', 1.12], ['xl', 'Extra large', 1.25]];
let simpleNow = false;
// "Match the mode": calm teal in Simple, blue in Advanced (a colour you pick yourself always wins)
export const setLookMode = (simple) => { if (simple !== simpleNow) { simpleNow = simple; applyLook(); } };
const DEFAULT = { accent: 'auto', theme: 'auto', size: 's', pcase: 'upper', design: 'theme1', font: 'auto', bg: 'auto', card: 'auto', radius: 'auto', density: 'auto', btn: 'auto', nav: 'auto', bars: 'auto', lead: 'auto', dsel: 'seg', logo: 'initials' };
export const FONTS = [['auto', 'Automatic'], ['rounded', 'Rounded'], ['standard', 'Standard'], ['system', 'System'], ['serif', 'Serif'], ['humanist', 'Humanist'], ['mono', 'Mono']];
// Design Studio choices (Style Guide): each is one data attribute on <html>; 'auto' removes it so the app looks as it always did
export const STUDIO = { bg: ['warm', 'cool', 'black'], card: ['flat', 'outline', 'lifted', 'tinted'], radius: ['sharp', 'round'], density: ['compact', 'roomy'], btn: ['pill', 'square', 'soft'], nav: ['icons', 'pill'], bars: ['square', 'slim', 'accent'], lead: ['tight', 'airy'] };
export const DESIGNS = [['theme1', 'Theme 1'], ['legacy', 'Legacy Theme']];

export function look() {
  try { return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) || '{}')) }; } catch { return { ...DEFAULT }; }
}
export function setLook(patch) {
  const v = { ...look(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* blocked */ }
  applyLook();
  return v;
}
export function applyLook() {
  const v = look(), root = document.documentElement;
  const dark = v.theme === 'dark' || (v.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (v.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = v.theme;
  const key = v.accent === 'auto' ? (simpleNow ? 'teal' : 'blue') : v.accent, a = (ACCENTS[key] || ACCENTS.blue)[dark ? 'd' : 'l'];
  root.style.setProperty('--line', a[0]); root.style.setProperty('--tint', a[1]); root.style.setProperty('--line-ink', a[2]);
  root.dataset.design = v.design === 'legacy' ? 'legacy' : 'theme1';
  root.dataset.font = ['system', 'serif', 'humanist', 'mono'].includes(v.font) ? v.font : v.font === 'standard' || (v.font !== 'rounded' && v.design === 'legacy') ? 'standard' : 'rounded';
  for (const [k, ok] of Object.entries(STUDIO)) { if (ok.includes(v[k])) root.dataset[k === 'card' ? 'cardlook' : k] = v[k]; else delete root.dataset[k === 'card' ? 'cardlook' : k]; }   // Automatic: rounded in Theme 1, the old font in Legacy Theme
  root.dataset.pcase = ['upper', 'title', 'lower'].includes(v.pcase) ? v.pcase : 'upper';
  const sz = SIZES.find((s) => s[0] === v.size) || SIZES[1];
  root.style.setProperty('--fs', String(sz[2]));
  const mt = document.querySelector('meta[name="theme-color"]');
  if (mt) mt.setAttribute('content', dark ? '#0E141A' : v.design === 'legacy' ? '#F3F5F2' : '#FFFFFF');
}
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (look().theme === 'auto') applyLook(); }); } catch { /* old browser */ }

// ---- hide amounts ----
// dots: fmt() prints ₱••••• ; blur: fmt() prints the real number between invisible markers and this file blurs what sits between them.
const B = '⁣';
export function applyHide() {
  document.body.classList.toggle('hide-amts', priv.on);
  document.body.classList.toggle('hide-blur', priv.on && priv.style === 'blur');
  if (priv.on && priv.style === 'blur') blurAll(document.body);
}
function blurAll(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.includes(B) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) {
    const p = n.parentNode; if (!p) continue;
    const tag = (p.nodeName || '').toLowerCase();
    if (tag === 'title') { p.remove(); continue; }          // native hover tooltips would show the real number
    if (tag === 'option' || tag === 'textarea') { n.nodeValue = n.nodeValue.split(B).join(''); continue; }
    if (p.namespaceURI === 'http://www.w3.org/2000/svg') { p.classList.add('blurred'); n.nodeValue = n.nodeValue.split(B).join(''); continue; }
    const parts = n.nodeValue.split(B), frag = document.createDocumentFragment();
    parts.forEach((t, i) => {
      if (!t) return;
      if (i % 2) { const s = document.createElement('span'); s.className = 'blurred'; s.textContent = t; frag.appendChild(s); } else frag.appendChild(document.createTextNode(t));
    });
    p.replaceChild(frag, n);
  }
}
let obs;
export function initAppearance() {
  applyLook();
  obs = new MutationObserver((muts) => {
    if (!(priv.on && priv.style === 'blur')) return;
    for (const m of muts) for (const n of m.addedNodes) { if (n.nodeType === 1) blurAll(n); else if (n.nodeType === 3 && n.nodeValue.includes(B)) n.parentNode && blurAll(n.parentNode); }
    for (const m of muts) if (m.type === 'characterData' && m.target.nodeValue.includes(B) && m.target.parentNode) blurAll(m.target.parentNode);
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  applyHide();
}
