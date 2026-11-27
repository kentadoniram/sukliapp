// v16.44: patchHtml(el, html) puts new markup into an element but keeps every part that did not change.
// A plain `el.innerHTML = ...` throws the old parts away and builds new ones, so animations start again (the pop-up slides in a second time, the
// background flashes) and a segmented control cannot slide. This keeps the same elements, so only what really changed is touched.
const SKIP = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
function sameKind(a, b) { return a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName); }
function syncAttrs(a, b) {
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) { if (at.name === 'value' || at.name === 'checked') continue; a.removeAttribute(at.name); }
  for (const at of b.attributes) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
}
function syncNode(a, b) {
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  syncAttrs(a, b);
  if (SKIP.has(a.tagName)) {
    if (a.tagName === 'INPUT' && (a.type === 'checkbox' || a.type === 'radio')) a.checked = b.hasAttribute('checked');
    else if (a !== document.activeElement && a.value !== (b.getAttribute('value') ?? '') && a.tagName === 'INPUT') a.value = b.getAttribute('value') ?? '';
    else if (a.tagName === 'SELECT') { if (a.innerHTML !== b.innerHTML) a.innerHTML = b.innerHTML; }
    else if (a.tagName === 'TEXTAREA' && a !== document.activeElement) a.value = b.textContent;
    return;
  }
  syncChildren(a, b);
}
function syncChildren(a, b) {
  const old = [...a.childNodes], nu = [...b.childNodes];
  nu.forEach((n, i) => {
    const o = old[i];
    if (o && sameKind(o, n)) syncNode(o, n);
    else if (o) a.replaceChild(n, o);
    else a.appendChild(n);
  });
  for (let i = old.length - 1; i >= nu.length; i--) a.removeChild(old[i]);
}
export function patchHtml(el, html) {
  if (!el) return;
  const t = document.createElement('template'); t.innerHTML = html;
  syncChildren(el, t.content);
}
