// Probability distribution screens (16.50): the maths is in prob.js, this file only draws it.
import { esc, ACT, sheet } from './ui.js';
import { money } from './screens.js';
import { segChoice, selectField } from './components.js';
import { button } from './components.js';
import { stepsOf, jointSteps, simulate, summarize, lacks, unreasonable, fit, empirical, MIN_STEPS, MIN_DAYS, PATHS } from './prob.js';

const O = { coin: 'all', days: 30, drift: 'none' };
const HORIZONS = [[7, '1 Week'], [30, '1 Month'], [90, '3 Months']];
const day0 = Date.UTC(2000, 0, 1), dnum = (p) => (Date.parse(`${p.date}T00:00:00Z`) - day0) / 864e5 + (p.ts ? (p.ts % 864e5) / 864e5 : 0);
const rerender = () => window.dispatchEvent(new Event('sukli-render'));
const inHundred = (p) => { const n = Math.round(p * 100); return n === 0 && p > 0 ? 'fewer than 1 in 100' : n >= 100 && p < 1 ? 'almost every one in 100' : `about ${n} in 100`; };
const sgn = (v) => (Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v) >= 1000 ? Math.round(Math.abs(v)).toLocaleString('en-US') : Math.abs(v).toFixed(1)}%` : 'n/a');

// bars from a histogram: green on the side at or above today's value, red below, a dashed line for today and a tick for the middle
function histSvg(bins, start, median, lo, hi, fmt, label) {
  const W = 320, H = 150, pad = 8, base = H - 22, top = 14, mx = Math.max(...bins.map((b) => b.p), 0.0001), bw = (W - pad * 2) / bins.length;
  const X = (v) => pad + ((v - lo) / (hi - lo || 1)) * (W - pad * 2), bars = bins.map((b, i) => { const h = (b.p / mx) * (base - top), mid = (b.lo + b.hi) / 2;
    return `<rect x="${(pad + i * bw + 0.5).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${Math.max(h, 0.5).toFixed(1)}" rx="2" fill="${mid < start ? 'var(--bad)' : 'var(--in)'}" opacity="${mid < start ? '.75' : '.8'}"><title>${esc(fmt(b.lo))} to ${esc(fmt(b.hi))}: ${(b.p * 100).toFixed(1)}%</title></rect>`; }).join('');
  const xs = X(start), xm = X(median), clamp = (x) => Math.max(pad + 18, Math.min(W - pad - 18, x));
  return `<svg class="oddsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${bars}
    <line x1="${xs.toFixed(1)}" x2="${xs.toFixed(1)}" y1="${top - 4}" y2="${base}" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="3 3"/>
    <text x="${clamp(xs).toFixed(1)}" y="${top - 5}" text-anchor="middle" font-size="9" fill="var(--ink)">today</text>
    <line x1="${pad}" x2="${W - pad}" y1="${base}" y2="${base}" stroke="var(--rule)"/>
    <text x="${pad}" y="${H - 8}" font-size="9" fill="var(--ink2)">${esc(fmt(lo))}</text><text x="${W - pad}" y="${H - 8}" text-anchor="end" font-size="9" fill="var(--ink2)">${esc(fmt(hi))}</text>
    <path d="M${xm.toFixed(1)} ${base + 2} l-3 6 h6z" fill="var(--ink)"/></svg>`;
}
const row = (k, v, sub = '', cls = '') => `<li class="ohr"><span class="ohl"><b>${k}</b>${sub ? `<small>${sub}</small>` : ''}</span><b class="${cls}">${v}</b></li>`;

// holdings: [{ cur, name, value (home currency), hist: [{ date, price, ts }] }] for coins you hold
export function oddsBlock(holdings) {
  const list = holdings.filter((h) => h.value > 0);
  if (!list.length) return '';
  if (O.coin !== 'all' && !list.some((h) => h.cur === O.coin)) O.coin = 'all';
  const picked = O.coin === 'all' ? list : list.filter((h) => h.cur === O.coin);
  const series = picked.map((h) => h.hist.filter((p) => p && p.price > 0 && p.date).map((p) => ({ t: dnum(p), p: p.price })).sort((a, b) => a.t - b.t));
  const usable = series.some((s) => s.length > 1) ? picked.map((h, i) => ({ h, s: series[i] })).filter((x) => x.s.length > 1) : [];
  const steps = usable.length === 1 ? stepsOf(usable[0].s) : jointSteps(usable.map((x) => x.s));
  const noData = lacks(usable.length ? steps : []);
  const skipped = picked.length - usable.length;
  const controls = `<div class="oddsctl">
    ${selectField({ label: 'Asset', optionsHtml: `<option value="all" ${O.coin === 'all' ? 'selected' : ''}>All my holdings (${list.length})</option>${list.map((h) => `<option value="${esc(h.cur)}" ${O.coin === h.cur ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}`, aria: 'Asset for the probability distribution', attr: { 'data-odds-coin': '' } })}
    <div class="field"><span>Look ahead</span><div class="segm" role="group" aria-label="Look ahead">${HORIZONS.map(([d, l]) => segChoice({ label: l, on: O.days === d, act: 'odds-days', v: d })).join('')}</div></div>
    <div class="field"><span>Average trend</span><div class="segm" role="group" aria-label="Average trend">${segChoice({ label: 'No trend', on: O.drift === 'none', act: 'odds-drift', v: 'none' })}${segChoice({ label: 'Past trend', on: O.drift === 'past', act: 'odds-drift', v: 'past' })}</div></div></div>`;
  const head = `<h3 class="subh">Possible Outcomes <small class="muted gsum">probability distribution</small></h3>`;
  if (noData) return `${head}${controls}<p class="hint">${esc(noData)}</p>`;
  const values = usable.map((x) => x.h.value), sim = simulate(steps, values, O.days, { drift: O.drift }), bad = unreasonable(sim);
  if (bad) return `${head}${controls}<p class="hint warnline">${esc(bad)}</p>`;
  const S = summarize(sim), f = fit(steps);
  const span = HORIZONS.find((x) => x[0] === O.days)[1].toLowerCase(), fm = (v) => money(v);
  return `${head}${controls}
    <p class="hint">${esc(span.replace(/^1 /, 'In 1 ').replace(/^3 /, 'In 3 '))}: the possible values of ${O.coin === 'all' ? 'everything you hold' : esc(picked[0].name)}, today ${fm(S.start)}. Taller bars are outcomes that come up more often.</p>
    <div class="oddswrap">${histSvg(S.bins, S.start, S.median, S.lo, S.hi, fm, `Possible values after ${span}`)}</div>
    <ul class="calfacts">
      ${row('Worst case', fm(S.p05), `${sgn(S.pct.p05)} · only 1 in 20 ends lower`, 'cr')}
      ${row('Typical', fm(S.median), `${sgn(S.pct.median)} · the middle outcome`)}
      ${row('Expected (average)', fm(S.mean), `${sgn(S.pct.mean)} · the average of all outcomes`)}
      ${row('Best case', fm(S.p95), `${sgn(S.pct.p95)} · only 1 in 20 ends higher`, 'cg')}
    </ul>
    <h4 class="subh">How often each could happen <small class="muted gsum">out of 100 similar futures</small></h4>
    <ul class="calfacts">
      ${row('Ends lower than today', inHundred(S.loss))}${row('Falls 10% or more', inHundred(S.loss10))}${row('Rises 10% or more', inHundred(S.gain10))}${row('Loses half or more', inHundred(S.halve))}
    </ul>
    <p class="hint">The widest results seen in ${PATHS.toLocaleString('en-US')} simulated futures: ${fm(S.worst)} (${sgn(S.pct.worst)}) to ${fm(S.best)} (${sgn(S.pct.best)}). Built from ${f.steps} recorded price changes over ${Math.round(f.days)} days${skipped ? `; ${skipped} holding${skipped === 1 ? ' has' : 's have'} no price history yet and ${skipped === 1 ? 'is' : 'are'} left out` : ''}.
      ${button({ label: 'How this is worked out', kind: 'link', act: 'odds-how' })}</p>`;
}
ACT['odds-days'] = (el) => { O.days = +el.dataset.v; rerender(); };
ACT['odds-drift'] = (el) => { O.drift = el.dataset.v; rerender(); };
document.addEventListener('change', (e) => { const el = e.target.closest && e.target.closest('select[data-odds-coin]'); if (el) { O.coin = el.value; rerender(); } });
ACT['odds-how'] = () => sheet(`<p><b>What you see.</b> Thousands of possible futures are simulated for the length of time you chose. Each bar is how many of them ended at that value. Green bars are at or above today's value, red bars below.</p>
  <h4 class="subh">The model</h4><ul class="calfacts">
  <li><span>The price's log moves like a random walk (geometric Brownian motion): its average rate per day, and a spread that grows with the square root of time.</span></li>
  <li><span>Only the prices Sukli recorded are known. Each gap between two recorded prices is one observation, so uneven gaps are handled by their length in days.</span></li>
  <li><span>Futures are built by bootstrap: the real past moves, standardised for their length, are drawn at random and added up. This keeps the real shape (fat tails) and, for several coins, how they moved together.</span></li>
  <li><span><b>No trend</b> (default) sets the average drift to zero, because a few weeks of history say little about direction. <b>Past trend</b> keeps the average drift that was observed.</span></li>
  <li><span>At least ${MIN_STEPS} recorded price changes over ${MIN_DAYS} days are needed. Your holdings are taken as they are today; nothing is bought, sold, earned or paid, and quote currencies use today's rate.</span></li></ul>
  <h4 class="subh">Limits</h4><p class="hint">Markets have calm and wild periods and sudden jumps that a short history cannot show, so the worst and best cases are a guide, not a limit. A wide picture means unsure, not safe. This is not advice.</p>`, { title: 'How This Is Worked Out', wide: true });

// ---- spending and saving: what each past month looked like and how likely a given month is ----
const monthKey = (d) => String(d).slice(0, 7);
// parts: the same income / spending parts Analytics uses (transfers and card payments are already left out), over all time
export function monthlyTotals(parts, kind) {
  const m = new Map(), now = new Date().toISOString().slice(0, 7);
  for (const p of parts) { if (p.kind !== kind) continue; const k = monthKey(p.t.date); if (k >= now) continue; m.set(k, (m.get(k) || 0) + p.v); }
  return [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
export function spendOddsBlock(parts) {
  const sp = monthlyTotals(parts, 'expense'), inc = monthlyTotals(parts, 'income');
  const spM = new Map(sp), net = inc.filter(([k]) => spM.has(k)).map(([k, v]) => [k, v - spM.get(k)]);
  const block = (title, rows, good) => {
    if (rows.length < 6) return `<h3 class="subh">${title}</h3><p class="hint">Needs at least 6 whole past months (${rows.length} so far).</p>`;
    const vals = rows.map((r) => r[1]), E = empirical(vals, { target: good === 'high' ? null : null });
    const lo = E.min, hi = E.max, mx = Math.max(...E.bins.map((b) => b.p)), W = 320, H = 120, pad = 8, base = H - 20, bw = (W - pad * 2) / E.bins.length;
    const bars = E.bins.map((b, i) => `<rect x="${(pad + i * bw + 0.5).toFixed(1)}" y="${(base - (b.p / mx) * (base - 12)).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${Math.max(0.5, (b.p / mx) * (base - 12)).toFixed(1)}" rx="2" fill="var(--accent)" opacity=".8"><title>${esc(money(b.lo))} to ${esc(money(b.hi))}: ${b.n} month${b.n === 1 ? '' : 's'}</title></rect>`).join('');
    return `<h3 class="subh">${title} <small class="muted gsum">${E.n} past months</small></h3>
      <div class="oddswrap"><svg class="oddsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}: how often each amount happened">${bars}<line x1="${pad}" x2="${W - pad}" y1="${base}" y2="${base}" stroke="var(--rule)"/><text x="${pad}" y="${H - 6}" font-size="9" fill="var(--ink2)">${esc(money(lo))}</text><text x="${W - pad}" y="${H - 6}" text-anchor="end" font-size="9" fill="var(--ink2)">${esc(money(hi))}</text></svg></div>
      <ul class="calfacts">${row('Lowest month', money(E.min), `1 in ${E.n} past months`)}${row('Usually (middle 50%)', `${money(E.p25)} to ${money(E.p75)}`, 'half of past months fell here')}${row('Typical', money(E.median), 'the middle month')}${row('Average', money(E.mean))}${row('Highest month', money(E.max), `1 in ${E.n} past months`)}</ul>
      <p class="hint">In 1 of 10 months it was ${good === 'low' ? 'above' : 'below'} ${money(good === 'low' ? E.p90 : E.p10)}.</p>`;
  };
  return `<div class="oddsblock">${block('Monthly spending', sp, 'low')}${block('Monthly income minus spending', net, 'high')}
    <p class="hint">Each whole past month is treated as one equally likely outcome; nothing else is assumed. The current month is not counted. Amounts are in your home currency.</p></div>`;
}
