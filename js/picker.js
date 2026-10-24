// One list behaviour for every choice field: a button showing the current choice; tapping it opens a list.
// More than five options: a search box on top. "Add new" (when the form can add) sits right under the search box, options below,
// grouped when the options come in groups. It enhances an ordinary <select>, so the form code keeps reading select.value.
import { sheet, esc } from './ui.js';

export const SEARCH_AFTER = 5;
const readOptions = (sel) => {
  const out = [];
  for (const n of sel.children) {
    if (n.tagName === 'OPTGROUP') for (const o of n.children) out.push({ value: o.value, label: o.textContent, group: n.label, off: o.disabled });
    else out.push({ value: n.value, label: n.textContent, group: '', off: n.disabled });
  }
  return out.filter((o) => o.value !== '__new');
};
export function pickerList(options, { value = '', title = 'Choose', onAdd = null, addLabel = 'Add new', onPick }) {
  const many = options.length > SEARCH_AFTER;
  const s = sheet(`${many ? '<input type="search" class="search pk-q" data-noclear="1" placeholder="Search" autocomplete="off" aria-label="Search">' : ''}
    ${onAdd ? `<button type="button" class="btn sm ghost wide pk-add">+ ${esc(addLabel)}</button>` : ''}
    <div class="pk-list"></div>`, { title, cls: many ? 'pickfix' : '' });
  const draw = () => {
    const q = many ? s.el.querySelector('.pk-q').value.trim().toLowerCase() : '';
    const hit = options.filter((o) => !q || (o.label + ' ' + o.group).toLowerCase().includes(q));
    const groups = new Map(); for (const o of hit) { if (!groups.has(o.group)) groups.set(o.group, []); groups.get(o.group).push(o); }
    s.el.querySelector('.pk-list').innerHTML = hit.length ? [...groups.entries()].map(([g, l]) => `${g ? `<h3>${esc(g)}</h3>` : ''}<div class="rows plain">${l.map((o) => `<button type="button" class="row pk-opt ${o.value === value ? 'on' : ''}" data-v="${esc(o.value)}" ${o.off ? 'disabled' : ''} aria-pressed="${o.value === value}"><span class="rmain"><strong>${esc(o.label)}</strong></span>${o.value === value ? '<span class="ramt">✓</span>' : ''}</button>`).join('')}</div>`).join('') : '<p class="empty">Nothing matches. Try another word' + (onAdd ? ', or add it with the button above' : '') + '.</p>';
  };
  if (many) s.el.querySelector('.pk-q').addEventListener('input', draw);
  s.el.addEventListener('click', (e) => { const b = e.target.closest('.pk-opt'); if (b) { s.close(); onPick(b.dataset.v); } });
  if (onAdd) s.el.querySelector('.pk-add').onclick = () => { s.close(); onAdd(); };
  draw(); return s;
}
export function enhanceSelect(sel, { title, onAdd, addLabel } = {}) {
  if (!sel || sel.dataset.picked) return sel && sel._pk;
  sel.dataset.picked = '1';
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pkbtn';
  sel.style.display = 'none'; sel.after(btn);
  const lab = sel.closest('label'), cap = lab && lab.querySelector('span');
  const paint = () => { const o = sel.selectedOptions[0]; btn.innerHTML = `<span class="pkval">${esc(o ? o.textContent : 'Choose…')}</span><span class="pkcar" aria-hidden="true">▾</span>`; btn.disabled = sel.disabled; };
  const open = (e) => { if (e) e.preventDefault(); pickerList(readOptions(sel), { value: sel.value, title: title || (cap ? cap.textContent : 'Choose'), onAdd, addLabel, onPick: (v) => { sel.value = v; paint(); sel.dispatchEvent(new Event('change', { bubbles: true })); } }); };
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
