// Models Lab (v16.29): runs the statistics and machine-learning models in mlkit.js on your own data, on your device. Read only: it never changes anything
// and the main forecast does not use it (the default forecast stays the tested one in stats.js). Every block says what it did and why it may be thin.
import { esc } from './ui.js';
import { sectionTitle } from './components.js';
import { get, HOME, fmt, monthLabel, thisMonth, shiftMonth, daysInMonth, partsBetween } from './core.js';
import { monthlySeries } from './finance.js';
import { totals } from './insights.js';
import { METHODS } from './stats.js';
import { dailySpend, firstDate, today, addDays } from './rolling.js';
import * as M from './mlkit.js';

const R = (n) => (n == null || !isFinite(n) ? '–' : fmt(n, HOME, { round: true }));
const f2 = (n, d = 2) => (n == null || !isFinite(n) ? '–' : n.toFixed(d));
const pc = (n, d = 0) => (n == null || !isFinite(n) ? '–' : `${(n * 100).toFixed(d)}%`);
const sec = (title, intro, body) => `<section class="card sgsec">${sectionTitle(title, 'h3')}<p class="hint">${intro}</p>${body}</section>`;
const table = (head, rows, cap = '') => `<div class="scrollx"><table class="sgpx">${cap ? `<caption>${esc(cap)}</caption>` : ''}${head ? `<tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>` : ''}${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
const none = (t) => `<p class="empty">${esc(t)}</p>`;
const safe = (title, intro, fn) => { try { return sec(title, intro, fn()); } catch (e) { return sec(title, intro, none('This model could not run on your data (' + (e && e.message ? e.message : 'error') + ').')); } };
const dow = (d) => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), 12).getDay();
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function modelslab() {
  const db = get(), ym = thisMonth(), now = today(), ser = monthlySeries(db, ym, 'expense', 36, true), y = ser.values, months = ser.months, inc = months.map((m) => totals(db, m, 'income').total);
  const first = firstDate(db), span = first ? Math.min(365, Math.max(0, Math.round((new Date(now) - new Date(first)) / 864e5) + 1)) : 0, ds = span >= 20 ? dailySpend(db, now, span) : { dates: [], vals: [] };
  const rows = ds.dates.map((d, i) => ({ d, v: ds.vals[i], dow: dow(d), dom: +d.slice(8, 10) })), out = [];
  const feat = (r, prev) => [r.dow === 0 || r.dow === 6 ? 1 : 0, r.dom <= 5 ? 1 : 0, r.dom >= 25 ? 1 : 0, Math.log1p(prev)], FN = ['weekend', 'first 5 days', 'last days (25+)', 'yesterday (log)'];
  const dayX = rows.slice(1).map((r, i) => feat(r, rows[i].v)), dayY = rows.slice(1).map((r) => Math.log1p(r.v));

  // 2 correlation and regression
  out.push(safe('Correlation and regression', 'Monthly figures: how income, time and spending move together. Daily figures: what predicts a day of spending (on a log scale, so one huge day does not rule the fit).', () => {
    const b = [];
    if (y.length >= 5) {
      const pr = M.pearson(inc, y), lin = M.linearFit(y.map((_, i) => i), y), pol = M.polyAuto(y.map((_, i) => i), y), mlr = M.ols(y.map((_, i) => [i, inc[i]]), y);
      b.push(table(['Model', 'Result', 'Fit'], [
        ["Pearson's r: income vs spending", `r = ${f2(pr.r)} (95% ${f2(pr.lo)} to ${f2(pr.hi)}), p = ${f2(pr.p, 3)}, ${pr.n} months`, pr.p < 0.05 ? 'a real link' : 'no reliable link'],
        ['Linear regression: spending over time', `${R(lin.beta[1])} per month, next month ${R(lin.predict([y.length]))} (slope p = ${f2(lin.p[1], 3)})`, `R² ${f2(lin.r2)}`],
        ['Polynomial regression (degree by leave-one-out)', `degree ${pol.deg}, next month ${R(pol.predict(y.length))}`, `R² ${f2(pol.r2)}, LOO miss ${R(pol.loo)}`],
        ['Multiple regression: time + income', `spending = ${R(mlr.beta[0])} + ${R(mlr.beta[1])} x month + ${f2(mlr.beta[2], 3)} x income`, `R² ${f2(mlr.r2)} (adj ${f2(mlr.adjR2)})`]]));
    } else b.push(none('Monthly models need 5 complete months.'));
    if (dayX.length >= 40) {
      const ol = M.ols(dayX, dayY), cvR = M.cvLambda(dayX, dayY, 'ridge'), rg = M.ridge(dayX, dayY, cvR.lambda), cvL = M.cvLambda(dayX, dayY, 'lasso'), ls = M.lasso(dayX, dayY, cvL.lambda);
      const big = M.quantile(rows.map((r) => r.v), 0.75), hy = rows.slice(1).map((r) => (r.v > big && r.v > 0 ? 1 : 0)), lg = M.logistic(dayX, hy);
      b.push(table(['Predictor', 'Least squares', 'Ridge', 'Lasso', 'Logistic: odds of a big day'], FN.map((n, j) => [n, f2(ol.beta[j + 1], 3), f2(rg.coef[j], 3), ls.kept.includes(j) ? f2(ls.coef[j], 3) : '0 (dropped)', `x${f2(lg.oddsRatios[j])}`]),
        `${dayX.length} days. Ridge lambda ${cvR.lambda}, lasso lambda ${cvL.lambda} (chosen by 5-fold cross-validation).`));
      b.push(`<p class="hint">Least squares R² ${f2(ol.r2)}; ridge R² ${f2(rg.r2)}; lasso keeps ${ls.kept.length} of ${FN.length}. Logistic: a "big day" is above your 75th percentile (${R(big)}); accuracy ${pc(lg.accuracy)}, AUC ${f2(lg.auc)} (0.5 = guessing).</p>`);
    } else b.push(none('Daily models need 40 days of history.'));
    return b.join('');
  }));

  // 3 forecasting
  out.push(safe('Forecasting models', 'Each model predicts a month from the months before it, replayed on your last 6 months (rolling test). Lower miss is better. These are shown for comparison; the main forecast still uses the method chosen in the Model Computation Guide.', () => {
    if (y.length < 8) return none('Forecast models need 8 complete months.');
    const fcs = [['Median of last 3 months (current default)', (h) => METHODS.median3.f(h)], ['Holt-Winters (damped trend' + (y.length >= 24 ? ' + seasons' : '') + ')', (h) => { const r = M.holtWinters(h, 12); return r.ok ? r.forecast[0] : null; }],
      ['ARIMA(1,1,1)', (h) => { const r = M.sarima(h, { p: 1, d: 1, q: 1 }); return r.ok ? r.forecast[0] : null; }], ['ARIMA(1,0,0)', (h) => { const r = M.sarima(h, { p: 1, d: 0, q: 0 }); return r.ok ? r.forecast[0] : null; }],
      ['Trend + season (Prophet-style)', (h) => { const r = M.prophetLike(h, { period: 12 }); return r.ok ? r.forecast[0] : null; }]];
    if (y.length >= 30) fcs.push(['SARIMA(1,1,0)(0,1,0)12', (h) => { const r = M.sarima(h, { p: 1, d: 1, q: 0, P: 0, D: 1, Q: 0, m: 12 }); return r.ok ? r.forecast[0] : null; }]);
    const rowsF = fcs.map(([n, fn]) => { const t = M.backtestFn(y, fn, { tests: 6, minTrain: 6 }); let nx = null; try { nx = fn(y); } catch { /* none */ } return { n, t, nx }; }).sort((a, b) => (a.t.mae || 1e18) - (b.t.mae || 1e18));
    const best = M.autoSarima(y, { m: 12, h: 3 });
    return table(['Model', 'Average miss', 'Typical miss', 'Next month', 'Tests'], rowsF.map((r, i) => [esc(r.n) + (i === 0 ? ' <b>(best on your data)</b>' : ''), R(r.t.mae), pc(r.t.mape), R(r.nx), r.t.n])) +
      (best.ok ? `<p class="hint">Automatic ARIMA search (by AICc): order (${best.order.join(',')})${best.seasonal[0] + best.seasonal[2] ? ` x seasonal (${best.seasonal.slice(0, 3).join(',')})12` : ''}, next 3 months ${best.forecast.map(R).join(', ')}. Residual spread ${R(best.sigma)}.</p>` : '') +
      (inc.some((v) => v > 0) ? (() => { const v = M.autoVar(months.map((_, i) => [y[i], inc[i]]), { h: 1 }); return v.ok ? `<p class="hint"><b>VAR</b> (spending and income together, lag ${v.p} chosen by BIC): next month spending ${R(v.forecast[0][0])}, income ${R(v.forecast[0][1])}. R² ${v.r2.map((x) => f2(x)).join(' / ')}.</p>` : `<p class="hint">VAR: ${esc(v.reason)}.</p>`; })() : '');
  }));

  // 4 clustering
  out.push(safe('Clustering', 'Your spending groups over the last 12 months, described by size, how often you buy, the typical purchase and how much of it falls on weekends. Groups that behave alike land together.', () => {
    const from = addDays(now, -364), by = new Map();
    for (const p of partsBetween(db, from, now)) if (p.kind === 'expense' && p.v > 0) { const e = by.get(p.group) || { g: p.group, tot: 0, n: 0, we: 0 }; e.tot += p.v; e.n++; const w = dow(p.t.date.slice(0, 10)); if (w === 0 || w === 6) e.we += p.v; by.set(p.group, e); }
    const gs = [...by.values()].filter((e) => e.n >= 3); if (gs.length < 6) return none('Clustering needs 6 groups with 3 or more purchases each.');
    const P = gs.map((e) => [Math.log1p(e.tot), Math.log1p(e.n), Math.log1p(e.tot / e.n), e.we / e.tot]), { Z } = M.zscoreColumns(P);
    const km = M.bestKmeans(Z, 5), db1 = M.dbscan(Z, M.suggestEps(Z, 3) * 1.1, 3), hc = M.hierarchical(Z), hk = hc.suggestK(5), hl = hc.cut(hk), gm = M.bestGmm(Z, 4);
    const lbl = (l) => (l < 0 ? 'noise' : String.fromCharCode(65 + l));
    return table(['Model', 'Clusters', 'Quality'], [['K-means (k by silhouette)', km.k, `silhouette ${f2(km.silhouette)}`], ['DBSCAN', `${db1.k} + ${db1.noise} unusual`, `eps ${f2(db1.eps)}`], [`Hierarchical (Ward), cut at ${hk}`, hk, `silhouette ${f2(M.silhouette(Z, hl))}`], ['Gaussian mixture (k by BIC)', gm ? gm.k : '–', gm ? `silhouette ${f2(gm.silhouette)}` : '']]) +
      table(['Group', 'Spent', 'Purchases', 'Weekend share', 'K-means', 'DBSCAN', 'Hierarchical', 'Mixture'], gs.map((e, i) => [esc(e.g), R(e.tot), e.n, pc(e.we / e.tot), lbl(km.labels[i]), lbl(db1.labels[i]), lbl(hl[i]), gm ? lbl(gm.labels[i]) : '–']), 'Cluster letters are only labels: A in one model is not the same as A in another.');
  }));

  // 5 anomaly detection
  out.push(safe('Anomaly detection', 'Days with unusual total spending in the last year (days with spending only). Each detector flags days on its own; the vote shows how many agree.', () => {
    const act = rows.filter((r) => r.v > 0); if (act.length < 30) return none('Anomaly detectors need 30 days with spending.');
    const v = act.map((r) => r.v), P = act.map((r) => [Math.log1p(r.v), r.dow === 0 || r.dow === 6 ? 1 : 0]), z = M.zScore(v), mz = M.modifiedZ(v), iq = M.iqrFences(v), iso = M.isolationForest(P), lo = M.lof(P, { k: 10 }), sv = M.oneClassSVM(P, { nu: 0.05, gamma: 0.5 });
    const votes = M.vote(z, mz, iq, iso, lo, sv), names = [['Z-score (3 SD)', z], ['Modified Z (3.5)', mz], ['IQR fences', iq], ['Isolation forest', iso], ['Local outlier factor', lo], ['One-class SVM', sv]];
    const top = act.map((r, i) => ({ r, i, n: votes[i] })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || b.r.v - a.r.v).slice(0, 10), mark = (x, d) => (d.flag[x.i] ? '●' : '·');
    return table(['Detector', 'Days flagged'], names.map(([n, d]) => [n, d.flag.filter(Boolean).length])) + (top.length ? table(['Day', 'Spent', 'Vote', ...names.map(([n]) => n.split(' ')[0])], top.map((x) => [`${x.r.d} ${DN[x.r.dow]}`, R(x.r.v), `${x.n} of 6`, ...names.map(([, d]) => mark(x, d))]), `Top days by votes (of ${act.length} spending days). Cutoffs: IQR above ${R(iq.hi)}.`) : none('No day was flagged by any detector.'));
  }));

  // 6 simulation
  out.push(safe('Monte Carlo simulation', 'Thousands of imagined futures, each drawing future days (or months) at random from your own past. The spread is the honest answer to "how much could I end up spending".', () => {
    const b = [], dim = daysInMonth(ym), day = +now.slice(8, 10), spent = totals(db, ym, 'expense').total, left = dim - day, wd = Array.from({ length: left }, (_, i) => dow(addDays(now, i + 1))), recent = rows.slice(-120).map((r) => ({ v: r.v, dow: r.dow }));
    const mc = M.monteCarloMonth(recent, { spent, daysLeft: left, weekdaysLeft: wd, runs: 10000 });
    b.push(mc.ok ? table(null, [['Spent so far this month', R(spent)], ['Days left', left], ['Month end, middle (50%)', `<b>${R(mc.p50)}</b>`], ['Likely range (25% to 75%)', `${R(mc.p25)} to ${R(mc.p75)}`], ['Wide range (5% to 95%)', `${R(mc.p05)} to ${R(mc.p95)}`]], '10,000 runs, weekday-aware draws from your last 120 days') : none('Month-end simulation: ' + mc.reason + '.'));
    const nets = months.map((_, i) => inc[i] - y[i]), mcs = M.monteCarloSavings(nets, { months: 12, target: Math.max(0, mean0(nets)) * 6 });
    b.push(mcs.ok ? table(null, [['Net saved per month (past)', `typical ${R(M.median(nets))}`], ['Saved in 12 months, middle', R(mcs.p50)], ['Saved in 12 months, 10% to 90%', `${R(mcs.p10)} to ${R(mcs.p90)}`], [`Chance of saving ${R(Math.max(0, mean0(nets)) * 6)} within 12 months`, pc(mcs.chance)]], 'Savings projection: each month drawn from your past monthly nets (income minus spending)') : none('Savings simulation: ' + mcs.reason + '.'));
    return b.join('');
  }));

  return `<header class="pagehead"><h2>Models Lab</h2></header><p class="hint">Advanced models run on your own data, on this device. They only read your data and never change it. With little history several will say "needs more data", which is the honest answer. How each one works is in the Model Computation Guide.</p>${out.join('')}`;
}
const mean0 = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
