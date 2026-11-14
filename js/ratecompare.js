// Rate comparison (15.35): savings and yield options side by side, each with where the number came from and the date it was read.
// The numbers are a hand-kept list, not a live feed: rates change, so every row shows its date and turns "old" after 60 days.
// Update ROWS from the source link before relying on a row. "If you put in" shows the yearly interest before tax on an amount you type.
import { esc } from './ui.js';
import { textField } from './components.js';
export const ROWS = [
  { grp: 'Government savings (Philippines)', name: 'Pag-IBIG MP2 Savings', rate: 7.12, cur: 'PHP', asof: '2026-02-27', term: '5 years, dividends yearly', note: 'Dividend rate declared for 2025. Not guaranteed: the Fund declares it each year. Regular Pag-IBIG savings: 6.62%.', src: 'https://mb.com.ph/2026/02/27/pag-ibig-fund-declares-record-p6434-b-dividends-for-2025', srcName: 'Manila Bulletin' },
  { grp: 'Bank time deposits (Japan)', name: 'Sony Bank, yen time deposit 1 year (campaign)', rate: 1.25, cur: 'JPY', asof: '2026-06-22', term: '1 year, campaign 1 Jun to 31 Aug 2026', note: 'Special rate for the first term only; early withdrawal loses it. After tax about 0.996%. 6 months: 0.80%.', src: 'https://sonybank.jp/campaign/yen202606/', srcName: 'Sony Bank' },
  { grp: 'Bank time deposits (Japan)', name: 'Rakuten Bank, yen time deposit 1 year (campaign)', rate: 1.20, cur: 'JPY', asof: '2026-06-08', term: '1 year, campaign 8 Jun to 31 Jul 2026', note: 'Limited summer campaign; check the conditions on the bank page.', src: 'https://jpyonline.pages.dev/article/2026-06-09-08-rakuten-bank-offers-1-2-one-year-yen/en/', srcName: 'Jp¥online (quoting Rakuten Bank)' },
  { grp: 'Bank time deposits (Philippines)', name: 'Metrobank online time deposit (top rate)', rate: 5.0, cur: 'PHP', asof: '2026-05-15', term: '180 to 364 days', note: 'The 5% top rate is for placements of P10 million or more. Smaller amounts earn less (not listed in the article).', src: 'https://tribune.net.ph/2026/05/19/metrobank-raises-online-time-deposit-rates-to-as-high-as-5', srcName: 'Daily Tribune' },
  { grp: 'Crypto earn (stablecoins)', name: 'Binance Simple Earn, flexible USDT/USDC', rate: 4.0, rateLow: 1.4, cur: 'USD', asof: '2026-07-01', term: 'Flexible (take out any time)', note: 'Range 1.4% to 4% (shown at the top). The date is only "mid-2026" in the source, so July is an estimate. Not insured: exchange and stablecoin risk.', src: 'https://www.spark.money/tools/crypto-earn-program-comparison', srcName: 'Spark' },
];
const age = (d, now = new Date()) => Math.floor((now - new Date(d + 'T12:00:00')) / 864e5);
export const stale = (r, now) => age(r.asof, now) > 60;
export function rateCompare(now = new Date()) {
  const groups = [...new Set(ROWS.map((r) => r.grp))];
  return `<header class="pagehead"><h2>Compare Rates</h2></header>
    <p class="hint">Savings and earning options side by side. Each line shows where the number came from and the date it was read. Rates change, so check the source before you act. This is information, not advice.</p>
    ${textField({ label: 'If you put in (amount)', id: 'rc-amt', inputmode: 'decimal', value: '100000', placeholder: 'e.g. 100000' })}
    ${groups.map((g) => `<section class="card"><h3>${esc(g)}</h3><ul class="calfacts rclist">${ROWS.filter((r) => r.grp === g).map((r) => `<li class="rcrow" data-rate="${r.rate}" data-low="${r.rateLow || ''}"><span><b>${esc(r.name)}</b><br><small class="muted">${esc(r.term)} · ${esc(r.cur)}</small><br><small>${esc(r.note)}</small><br><small class="muted">Read ${esc(r.asof)}${stale(r, now) ? ' · <b class="cr">old, please check</b>' : ''} · <a href="${esc(r.src)}" target="_blank" rel="noopener">${esc(r.srcName)}</a></small></span><b class="rcnum">${r.rateLow ? r.rateLow + '–' : ''}${r.rate}%<br><small class="muted rcint"></small></b></li>`).join('')}</ul></section>`).join('')}
    <p class="hint">Interest shown is before tax and in each option's own currency. Different currencies and risks are not like for like: a higher number is not always better.</p>`;
}
export function bindRateCompare(root = document) {
  const inp = root.querySelector('#rc-amt'); if (!inp) return;
  const draw = () => { const a = parseFloat(String(inp.value).replace(/,/g, '')) || 0; root.querySelectorAll('.rcrow').forEach((li) => { const r = +li.dataset.rate, lo = li.dataset.low ? +li.dataset.low : 0, f = (x) => Math.round(a * x / 100).toLocaleString(); li.querySelector('.rcint').textContent = a > 0 ? `${lo ? f(lo) + '–' : ''}${f(r)} a year` : ''; }); };
  inp.addEventListener('input', draw); draw();
}
