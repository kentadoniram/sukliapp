// Probability distributions (16.50). Pure maths, no screen code, so it can be tested on its own.
//
// ASSUMPTIONS (shown to the user in the app as well):
//  1. Prices: the log of a price moves like a random walk. Over a time dt (days) the log return has the same average rate (mu per day) and a spread that grows with the square root of time.
//     This is the standard "geometric Brownian motion" model. Real markets have fatter tails and calm and wild periods, so the ends are only a guide.
//  2. We only know the prices that were recorded (not every day), so each gap between two recorded prices is one observation of length dt days.
//  3. The future is built by BOOTSTRAP: we re-use the standardised moves that really happened (e = (r - mu*dt) / sqrt(dt)), drawn at random with replacement,
//     which keeps the real shape of your coin's ups and downs (including fat tails) and, for several coins at once, keeps them moving together as they really did.
//  4. By default the average trend is set to zero ("no trend"): a few weeks of history say little about the future direction, and a guessed trend would make the picture look more certain than it is.
//     "Past trend" keeps the observed average drift instead.
//  5. Quantities are today's holdings. Nothing is bought, sold, earned or paid in the future. Quote currencies are today's rates.
//  6. Spending and saving: each past month is one equally likely outcome (an empirical distribution), nothing else is assumed. The next month is treated as drawn from the same pattern.
// None of this is a promise or advice. Wide results mean "unsure", not "safe".

export const MIN_STEPS = 8, MIN_DAYS = 14, PATHS = 4000, BINS = 24;
export const Z_CLIP = 5;            // a single standardised move is never allowed to be more than 5 typical moves (a bad price record cannot dominate)
export const DRIFT_CAP = Math.log(2); // 'past trend' may not add more than a doubling or halving over the horizon
export const PATH_CAP = Math.log(20);  // no simulated future is allowed to move more than 20x up or down: beyond that the model is not meaningful

// small seeded random generator (mulberry32): the same data gives the same picture every time
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedOf = (xs) => { let h = 2166136261; for (const x of xs) { h ^= Math.round(x * 1e6) | 0; h = Math.imul(h, 16777619); } return h >>> 0; };

// series: [{ t: days (number), p: price }] for one coin, sorted by time. -> steps [{dt, r}] (log returns between consecutive recorded prices)
// One price per day (the last one recorded that day). Live prices are saved many times a day, minutes apart; dividing such tiny gaps by sqrt(dt)
// blew a small price flicker up into a huge "move per day" (16.50 bug), so the model only ever sees day-to-day changes.
export const daily = (series) => { const m = new Map(); for (const x of series) { if (x && x.p > 0 && Number.isFinite(x.t)) m.set(Math.floor(x.t), { t: Math.floor(x.t), p: x.p }); } return [...m.values()].sort((a, b) => a.t - b.t); };
export function stepsOf(series) {
  const s = daily(series), out = [];
  for (let i = 1; i < s.length; i++) { const dt = s[i].t - s[i - 1].t; if (dt > 0) out.push({ dt, r: [Math.log(s[i].p / s[i - 1].p)] }); }
  return out;
}
// several coins on a shared timeline: forward-fill each price, then one joint step per interval. A coin with no new price in an interval moves 0 there.
export function jointSteps(rawList) {
  const seriesList = rawList.map(daily);
  const times = [...new Set(seriesList.flatMap((l) => l.map((x) => x.t)))].sort((a, b) => a - b), n = seriesList.length;
  const idx = seriesList.map(() => 0), last = seriesList.map(() => null), pts = [];
  for (const t of times) { const row = []; for (let k = 0; k < n; k++) { const l = seriesList[k]; while (idx[k] < l.length && l[idx[k]].t <= t) { last[k] = l[idx[k]].p; idx[k]++; } row.push(last[k]); } pts.push({ t, row }); }
  const out = [];
  for (let i = 1; i < pts.length; i++) { const dt = pts[i].t - pts[i - 1].t; if (dt <= 0) continue; const r = pts[i].row.map((p, k) => (p > 0 && pts[i - 1].row[k] > 0 ? Math.log(p / pts[i - 1].row[k]) : 0)); out.push({ dt, r }); }
  return out;
}
// observed average rate per day for each coin (maximum likelihood for irregular gaps) and daily spread
export function fit(steps) {
  const n = steps[0] ? steps[0].r.length : 0, T = steps.reduce((q, s) => q + s.dt, 0) || 1, mu = [], sd = [];
  for (let k = 0; k < n; k++) { const m = steps.reduce((q, s) => q + s.r[k], 0) / T; mu.push(m); sd.push(Math.sqrt(steps.reduce((q, s) => q + (s.r[k] - m * s.dt) ** 2, 0) / T)); }
  return { mu, sd, days: T, steps: steps.length };
}

// values: today's value per coin (home currency). Returns sorted end values (all coins together) and the start value.
export function simulate(steps, values, horizonDays, { drift = 'none', paths = PATHS, seed = 0 } = {}) {
  const n = values.length, f = fit(steps), start = values.reduce((q, v) => q + v, 0);
  if (!steps.length || !n || !(horizonDays > 0)) return null;
  const avgDt = f.days / steps.length, m = Math.max(1, Math.round(horizonDays / avgDt)), scale = Math.sqrt(horizonDays / m);
  const z = steps.map((s) => s.r.map((r, k) => (r - f.mu[k] * s.dt) / Math.sqrt(s.dt)));       // standardised, trend removed
  for (let k = 0; k < n; k++) { const sdz = Math.sqrt(z.reduce((q, e) => q + e[k] * e[k], 0) / z.length) || 1, lim = Z_CLIP * sdz; for (const e of z) e[k] = Math.max(-lim, Math.min(lim, e[k])); }
  const rand = rng(seed || seedOf([...values, horizonDays, steps.length, f.days])), end = new Float64Array(paths);
  for (let p = 0; p < paths; p++) {
    const acc = new Array(n).fill(0);
    for (let j = 0; j < m; j++) { const e = z[(rand() * z.length) | 0]; for (let k = 0; k < n; k++) acc[k] += e[k] * scale; }
    let v = 0; for (let k = 0; k < n; k++) { const dr = drift === 'past' ? Math.max(-DRIFT_CAP, Math.min(DRIFT_CAP, f.mu[k] * horizonDays)) : 0, lr = Math.max(-PATH_CAP, Math.min(PATH_CAP, acc[k] + dr)); v += values[k] * Math.exp(lr); }
    end[p] = v;
  }
  return { end: Array.from(end).sort((a, b) => a - b), start, fit: f, horizonDays, drift, m };
}
export const q = (sorted, p) => { if (!sorted.length) return 0; const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); };
export const share = (sorted, pred) => (sorted.length ? sorted.filter(pred).length / sorted.length : 0);

// histogram of values (sorted) into equal-width bins; each bin: { lo, hi, n, p }
export function histogram(sorted, bins = BINS, lo = sorted[0], hi = sorted[sorted.length - 1]) {
  if (!sorted.length) return []; if (!(hi > lo)) { hi = lo + 1; }
  const w = (hi - lo) / bins, out = Array.from({ length: bins }, (_, i) => ({ lo: lo + i * w, hi: lo + (i + 1) * w, n: 0, p: 0 }));
  for (const v of sorted) { const i = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w))); out[i].n++; }
  for (const b of out) b.p = b.n / sorted.length; return out;
}
// the picture's numbers for a simulated outcome set. Percent change is against today's value.
export function summarize(sim) {
  const e = sim.end, s0 = sim.start, pc = (v) => (v / s0 - 1) * 100, mean = e.reduce((a, b) => a + b, 0) / e.length;
  const lo = q(e, 0.01), hi = q(e, 0.99);      // the picture is drawn between the 1st and 99th percentile; rarer extremes are stated, not drawn
  return { n: e.length, start: s0, worst: e[0], best: e[e.length - 1], p05: q(e, 0.05), p25: q(e, 0.25), median: q(e, 0.5), p75: q(e, 0.75), p95: q(e, 0.95), mean,
    loss: share(e, (v) => v < s0), loss10: share(e, (v) => v <= s0 * 0.9), gain10: share(e, (v) => v >= s0 * 1.1), halve: share(e, (v) => v <= s0 * 0.5),
    pct: { p05: pc(q(e, 0.05)), median: pc(q(e, 0.5)), p95: pc(q(e, 0.95)), mean: pc(mean), worst: pc(e[0]), best: pc(e[e.length - 1]) },
    bins: histogram(e.filter((v) => v >= lo && v <= hi), BINS, lo, hi), lo, hi };
}
// Sanity check of a finished simulation: finite, and not absurdly wide. Returns '' when fine, else a reason that is shown instead of the numbers.
export function unreasonable(sim) {
  if (!sim || !sim.end.length) return 'The simulation could not be run.';
  const e = sim.end, s0 = sim.start;
  if (!(s0 > 0) || !e.every(Number.isFinite)) return 'The prices recorded for this holding give numbers that cannot be used.';
  const hi = q(e, 0.95) / s0, lo = q(e, 0.05) / s0, days = sim.horizonDays;
  if (hi > 10 || lo < 0.05) return `The recorded prices move so wildly that the spread after ${days} days (${lo.toFixed(2)}x to ${hi.toFixed(1)}x today's value) is not believable. Check the saved prices of this holding for a wrong entry.`;
  return '';
}
// Is there enough history? Returns '' when yes, otherwise a plain-language reason.
export function lacks(steps) {
  const f = steps.length ? fit(steps) : null;
  if (!f || f.steps < MIN_STEPS) return `Only ${f ? f.steps : 0} price changes are recorded (at least ${MIN_STEPS} are needed). Prices are saved each time they update, so this fills in with time.`;
  if (f.days < MIN_DAYS) return `The recorded prices cover only ${Math.round(f.days)} days (at least ${MIN_DAYS} are needed).`;
  return '';
}

// Empirical distribution of a list of past values (for example monthly spending). Every past value is one equally likely outcome.
export function empirical(values, { target = null } = {}) {
  const v = values.filter(Number.isFinite).slice().sort((a, b) => a - b), n = v.length; if (!n) return null;
  const mean = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  return { n, mean, sd, min: v[0], max: v[n - 1], p10: q(v, 0.1), p25: q(v, 0.25), median: q(v, 0.5), p75: q(v, 0.75), p90: q(v, 0.9),
    above: target != null ? share(v, (x) => x > target) : null, target, sorted: v, bins: histogram(v, Math.min(10, Math.max(4, Math.round(Math.sqrt(n) * 1.6)))) };
}
