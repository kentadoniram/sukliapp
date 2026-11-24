// Statistics and machine-learning kit (v16.29). Pure functions, no DOM, no network, no randomness except a seeded generator,
// so the same data always gives the same answer. Everything here is written for small personal data (tens to a few thousand rows).
// Sections: 1 linear algebra  2 correlation and regression  3 forecasting  4 clustering  5 anomaly detection  6 simulation.

// ---------------------------------------------------------------- 0. helpers
export const mulberry = (seed = 7) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : 0);
export const variance = (a, ddof = 1) => { if (a.length <= ddof) return 0; const m = mean(a); return sum(a.map((x) => (x - m) ** 2)) / (a.length - ddof); };
export const sd = (a, ddof = 1) => Math.sqrt(variance(a, ddof));
export const quantile = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), p = (s.length - 1) * q, i = Math.floor(p); return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (p - i); };
export const median = (a) => quantile(a, 0.5);
const norm = (a) => Math.sqrt(sum(a.map((x) => x * x)));
const dist = (a, b) => Math.sqrt(sum(a.map((x, i) => (x - b[i]) ** 2)));
const gauss01 = (rand) => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// ---------------------------------------------------------------- 1. linear algebra
// Solve A x = b for a symmetric positive-definite A (Cholesky); falls back to a tiny ridge when A is singular.
export function solveSPD(A, b) {
  const n = A.length;
  for (let jitter = 0, tries = 0; tries < 6; tries++, jitter = jitter ? jitter * 100 : 1e-10) {
    const L = Array.from({ length: n }, () => new Array(n).fill(0)); let ok = true;
    for (let i = 0; i < n && ok; i++) for (let j = 0; j <= i; j++) {
      let s = A[i][j] + (i === j ? jitter : 0); for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { if (s <= 1e-14) { ok = false; break; } L[i][j] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
    }
    if (!ok) continue;
    const y = new Array(n).fill(0), x = new Array(n).fill(0);
    for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
    return x;
  }
  return new Array(n).fill(0);
}
const inverseSPD = (A) => { const n = A.length; const cols = []; for (let j = 0; j < n; j++) cols.push(solveSPD(A, Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)))); return Array.from({ length: n }, (_, i) => cols.map((c) => c[i])); };
const addOnes = (X) => X.map((r) => [1, ...r]);
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// ---------------------------------------------------------------- 2. correlation and regression
// Regularised incomplete beta (continued fraction) -> Student t two-sided p-value. Used for Pearson and for regression coefficients.
function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
const ibeta = (x, a, b) => { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; };
export const tTwoSidedP = (t, df) => (df > 0 ? ibeta(df / (df + t * t), df / 2, 0.5) : 1);

// Pearson's r = cov(x, y) / (sd(x) sd(y)); t = r sqrt((n-2)/(1-r^2)); 95% interval by the Fisher z transform.
export function pearson(x, y) {
  const n = Math.min(x.length, y.length); if (n < 3) return { r: 0, n, t: 0, p: 1, lo: -1, hi: 1 };
  const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n)); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  if (!sxx || !syy) return { r: 0, n, t: 0, p: 1, lo: -1, hi: 1 };
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy))), t = Math.abs(r) === 1 ? Infinity : r * Math.sqrt((n - 2) / (1 - r * r)), p = Math.abs(r) === 1 ? 0 : tTwoSidedP(t, n - 2);
  let lo = -1, hi = 1; if (n > 3 && Math.abs(r) < 1) { const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3); lo = Math.tanh(z - 1.96 * se); hi = Math.tanh(z + 1.96 * se); }
  return { r, n, t, p, lo, hi };
}

// Ordinary least squares: beta = (X'X)^-1 X'y. Covers simple linear regression (one column) and multiple linear regression (many columns).
// Returns coefficients (intercept first when `intercept`), R^2, adjusted R^2, RMSE, standard errors and p-values, residuals.
export function ols(X, y, { intercept = true } = {}) {
  const n = y.length, A = intercept ? addOnes(X) : X, k = A[0] ? A[0].length : 0;
  const XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => { let s = 0; for (let r = 0; r < n; r++) s += A[r][i] * A[r][j]; return s; }));
  const Xty = Array.from({ length: k }, (_, i) => { let s = 0; for (let r = 0; r < n; r++) s += A[r][i] * y[r]; return s; });
  const beta = solveSPD(XtX, Xty), fit = A.map((r) => dot(r, beta)), res = y.map((v, i) => v - fit[i]);
  const sse = sum(res.map((e) => e * e)), my = mean(y), sst = sum(y.map((v) => (v - my) ** 2)), df = n - k;
  const r2 = sst > 0 ? 1 - sse / sst : 0, adj = df > 0 && sst > 0 ? 1 - (1 - r2) * (n - (intercept ? 1 : 0)) / df : r2, s2 = df > 0 ? sse / df : 0;
  let se = new Array(k).fill(NaN), p = new Array(k).fill(NaN);
  if (df > 0) { const inv = inverseSPD(XtX); se = inv.map((row, i) => Math.sqrt(Math.max(0, row[i] * s2))); p = beta.map((b, i) => (se[i] > 0 ? tTwoSidedP(b / se[i], df) : 1)); }
  return { beta, intercept, fit, res, sse, r2, adjR2: adj, rmse: Math.sqrt(sse / Math.max(1, n)), se, p, df, n, predict: (x) => dot(intercept ? [1, ...x] : x, beta) };
}
export const linearFit = (x, y) => ols(x.map((v) => [v]), y);

// Polynomial regression of degree d on a standardised x (keeps the matrix well conditioned). Degree can be chosen by leave-one-out error.
export function polyFit(x, y, deg = 2) {
  const mx = mean(x), s = sd(x) || 1, z = x.map((v) => (v - mx) / s), X = z.map((v) => Array.from({ length: deg }, (_, k) => v ** (k + 1))), m = ols(X, y);
  return { ...m, deg, mx, s, predict: (v) => { const t = (v - mx) / s; return m.predict(Array.from({ length: deg }, (_, k) => t ** (k + 1))); } };
}
// leave-one-out error without refitting: e_i / (1 - h_ii), h = diag of the hat matrix
function looError(X, y, lambda = 0) {
  const A = addOnes(X), k = A[0].length, XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => sum(A.map((r) => r[i] * r[j])) + (i && i === j ? lambda : 0)));
  const inv = inverseSPD(XtX), b = solveSPD(XtX, Array.from({ length: k }, (_, i) => sum(A.map((r, rr) => r[i] * y[rr]))));
  let s = 0; for (let i = 0; i < y.length; i++) { const h = dot(A[i], inv.map((row) => dot(row, A[i]))), e = (y[i] - dot(A[i], b)) / Math.max(1e-9, 1 - h); s += e * e; } return Math.sqrt(s / y.length);
}
export function polyAuto(x, y, maxDeg = 4) {
  const mx = mean(x), s = sd(x) || 1, z = x.map((v) => (v - mx) / s); let best = null;
  for (let d = 1; d <= Math.min(maxDeg, y.length - 3); d++) { const e = looError(z.map((v) => Array.from({ length: d }, (_, k) => v ** (k + 1))), y); if (!best || e < best.loo * 0.98) best = { deg: d, loo: e }; }
  return best ? { ...polyFit(x, y, best.deg), loo: best.loo } : polyFit(x, y, 1);
}

// Ridge regression: minimise |y - Xb|^2 + lambda |b|^2 (intercept not penalised, columns standardised first).
// Lasso: the same with lambda |b|_1, solved by coordinate descent with soft-thresholding, so weak columns become exactly 0.
function standardise(X) { const k = X[0].length, mu = Array.from({ length: k }, (_, j) => mean(X.map((r) => r[j]))), sg = Array.from({ length: k }, (_, j) => sd(X.map((r) => r[j]), 0) || 1); return { Z: X.map((r) => r.map((v, j) => (v - mu[j]) / sg[j])), mu, sg }; }
export function ridge(X, y, lambda = 1) {
  const { Z, mu, sg } = standardise(X), n = y.length, my = mean(y), k = Z[0].length, yc = y.map((v) => v - my);
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => sum(Z.map((r) => r[i] * r[j])) + (i === j ? lambda : 0))), b = Array.from({ length: k }, (_, i) => sum(Z.map((r, rr) => r[i] * yc[rr])));
  return packLinear(solveSPD(A, b), mu, sg, my, X, y, n);
}
export function lasso(X, y, lambda = 0.1, iters = 500) {
  const { Z, mu, sg } = standardise(X), n = y.length, my = mean(y), k = Z[0].length, yc = y.map((v) => v - my), w = new Array(k).fill(0), res = [...yc], col = Array.from({ length: k }, (_, j) => sum(Z.map((r) => r[j] * r[j])) / n);
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let j = 0; j < k; j++) {
      if (!col[j]) continue; let rho = 0; for (let i = 0; i < n; i++) rho += Z[i][j] * (res[i] + Z[i][j] * w[j]); rho /= n;
      const nw = Math.sign(rho) * Math.max(0, Math.abs(rho) - lambda) / col[j]; if (nw !== w[j]) { const d = nw - w[j]; for (let i = 0; i < n; i++) res[i] -= Z[i][j] * d; moved = Math.max(moved, Math.abs(d)); w[j] = nw; }
    }
    if (moved < 1e-9) break;
  }
  return packLinear(w, mu, sg, my, X, y, n);
}
function packLinear(w, mu, sg, my, X, y, n) {
  const coef = w.map((v, j) => v / sg[j]), b0 = my - sum(coef.map((c, j) => c * mu[j])), predict = (x) => b0 + dot(coef, x), fit = X.map(predict), sse = sum(y.map((v, i) => (v - fit[i]) ** 2)), sst = sum(y.map((v) => (v - my) ** 2));
  return { intercept: b0, coef, std: w, predict, fit, r2: sst > 0 ? 1 - sse / sst : 0, rmse: Math.sqrt(sse / n), kept: w.map((v, j) => (Math.abs(v) > 1e-9 ? j : -1)).filter((j) => j >= 0) };
}
// k-fold cross-validated choice of lambda for ridge or lasso (smallest error; ties go to the larger lambda = simpler model)
export function cvLambda(X, y, kind = 'ridge', grid = null, folds = 5) {
  const n = y.length, f = Math.min(folds, n), g = grid || (kind === 'ridge' ? [0.01, 0.1, 1, 3, 10, 30, 100] : [0.001, 0.01, 0.03, 0.1, 0.3, 1]), fit = kind === 'ridge' ? ridge : lasso; let best = null;
  for (const lam of g) { let e = 0; for (let k = 0; k < f; k++) { const tr = [], te = []; for (let i = 0; i < n; i++) (i % f === k ? te : tr).push(i); if (tr.length < 3 || !te.length) continue; const m = fit(tr.map((i) => X[i]), tr.map((i) => y[i]), lam); e += sum(te.map((i) => (y[i] - m.predict(X[i])) ** 2)); } if (!best || e <= best.e * 1.0000001) best = { lam, e }; }
  return { lambda: best.lam, cvRmse: Math.sqrt(best.e / n) };
}

// Logistic regression: P(y = 1) = 1 / (1 + e^-(b0 + b.x)), fitted by Newton-Raphson (IRLS) with a small L2 penalty so it always converges.
export function logistic(X, y, { l2 = 1e-3, iters = 60 } = {}) {
  const n = y.length, A = addOnes(X), k = A[0].length, b = new Array(k).fill(0), sig = (z) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));
  for (let it = 0; it < iters; it++) {
    const p = A.map((r) => sig(dot(r, b))), g = new Array(k).fill(0), H = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let i = 0; i < n; i++) { const w = Math.max(1e-6, p[i] * (1 - p[i])); for (let a = 0; a < k; a++) { g[a] += A[i][a] * (y[i] - p[i]); for (let c = 0; c < k; c++) H[a][c] += w * A[i][a] * A[i][c]; } }
    for (let a = 1; a < k; a++) { g[a] -= l2 * b[a]; H[a][a] += l2; } H[0][0] += 1e-9;
    const step = solveSPD(H, g); let big = 0; for (let a = 0; a < k; a++) { b[a] += step[a]; big = Math.max(big, Math.abs(step[a])); } if (big < 1e-8) break;
  }
  const prob = (x) => sig(dot([1, ...x], b)), pr = X.map(prob), ll = -sum(y.map((v, i) => v * Math.log(Math.max(1e-12, pr[i])) + (1 - v) * Math.log(Math.max(1e-12, 1 - pr[i])))) / n;
  return { beta: b, prob, logLoss: ll, accuracy: sum(y.map((v, i) => ((pr[i] >= 0.5 ? 1 : 0) === v ? 1 : 0))) / n, auc: auc(pr, y), oddsRatios: b.slice(1).map(Math.exp) };
}
// area under the ROC curve = chance that a random 1 scores above a random 0 (ties count half)
export function auc(score, y) { let w = 0, tot = 0; for (let i = 0; i < y.length; i++) if (y[i] === 1) for (let j = 0; j < y.length; j++) if (y[j] === 0) { tot++; w += score[i] > score[j] ? 1 : score[i] === score[j] ? 0.5 : 0; } return tot ? w / tot : 0.5; }

// ---------------------------------------------------------------- 3. forecasting
// Nelder-Mead simplex minimiser (derivative free); `bounds` clamp each parameter.
export function nelderMead(f, x0, { step = 0.1, iters = 300, tol = 1e-10, bounds = null } = {}) {
  const n = x0.length, clamp = (x) => (bounds ? x.map((v, i) => Math.min(bounds[i][1], Math.max(bounds[i][0], v))) : x);
  let S = [clamp(x0)]; for (let i = 0; i < n; i++) { const p = [...x0]; p[i] += step * (Math.abs(p[i]) > 1e-3 ? Math.abs(p[i]) : 1); S.push(clamp(p)); }
  let F = S.map(f);
  for (let it = 0; it < iters; it++) {
    const idx = F.map((_, i) => i).sort((a, b) => F[a] - F[b]); S = idx.map((i) => S[i]); F = idx.map((i) => F[i]);
    if (Math.abs(F[n] - F[0]) < tol * (1 + Math.abs(F[0]))) break;
    const c = S[0].map((_, j) => sum(S.slice(0, n).map((p) => p[j])) / n), at = (t) => clamp(c.map((v, j) => v + t * (S[n][j] - v))), r = at(-1), fr = f(r);
    if (fr < F[0]) { const e = at(-2), fe = f(e); if (fe < fr) { S[n] = e; F[n] = fe; } else { S[n] = r; F[n] = fr; } }
    else if (fr < F[n - 1]) { S[n] = r; F[n] = fr; }
    else { const k = at(fr < F[n] ? -0.5 : 0.5), fk = f(k); if (fk < Math.min(fr, F[n])) { S[n] = k; F[n] = fk; } else for (let i = 1; i <= n; i++) { S[i] = clamp(S[i].map((v, j) => S[0][j] + 0.5 * (v - S[0][j]))); F[i] = f(S[i]); } }
  }
  const b = F.indexOf(Math.min(...F)); return { x: S[b], f: F[b] };
}

// Holt-Winters (triple exponential smoothing), additive. level l, trend b, season s (period m).
//   l_t = a (y_t - s_(t-m)) + (1-a)(l_(t-1) + phi b_(t-1))   b_t = B (l_t - l_(t-1)) + (1-B) phi b_(t-1)   s_t = g (y_t - l_t) + (1-g) s_(t-m)
//   forecast(h) = l + (phi + ... + phi^h) b + s_(t+h-m)       a, B, g, phi are found by minimising the one-step squared error.
// With m = 0 (or fewer than 2 seasons of data) the seasonal part is dropped and it is Holt's damped-trend method.
export function holtWinters(y, m = 12, { h = 1 } = {}) {
  const n = y.length, seasonal = m > 1 && n >= 2 * m;
  if (n < 4) return { ok: false, reason: 'needs at least 4 points' };
  const init = () => {
    if (!seasonal) return { l: y[0], b: (y[Math.min(n - 1, 3)] - y[0]) / Math.min(n - 1, 3), s: [] };
    const m1 = mean(y.slice(0, m)), m2 = mean(y.slice(m, 2 * m)), b0 = (m2 - m1) / m, mid = (m - 1) / 2; return { l: m1 + b0 * mid, b: b0, s: y.slice(0, m).map((v, i) => v - (m1 + b0 * (i - mid))) };
  };
  const run = (a, B, g, phi) => {
    const st = init(); let l = st.l, b = st.b; const s = [...st.s]; let sse = 0, cnt = 0; const start = seasonal ? m : 1;
    for (let t = start; t < n; t++) {
      const sT = seasonal ? s[t % m] : 0, pred = l + phi * b + sT; if (t >= start) { sse += (y[t] - pred) ** 2; cnt++; }
      const nl = a * (y[t] - sT) + (1 - a) * (l + phi * b), nb = B * (nl - l) + (1 - B) * phi * b; if (seasonal) s[t % m] = g * (y[t] - nl) + (1 - g) * sT; l = nl; b = nb;
    }
    return { sse, cnt, l, b, s };
  };
  const bnds = [[0.01, 0.99], [0.001, 0.5], [0.001, 0.99], [0.8, 1]];
  const best = nelderMead((p) => run(p[0], p[1], seasonal ? p[2] : 0, p[3]).sse, [0.4, 0.05, 0.2, 1], { bounds: bnds, iters: 400 }), [a, B, g, phi] = best.x, r = run(a, B, seasonal ? g : 0, phi);
  const forecast = []; let damp = 0; for (let k = 1; k <= h; k++) { damp += phi ** k; forecast.push(r.l + damp * r.b + (seasonal ? r.s[(n + k - 1) % m] : 0)); }
  return { ok: true, seasonal, alpha: a, beta: B, gamma: seasonal ? g : 0, phi, forecast, rmse: Math.sqrt(r.sse / Math.max(1, r.cnt)), aic: r.cnt * Math.log(Math.max(1e-12, r.sse / r.cnt)) + 2 * (seasonal ? 4 + m : 4) };
}

// ARIMA(p,d,q) and SARIMA(p,d,q)(P,D,Q)m by conditional sum of squares: difference d (and D seasonal) times, then fit
//   (1 - sum phi_i B^i)(1 - sum Phi_j B^jm) w_t = c + (1 + sum theta_i B^i)(1 + sum Theta_j B^jm) e_t
// by minimising the sum of squared one-step errors over all parameters (Nelder-Mead; AR-only models start from the least-squares answer).
const polyMul = (a, b) => { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return r; };
const diffOnce = (y, lag) => y.slice(lag).map((v, i) => v - y[i]);
export function sarima(y, { p = 1, d = 0, q = 0, P = 0, D = 0, Q = 0, m = 12, h = 1 } = {}) {
  let w = [...y]; const keep = [];
  for (let i = 0; i < D; i++) { keep.push({ lag: m, tail: w.slice(-m) }); w = diffOnce(w, m); }
  for (let i = 0; i < d; i++) { keep.push({ lag: 1, tail: w.slice(-1) }); w = diffOnce(w, 1); }
  const need = Math.max(p + P * m, q + Q * m) + 3; if (w.length < need + 2) return { ok: false, reason: 'not enough points for this order' };
  const mu = mean(w), x = w.map((v) => v - mu), k = p + q + P + Q;
  const polys = (th) => { const ph = th.slice(0, p), th2 = th.slice(p, p + q), PH = th.slice(p + q, p + q + P), TH = th.slice(p + q + P);
    const arp = polyMul([1, ...ph.map((v) => -v)], (() => { const a = new Array(P * m + 1).fill(0); a[0] = 1; PH.forEach((v, j) => { a[(j + 1) * m] = -v; }); return a; })());
    const map = polyMul([1, ...th2], (() => { const a = new Array(Q * m + 1).fill(0); a[0] = 1; TH.forEach((v, j) => { a[(j + 1) * m] = v; }); return a; })());
    return { ar: arp.slice(1).map((v) => -v), ma: map.slice(1) }; };
  const errs = (th) => { const { ar, ma } = polys(th), e = new Array(x.length).fill(0), start = ar.length; let s = 0;
    for (let t = start; t < x.length; t++) { let pr = 0; for (let i = 0; i < ar.length; i++) pr += ar[i] * x[t - 1 - i]; for (let i = 0; i < ma.length; i++) if (t - 1 - i >= start) pr += ma[i] * e[t - 1 - i]; e[t] = x[t] - pr; s += e[t] * e[t]; if (!isFinite(s)) return { e, s: 1e30 }; }
    return { e, s, start }; };
  let th0 = new Array(k).fill(0);
  if (k && !q && !Q && !P) { const rows = [], tg = []; for (let t = p; t < x.length; t++) { rows.push(Array.from({ length: p }, (_, i) => x[t - 1 - i])); tg.push(x[t]); } th0 = ols(rows, tg, { intercept: false }).beta; }
  const fit = k ? nelderMead((th) => errs(th).s, th0, { step: 0.2, bounds: new Array(k).fill([-0.98, 0.98]), iters: 400 }) : { x: [], f: errs([]).s };
  const { e, start } = errs(fit.x), nobs = x.length - start, sigma2 = fit.f / Math.max(1, nobs), { ar, ma } = polys(fit.x);
  // forecast the differenced series, then undo the differencing
  const xs = [...x], es = [...e]; const fw = [];
  for (let s = 0; s < h; s++) { const t = xs.length; let pr = 0; for (let i = 0; i < ar.length; i++) pr += ar[i] * xs[t - 1 - i]; for (let i = 0; i < ma.length; i++) pr += ma[i] * (es[t - 1 - i] || 0); xs.push(pr); es.push(0); fw.push(pr + mu); }
  let out = fw; // integrate: reverse the order the differences were taken
  for (let i = keep.length - 1; i >= 0; i--) { const { lag, tail } = keep[i], base = [...tail], res = []; for (let s = 0; s < out.length; s++) { const v = out[s] + base[s]; base.push(v); res.push(v); } out = res; }
  const aic = nobs * Math.log(Math.max(1e-12, sigma2)) + 2 * (k + 1), aicc = nobs - k - 2 > 0 ? aic + 2 * (k + 1) * (k + 2) / (nobs - k - 2) : aic;
  return { ok: true, order: [p, d, q], seasonal: [P, D, Q, m], params: fit.x, forecast: out, sigma: Math.sqrt(sigma2), aic, aicc, nobs, residuals: e.slice(start) };
}
// automatic order search over a small grid by AICc (the usual rule); seasonal orders only when there are 3+ seasons of data
export function autoSarima(y, { m = 12, h = 1, seasonal = true } = {}) {
  const useS = seasonal && m > 1 && y.length >= 3 * m, dd = y.length > 12 && sd(diffOnce(y, 1)) < sd(y) * 0.9 ? 1 : 0; let best = null;
  const grid = []; for (const p of [0, 1, 2]) for (const q of [0, 1, 2]) { grid.push({ p, d: dd, q, P: 0, D: 0, Q: 0 }); if (useS) for (const P of [0, 1]) for (const Q of [0, 1]) if (P || Q) grid.push({ p, d: dd, q, P, D: 0, Q }); }
  for (const g of grid) { const r = sarima(y, { ...g, m, h }); if (r.ok && isFinite(r.aicc) && (!best || r.aicc < best.aicc - 1e-9)) best = r; }
  return best || { ok: false, reason: 'no order could be fitted' };
}

// Prophet-style additive model (NOT Facebook Prophet itself): y(t) = trend(t) + yearly seasonality(t) + noise.
// trend = a line with a few slope changes (changepoints, each change shrunk by a ridge penalty); seasonality = Fourier terms sin/cos(2 pi k t / period).
// Facebook's Prophet fits a similar form with Stan; this version solves the same shape by regularised least squares so it runs offline.
export function prophetLike(y, { period = 12, fourier = 3, changepoints = 4, ridgeCp = 3, h = 1 } = {}) {
  const n = y.length; if (n < 6) return { ok: false, reason: 'needs at least 6 points' };
  const K = n >= 2 * period ? fourier : 0, cps = Array.from({ length: Math.min(changepoints, Math.max(0, n - 6)) }, (_, i) => Math.round((i + 1) * 0.8 * n / (changepoints + 1)));
  const feat = (t) => { const r = [t / n]; for (const c of cps) r.push(Math.max(0, t - c) / n); for (let k = 1; k <= K; k++) r.push(Math.sin(2 * Math.PI * k * t / period), Math.cos(2 * Math.PI * k * t / period)); return r; };
  const X = y.map((_, t) => feat(t)), pen = X[0].map((_, j) => (j >= 1 && j <= cps.length ? ridgeCp : 0.01));
  const k = X[0].length, A = Array.from({ length: k + 1 }, (_, i) => Array.from({ length: k + 1 }, (_, j) => { let s = 0; for (let r = 0; r < n; r++) s += (i ? X[r][i - 1] : 1) * (j ? X[r][j - 1] : 1); return s + (i && i === j ? pen[i - 1] * n : 0); })), b = Array.from({ length: k + 1 }, (_, i) => { let s = 0; for (let r = 0; r < n; r++) s += (i ? X[r][i - 1] : 1) * y[r]; return s; }), beta = solveSPD(A, b);
  const pred = (t) => beta[0] + dot(feat(t), beta.slice(1)), fit = y.map((_, t) => pred(t)), rmse = Math.sqrt(mean(y.map((v, t) => (v - fit[t]) ** 2)));
  return { ok: true, forecast: Array.from({ length: h }, (_, i) => pred(n + i)), fit, rmse, seasonal: K > 0, changepoints: cps, trendPerPeriod: beta[1] / n };
}

// Vector autoregression VAR(p): every series is regressed on the last p values of ALL series (one OLS per series). Lag chosen by BIC.
export function varFit(Y, { p = 1, h = 1 } = {}) {
  const n = Y.length, k = Y[0].length, rows = [], T = []; if (n - p < k * p + 5) return { ok: false, reason: 'needs more rows than parameters' };
  for (let t = p; t < n; t++) { const r = []; for (let l = 1; l <= p; l++) r.push(...Y[t - l]); rows.push(r); T.push(Y[t]); }
  const eq = Array.from({ length: k }, (_, j) => ols(rows, T.map((r) => r[j]))), nobs = rows.length;
  const sse = eq.map((e) => e.sse), logdet = sum(sse.map((s) => Math.log(Math.max(1e-12, s / nobs)))), params = k * (k * p + 1), bic = nobs * logdet + params * Math.log(nobs), aic = nobs * logdet + 2 * params;
  const hist = Y.map((r) => [...r]), out = []; for (let s = 0; s < h; s++) { const x = []; for (let l = 1; l <= p; l++) x.push(...hist[hist.length - l]); const nxt = eq.map((e) => e.predict(x)); hist.push(nxt); out.push(nxt); }
  return { ok: true, p, k, forecast: out, bic, aic, r2: eq.map((e) => e.r2), coef: eq.map((e) => e.beta), nobs };
}
export function autoVar(Y, { maxP = 3, h = 1 } = {}) { let best = null; for (let p = 1; p <= maxP; p++) { const r = varFit(Y, { p, h }); if (r.ok && (!best || r.bic < best.bic)) best = r; } return best || { ok: false, reason: 'not enough rows' }; }

// Rolling-origin test of any one-step forecaster: forecast month t from months before t, for the last `tests` months. Returns MAE and MAPE-like error.
export function backtestFn(y, fn, { tests = 6, minTrain = 6 } = {}) {
  const errs = [], apes = []; for (let t = Math.max(minTrain, y.length - tests); t < y.length; t++) { let f; try { f = fn(y.slice(0, t)); } catch { f = null; } if (f == null || !isFinite(f)) continue; errs.push(Math.abs(f - y[t])); apes.push(Math.abs(f - y[t]) / Math.max(1, Math.abs(y[t]))); }
  return { n: errs.length, mae: errs.length ? mean(errs) : NaN, mape: apes.length ? mean(apes) : NaN };
}

// ---------------------------------------------------------------- 4. clustering
export function zscoreColumns(P) { const k = P[0].length, mu = Array.from({ length: k }, (_, j) => mean(P.map((r) => r[j]))), sg = Array.from({ length: k }, (_, j) => sd(P.map((r) => r[j]), 0) || 1); return { Z: P.map((r) => r.map((v, j) => (v - mu[j]) / sg[j])), mu, sg }; }
// Silhouette: for each point a = mean distance inside its cluster, b = mean distance to the nearest other cluster, s = (b - a) / max(a, b). Mean over points (noise label -1 skipped).
export function silhouette(P, lab) {
  const ids = [...new Set(lab)].filter((c) => c >= 0); if (ids.length < 2) return 0; const s = [];
  for (let i = 0; i < P.length; i++) { if (lab[i] < 0) continue; const own = []; const oth = new Map(); for (let j = 0; j < P.length; j++) { if (i === j || lab[j] < 0) continue; const d = dist(P[i], P[j]); if (lab[j] === lab[i]) own.push(d); else { if (!oth.has(lab[j])) oth.set(lab[j], []); oth.get(lab[j]).push(d); } } if (!own.length || !oth.size) continue; const a = mean(own), b = Math.min(...[...oth.values()].map(mean)); s.push((b - a) / Math.max(a, b, 1e-12)); }
  return s.length ? mean(s) : 0;
}
// K-means with k-means++ seeding and several restarts: minimise the sum of squared distances to the cluster centre.
export function kmeans(P, k, { seed = 7, restarts = 8, iters = 100 } = {}) {
  const n = P.length; if (n < k) return null; let best = null;
  for (let r = 0; r < restarts; r++) {
    const rand = mulberry(seed + r * 101), C = [P[Math.floor(rand() * n)]];
    while (C.length < k) { const d2 = P.map((p) => Math.min(...C.map((c) => dist(p, c) ** 2))), tot = sum(d2); let u = rand() * tot, i = 0; for (; i < n - 1; i++) { u -= d2[i]; if (u <= 0) break; } C.push(P[i]); }
    let lab = new Array(n).fill(0);
    for (let it = 0; it < iters; it++) {
      let ch = false; lab = P.map((p, i) => { let b = 0, bd = Infinity; C.forEach((c, j) => { const d = dist(p, c); if (d < bd) { bd = d; b = j; } }); if (b !== lab[i]) ch = true; return b; });
      for (let j = 0; j < k; j++) { const m = P.filter((_, i) => lab[i] === j); if (m.length) C[j] = m[0].map((_, d) => mean(m.map((p) => p[d]))); }
      if (!ch && it) break;
    }
    const inertia = sum(P.map((p, i) => dist(p, C[lab[i]]) ** 2)); if (!best || inertia < best.inertia) best = { labels: lab, centers: C.map((c) => [...c]), inertia };
  }
  return { ...best, k, silhouette: silhouette(P, best.labels) };
}
export function bestKmeans(P, kMax = 5, opts = {}) { let best = null; for (let k = 2; k <= Math.min(kMax, P.length - 1); k++) { const r = kmeans(P, k, opts); if (r && (!best || r.silhouette > best.silhouette + 1e-9)) best = r; } return best; }

// DBSCAN: a point with at least minPts neighbours within eps is a core point; clusters grow through core points; the rest is noise (label -1).
export function dbscan(P, eps, minPts = 4) {
  const n = P.length, lab = new Array(n).fill(undefined), nb = (i) => { const r = []; for (let j = 0; j < n; j++) if (dist(P[i], P[j]) <= eps) r.push(j); return r; }; let c = 0;
  for (let i = 0; i < n; i++) { if (lab[i] !== undefined) continue; const N = nb(i); if (N.length < minPts) { lab[i] = -1; continue; } lab[i] = c; const q = [...N]; for (let a = 0; a < q.length; a++) { const j = q[a]; if (lab[j] === -1) lab[j] = c; if (lab[j] !== undefined) continue; lab[j] = c; const M = nb(j); if (M.length >= minPts) q.push(...M); } c++; }
  return { labels: lab, k: c, noise: lab.filter((v) => v === -1).length, eps, minPts };
}
// a usual eps: the distance to the minPts-th neighbour, taken at the 90th percentile of all points (the "knee" of the k-distance plot, simplified)
export const suggestEps = (P, minPts = 4) => quantile(P.map((p, i) => { const d = P.map((q, j) => (i === j ? Infinity : dist(p, q))).sort((a, b) => a - b); return d[Math.min(minPts - 1, d.length - 1)]; }), 0.9);

// Agglomerative hierarchical clustering. Start with every point alone and merge the two closest clusters until one is left.
// linkage: single = closest members, complete = farthest, average = mean of all pairs, ward = smallest rise in within-cluster variance.
export function hierarchical(P, { linkage = 'ward' } = {}) {
  const n = P.length; let cl = P.map((p, i) => ({ id: i, pts: [i], c: [...p] })), nextId = n; const merges = [];
  const d = (a, b) => { if (linkage === 'ward') { const na = a.pts.length, nb = b.pts.length; return Math.sqrt(2 * na * nb / (na + nb)) * dist(a.c, b.c); } let v = linkage === 'single' ? Infinity : linkage === 'complete' ? 0 : 0, c = 0; for (const i of a.pts) for (const j of b.pts) { const x = dist(P[i], P[j]); if (linkage === 'single') v = Math.min(v, x); else if (linkage === 'complete') v = Math.max(v, x); else { v += x; c++; } } return linkage === 'average' ? v / c : v; };
  while (cl.length > 1) { let bi = 0, bj = 1, bd = Infinity; for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) { const x = d(cl[i], cl[j]); if (x < bd) { bd = x; bi = i; bj = j; } } const a = cl[bi], b = cl[bj], pts = [...a.pts, ...b.pts], c = P[0].map((_, k) => mean(pts.map((i) => P[i][k]))); merges.push({ a: a.id, b: b.id, id: nextId, height: bd, size: pts.length }); cl = cl.filter((_, i) => i !== bi && i !== bj); cl.push({ id: nextId++, pts, c }); }
  const cut = (k) => { let groups = P.map((_, i) => [i]); const idToPts = new Map(P.map((_, i) => [i, [i]])); const alive = new Set(P.map((_, i) => i)); for (let s = 0; s < n - k; s++) { const m = merges[s]; const pts = [...idToPts.get(m.a), ...idToPts.get(m.b)]; idToPts.set(m.id, pts); alive.delete(m.a); alive.delete(m.b); alive.add(m.id); } const lab = new Array(n).fill(0); let c = 0; for (const id of alive) { for (const i of idToPts.get(id)) lab[i] = c; c++; } return lab; };
  return { merges, cut, linkage, suggestK: (kMax = 6) => { let best = null; for (let k = 2; k <= Math.min(kMax, n - 1); k++) { const s = silhouette(P, cut(k)); if (!best || s > best.s + 1e-9) best = { k, s }; } return best ? best.k : 2; } };
}

// Gaussian mixture by EM with diagonal covariances: each cluster is a bell with its own centre and spread, points get soft membership.
export function gmm(P, k, { seed = 7, iters = 150 } = {}) {
  const n = P.length, dim = P[0].length, km = kmeans(P, k, { seed, restarts: 3 }); if (!km) return null; const minVar = 1e-3;
  let mu = km.centers.map((c) => [...c]), vr = Array.from({ length: k }, (_, j) => { const m = P.filter((_, i) => km.labels[i] === j); return Array.from({ length: dim }, (_, d) => Math.max(minVar, variance(m.map((p) => p[d]), 0) || 1)); }), pi = Array.from({ length: k }, (_, j) => Math.max(1, km.labels.filter((l) => l === j).length) / n), R = [], ll = -Infinity;
  const logN = (x, m, v) => { let s = 0; for (let d = 0; d < dim; d++) s += -0.5 * (Math.log(2 * Math.PI * v[d]) + (x[d] - m[d]) ** 2 / v[d]); return s; };
  for (let it = 0; it < iters; it++) {
    let nl = 0; R = P.map((x) => { const l = pi.map((w, j) => Math.log(w) + logN(x, mu[j], vr[j])), mx = Math.max(...l), e = l.map((v) => Math.exp(v - mx)), s = sum(e); nl += mx + Math.log(s); return e.map((v) => v / s); });
    for (let j = 0; j < k; j++) { const rj = R.map((r) => r[j]), nj = Math.max(1e-9, sum(rj)); pi[j] = nj / n; mu[j] = Array.from({ length: dim }, (_, d) => sum(P.map((x, i) => rj[i] * x[d])) / nj); vr[j] = Array.from({ length: dim }, (_, d) => Math.max(minVar, sum(P.map((x, i) => rj[i] * (x[d] - mu[j][d]) ** 2)) / nj)); }
    if (Math.abs(nl - ll) < 1e-7) { ll = nl; break; } ll = nl;
  }
  const params = k * 2 * dim + k - 1, bic = -2 * ll + params * Math.log(n), labels = R.map((r) => r.indexOf(Math.max(...r)));
  return { k, labels, resp: R, means: mu, vars: vr, weights: pi, logLik: ll, bic, silhouette: silhouette(P, labels) };
}
export function bestGmm(P, kMax = 4, opts = {}) { let best = null; for (let k = 1; k <= Math.min(kMax, Math.floor(P.length / 5)); k++) { const r = gmm(P, k, opts); if (r && (!best || r.bic < best.bic)) best = r; } return best; }

// ---------------------------------------------------------------- 5. anomaly detection
// All detectors return { score: number[], flag: boolean[] } with a higher score = more unusual.
export const zScore = (a, cut = 3) => { const m = mean(a), s = sd(a) || 1, score = a.map((v) => Math.abs(v - m) / s); return { score, flag: score.map((z) => z >= cut), cut }; };
export const modifiedZ = (a, cut = 3.5) => { const m = median(a), mad = median(a.map((v) => Math.abs(v - m))) || 1e-9, score = a.map((v) => Math.abs(0.6745 * (v - m) / mad)); return { score, flag: score.map((z) => z >= cut), cut }; };
// Tukey fences: below Q1 - 1.5 IQR or above Q3 + 1.5 IQR (3 IQR = "far out")
export const iqrFences = (a, k = 1.5) => { const q1 = quantile(a, 0.25), q3 = quantile(a, 0.75), r = q3 - q1 || 1e-9, lo = q1 - k * r, hi = q3 + k * r; return { score: a.map((v) => (v > hi ? (v - hi) / r : v < lo ? (lo - v) / r : 0)), flag: a.map((v) => v < lo || v > hi), lo, hi, k }; };
// Isolation forest: random splits isolate odd points in few steps. score = 2^(-E[path length] / c(n)); near 1 = odd, near 0.5 = ordinary.
const cFactor = (n) => (n <= 1 ? 0 : n === 2 ? 1 : 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n);
export function isolationForest(P, { trees = 100, sample = 256, seed = 7, contamination = 0.05 } = {}) {
  const n = P.length, rand = mulberry(seed), psi = Math.min(sample, n), maxDepth = Math.ceil(Math.log2(Math.max(2, psi)));
  const build = (idx, depth) => { if (depth >= maxDepth || idx.length <= 1) return { size: idx.length }; const dim = P[0].length, f = Math.floor(rand() * dim); let lo = Infinity, hi = -Infinity; for (const i of idx) { lo = Math.min(lo, P[i][f]); hi = Math.max(hi, P[i][f]); } if (lo === hi) return { size: idx.length }; const cut = lo + rand() * (hi - lo); return { f, cut, l: build(idx.filter((i) => P[i][f] < cut), depth + 1), r: build(idx.filter((i) => P[i][f] >= cut), depth + 1) }; };
  const forest = []; for (let t = 0; t < trees; t++) { const idx = Array.from({ length: n }, (_, i) => i); for (let i = 0; i < psi; i++) { const j = i + Math.floor(rand() * (n - i)); [idx[i], idx[j]] = [idx[j], idx[i]]; } forest.push(build(idx.slice(0, psi), 0)); }
  const path = (x, node, d = 0) => (node.f === undefined ? d + cFactor(node.size) : path(x, x[node.f] < node.cut ? node.l : node.r, d + 1)), cn = cFactor(psi) || 1;
  const score = P.map((x) => 2 ** (-mean(forest.map((t) => path(x, t))) / cn)), thr = quantile(score, 1 - contamination);
  return { score, flag: score.map((s) => s > thr && s > 0.55), threshold: thr };
}
// Local outlier factor: compares how crowded a point's neighbourhood is with how crowded its neighbours' neighbourhoods are. LOF near 1 = ordinary, well above 1 = outlier.
export function lof(P, { k = 10, cut = 1.5 } = {}) {
  const n = P.length, kk = Math.min(k, n - 1); if (kk < 2) return { score: new Array(n).fill(1), flag: new Array(n).fill(false) };
  const D = P.map((p, i) => P.map((q, j) => (i === j ? Infinity : dist(p, q)))), nn = D.map((row) => row.map((d, j) => [d, j]).sort((a, b) => a[0] - b[0]).slice(0, kk)), kd = nn.map((r) => r[kk - 1][0]);
  const lrd = nn.map((r) => 1 / Math.max(1e-12, mean(r.map(([d, j]) => Math.max(d, kd[j])))));   // reachability distance = max(distance, neighbour's k-distance)
  const score = nn.map((r, i) => mean(r.map(([, j]) => lrd[j])) / lrd[i]); return { score, flag: score.map((s) => s > cut), cut };
}
// One-class SVM (RBF kernel, nu-formulation): learn the region where most points live. Dual problem  min 1/2 a'Ka  with  0 <= a_i <= 1/(nu n), sum a = 1,
// solved by pairwise (SMO-style) updates. decision(x) = sum a_i K(x_i, x) - rho; below 0 = outside the region = anomaly.
export function oneClassSVM(P, { nu = 0.05, gamma = null, iters = 60, seed = 7 } = {}) {
  const n = P.length, dim = P[0].length, g = gamma || 1 / dim, K = P.map((p) => P.map((q) => Math.exp(-g * dist(p, q) ** 2))), C = 1 / (nu * n), a = new Array(n).fill(0), rand = mulberry(seed);
  for (let i = 0; i < Math.floor(nu * n) + 1; i++) a[i] = Math.min(C, 1 / (Math.floor(nu * n) + 1));
  const tot = sum(a); for (let i = 0; i < n; i++) a[i] /= tot; for (let i = 0; i < n; i++) if (a[i] > C) a[i] = C;
  const Ka = P.map((_, i) => sum(a.map((v, j) => v * K[i][j])));
  for (let it = 0; it < iters * n; it++) {
    let i = 0, j = 1, gi = Infinity, gj = -Infinity; for (let t = 0; t < n; t++) { if (a[t] < C - 1e-12 && Ka[t] < gi) { gi = Ka[t]; i = t; } if (a[t] > 1e-12 && Ka[t] > gj) { gj = Ka[t]; j = t; } }
    if (gj - gi < 1e-6 || i === j) { const r1 = Math.floor(rand() * n), r2 = Math.floor(rand() * n); if (r1 === r2 || gj - gi < 1e-6) { if (it > n) break; continue; } }
    const eta = K[i][i] + K[j][j] - 2 * K[i][j]; if (eta < 1e-12) continue; let dlt = (Ka[j] - Ka[i]) / eta; dlt = Math.max(-a[i], Math.min(a[j], dlt)); dlt = Math.min(dlt, C - a[i]); if (a[j] - dlt < 0) dlt = a[j]; if (Math.abs(dlt) < 1e-14) continue;
    a[i] += dlt; a[j] -= dlt; for (let t = 0; t < n; t++) Ka[t] += dlt * (K[t][i] - K[t][j]);
  }
  const free = a.map((v, i) => (v > 1e-9 && v < C - 1e-9 ? Ka[i] : null)).filter((v) => v != null), rho = free.length ? mean(free) : Math.max(...Ka.filter((_, i) => a[i] > 1e-9));
  const decision = (x) => sum(P.map((p, i) => (a[i] > 1e-12 ? a[i] * Math.exp(-g * dist(p, x) ** 2) : 0))) - rho, dec = P.map(decision), scale = Math.max(1e-9, Math.abs(rho));
  return { score: dec.map((v) => Math.max(0, -v) / scale), flag: (() => { const cap = [...dec].sort((x, y) => x - y)[Math.max(0, Math.ceil(nu * n) - 1)]; return dec.map((v) => v < -1e-9 && v <= cap); })(), decision, rho, supportVectors: a.filter((v) => v > 1e-9).length };
}
// Vote across detectors (how many of them flagged each row)
export const vote = (...res) => res[0].flag.map((_, i) => res.filter((r) => r.flag[i]).length);

// ---------------------------------------------------------------- 6. simulation
// Monte Carlo month end: spent so far + the sum of `daysLeft` future days, each day drawn at random from your recent daily totals (bootstrap).
// A weekday-aware draw uses only days of the same weekday when there are at least 4 of them. Returns the spread of possible month-end totals.
export function monteCarloMonth(daily, { spent = 0, daysLeft = 10, weekdaysLeft = null, runs = 10000, seed = 7, budget = null } = {}) {
  const rand = mulberry(seed), pool = daily.map((d) => d.v), byDow = new Map(); for (const d of daily) { if (!byDow.has(d.dow)) byDow.set(d.dow, []); byDow.get(d.dow).push(d.v); }
  if (pool.length < 14) return { ok: false, reason: 'needs 14 days of spending' };
  const out = new Array(runs); for (let r = 0; r < runs; r++) { let s = spent; for (let d = 0; d < daysLeft; d++) { const dow = weekdaysLeft ? weekdaysLeft[d] : null, src = dow != null && (byDow.get(dow) || []).length >= 4 ? byDow.get(dow) : pool; s += src[Math.floor(rand() * src.length)]; } out[r] = s; }
  const q = (p) => quantile(out, p); return { ok: true, runs, mean: mean(out), p05: q(0.05), p25: q(0.25), p50: q(0.5), p75: q(0.75), p95: q(0.95), overBudget: budget != null ? out.filter((v) => v > budget).length / runs : null, samples: out };
}
// Monte Carlo savings path: each future month's net saving is drawn from your past monthly nets (block of 1; a drift-free bootstrap).
// Returns the chance of reaching `target` within `months`, and the 10th / 50th / 90th percentile of the final balance.
export function monteCarloSavings(nets, { start = 0, months = 12, target = null, runs = 10000, seed = 7 } = {}) {
  if (nets.length < 4) return { ok: false, reason: 'needs 4 months of income and spending' }; const rand = mulberry(seed), end = new Array(runs), hit = [];
  for (let r = 0; r < runs; r++) { let b = start, reached = -1; for (let m = 1; m <= months; m++) { b += nets[Math.floor(rand() * nets.length)]; if (target != null && reached < 0 && b >= target) reached = m; } end[r] = b; hit.push(reached); }
  return { ok: true, runs, p10: quantile(end, 0.1), p50: quantile(end, 0.5), p90: quantile(end, 0.9), chance: target != null ? hit.filter((x) => x >= 0).length / runs : null, medianMonths: target != null && hit.filter((x) => x >= 0).length ? median(hit.filter((x) => x >= 0)) : null, samples: end };
}
// Generic Monte Carlo for any random draw function (kept for tests and future use): estimate E[f] and a 95% interval by the standard error.
export function monteCarlo(draw, { runs = 10000, seed = 7 } = {}) { const rand = mulberry(seed), v = Array.from({ length: runs }, () => draw(rand, () => gauss01(rand))), m = mean(v), se = sd(v) / Math.sqrt(runs); return { mean: m, se, lo: m - 1.96 * se, hi: m + 1.96 * se, p05: quantile(v, 0.05), p95: quantile(v, 0.95) }; }
