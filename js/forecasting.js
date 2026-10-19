// Lightweight, local-only monthly forecasting. No external model or network calls.
// Selects among simple methods by rolling-origin backtesting; never assumes a method wins.

const finite = (x) => Number.isFinite(Number(x)) ? Number(x) : 0;
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const FORECAST_METHODS = Object.freeze(['median-3', 'mean-3', 'weighted-3', 'seasonal-naive']);

export function predictWithMethod(values, method) {
  const a = values.map(finite);
  if (!a.length) return 0;
  const last3 = a.slice(-3);
  if (method === 'mean-3') return mean(last3);
  if (method === 'weighted-3') {
    const w = [0.2, 0.3, 0.5].slice(3 - last3.length);
    return last3.reduce((s, x, i) => s + x * w[i], 0) / w.reduce((s, x) => s + x, 0);
  }
  if (method === 'seasonal-naive' && a.length >= 12) return a[a.length - 12];
  return median(last3);
}

export function backtestSeries(input, maxOrigins = 6) {
  const values = input.map(finite);
  const firstOrigin = Math.max(3, values.length - maxOrigins);
  const scores = new Map(FORECAST_METHODS.map((m) => [m, { errors: [], absoluteErrors: [], predictions: [] }]));
  for (let i = firstOrigin; i < values.length; i++) {
    const history = values.slice(0, i), actual = values[i];
    for (const method of FORECAST_METHODS) {
      if (method === 'seasonal-naive' && history.length < 12) continue;
      const predicted = Math.max(0, predictWithMethod(history, method));
      const error = actual - predicted;
      const row = scores.get(method);
      row.errors.push(error);
      row.absoluteErrors.push(Math.abs(error));
      row.predictions.push({ index: i, actual, predicted, error });
    }
  }
  return [...scores.entries()].map(([method, s]) => ({
    method,
    n: s.errors.length,
    mae: s.absoluteErrors.length ? mean(s.absoluteErrors) : null,
    mape: s.predictions.filter((p) => p.actual !== 0).length
      ? mean(s.predictions.filter((p) => p.actual !== 0).map((p) => Math.abs(p.error) / Math.abs(p.actual))) * 100
      : null,
    errors: s.absoluteErrors,
    predictions: s.predictions,
  }));
}

export function forecastSeries(input) {
  const values = input.map(finite);
  if (!values.length) return { value: 0, method: 'median-3', mae: null, lower: null, upper: null, backtestCount: 0, historyCount: 0, dataCoverage: 'insufficient' };
  const tested = backtestSeries(values);
  const candidates = tested.filter((x) => x.n >= 3 && x.mae != null)
    .sort((a, b) => a.mae - b.mae || FORECAST_METHODS.indexOf(a.method) - FORECAST_METHODS.indexOf(b.method));
  // Avoid choosing seasonal-naive based on too few comparable tests.
  const best = candidates[0] || null;
  const method = best ? best.method : (values.length >= 3 ? 'median-3' : 'mean-3');
  const value = Math.max(0, predictWithMethod(values, method));
  const mae = best ? best.mae : null;
  const enoughErrorSamples = !!best && best.n >= 3;
  return {
    value,
    method,
    mae,
    lower: enoughErrorSamples ? Math.max(0, value - mae) : null,
    upper: enoughErrorSamples ? value + mae : null,
    backtestCount: best ? best.n : 0,
    historyCount: values.length,
    dataCoverage: values.length >= 12 ? '12+ months' : values.length >= 6 ? '6–11 months' : 'under 6 months',
    scores: tested.map(({ method: m, n, mae: e, mape }) => ({ method: m, n, mae: e, mape })),
  };
}
