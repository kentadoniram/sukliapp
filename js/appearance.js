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
};
export const SIZES = [['xs', 'Extra small', 0.8], ['s', 'Small', 0.9], ['m', 'Medium', 1], ['l', 'Large', 1.12], ['xl', 'Extra large', 1.25]];
const DEFAULT = { accent: 'blue', theme: 'auto', size: 's' };

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
  const a = (ACCENTS[v.accent] || ACCENTS.blue)[dark ? 'd' : 'l'];
  root.style.setProperty('--line', a[0]); root.style.setProperty('--tint', a[1]); root.style.setProperty('--line-ink', a[2]);
  const sz = SIZES.find((s) => s[0] === v.size) || SIZES[1];
  root.style.setProperty('--fs', String(sz[2]));
  const mt = document.querySelector('meta[name="theme-color"]');
  if (mt) mt.setAttribute('content', dark ? '#0E141A' : '#F3F5F2');
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
    for (const m of muts) for (const n of m.addedNodes) { if (n.nodeType === 1) blurAll(n); else if (n.nodeType === 3 && n.nodeValue.includes(B)) blurAll(n.parentNode); }
    for (const m of muts) if (m.type === 'characterData' && m.target.nodeValue.includes(B)) blurAll(m.target.parentNode);
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  applyHide();
}
