// Investments > Gains and Fees: windows with the full records behind the short lists on the cards.
// The cards only store what they computed in DETAIL; tapping a row or the "Recent" / "Latest Fees" select opens it here.
import { esc, ACT, sheet } from './ui.js';
import { money } from './screens.js';
import { button } from './components.js';

export const DETAIL = { earned: [], recent: [], fees: [], yr: '' };
const cls = (v) => (v >= 0 ? 'cg' : 'cr'), sg = (v) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;
const li = (d, label, v, c = '') => `<li class="ohr"><span class="ohl"><b>${esc(label)}</b><small>${esc(String(d).slice(0, 10))}</small></span><b class="${c}">${v}</b></li>`;
const group = (rows, key) => { const m = new Map(); for (const r of rows) { const k = key(r); m.set(k, (m.get(k) || 0) + r.v); } return [...m].sort((a, b) => b[1] - a[1]); };
const block = (title, g) => (g.length ? `<h3 class="subh">${title}</h3><div class="debtsum">${g.map(([n, v]) => `<div class="dsrow"><span>${esc(n)}</span><b>${money(v)}</b></div>`).join('')}</div>` : '');

// Earned, this year / all time: where the figure comes from, so a surprisingly large total can be traced
ACT['inv-earned'] = (el) => {
  const yrOnly = el && el.dataset && el.dataset.r === 'yr', rows = DETAIL.earned.filter((r) => !yrOnly || String(r.date).startsWith(DETAIL.yr)), tot = rows.reduce((q, r) => q + r.v, 0);
  const big = rows.slice().sort((a, b) => b.v - a.v).slice(0, 15);
  sheet(`<div class="debtsum"><div class="dsrow"><span>Earned, ${yrOnly ? 'this year' : 'all time'}</span><b>${money(tot)}</b></div><div class="dsrow"><span>Entries</span><b>${rows.length}</b></div></div>
    ${block('By account', group(rows, (r) => r.acct))}${block('By kind', group(rows, (r) => r.kind))}${block('By month', group(rows, (r) => String(r.date).slice(0, 7)).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 18))}
    <h3 class="subh">Largest entries</h3><ul class="calfacts">${big.map((r) => li(r.date, `${r.acct} · ${r.kind}`, money(r.v))).join('') || '<li><span>Nothing earned yet</span></li>'}</ul>
    <p class="hint">Every daily interest or staking payment is one entry, so a long-running Earn product adds up to a large number of small ones.</p>`, { title: yrOnly ? 'Earned This Year' : 'Earned All Time', wide: true });
};
ACT['inv-recent'] = () => {
  sheet(`<ul class="calfacts">${DETAIL.recent.map((x) => li(x.date, x.label, sg(x.v), cls(x.v))).join('') || '<li><span>Nothing yet</span></li>'}</ul>`, { title: 'Recent Earnings and Gains', wide: true });
};
ACT['inv-fees'] = () => {
  const yr = DETAIL.yr, all = DETAIL.fees, tot = all.reduce((q, p) => q + p.v, 0), thisYr = all.filter((p) => String(p.date).startsWith(yr)).reduce((q, p) => q + p.v, 0);
  sheet(`<div class="debtsum"><div class="dsrow"><span>All time</span><b>${money(tot)}</b></div><div class="dsrow"><span>This year</span><b>${money(thisYr)}</b></div><div class="dsrow"><span>Records</span><b>${all.length}</b></div></div>
    <ul class="calfacts">${all.map((p) => li(p.date, p.name, money(p.v))).join('') || '<li><span>No fees recorded</span></li>'}</ul>`, { title: 'Latest Fees', wide: true });
};
// the select-like control that opens one of these windows (same look as the other selects)
export const selectBtn = (act, label, value = '') => button({ html: `<span class="pkval">${esc(label)}${value ? ` <small class="muted">${esc(value)}</small>` : ''}</span><span class="pkcar" aria-hidden="true">▾</span>`, kind: 'plain', cls: 'pkbtn', act, aria: label });
export const rowBtn = (act, label, valueHtml, r) => button({ html: `<span>${label}</span>${valueHtml}`, kind: 'plain', cls: 'rowbtn', act, attr: { 'data-r': r } });
