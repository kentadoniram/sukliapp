// Sukli UI components (15.13). Small helpers that return HTML strings with the classes the app already uses,
// so every look lives in styles.css and a design change is made once. Use these for new and touched screens;
// do not write a raw <button> by hand. Attributes: e → data-e, act → data-act, v → data-v, id, attr → anything else.
import { esc, ic } from './ui.js';

const attrs = (o) => Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join('');
const KIND = { primary: 'btn', secondary: 'btn ghost', ghost: 'btn ghost', danger: 'btn danger', 'danger-ghost': 'btn danger ghost', link: 'linkbtn', 'danger-link': 'linkbtn danger', chip: 'chip', icon: 'iconbtn', toggle: 'tog' };
const dataOf = ({ id, e, act, v, data, title, pressed, disabled, attr } = {}) => attrs({ id, 'data-e': e, 'data-act': act, 'data-v': data ? undefined : v, ...(data ? { [`data-${data}`]: v } : {}), title, 'aria-pressed': pressed === undefined ? undefined : String(!!pressed), disabled, ...attr });

// button({ label, kind: primary|secondary|ghost|danger|danger-ghost|link|chip|icon|toggle, size: 'sm', on, e|act, v, id, icon, aria })
export function button({ label = '', kind = 'secondary', size = '', on = false, icon = '', aria = '', cls: extra = '', ...rest } = {}) {
  const cls = [KIND[kind] || KIND.secondary, size, on ? 'on' : '', extra].filter(Boolean).join(' ');
  const pressed = kind === 'toggle' || rest.pressed !== undefined ? (rest.pressed === undefined ? on : rest.pressed) : undefined;
  const lab = kind === 'icon' ? ic(icon || 'x') : `${icon ? ic(icon) + ' ' : ''}${esc(label)}`;
  return `<button type="button" class="${cls}"${aria || (kind === 'icon' ? label : '') ? ` aria-label="${esc(aria || label)}"` : ''}${dataOf({ ...rest, pressed })}>${lab}</button>`;
}

// seg({ options: [{ label, value }], value, e|act, aria, size: 'sm', cls }): a switch with one option on, equal widths
export function seg({ options = [], value, e, act, data, aria = '', size = 'sm', cls = '', pack = (v) => v } = {}) {
  const n = options.length, w = n === 2 ? ' two' : n === 3 ? ' three' : '';
  const one = (o) => `<button type="button"${o.value === value ? ' class="on"' : ''}${dataOf({ e, act, data, v: pack(o.value), pressed: o.value === value, title: o.title, attr: o.attr })}>${esc(o.label)}</button>`;
  return `<div class="seg ${size}${w} ${cls}" role="group"${aria ? ` aria-label="${esc(aria)}"` : ''}>${options.map(one).join('')}</div>`;
}

// toggle({ label, on, e|act, v }): a small pill that is on or off
export const toggle = (o) => button({ ...o, kind: 'toggle', pressed: !!o.on });

// segChoice({ label, on, act|e, v, data, attr, aria, size, cls, sub }): one segment of a segmented control where any number can be selected (a row of these sits inside `.segm`)
// the whole row has rounded outer corners and the selected segment is its own rounded pill, so the choice is easy to see
export function segChoice({ label = '', on = false, aria = '', size = '', cls: extra = '', sub = '', ...rest } = {}) {
  const cls = ['segi', size, on ? 'on' : '', extra].filter(Boolean).join(' ');
  return `<button type="button" class="${cls}"${aria ? ` aria-label="${esc(aria)}"` : ''}${dataOf({ ...rest, pressed: !!on })}><span class="swlab">${esc(label)}${sub ? ` <small>${esc(sub)}</small>` : ''}</span></button>`;
}

// field({ label, control, cls, hint }): a label above a control
export const field = ({ label = '', control = '', cls = '', hint = '' } = {}) => `<label class="field ${cls}"><span>${label}</span>${control}${hint ? `<small class="muted">${hint}</small>` : ''}</label>`;

// box({ title, hint, cancel: { e|act, label }, body, cls }): the darker box with a green border, title and Cancel
export function box({ title = '', hint = '', cancel, body = '', cls = '' } = {}) {
  return `<div class="field othbox ${cls}"><div class="othhead"><b>${esc(title)}</b>${cancel ? button({ label: cancel.label || 'Cancel', kind: 'ghost', size: 'sm', e: cancel.e, act: cancel.act, v: cancel.v }) : ''}</div>${hint ? `<small class="hint">${esc(hint)}</small>` : ''}${body}</div>`;
}

// sectionTitle(text): a heading inside a page or sheet
export const sectionTitle = (t, tag = 'h2') => `<${tag} class="sect">${esc(t)}</${tag}>`;

// textField({ label, id, name, value, placeholder, inputmode, type, hint, cls, hidden, attr }): label + input, one size everywhere
export function textField({ label = '', id, name, value = '', placeholder, inputmode, type, hint = '', cls = '', hidden = false, aria, attr } = {}) {
  const inp = `<input${attrs({ id, name, type, inputmode, placeholder, autocomplete: 'off', 'aria-label': aria, ...(attr || {}) })} value="${esc(value)}">`;
  return `<label class="field ${cls}"${hidden ? ' hidden' : ''}><span>${esc(label)}</span>${inp}${hint ? `<small class="muted">${esc(hint)}</small>` : ''}</label>`;
}
// selectField({ label, id, name, options: [{ value, label }] | ['a','b'], value, hint, cls, hidden, attr }): label + select (the app swaps it for its own picker)
export function selectField({ label = '', id, name, options = [], value, hint = '', cls = '', hidden = false, aria, attr } = {}) {
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o })).map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  return `<label class="field ${cls}"${hidden ? ' hidden' : ''}><span>${esc(label)}</span><select${attrs({ id, name, 'aria-label': aria || label, ...(attr || {}) })}>${opts}</select>${hint ? `<small class="muted">${esc(hint)}</small>` : ''}</label>`;
}
// tabs({ items: [{ label, value }], value, act, v key, aria }): the compact row of tabs used on Investments (Spot, Earn, Margin; dashboard cards)
export function tabs({ items = [], value, act, aria = '', attrOf } = {}) {
  return `<div class="wtabs" role="tablist"${aria ? ` aria-label="${esc(aria)}"` : ''}>${items.map((x) => button({ label: x.label, kind: 'chip', cls: `wtab ${x.cls || ''}`.trim(), on: x.value === value, act, v: x.value, attr: { role: 'tab', 'aria-selected': String(x.value === value), ...(attrOf ? attrOf(x) : {}) } })).join('')}</div>`;
}
