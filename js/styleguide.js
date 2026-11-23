// Style guide (15.23): every component the app is built from, on one page, so a look can be checked in one place (light, dark, Simple, Advanced).
import { esc, sheet, toast, ACT } from './ui.js';
import { look, applyLook, ACCENTS, FONTS, SIZES } from './appearance.js';
import { DSTYLES, platOf } from './invest.js';
import { get, commit } from './core.js';
import { platLogoRows, platIcon, customIcon, platSymbol } from './platicons.js';
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

// ---- Design Studio: every look choice, with a small picture of each, in one place ----
const tile = (k, v, label, preview, cur) => button({ html: `<span class="pv ${preview.cls || ''}">${preview.html || ''}</span><b>${esc(label)}</b>`, kind: 'plain', cls: `sgtile ${String(cur) === String(v) ? 'on' : ''}`, act: 'look', pressed: String(cur) === String(v), attr: { 'data-k': k, 'data-v': v } });
const grp = (title, hint, k, opts, cur) => `<div class="sggrp"><h4>${esc(title)}</h4><p class="hint">${esc(hint)}</p><div class="sgtiles">${opts.map(([v, l, pv]) => tile(k, v, l, pv, cur)).join('')}</div></div>`;
const cardPv = (c) => ({ html: `<div class="pv-card ${c}"><i></i><i></i></div>` });
const studio = () => {
  const lk = look(), dark = lk.theme === 'dark' || (lk.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const dsel = lk.dsel || 'seg';
  const sel = (c, on) => `<div class="pv-sel ${c}">${['Perf', 'Fees', 'Gains'].map((x, i) => `<span class="${i === on ? 'on' : ''}">${x}</span>`).join('')}</div>`;
  return [
    grp('Design', 'Theme 1 is the newer look. Legacy Theme is the original.', 'design', [['theme1', 'Theme 1', cardPv('')], ['legacy', 'Legacy', cardPv('outline')]], lk.design === 'legacy' ? 'legacy' : 'theme1'),
    grp('Light or dark', 'Automatic follows your phone.', 'theme', [['auto', 'Automatic', { cls: 'pv-bg-white', html: '◐' }], ['light', 'Light', { cls: 'pv-bg-white', html: '☀' }], ['dark', 'Dark', { cls: 'pv-bg-black', html: '<span style="color:#fff">☾</span>' }]], lk.theme),
    grp('Colour palette', 'The accent colour used for buttons, links and highlights. Match the mode uses teal in Simple and blue in Advanced.', 'accent', [['auto', 'Match mode', { html: '<span class="pv-dot" style="background:conic-gradient(' + ACCENTS.teal.l[0] + ' 50%,' + ACCENTS.blue.l[0] + ' 0)"></span>' }], ...Object.entries(ACCENTS).map(([k, a]) => [k, a.n, { html: `<span class="pv-dot" style="background:${a[dark ? 'd' : 'l'][0]}"></span>` }])], lk.accent),
    grp('Page background', 'The colour behind the cards. Pure black only shows in dark mode, and warm or cool only in light mode.', 'bg', [['auto', 'Standard', { cls: 'pv-bg-white', html: '' }], ['warm', 'Warm paper', { cls: 'pv-bg-warm', html: '' }], ['cool', 'Cool blue', { cls: 'pv-bg-cool', html: '' }], ['black', 'True black', { cls: 'pv-bg-black', html: '' }]], lk.bg),
    grp('Font', 'Letter shapes. Serif has small feet like a book, Mono gives every digit the same width, Humanist is a friendly sans-serif.', 'font', FONTS.map(([v, l]) => [v, l, { html: `<span class="pv-type pvf-${v}">Aa 1,234</span>` }]), ['rounded', 'standard', 'system', 'serif', 'humanist', 'mono'].includes(lk.font) ? lk.font : 'auto'),
    grp('Text size', 'Smaller text leaves more room above the on-screen keyboard.', 'size', SIZES.map(([v, l, f]) => [v, l, { html: `<span class="pv-type" style="font-size:${Math.round(14 * f)}px">Aa</span>` }]), lk.size),
    grp('Line spacing', 'Space between lines of text.', 'lead', [['auto', 'Standard', { html: '<span class="pv-type" style="font-size:12px;line-height:1.4">Line<br>Line</span>' }], ['tight', 'Tight', { html: '<span class="pv-type" style="font-size:12px;line-height:1.15">Line<br>Line</span>' }], ['airy', 'Airy', { html: '<span class="pv-type" style="font-size:12px;line-height:1.7">Line<br>Line</span>' }]], lk.lead),
    grp('Card style', 'Flat sits on the page, Outline has a border, Lifted floats with a shadow, Tinted carries a hint of your accent colour.', 'card', [['auto', 'Standard', cardPv('')], ['flat', 'Flat', cardPv('flat')], ['outline', 'Outline', cardPv('outline')], ['lifted', 'Lifted', cardPv('lifted')], ['tinted', 'Tinted', cardPv('tinted')]], lk.card),
    grp('Corners', 'How round cards and boxes are.', 'radius', [['sharp', 'Sharp', cardPv('sharp')], ['auto', 'Soft', cardPv('')], ['round', 'Round', cardPv('round')]], lk.radius === 'sharp' || lk.radius === 'round' ? lk.radius : 'auto'),
    grp('Spacing', 'How much room there is inside cards. Compact fits more on one screen.', 'density', [['compact', 'Compact', cardPv('compact')], ['auto', 'Standard', cardPv('')], ['roomy', 'Roomy', cardPv('roomy')]], lk.density === 'compact' || lk.density === 'roomy' ? lk.density : 'auto'),
    grp('Buttons', 'The shape of buttons. Soft turns the main button into a gentle tint instead of a solid colour.', 'btn', [['auto', 'Rounded', { html: '<span class="pv-btn">Save</span>' }], ['pill', 'Pill', { html: '<span class="pv-btn pill">Save</span>' }], ['square', 'Square', { html: '<span class="pv-btn square">Save</span>' }], ['soft', 'Soft', { html: '<span class="pv-btn soft">Save</span>' }]], lk.btn),
    grp('Bottom navigation', 'The bar at the bottom of the screen. Icons only hides the words, Floating pill lifts it off the edge.', 'nav', [['auto', 'Icons + words', { html: '<div class="pv-nav"><span><i class="on"></i><small></small></span><span><i></i><small></small></span><span><i></i><small></small></span></div>' }], ['icons', 'Icons only', { html: '<div class="pv-nav icons"><i class="on"></i><i></i><i></i></div>' }], ['pill', 'Floating pill', { html: '<div class="pv-nav pill"><i class="on"></i><i></i><i></i></div>' }]], lk.nav),
    grp('Investment sections selector', 'How you switch between Performance, Per-Token, Fees, Prediction and Gains on the Investments tab.', 'dsel', DSTYLES.map(([v, n]) => [v, n, { html: sel(v, 0) }]), dsel),
    grp('Charts: bars', 'The seven daily bars on Home and similar bar charts.', 'bars', [['auto', 'Rounded', { html: '<div class="pv-bars"><i style="height:50%"></i><i style="height:80%"></i><i style="height:35%"></i><i style="height:65%"></i></div>' }], ['square', 'Square', { html: '<div class="pv-bars square"><i style="height:50%"></i><i style="height:80%"></i><i style="height:35%"></i><i style="height:65%"></i></div>' }], ['slim', 'Slim', { html: '<div class="pv-bars slim"><i style="height:50%"></i><i style="height:80%"></i><i style="height:35%"></i><i style="height:65%"></i></div>' }], ['accent', 'All accent', { html: '<div class="pv-bars accent"><i style="height:50%"></i><i style="height:80%"></i><i style="height:35%"></i><i style="height:65%"></i></div>' }]], lk.bars),
    grp('Platform names (Investments)', 'Always bold. Only the capital letters change.', 'pcase', [['upper', 'UPPERCASE', { html: '<b>BYBIT</b>' }], ['title', 'Title Case', { html: '<b>Bybit</b>' }], ['lower', 'lowercase', { html: '<b>bybit</b>' }]], lk.pcase),
  ].join('');
};
ACT['sg-reset-look'] = () => { try { localStorage.removeItem('sukli-look'); } catch { /* blocked */ } applyLook(); window.dispatchEvent(new Event('sukli-render')); };

// ---- Platform logos: upload your own files (nothing from the companies is bundled) ----
const logoNames = () => [...new Set(get().accounts.filter((a) => !a.deleted).map(platOf).filter((n) => n && n !== 'Wallets and other'))].sort((a, b) => a.localeCompare(b));
const platLogos = () => `<p class="hint">Sukli does not ship company logos, because they are trademarks. Upload the ones you want (a PNG, JPG or SVG you downloaded from the company’s own brand page) and they are used everywhere that platform appears. Files are shrunk and kept on this device only.</p>
  <div class="sgtiles">${[['initials', 'Brand colour + letters', { html: platIcon('Binance') + platIcon('GCash') + platIcon('OKX') }], ['symbol', 'Sukli symbols', { html: `<span class="pv-dot" style="background:#555"></span>` }]].map(([v, l, pv]) => tile('logo', v, l, pv, look().logo === 'symbol' ? 'symbol' : 'initials')).join('')}</div>
  <p class="hint">Upload several at once: name each file after its platform (bybit.png, gcash.svg, binance.jpg) and choose them all together.</p>
  <label class="btn sm ghost sglogo-up">Upload many logos<input type="file" accept="image/*" multiple hidden data-sg-logo="*"></label>
  <div class="sglogos">${logoNames().length ? platLogoRows(logoNames()) : '<p class="muted">Platforms you add under Investments appear here.</p>'}</div>`;
const shrink = (file) => new Promise((res) => { const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { const c = document.createElement('canvas'), k = Math.min(1, 96 / Math.max(img.width, img.height, 1)); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/png')); };
  img.onerror = () => { URL.revokeObjectURL(url); res(''); }; img.src = url; });
const nk = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
document.addEventListener('change', async (e) => {
  const el = e.target.closest && e.target.closest('input[data-sg-logo]'); if (!el) return;
  const files = [...(el.files || [])], one = el.dataset.sgLogo, names = logoNames(); let n = 0, miss = [];
  for (const f of files) {
    const target = one === '*' ? names.find((x) => nk(x) === nk(f.name.replace(/\.[^.]+$/, ''))) || f.name.replace(/\.[^.]+$/, '') : one;
    const data = await shrink(f); if (!data) { miss.push(f.name); continue; }
    if (one === '*' && !names.includes(target) && !platSymbol(target).known) { miss.push(f.name); continue; }
    commit((d) => { (d.settings.platformIcons = d.settings.platformIcons || {})[target] = data; }); n++;
  }
  el.value = ''; toast(n ? `${n} logo${n === 1 ? '' : 's'} saved.${miss.length ? ` Not matched: ${miss.join(', ')}.` : ''}` : 'No logo saved. Check the file is an image named after a platform.');
  window.dispatchEvent(new Event('sukli-render'));
});
ACT['sg-logo-reset'] = (el) => { const ex = el.dataset.ex; commit((d) => { if (d.settings.platformIcons) delete d.settings.platformIcons[ex]; }); toast('Logo removed.'); window.dispatchEvent(new Event('sukli-render')); };
export function styleguide() {
  setTimeout(measureGuide, 80);
  return `<header class="pagehead"><h2>Style Guide</h2></header>
  <p class="hint">Sizes are CSS pixels measured live from this page at your current Text Size (<b id="sgscale">100%</b>). At 100% they match the numbers in the style sheet; at other text sizes, type and some padding scale with it. Use them for exact dimensions.</p>
  <p class="hint">Everything the app is built from. If something looks wrong here it looks wrong everywhere. Change a look once in the style sheet, not screen by screen.</p>
  ${sec('Design Studio', `<p class="hint">Pick any option below and the whole app changes straight away. Each choice is kept on this device. Standard means the look the app always had.</p><div class="sgstudio">${studio()}</div><div class="btnrow left">${button({ label: 'Reset every look choice', kind: 'ghost', act: 'sg-reset-look' })}</div>`)}
  ${sec('Platform logos', platLogos())}
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
