// Look and feel: accent colour, light/dark, text size, and how "hide amounts" hides (dots or blur).
// Per device (localStorage), applied before the first paint so nothing flashes.
import { priv } from './core.js';

const KEY = 'sukli-look';
export const ACCENTS = {
  blue:     { n: 'Blue',     l: ['#1D4E89', '#E4ECF5', '#FFFFFF'], d: ['#7AB0EE', '#1A2A3B', '#0E141A'] },
  teal:     { n: 'Teal',     l: ['#0F6E6E', '#DFF0EE', '#FFFFFF'], d: ['#5CC9C0', '#14302F', '#0B1514'] },
  green:    { n: 'Green',    l: ['#2E6B34', '#E3EFE2', '#FFFFFF'], d: ['#7FCB88', '#18301B', '#0C140D'] },
  purple:   { n: 'Purple',   l: ['#5B3FA0', '#EBE6F5', '#FFFFFF'], d: ['#B39DF0', '#2A2140', '#120E1B'] },
  rose:     { n: 'Rose',     l: ['#B03A5B', '#F6E4EA', '#FFFFFF'], d: ['#F08AA6', '#3A1B27', '#1B0D13'] },
  orange:   { n: 'Orange',   l: ['#A8540C', '#F6E9DC', '#FFFFFF'], d: ['#F0A867', '#3A2714', '#1B120A'] },
  graphite: { n: 'Graphite', l: ['#3B4650', '#E6E9EC', '#FFFFFF'], d: ['#AEBBC7', '#232B33', '#0E141A'] },
  indigo:   { n: 'Indigo',   l: ['#3F4BB8', '#E5E7F7', '#FFFFFF'], d: ['#9AA5F2', '#1E2240', '#0F1120'] },
  ocean:    { n: 'Ocean',    l: ['#0B6E99', '#DDEEF6', '#FFFFFF'], d: ['#62C0E8', '#10303F', '#0A151B'] },
  plum:     { n: 'Plum',     l: ['#8A2D7B', '#F3E3F0', '#FFFFFF'], d: ['#E39AD6', '#341A31', '#180B16'] },
  gold:     { n: 'Gold',     l: ['#8A6500', '#F5ECD3', '#FFFFFF'], d: ['#E8C45C', '#37300F', '#1A1606'] },
  coral:    { n: 'Coral',    l: ['#C2412D', '#F8E4DF', '#FFFFFF'], d: ['#F59A8A', '#3C1B16', '#1C0C09'] },
  forest:   { n: 'Forest',   l: ['#1F5E3B', '#DDEDE3', '#FFFFFF'], d: ['#6FD09A', '#14301F', '#0A150E'] },
  mono:     { n: 'Mono',     l: ['#111111', '#EDEDED', '#FFFFFF'], d: ['#F2F2F2', '#262626', '#0A0A0A'] },
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
