// Small, robust statistics. Pure functions: nothing leaves the device, no AI service.
export const sum = (a) => a.reduce((n, v) => n + v, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : 0);
export const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const mad = (a) => { const m = median(a); return median(a.map((v) => Math.abs(v - m))); };          // spread that one big dinner cannot distort
export const quantile = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
// how far v is from your own usual, in robust "standard deviations". Needs a floor so a perfectly regular history is not infinitely sensitive.
export const robustZ = (v, a, floor = 0.5) => (v - median(a)) / Math.max(1.4826 * mad(a), floor);

// straight-line trend with a plain confidence label, so one bad week is not called a trend
export function trend(series) {
  const n = series.length; if (n < 4) return { conf: 'none', n };
  const xs = series.map((_, i) => i), mx = mean(xs), my = mean(series);
  const sxx = sum(xs.map((x) => (x - mx) ** 2)), slope = sum(xs.map((x, i) => (x - mx) * (series[i] - my))) / sxx;
  const rss = sum(series.map((y, i) => (y - (my + slope * (i - mx))) ** 2)), se = Math.sqrt(rss / (n - 2)) / Math.sqrt(sxx);
  const t = se > 0 ? slope / se : (slope === 0 ? 0 : Math.sign(slope) * 99);
  const conf = Math.abs(t) >= 3.2 && n >= 5 ? 'high' : Math.abs(t) >= 2.2 ? 'medium' : 'low';
  return { slope, t, conf, n, rel: my ? slope / my : 0, dir: slope > 0 ? 'up' : 'down' };
}

// ---- forecasting: simple methods, picked by how well each would have predicted your own past months ----
export const METHODS = {
  mean3: { label: 'average of the last 3 months', f: (h) => mean(h.slice(-3)), need: 2 },
  median3: { label: 'median of the last 3 months', f: (h) => median(h.slice(-3)), need: 2 },
  median6: { label: 'median of the last 6 months', f: (h) => median(h.slice(-6)), need: 4 },
  ewma: { label: 'recent months weighted more', f: (h) => h.reduce((e, v, i) => (i ? 0.5 * v + 0.5 * e : v), 0), need: 3 },
  trend: { label: 'recent trend continued', f: (h) => { const w = h.slice(-6), t = trend(w); return Math.max(0, mean(w) + (t.slope || 0) * (w.length - (w.length - 1) / 2)); }, need: 5 },
  seasonal: { label: 'same month last year, adjusted to your recent level', f: (h) => { const n = h.length, then = mean(h.slice(n - 14, n - 11)), now = mean(h.slice(-3)); return h[n - 12] * Math.min(2, Math.max(0.5, then > 0 ? now / then : 1)); }, need: 14 },
};
export function backtest(series) {
  const out = [];
  for (const [name, m] of Object.entries(METHODS)) {
    const errs = [];
    for (let t = Math.max(3, m.need); t < series.length; t++) errs.push(Math.abs(m.f(series.slice(0, t)) - series[t]));
    if (errs.length >= 3) out.push({ name, label: m.label, mae: mean(errs), p80: quantile(errs, 0.8), n: errs.length });
  }
  return out.sort((a, b) => a.mae - b.mae);
}
// series: monthly totals, oldest first, zero months kept. Returns the forecast, the method and a rough error range.
export function forecastSeries(series) {
  if (series.length < 2) return null;
  const ranked = backtest(series), best = ranked[0];
  const name = best ? best.name : 'median3', m = METHODS[name];
  const value = Math.max(0, m.f(series));
  return { method: name, label: m.label, value, tested: best ? best.n : 0, mae: best ? best.mae : null, low: best ? Math.max(0, value - best.p80) : null, high: best ? value + best.p80 : null, ranked };
}
