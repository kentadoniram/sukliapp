// Style guide (15.23): every component the app is built from, on one page, so a look can be checked in one place (light, dark, Simple, Advanced).
import { esc, sheet, toast, ACT } from './ui.js';
import { look } from './appearance.js';
import { DSTYLES } from './invest.js';
import { card, CARD_DESIGNS, button, seg, toggle, segChoice, field, textField, selectField, box, tabs, sectionTitle } from './components.js';

const TOKENS = [['--paper', 'Page'], ['--sheet', 'Card'], ['--ink', 'Text'], ['--ink2', 'Soft text'], ['--rule', 'Rule'], ['--line', 'Accent'], ['--tint', 'Tint'], ['--in', 'Income'], ['--warn', 'Warning'], ['--bad', 'Bad'], ['--iv-spot', 'Spot'], ['--iv-earn', 'Earn'], ['--iv-margin', 'Margin'], ['--iv-fut', 'Futures']];
const sec = (title, body) => `<section class="card sgsec">${sectionTitle(title, 'h3')}${body}</section>`;
const demo = (label, html) => `<div class="sgrow"><small class="muted">${esc(label)}</small><div>${html}</div></div>`;

// measured live from the page, so the numbers are what the screen really uses (CSS pixels at the current text size), never a copy that can drift
const MEASURE = [['h2', 'Heading 2'], ['h3', 'Heading 3'], ['h4', 'Heading 4'], ['p:not(.hint):not(.muted)', 'Body text'], ['p.hint', 'Hint text'], ['.btn:not(.sm):not(.ghost)', 'Button, primary'], ['.btn.sm:not(.ghost)', 'Button, small primary'], ['.btn.ghost:not(.sm)', 'Button, ghost'], ['.btn.sm.ghost', 'Button, small ghost'], ['.chip', 'Chip'], ['.segm button', 'Segment'], ['.tabs button, .wtabs button, .segm.wsw button', 'Tab'], ['input:not([type=checkbox]):not([type=radio]):not([type=file])', 'Input'], ['select', 'Select'], ['.box', 'Box'], ['.card', 'Card'], ['.sgsw1 i', 'Colour swatch']];
const px = (n) => `${Math.round(n * 10) / 10}px`;
function measureGuide() {
  const fs = getComputedStyle(document.documentElement).getPropertyValue('--fs').trim() || '1', note = document.getElementById('sgscale'); if (note) note.textContent = `${Math.round(parseFloat(fs) * 100)}%`;
  document.querySelectorAll('.sgsec').forEach((sec) => {
    sec.querySelector('.sgpx')?.remove(); const rows = [], seen = new Set();
    for (const [sel, name] of MEASURE) { const el = sec.querySelector(sel); if (!el || seen.has(name)) continue; seen.add(name); const r = el.getBoundingClientRect(), c = getComputedStyle(el); if (!r.width) continue;
      const pad = [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map((v) => `${Math.round(parseFloat(v))}`), same = pad.every((v) => v === pad[0]);
      rows.push(`<tr><th>${esc(name)}</th><td>${px(r.height)} high${el.matches('.btn,.chip,input,select,.sgsw1 i') ? `, ${px(r.width)} wide` : ''}</td><td>text ${px(parseFloat(c.fontSize))} / ${c.fontWeight}</td><td>padding ${same ? pad[0] : pad.join(' ')}px</td><td>corners ${px(parseFloat(c.borderTopLeftRadius) || 0)}</td></tr>`); }
    if (rows.length) sec.insertAdjacentHTML('beforeend', `<table class="sgpx"><caption>Measured sizes</caption>${rows.join('')}</table>`); });
}
export function styleguide() {
  setTimeout(measureGuide, 80);
  return `<header class="pagehead"><h2>Style Guide</h2></header>
  <p class="hint">Sizes are CSS pixels measured live from this page at your current Text Size (<b id="sgscale">100%</b>). At 100% they match the numbers in the style sheet; at other text sizes, type and some padding scale with it. Use them for exact dimensions.</p>
  <p class="hint">Everything the app is built from. If something looks wrong here it looks wrong everywhere. Change a look once in the style sheet, not screen by screen.</p>
  ${sec('Investment Performance selector', `<p class="hint">How you switch between Performance, Per-Token, Fees, Prediction and Gains on the Investments tab. Tap one to use it.</p><div class="sgopts">${DSTYLES.map(([v, n]) => button({ label: n, kind: 'chip', on: (look().dsel || 'seg') === v, act: 'look', attr: { 'data-k': 'dsel', 'data-v': v } })).join('')}</div>`)}
  ${sec('Colours', `<div class="sgsw">${TOKENS.map(([v, n]) => `<div class="sgsw1"><i style="background:var(${v})"></i><small>${esc(n)}<br><code>${esc(v)}</code></small></div>`).join('')}</div>`)}
  ${sec('Text', `<h2>Heading 2</h2><h3>Heading 3</h3><h4>Heading 4</h4><p>Body text, the size most of the app uses.</p><p class="hint">Hint text explains something quietly.</p><p class="muted">Muted text for details.</p>`)}
  ${sec('Buttons', [demo('primary', button({ label: 'Save', kind: 'primary' }) + button({ label: 'Save', kind: 'primary', size: 'sm' })), demo('ghost', button({ label: 'Cancel', kind: 'ghost' }) + button({ label: 'Cancel', kind: 'ghost', size: 'sm' })), demo('danger', button({ label: 'Delete', kind: 'danger' }) + button({ label: 'Delete', kind: 'danger-ghost', size: 'sm' })), demo('link', button({ label: 'Edit', kind: 'link' }) + button({ label: 'Remove', kind: 'danger-link' })),  demo('icon', button({ label: 'Close', kind: 'icon', icon: 'x' }))].join(''))}
  ${sec('Chips', demo('selected and not selected', `<div class="chips">${button({ label: 'All', kind: 'chip', on: true })}${button({ label: 'JPY', kind: 'chip' })}${button({ label: 'Convenience Stores', kind: 'chip' })}${button({ label: 'Food', kind: 'chip', on: true })}</div>`) + demo('text centred in the pill, across and up and down', `<div class="chips">${button({ label: 'A', kind: 'chip' })}${button({ label: 'Yen', kind: 'chip', on: true })}${button({ label: 'Transportation', kind: 'chip' })}</div>`))}
  ${sec('Switches and Toggles', demo('segmented control, any number can be selected (shows or hides a section)', `<div class="segm">${segChoice({ label: 'Performance', on: true })}${segChoice({ label: 'Prediction', on: false })}</div>`) + demo('seg two', seg({ options: [{ label: 'Fixed', value: 'a' }, { label: 'Percent', value: 'b' }], value: 'a', e: 'sg-noop' })) + demo('seg three', seg({ options: [{ label: 'Maker', value: 1 }, { label: 'Taker', value: 2 }, { label: 'Other Asset', value: 3 }], value: 2, e: 'sg-noop' })) + demo('toggle', toggle({ label: 'Tax', on: true, e: 'sg-noop' }) + toggle({ label: 'Discount', on: false, e: 'sg-noop' })))}
  ${sec('Tabs', demo('wallet tabs', tabs({ items: [{ label: 'Spot', value: 'a', cls: 'w-spot' }, { label: 'Earn', value: 'b', cls: 'w-earn' }, { label: 'Margin', value: 'c', cls: 'w-margin' }, { label: 'Futures', value: 'd', cls: 'w-futures' }], value: 'b', act: 'sg-noop', aria: 'Example' })))}
  ${sec('Fields', textField({ label: 'Text Field', value: 'Hello', hint: 'A hint under the field' }) + selectField({ label: 'Select Field', options: ['One', 'Two', 'Three'], value: 'Two' }) + field({ label: 'Any Control', control: '<input type="date">' }))}
  ${sec('Cards', [['', 'Theme card'], ...CARD_DESIGNS.map((x) => [x, x])].map(([x, n]) => card({ design: x, cls: 'sgcard', body: `<b>${esc(n)}</b><p class="hint">${x ? 'card({ design: "' + x + '" })' : 'card()'}</p>` })).join(''))}
  ${sec('Card kinds', `<p class="hint">One table in design.css (section 7) sets the look of each kind. Change a line there and every card of that kind follows.</p>` + ['cardbox', 'rem', 'fsum', 'tipbox'].map((k) => `<div class="${k}"><b>.${k}</b><br><small class="hint">${{ cardbox: 'plain family', rem: 'tint family', fsum: 'tint family, tighter', tipbox: 'compact family' }[k]}</small></div>`).join(''))}
  ${sec('Box', box({ title: 'Split Into Items', hint: 'The darker box with a Cancel', cancel: { act: 'sg-noop' }, body: '<p>Body of the box</p>' }))}
  ${sec('Sheet and Message', demo('', button({ label: 'Open a Sheet', kind: 'ghost', act: 'sg-sheet' }) + button({ label: 'Show a Message', kind: 'ghost', act: 'sg-toast' })))}
  ${sec('Rules for New Screens', `<ul class="calfacts"><li><span>Buttons, switches, tabs and fields come from <code>components.js</code>. No hand-written <code>&lt;button&gt;</code>.</span></li><li><span>Colours come from tokens (<code>var(--ink)</code>), never raw hex. Dark mode then works by itself.</span></li><li><span>Android wrap: nothing that works only on hover, keep 44 px touch targets, respect the safe areas, the Back button closes the top sheet first, and state that matters is saved in the app data, not only in localStorage.</span></li></ul>`)}`;
}
ACT['sg-noop'] = () => {};
ACT['sg-sheet'] = () => sheet(`<p>This is a sheet. ${button({ label: 'Close', kind: 'ghost', act: 'sg-close' })}</p>`, { title: 'Sample Sheet' });
ACT['sg-close'] = () => document.querySelectorAll('.sheet .x, .sheet [data-close]').forEach((e) => e.click());
ACT['sg-toast'] = () => toast('This is a message.');
