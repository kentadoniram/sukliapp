// One list behaviour for every choice field: a button showing the current choice; tapping it opens a list.
// More than five options: a search box on top. "Add new" (when the form can add) sits right under the search box, options below,
// grouped when the options come in groups. It enhances an ordinary <select>, so the form code keeps reading select.value.
import { sheet, esc } from './ui.js';
import { button } from './components.js';
import { get } from './core.js';
import { acctRow } from './acctpicker.js';
import { platIcon } from './platicons.js';

export const SEARCH_AFTER = 5;
const readOptions = (sel) => {
  const out = [];
  for (const n of sel.children) {
    if (n.tagName === 'OPTGROUP') for (const o of n.children) out.push({ value: o.value, label: o.textContent, leaf: o.dataset.leaf || '', sub: o.dataset.sub || '', group: n.label, off: o.disabled });
    else out.push({ value: n.value, label: n.textContent, leaf: n.dataset.leaf || '', sub: n.dataset.sub || '', group: '', off: n.disabled });
  }
  return out.filter((o) => o.value !== '__new');
};

// A group label written as "A › B › C" is a path: each part is a level you can open or close on its own. Nothing is open until you open it
// (a search opens everything that matches). levels = { A: ['Platform', 'Account type'] } adds a small caption to each level so you can tell what it is.
const SEP = ' › ';
function treeHtml(hit, open, searching, value, levels) {
  const root = { kids: new Map(), opts: [] };
  for (const o of hit) { let n = root; for (const seg of (o.group ? o.group.split(SEP) : [])) { if (!n.kids.has(seg)) n.kids.set(seg, { name: seg, kids: new Map(), opts: [] }); n = n.kids.get(seg); } n.opts.push(o); }
  const count = (n) => n.opts.length + [...n.kids.values()].reduce((t, k) => t + count(k), 0);
  const holds = (n) => n.opts.some((o) => o.value === value) || [...n.kids.values()].some(holds);
  const accs = new Map(get().accounts.map((x) => [x.id, x]));
  const leaf = (o, d) => { const a = accs.get(o.value); if (a && !o.off) return acctRow(a, { selected: value }).replace('class="row cur"', `class="row cur pk-opt pkd${d} ${o.value === value ? 'on' : ''}" data-v="${esc(o.value)}"`);
    return button({ html: `<span class="rmain"><strong>${esc(o.leaf || o.label)}</strong>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>${o.value === value ? '<span class="ramt">✓</span>' : ''}`, kind: 'plain', cls: `row pk-opt pkd${d} ${o.value === value ? 'on' : ''}`, pressed: o.value === value, attr: { 'data-v': o.value, ...(o.off ? { disabled: 'disabled' } : {}) } }); };
  const walk = (n, path) => `${[...n.kids.values()].map((k) => { const p = [...path, k.name], key = p.join(SEP), isOpen = searching || open.has(key), cap = ((levels[p[0]] || [])[p.length - 1]) || '';
    const ic = cap === 'Platform' ? platIcon(k.name, 'xs') : '';
    return `<div class="pk-node pkd${path.length}">${button({ html: `<span class="pkgl">${ic}<b>${esc(k.name)}</b></span><span class="pkmeta">${holds(k) ? '<i class="pkdot" title="Holds your current choice"></i>' : ''}<small class="muted">${count(k)}</small><span aria-hidden="true">${isOpen ? '▾' : '▸'}</span></span>`, kind: 'plain', cls: `pk-gh pkh${path.length}`, attr: { 'data-g': key, 'aria-expanded': String(isOpen) } })}<div class="pk-kids" ${isOpen ? '' : 'hidden'}><div class="rows plain">${walk(k, p)}</div></div></div>`; }).join('')}${n.opts.map((o) => leaf(o, path.length)).join('')}`;
  return walk(root, []);
}
export function pickerList(options, { value = '', title = 'Choose', onAdd = null, addLabel = 'Add new', collapse = false, tree = false, levels = {}, onPick }) {
  const many = options.length > SEARCH_AFTER;
  // collapse: each group is a heading you can open or close; only the group holding the current choice starts open
  const cur = options.find((o) => o.value === value), open = new Set(tree ? [] : collapse && cur ? [cur.group] : (collapse ? [(options.find((o) => o.group) || {}).group] : []));
  const s = sheet(`${many ? `<input type="search" class="search pk-q" data-noclear="1" placeholder="${tree ? 'Search platform, asset or currency' : 'Search'}" autocomplete="off" aria-label="Search">` : ''}
    ${onAdd ? `${button({ label: `+ ${addLabel}`, kind: 'ghost', size: 'sm', cls: 'wide pk-add' })}` : ''}
    <div class="pk-list"></div>`, { title, cls: many ? 'pickfix' : '' });
  const draw = () => {
    const q = many ? s.el.querySelector('.pk-q').value.trim().toLowerCase() : '';
    const hit = options.filter((o) => !q || (o.label + ' ' + o.group + ' ' + (o.leaf || '')).toLowerCase().includes(q));
    if (tree) { s.el.querySelector('.pk-list').innerHTML = hit.length ? treeHtml(hit, open, !!q, value, levels) : '<p class="empty">Nothing matches. Try another word.</p>'; return; }
    const groups = new Map(); for (const o of hit) { if (!groups.has(o.group)) groups.set(o.group, []); groups.get(o.group).push(o); }
    s.el.querySelector('.pk-list').innerHTML = hit.length ? [...groups.entries()].map(([g, l]) => { const fold = collapse && g && !q && !open.has(g); return `${g ? (collapse ? `${button({ html: `<span>${esc(g)} <small class="muted">${l.length}</small></span><span aria-hidden="true">${fold ? '▸' : '▾'}</span>`, kind: 'plain', cls: 'pk-gh', attr: { 'data-g': g, 'aria-expanded': String(!fold) } })}` : `<h3>${esc(g)}</h3>`) : ''}<div class="rows plain" ${fold ? 'hidden' : ''}>${l.map((o) => `<button type="button" class="row pk-opt ${o.value === value ? 'on' : ''}" data-v="${esc(o.value)}" ${o.off ? 'disabled' : ''} aria-pressed="${o.value === value}"><span class="rmain"><strong>${esc(o.label)}</strong></span>${o.value === value ? '<span class="ramt">✓</span>' : ''}</button>`).join('')}</div>`; }).join('') : '<p class="empty">Nothing matches. Try another word' + (onAdd ? ', or add it with the button above' : '') + '.</p>';
  };
  if (many) s.el.querySelector('.pk-q').addEventListener('input', draw);
  s.el.addEventListener('click', (e) => { const h = e.target.closest('.pk-gh'); if (h) { const g = h.dataset.g; if (open.has(g)) open.delete(g); else open.add(g); draw(); return; } const b = e.target.closest('.pk-opt'); if (b) { s.close(); onPick(b.dataset.v); } });
  if (onAdd) s.el.querySelector('.pk-add').onclick = () => { s.close(); onAdd(); };
  draw(); return s;
}
export function enhanceSelect(sel, { title, onAdd, addLabel, collapse = false, tree = false, levels = {} } = {}) {
  if (!sel || sel.dataset.picked) return sel && sel._pk;
  sel.dataset.picked = '1';
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pkbtn';
  sel.style.display = 'none'; sel.after(btn);
  const lab = sel.closest('label'), cap = lab && lab.querySelector('span');
  const paint = () => { const o = sel.selectedOptions[0]; btn.innerHTML = `<span class="pkval">${esc(o ? o.textContent : 'Choose…')}</span><span class="pkcar" aria-hidden="true">▾</span>`; btn.disabled = sel.disabled; };
  const open = (e) => { if (e) e.preventDefault(); pickerList(readOptions(sel), { value: sel.value, title: title || (cap ? cap.textContent : 'Choose'), onAdd, addLabel, collapse, tree, levels, onPick: (v) => { sel.value = v; paint(); sel.dispatchEvent(new Event('change', { bubbles: true })); } }); };
  btn.onclick = open;
  if (lab) lab.addEventListener('click', (e) => { if (e.target === lab || e.target === cap) open(e); });   // tapping the caption opens the list too
  new MutationObserver(paint).observe(sel, { childList: true, subtree: true });
  sel.addEventListener('change', paint);
  // code that sets select.value directly (presets, smart hints) must repaint the button too
  const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(sel, 'value', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); paint(); } });
  paint(); sel._pk = { paint, open }; return sel._pk;
}

// every <select name=...> in a form becomes the shared list; per-field options (title, onAdd) come in by name
export function pickAll(root, per = {}) {
  root.querySelectorAll('select[name]').forEach((sel) => { if (!sel.dataset.picked && !sel.hasAttribute('data-nopick')) enhanceSelect(sel, per[sel.name] || {}); });
}
