// Small, robust statistics. Pure functions: nothing leaves the device, no AI service.
export const sum = (a) => a.reduce((n, v) => n + v, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : 0);
export const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const mad = (a) => { const m = median(a); return median(a.map((v) => Math.abs(v - m))); };          // spread that one big dinner cannot distort
export const quantile = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
// how far v is from your own usual, in robust "standard deviations". Needs a floor so a perfectly regular history is not infinitely sensitive.
export const robustZ = (v, a, floor = 0.5) => (v - median(a)) / Math.max(1.4826 * mad(a), floor);

// Trend: Theil-Sen slope (the median of the slopes between every pair of months, so one huge month cannot tilt it) and a Mann-Kendall test
// (counts how many later months sit above or below earlier ones). z of 1.96 is about 95% sure, 2.58 about 99%.
export function trend(series) {
  const n = series.length; if (n < 4) return { conf: 'none', n };
  const sl = []; let S = 0;
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) { sl.push((series[j] - series[i]) / (j - i)); S += Math.sign(series[j] - series[i]); }
  const slope = median(sl), ties = new Map(); for (const v of series) ties.set(v, (ties.get(v) || 0) + 1);
  const varS = (n * (n - 1) * (2 * n + 5) - [...ties.values()].reduce((t, k) => t + k * (k - 1) * (2 * k + 5), 0)) / 18, sd = Math.sqrt(Math.max(varS, 1e-9));
  const z = S > 0 ? (S - 1) / sd : S < 0 ? (S + 1) / sd : 0, my = mean(series);
  const conf = Math.abs(z) >= 2.58 && n >= 6 ? 'high' : Math.abs(z) >= 1.96 ? 'medium' : 'low';
  return { slope, t: z, z, S, conf, n, rel: my ? slope / my : 0, dir: slope > 0 ? 'up' : 'down', method: 'Theil-Sen + Mann-Kendall' };
}

// A level shift: spending moved to a new normal and stayed there. Looks for a month k where the months from k on sit far from the old level
// (median gap over 3 times the old spread, and at least 40% of the old level), with at least 3 months after it and no more than one of them back near the old level.
export const SHIFT = { minAfter: 3, score: 3, minRel: 0.4 };
export function levelShift(series) {
  const n = series.length; let best = null;
  for (let k = 3; k <= n - SHIFT.minAfter; k++) {
    const a = series.slice(0, k), b = series.slice(k), ma = median(a), mb = median(b);
    const spread = Math.max(1.4826 * mad(a), 0.2 * Math.abs(ma), 1), score = Math.abs(mb - ma) / spread, mid = (ma + mb) / 2, side = Math.sign(mb - ma);
    const far = b.filter((v) => Math.sign(v - mid) === side).length;
    if (!(score >= SHIFT.score && Math.abs(mb - ma) >= SHIFT.minRel * Math.max(Math.abs(ma), 1) && far >= b.length - 1)) continue;
    let at = k; while (at < n && Math.sign(series[at] - mid) !== side) at++;      // the break is the first month actually on the new side
    if (n - at >= SHIFT.minAfter && (!best || score > best.score)) best = { at, from: ma, to: mb, score, spread };
  }
  return best;
}

// ---- forecasting: simple methods, picked by how well each would have predicted your own past months ----
export const METHODS = {
  mean3: { label: 'average of the last 3 months', f: (h) => mean(h.slice(-3)), need: 2 },
  median3: { label: 'median of the last 3 months', f: (h) => median(h.slice(-3)), need: 2 },
  median6: { label: 'median of the last 6 months', f: (h) => median(h.slice(-6)), need: 4 },
  ewma: { label: 'recent months weighted more', f: (h) => h.reduce((e, v, i) => (i ? 0.5 * v + 0.5 * e : v), 0), need: 3 },
  trend: { label: 'recent trend continued', f: (h) => { const w = h.slice(-6), t = trend(w), sl = t.slope || 0, b0 = median(w.map((v, i) => v - sl * i)); return Math.max(0, b0 + sl * w.length); }, need: 5 },
  fixvar: { label: 'fixed bills plus the usual variable spending', f: (h, aux) => { const n = h.length, a = aux.slice(0, n); return Math.max(0, median(a.slice(-3)) + median(h.map((v, i) => v - a[i]).slice(-3))); }, need: 4, aux: true },
  seasonal: { label: 'same month last year, adjusted to your recent level', f: (h) => { const n = h.length, then = mean(h.slice(n - 14, n - 11)), now = mean(h.slice(-3)); return h[n - 12] * Math.min(2, Math.max(0.5, then > 0 ? now / then : 1)); }, need: 14 },
};
export function backtest(series, aux = null) {
  const out = [];
  for (const [name, m] of Object.entries(METHODS)) {
    if (m.aux && !aux) continue;
    const errs = [];
    for (let t = Math.max(3, m.need); t < series.length; t++) errs.push(Math.abs(m.f(series.slice(0, t), aux) - series[t]));
    if (errs.length >= 3) out.push({ name, label: m.label, mae: mean(errs), p80: quantile(errs, 0.8), n: errs.length });
  }
  return out.sort((a, b) => a.mae - b.mae);
}
// Safer choice: the plain median of the last 3 months unless another method has proved itself. It must have at least 6 tests AND an average miss at least 10% smaller.
export const CHOOSE = { minTests: 6, margin: 0.9, fallback: 'median3' };
export function chooseMethod(series, aux = null) {
  const ranked = backtest(series, aux), best = ranked[0], base = ranked.find((r) => r.name === CHOOSE.fallback);
  if (!best) return { name: CHOOSE.fallback, ranked, why: 'Fewer than 3 months could be tested, so the plain median of the last 3 months is used.', tests: 0, best: null, base: null };
  if (best.name === CHOOSE.fallback) return { name: CHOOSE.fallback, ranked, why: 'The plain median was also the best method on your own months.', tests: best.n, best, base };
  if (best.n < CHOOSE.minTests) return { name: CHOOSE.fallback, ranked, why: `${best.label} did best, but only ${best.n} tests (needs ${CHOOSE.minTests}), so the plain median is used.`, tests: best.n, best, base };
  if (base && best.mae >= CHOOSE.margin * base.mae) return { name: CHOOSE.fallback, ranked, why: `${best.label} was only ${Math.round((1 - best.mae / base.mae) * 100)}% closer than the median (needs 10%), so the plain median is used.`, tests: best.n, best, base };
  return { name: best.name, ranked, why: `${best.label} beat the plain 3-month median by ${base ? Math.round((1 - best.mae / base.mae) * 100) : 0}% over ${best.n} tests.`, tests: best.n, best, base };
}
// Honest range: the real misses of this method on your own past months, as ratios (so a big month can miss by more money than a small one),
// the 10th and 90th percentile of them, widened when there are few tests. Under 4 tests it is a plain +/-40% and says so.
export const RANGE = { lo: 0.1, hi: 0.9, minTests: 4, fallbackPct: 0.4, floor: 0.15, widen: 3 };
export function rangeFor(series, predict, value) {
  const K = 0.1 * mean(series) + 1, errs = [];
  for (let t = 3; t < series.length; t++) errs.push(Math.log((series[t] + K) / (Math.max(0, predict(series.slice(0, t))) + K)));
  if (errs.length < RANGE.minTests) return { low: Math.max(0, value * (1 - RANGE.fallbackPct)), high: value * (1 + RANGE.fallbackPct), n: errs.length, basis: 'default', q10: null, q90: null, widen: null, coverage: null };
  const w = 1 + RANGE.widen / errs.length, q10 = Math.min(quantile(errs, RANGE.lo) * w, -RANGE.floor), q90 = Math.max(quantile(errs, RANGE.hi) * w, RANGE.floor);
  const cover = errs.filter((e) => e >= q10 && e <= q90).length / errs.length;
  return { low: Math.max(0, (value + K) * Math.exp(q10) - K), high: (value + K) * Math.exp(q90) - K, n: errs.length, basis: 'tested', q10, q90, widen: w, coverage: cover };
}
// series: monthly totals, oldest first, zero months kept. aux (optional): the fixed bills inside each month. A level shift restarts the history.
export function forecastSeries(series, aux = null) {
  if (series.length < 2) return null;
  const shift = levelShift(series), from = shift ? shift.at : 0, s = series.slice(from), a = aux ? aux.slice(from) : null;
  const pick = chooseMethod(s, a), m = METHODS[pick.name], value = Math.max(0, m.f(s, a)), rg = rangeFor(s, (h) => m.f(h, a), value);
  return { method: pick.name, label: m.label, value, tested: pick.tests, mae: ((pick.ranked.find((r) => r.name === pick.name)) || {}).mae ?? null, low: rg.low, high: rg.high, range: rg, ranked: pick.ranked, why: pick.why, shift, usedFrom: from, used: s.length };
}
