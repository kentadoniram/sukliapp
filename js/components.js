// Sukli UI components (15.13). Small helpers that return HTML strings with the classes the app already uses,
// so every look lives in styles.css and a design change is made once. Use these for new and touched screens;
// do not write a raw <button> by hand. Attributes: e → data-e, act → data-act, v → data-v, id, attr → anything else.
import { esc, ic } from './ui.js';
import { look } from './appearance.js';

const attrs = (o) => Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join('');
const KIND = { primary: 'btn', secondary: 'btn ghost', ghost: 'btn ghost', danger: 'btn danger', 'danger-ghost': 'btn danger ghost', link: 'linkbtn', 'danger-link': 'linkbtn danger', chip: 'chip', icon: 'iconbtn', toggle: 'tog', plain: '' };
const dataOf = ({ id, e, act, v, data, title, pressed, disabled, attr } = {}) => attrs({ id, 'data-e': e, 'data-act': act, 'data-v': data ? undefined : v, ...(data ? { [`data-${data}`]: v } : {}), title, 'aria-pressed': pressed === undefined ? undefined : String(!!pressed), disabled, ...attr });

// button({ label | html, kind: primary|secondary|ghost|danger|danger-ghost|link|danger-link|chip|icon|toggle|plain, size: 'sm', on, e|act, v, id, icon, aria, cls, submit, pressed, attr })
// html = trusted markup for the inside (icons, two lines of text, badges): the caller has already escaped it. kind 'plain' adds no look of its own (row buttons, picker buttons: give the look with cls).
export function button({ label = '', html = null, kind = 'secondary', size = '', on = false, icon = '', aria = '', cls: extra = '', submit = false, ...rest } = {}) {
  const cls = [KIND[kind] === undefined ? KIND.secondary : KIND[kind], size, on ? 'on' : '', extra].filter(Boolean).join(' ');
  const pressed = kind === 'toggle' || rest.pressed !== undefined ? (rest.pressed === undefined ? on : rest.pressed) : undefined;
  const lab = html !== null ? html : kind === 'icon' ? ic(icon || 'x') : `${icon ? ic(icon) + ' ' : ''}${esc(label)}`;
  return `<button type="${submit ? 'submit' : 'button'}"${cls ? ` class="${cls}"` : ''}${aria || (kind === 'icon' ? label : '') ? ` aria-label="${esc(aria || label)}"` : ''}${dataOf({ ...rest, pressed })}>${lab}</button>`;
}

// seg({ options: [{ label, value }], value, e|act, aria, size: 'sm', cls }): a switch with one option on, equal widths
// t1: true → under Theme 1 the same switch is drawn as the sliding .t1seg (Legacy keeps the plain .seg buttons)
export function seg({ options = [], value, e, act, data, aria = '', size = 'sm', cls = '', pack = (v) => v, t1 = false } = {}) {
  if (t1 && look().design !== 'legacy') {
    const idx = options.findIndex((o) => o.value === value);
    return `<div class="t1seg ${cls}" role="group"${aria ? ` aria-label="${esc(aria)}"` : ''} data-sel="${idx}" style="--n:${options.length};--sel:${Math.max(0, idx)}">${options.map((o) => button({ html: esc(o.label), kind: 'plain', cls: `t1s-slot ${o.value === value ? 'on' : ''}`, e, act, data, v: pack(o.value), pressed: o.value === value, title: o.title, attr: o.attr })).join('')}</div>`;
  }
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

// popBox({ title, hint, done: { e|act }, remove: { label, e|act }, body, cls, id }): the same content as box(), shown as a pop-up window over the form (like Tax, discount and card fees).
// Because it stays inside the form, the form's own click and input handling keeps working. The dark backdrop closes it like Done.
export function popBox({ fresh = true, title = '', hint = '', done = {}, remove = null, body = '', cls = '', id = '' } = {}) {
  return `<div class="popwin" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="popback" data-e="${esc(done.e || '')}"></div><div class="popcard ${fresh ? 'fresh ' : ''}${cls}"${id ? ` id="${esc(id)}"` : ''}><div class="pophead"><h3>${esc(title)}</h3>${button({ kind: 'icon', icon: 'x', label: 'Close', e: done.e, act: done.act })}</div>${hint ? `<small class="hint pophint">${esc(hint)}</small>` : ''}<div class="popbody">${body}</div><div class="popfoot">${remove ? button({ label: remove.label, kind: 'danger-ghost', e: remove.e, act: remove.act }) : '<span></span>'}${button({ label: 'Done', kind: 'primary', e: done.e, act: done.act })}</div></div></div>`;
}

// box({ title, hint, cancel: { e|act, label }, body, cls }): the darker box with a green border, title and Cancel
export function box({ title = '', hint = '', cancel, body = '', cls = '' } = {}) {
  return `<div class="field othbox ${cls}"><div class="othhead"><b>${esc(title)}</b>${cancel ? button({ label: cancel.label || 'Cancel', kind: 'ghost', size: 'sm', e: cancel.e, act: cancel.act, v: cancel.v }) : ''}</div>${hint ? `<small class="hint">${esc(hint)}</small>` : ''}${body}</div>`;
}

// sectionTitle(text): a heading inside a page or sheet
export const sectionTitle = (t, tag = 'h2') => `<${tag} class="sect">${esc(t)}</${tag}>`;

// textField({ label, id, name, value, placeholder, inputmode, type, hint, cls, hidden, attr }): label + input, one size everywhere
// v16.35 options shared by both fields (all optional, so older calls are unchanged):
//   tip: raw HTML placed after the label text (the "?" help buttons)   lid: id of the label itself (so a row can be shown or hidden)   spanId: id of the label text (when it is rewritten later)
//   after: raw HTML placed after the control instead of hint (a help line that has its own id or class)
const fieldHead = (label, tip, spanId) => `<span${spanId ? ` id="${esc(spanId)}"` : ''}>${esc(label)}${tip ? ` ${tip}` : ''}</span>`;
const fieldTail = (hint, after) => (after || (hint ? `<small class="muted">${esc(hint)}</small>` : ''));
export function textField({ label = '', id, name, value = '', placeholder, inputmode, type, hint = '', cls = '', hidden = false, aria, attr, tip, lid, spanId, after } = {}) {
  const inp = `<input${attrs({ id, name, type, inputmode, placeholder, autocomplete: 'off', 'aria-label': aria, ...(attr || {}) })} value="${esc(value)}">`;
  return `<label class="field ${cls}"${lid ? ` id="${esc(lid)}"` : ''}${hidden ? ' hidden' : ''}>${fieldHead(label, tip, spanId)}${inp}${fieldTail(hint, after)}</label>`;
}
// areaField({ label, id, name, value, rows, placeholder, lid, attr }): label + textarea (notes, lists of lines)
export function areaField({ label = '', id, name, value = '', rows = 2, placeholder, cls = '', hint = '', attr, tip, lid, spanId, after } = {}) {
  return `<label class="field ${cls}"${lid ? ` id="${esc(lid)}"` : ''}>${fieldHead(label, tip, spanId)}<textarea${attrs({ id, name, rows, placeholder, ...(attr || {}) })}>${esc(value)}</textarea>${fieldTail(hint, after)}</label>`;
}
// selectField({ label, id, name, options: [{ value, label }] | ['a','b'], optionsHtml, value, hint, cls, hidden, attr }): label + select (the app swaps it for its own picker)
// optionsHtml: ready-made <option>/<optgroup> markup, used instead of options when the list has groups or is built elsewhere
export function selectField({ label = '', id, name, options = [], optionsHtml, value, hint = '', cls = '', hidden = false, aria, attr, tip, lid, spanId, after } = {}) {
  const opts = optionsHtml != null ? optionsHtml : options.map((o) => (typeof o === 'object' ? o : { value: o, label: o })).map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  return `<label class="field ${cls}"${lid ? ` id="${esc(lid)}"` : ''}${hidden ? ' hidden' : ''}>${fieldHead(label, tip, spanId)}<select${attrs({ id, name, 'aria-label': aria === undefined ? label : aria, ...(attr || {}) })}>${opts}</select>${fieldTail(hint, after)}</label>`;
}
// tabs({ items: [{ label, value }], value, act, v key, aria }): the compact row of tabs used on Investments (Spot, Earn, Margin; dashboard cards)
export function tabs({ items = [], value, act, aria = '', attrOf } = {}) {
  return `<div class="wtabs" role="tablist"${aria ? ` aria-label="${esc(aria)}"` : ''}>${items.map((x) => button({ label: x.label, kind: 'chip', cls: `wtab ${x.cls || ''}`.trim(), on: x.value === value, act, v: x.value, attr: { role: 'tab', 'aria-selected': String(x.value === value), ...(attrOf ? attrOf(x) : {}) } })).join('')}</div>`;
}

// the one reusable card: every card-like box takes its look from the shared card tokens (see DESIGN SYSTEM in styles.css), so a theme changes the tokens, not each screen
// design: '' (the theme's own card), 'flat', 'raised' or 'tint'. Each is only a set of card tokens in design.css, so no screen restyles a card.
export const CARD_DESIGNS = ['flat', 'raised', 'tint', 'hero'];
// kind: the card kind from the table in design.css (section 7); unknown names are ignored so a typo cannot add a stray class
export const CARD_KINDS = ['cardbox', 'binrow', 'tile', 'outlook-card', 'rem', 'fsum', 'goalcheck', 'reimbview'];
export function card({ body = '', cls = '', tone = '', design = '', kind = '', tag = 'section', attr = {} } = {}) {
  const a = Object.entries(attr).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('');
  return `<${tag} class="ui-card${tone ? ' ui-card--' + tone : ''}${CARD_DESIGNS.includes(design) ? ' ui-card--' + design : ''}${CARD_KINDS.includes(kind) ? ' ' + kind : ''}${cls ? ' ' + cls : ''}"${a}>${body}</${tag}>`;
}

// Home and Investments are two areas of the app. This is the one switch between them, shown at the top of both (Theme 1):
// the area you are in is filled, the other one is a link. areaSwitch('home') or areaSwitch('invest').
export const AREAS = [['home', 'Home', 'home'], ['invest', 'Investments', 'spark']];
// v16.18: the two area names sit beside the burger menu as the title of the page; the current one is large, the other is a link to it.
// v16.21: the header names the page you are on and nothing else (no second link beside it); Investments has its own Home button
export const areaTitle = (cur) => `<nav class="arealabs" aria-label="${esc((AREAS.find(([r]) => r === cur) || [0, cur])[1])}"><span class="areatitle on" aria-current="page">${esc((AREAS.find(([r]) => r === cur) || [0, cur])[1])}</span></nav>`;
export const areaLabels = (cur) => `<nav class="arealabs" aria-label="Home or Investments">${AREAS.map(([r, l]) => `<a href="#/${r}" class="areatitle${cur === r ? ' on' : ''}" ${cur === r ? 'aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</nav>`;
export const areaSwitch = (cur) => `<nav class="areasw" data-area-switch="${esc(cur)}" aria-label="Switch between Home and Investments">${AREAS.map(([r, l, i]) => `<a href="#/${r}" class="${cur === r ? 'on' : ''}" ${cur === r ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></a>`).join('')}</nav>`;

// The one label-and-figure row (v16.51). `value` is already-formatted HTML; `sub` is an optional small line under the label.
export const rowHtml = ({ label, value, sub = '', cls = '', tag = 'div' }) => `<${tag} class="kvrow${cls ? ' ' + cls : ''}"><span class="kvl"><b>${label}</b>${sub ? `<small class="hint">${sub}</small>` : ''}</span><b class="kvv">${value}</b></${tag}>`;
