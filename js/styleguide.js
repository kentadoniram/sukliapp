// Style guide (15.23): every component the app is built from, on one page, so a look can be checked in one place (light, dark, Simple, Advanced).
import { esc, sheet, toast, ACT } from './ui.js';
import { button, seg, toggle, switchBtn, field, textField, selectField, box, tabs, sectionTitle } from './components.js';

const TOKENS = [['--paper', 'Page'], ['--sheet', 'Card'], ['--ink', 'Text'], ['--ink2', 'Soft text'], ['--rule', 'Rule'], ['--line', 'Accent'], ['--tint', 'Tint'], ['--in', 'Income'], ['--warn', 'Warning'], ['--bad', 'Bad'], ['--iv-spot', 'Spot'], ['--iv-earn', 'Earn'], ['--iv-margin', 'Margin'], ['--iv-fut', 'Futures']];
const sec = (title, body) => `<section class="card sgsec">${sectionTitle(title, 'h3')}${body}</section>`;
const demo = (label, html) => `<div class="sgrow"><small class="muted">${esc(label)}</small><div>${html}</div></div>`;

export function styleguide() {
  return `<header class="pagehead"><h2>Style Guide</h2></header>
  <p class="hint">Everything the app is built from. If something looks wrong here it looks wrong everywhere. Change a look once in the style sheet, not screen by screen.</p>
  ${sec('Colours', `<div class="sgsw">${TOKENS.map(([v, n]) => `<div class="sgsw1"><i style="background:var(${v})"></i><small>${esc(n)}<br><code>${esc(v)}</code></small></div>`).join('')}</div>`)}
  ${sec('Text', `<h2>Heading 2</h2><h3>Heading 3</h3><h4>Heading 4</h4><p>Body text, the size most of the app uses.</p><p class="hint">Hint text explains something quietly.</p><p class="muted">Muted text for details.</p>`)}
  ${sec('Buttons', [demo('primary', button({ label: 'Save', kind: 'primary' }) + button({ label: 'Save', kind: 'primary', size: 'sm' })), demo('ghost', button({ label: 'Cancel', kind: 'ghost' }) + button({ label: 'Cancel', kind: 'ghost', size: 'sm' })), demo('danger', button({ label: 'Delete', kind: 'danger' }) + button({ label: 'Delete', kind: 'danger-ghost', size: 'sm' })), demo('link', button({ label: 'Edit', kind: 'link' }) + button({ label: 'Remove', kind: 'danger-link' })),  demo('icon', button({ label: 'Close', kind: 'icon', icon: 'x' }))].join(''))}
  ${sec('Chips', demo('selected and not selected', `<div class="chips">${button({ label: 'All', kind: 'chip', on: true })}${button({ label: 'JPY', kind: 'chip' })}${button({ label: 'Convenience Stores', kind: 'chip' })}${button({ label: 'Food', kind: 'chip', on: true })}</div>`) + demo('text centred in the pill, across and up and down', `<div class="chips">${button({ label: 'A', kind: 'chip' })}${button({ label: 'Yen', kind: 'chip', on: true })}${button({ label: 'Transportation', kind: 'chip' })}</div>`))}
  ${sec('Switches and Toggles', demo('switch (shows or hides a section)', `<div class="swgrid">${switchBtn({ label: 'Performance', on: true })}${switchBtn({ label: 'Prediction', on: false })}</div>`) + demo('seg two', seg({ options: [{ label: 'Fixed', value: 'a' }, { label: 'Percent', value: 'b' }], value: 'a', e: 'sg-noop' })) + demo('seg three', seg({ options: [{ label: 'Maker', value: 1 }, { label: 'Taker', value: 2 }, { label: 'Other Asset', value: 3 }], value: 2, e: 'sg-noop' })) + demo('toggle', toggle({ label: 'Tax', on: true, e: 'sg-noop' }) + toggle({ label: 'Discount', on: false, e: 'sg-noop' })))}
  ${sec('Tabs', demo('wallet tabs', tabs({ items: [{ label: 'Spot', value: 'a', cls: 'w-spot' }, { label: 'Earn', value: 'b', cls: 'w-earn' }, { label: 'Margin', value: 'c', cls: 'w-margin' }, { label: 'Futures', value: 'd', cls: 'w-futures' }], value: 'b', act: 'sg-noop', aria: 'Example' })))}
  ${sec('Fields', textField({ label: 'Text Field', value: 'Hello', hint: 'A hint under the field' }) + selectField({ label: 'Select Field', options: ['One', 'Two', 'Three'], value: 'Two' }) + field({ label: 'Any Control', control: '<input type="date">' }))}
  ${sec('Box', box({ title: 'Split Into Items', hint: 'The darker box with a Cancel', cancel: { act: 'sg-noop' }, body: '<p>Body of the box</p>' }))}
  ${sec('Sheet and Message', demo('', button({ label: 'Open a Sheet', kind: 'ghost', act: 'sg-sheet' }) + button({ label: 'Show a Message', kind: 'ghost', act: 'sg-toast' })))}
  ${sec('Rules for New Screens', `<ul class="calfacts"><li><span>Buttons, switches, tabs and fields come from <code>components.js</code>. No hand-written <code>&lt;button&gt;</code>.</span></li><li><span>Colours come from tokens (<code>var(--ink)</code>), never raw hex. Dark mode then works by itself.</span></li><li><span>Android wrap: nothing that works only on hover, keep 44 px touch targets, respect the safe areas, the Back button closes the top sheet first, and state that matters is saved in the app data, not only in localStorage.</span></li></ul>`)}`;
}
ACT['sg-noop'] = () => {};
ACT['sg-sheet'] = () => sheet(`<p>This is a sheet. ${button({ label: 'Close', kind: 'ghost', act: 'sg-close' })}</p>`, { title: 'Sample Sheet' });
ACT['sg-close'] = () => document.querySelectorAll('.sheet .x, .sheet [data-close]').forEach((e) => e.click());
ACT['sg-toast'] = () => toast('This is a message.');
