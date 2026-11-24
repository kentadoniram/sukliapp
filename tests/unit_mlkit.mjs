import * as M from '../js/mlkit.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, t, m) => ok(Math.abs(a - b) <= t, `${m} (${a.toFixed(4)} vs ${b})`);
const R = M.mulberry(3), noise = (s) => (R() - 0.5) * s;
// pearson
const x = Array.from({ length: 50 }, (_, i) => i), y = x.map((v) => 2 * v + 1);
near(M.pearson(x, y).r, 1, 1e-9, 'pearson perfect'); near(M.pearson(x, x.map((v) => -v)).r, -1, 1e-9, 'pearson negative');
near(M.pearson([1,2,3,4,5],[2,1,4,3,5]).r, 0.8, 1e-9, 'pearson known 0.8'); near(M.pearson([1,2,3,4,5],[2,1,4,3,5]).p, 0.104, 0.002, 'pearson p known');
// ols
const X = x.map((v) => [v, (v * 7) % 5]), yy = x.map((v, i) => 3 + 2 * X[i][0] - 1.5 * X[i][1]);
const o = M.ols(X, yy); near(o.beta[0], 3, 1e-6, 'ols b0'); near(o.beta[1], 2, 1e-6, 'ols b1'); near(o.beta[2], -1.5, 1e-6, 'ols b2'); near(o.r2, 1, 1e-9, 'ols r2');
// poly
const px = x.map((v) => v / 5), py = px.map((v) => 1 - 2 * v + 0.5 * v * v); const pf = M.polyFit(px, py, 2); near(pf.predict(4), 1 - 8 + 8, 1e-6, 'poly predict'); ok(M.polyAuto(px, py).deg === 2, 'polyAuto picks degree 2');
// ridge/lasso
const rx = Array.from({ length: 80 }, () => [R(), R(), R(), R()]), ry = rx.map((r) => 4 * r[0] - 2 * r[1] + noise(0.1));
const rg = M.ridge(rx, ry, 0.01); near(rg.coef[0], 4, 0.2, 'ridge coef0'); const big = M.ridge(rx, ry, 1000); ok(Math.abs(big.coef[0]) < Math.abs(rg.coef[0]) / 2, 'ridge shrinks');
const ls = M.lasso(rx, ry, 0.1); ok(ls.kept.includes(0) && ls.kept.includes(1) && !ls.kept.includes(2) && !ls.kept.includes(3), 'lasso zeroes weak columns ' + ls.kept); ok(M.cvLambda(rx, ry, 'lasso').lambda <= 0.3, 'cvLambda');
// logistic
const lx = Array.from({ length: 200 }, () => [R() * 4 - 2]), ly = lx.map((r) => (R() < 1 / (1 + Math.exp(-3 * r[0])) ? 1 : 0)); const lg = M.logistic(lx, ly); ok(lg.beta[1] > 1.5 && lg.beta[1] < 5, 'logistic slope ' + lg.beta[1].toFixed(2)); ok(lg.auc > 0.8, 'logistic auc ' + lg.auc.toFixed(2));
// holt winters on trend+season
const sea = [10, 12, 15, 11, 9, 8, 14, 20, 16, 12, 10, 18], hw = Array.from({ length: 48 }, (_, i) => 100 + 2 * i + sea[i % 12]); const h = M.holtWinters(hw, 12, { h: 3 });
ok(h.ok && h.seasonal, 'hw seasonal'); near(h.forecast[0], 100 + 2 * 48 + sea[0], 2, 'hw fc1'); near(h.forecast[2], 100 + 2 * 50 + sea[2], 2, 'hw fc3');
// arima AR(1)
let a = [0]; for (let i = 1; i < 300; i++) a.push(0.7 * a[i - 1] + noise(1)); const ar = M.sarima(a, { p: 1, d: 0, q: 0 }); near(ar.params[0], 0.7, 0.12, 'ar1 phi');
const rw = a.map((_, i) => 5 * i + 10 * Math.sin(i)); const ai = M.sarima(rw, { p: 1, d: 1, q: 0, h: 2 }); ok(ai.ok && ai.forecast[0] > rw[rw.length - 1] - 20, 'arima d=1 forecast continues up');
const ma = []; let e0 = 0; for (let i = 0; i < 300; i++) { const e = noise(2); ma.push(e + 0.6 * e0); e0 = e; } near(M.sarima(ma, { p: 0, q: 1 }).params[0], 0.6, 0.15, 'ma1 theta');
const sr = M.sarima(hw, { p: 1, d: 1, q: 0, P: 0, D: 1, Q: 0, m: 12, h: 2 }); ok(sr.ok && Math.abs(sr.forecast[0] - (100 + 96 + sea[0])) < 6, 'sarima seasonal diff fc ' + sr.forecast[0]); ok(M.autoSarima(hw).ok, 'autoSarima');
// prophet-like
const pl = M.prophetLike(hw, { h: 2 }); ok(pl.ok && Math.abs(pl.forecast[0] - (100 + 96 + sea[0])) < 6, 'prophetLike fc ' + pl.forecast[0]);
// var
const v1 = [[1, 1]]; for (let i = 1; i < 1500; i++) v1.push([0.5 * v1[i - 1][0] + 0.3 * v1[i - 1][1] + noise(0.5), 0.2 * v1[i - 1][0] + 0.4 * v1[i - 1][1] + noise(0.5)]); const vf = M.varFit(v1, { p: 1 }); near(vf.coef[0][1], 0.5, 0.12, 'var a11'); near(vf.coef[0][2], 0.3, 0.12, 'var a12'); ok(M.autoVar(v1).p === 1, 'var picks p=1');
// clustering
const blobs = []; for (const c of [[0, 0], [8, 8], [0, 8]]) for (let i = 0; i < 30; i++) blobs.push([c[0] + noise(1) + noise(1) + noise(1), c[1] + noise(1) + noise(1) + noise(1)]);
const km = M.bestKmeans(blobs, 5); ok(km.k === 3, 'kmeans k=3 ' + km.k); const db = M.dbscan(blobs, 1.2, 4); ok(db.k === 3, 'dbscan 3 clusters ' + db.k);
const hc = M.hierarchical(blobs); ok(hc.suggestK() === 3, 'hier k=3'); const lab = hc.cut(3); ok(new Set(lab.slice(0, 30)).size === 1 && new Set(lab).size === 3, 'hier cut pure');
for (const l of ['single', 'complete', 'average']) ok(new Set(M.hierarchical(blobs, { linkage: l }).cut(3)).size === 3, 'hier ' + l);
const gm = M.bestGmm(blobs, 5); ok(gm.k === 3, 'gmm k=3 ' + gm.k);
// anomaly
const base = Array.from({ length: 100 }, () => 50 + noise(10)); base.push(200); const P = base.map((v) => [v]);
ok(M.zScore(base).flag[100], 'z flags'); ok(M.modifiedZ(base).flag[100], 'mz flags'); ok(M.iqrFences(base).flag[100], 'iqr flags');
ok(M.isolationForest(P).flag[100], 'iforest flags'); ok(M.lof(P).flag[100], 'lof flags'); const sv = M.oneClassSVM(P, { nu: 0.05, gamma: 0.001 }); ok(sv.flag[100], 'ocsvm flags'); ok(sv.flag.filter(Boolean).length < 15, 'ocsvm not flag-happy ' + sv.flag.filter(Boolean).length);
near(M.modifiedZ([1,2,3,4,100]).score[4], 0.6745 * 97 / 1, 1e-6, 'mz formula');
// monte carlo
const daily = Array.from({ length: 60 }, (_, i) => ({ v: 1000 + (i % 7) * 100, dow: i % 7 })); const mc = M.monteCarloMonth(daily, { spent: 5000, daysLeft: 10, budget: 20000 }); ok(mc.ok && mc.p05 < mc.p50 && mc.p50 < mc.p95, 'mc ordering'); near(mc.mean, 5000 + 10 * 1300, 150, 'mc mean');
const mcs = M.monteCarloSavings([1000, 2000, 3000, -500], { start: 0, months: 12, target: 20000 }); ok(mcs.ok && mcs.chance > 0 && mcs.chance < 1, 'mc savings chance ' + mcs.chance); near(M.monteCarlo((r) => r()).mean, 0.5, 0.02, 'mc generic');
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
