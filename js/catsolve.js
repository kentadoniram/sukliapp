// Category spending estimate. Pure maths, no screens.
// For each receipt you only say HOW MANY items of each category you bought (3 drinks, 2 snacks, 1 toiletry) and what you paid in total.
// Model:  total ~ sum( count x average price of that category )      (prices include tax, so no tax rates are needed here)
// With many receipts the average price of each category can be fitted, then
//     spent on a category = sum over receipts of ( count x its average price ), scaled so every receipt adds up to what you really paid.
// It is a rough estimate by design: it says "about", gives a range, and never changes a saved total.
//
// How it copes with messy prices
//   - non-negative fit (a price can't be below zero)
//   - robust fit: one odd receipt (a 12-pack, a sale) counts less (Huber weights)
//   - starting guess per category (typical Japan prices) that matters less as receipts come in (ridge toward the guess,
//     strength chosen by cross-validation)
//   - per shop prices, borrowing from the all-shops fit when a shop has few receipts (partial pooling)
//   - range from bootstrap: the same fit run on many reshuffled copies of your receipts
//   - exact amounts you already know (an item the exact solver solved, a typed price) are taken out first and counted as exact.

// typical prices in yen, tax included. Only a starting guess. Split categories by PRICE LEVEL, not by type of food.
export const DEFAULT_CATS = {
  drinks: 150, snacks: 150, 'ready meals': 520, groceries: 300, produce: 250, 'meat and fish': 500, toiletries: 450, household: 400, other: 500,
};

const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };

// rows: [{ n: {cat: count}, y: total to explain }]   prior: {cat: price}   -> { cat: price }
function fit(rows, cats, prior, tau, huber = 0.25) {
  const C = cats.length, ci = new Map(cats.map((c, i) => [c, i]));
  const q = new Array(C).fill(1);                                       // price relative to the guess; 1 = trust the guess
  const A = rows.map((r) => { const a = new Array(C).fill(0); for (const [c, n] of Object.entries(r.n)) if (ci.has(c)) a[ci.get(c)] = n * prior[c] / r.y; return a; });
  let w = new Array(rows.length).fill(1);
  for (let irls = 0; irls < 8; irls++) {
    const pred = A.map((a) => a.reduce((s, v, j) => s + v * q[j], 0));
    for (let sweep = 0; sweep < 200; sweep++) {
      let move = 0;
      for (let j = 0; j < C; j++) {
        let num = tau, den = tau;
        for (let t = 0; t < A.length; t++) { const a = A[t][j]; if (!a) continue; num += w[t] * a * (1 - (pred[t] - a * q[j])); den += w[t] * a * a; }
        const nq = Math.max(0.05, num / den);
        if (nq !== q[j]) { const d = nq - q[j]; for (let t = 0; t < A.length; t++) if (A[t][j]) pred[t] += A[t][j] * d; move = Math.max(move, Math.abs(d)); q[j] = nq; }
      }
      if (move < 1e-7) break;
    }
    const e = A.map((a) => Math.abs(a.reduce((s, v, j) => s + v * q[j], 0) - 1));
    w = e.map((x) => (x <= huber ? 1 : huber / x));
  }
  const out = {}; cats.forEach((c, j) => { out[c] = prior[c] * q[j]; });
  return out;
}
const predict = (p, n) => Object.entries(n).reduce((s, [c, k]) => s + k * (p[c] ?? 0), 0);

// pick the pull toward the guess by 5-fold cross-validation (few receipts: a fixed middle value)
function pickTau(rows, cats, prior) {
  if (rows.length < 10) return 0.8;
  let best = 0.8, bs = Infinity;
  for (const tau of [0.05, 0.2, 0.8, 3]) {
    let err = 0;
    for (let f = 0; f < 5; f++) {
      const tr = rows.filter((_, i) => i % 5 !== f), te = rows.filter((_, i) => i % 5 === f);
      const p = fit(tr, cats, prior, tau);
      for (const r of te) err += Math.min(1, Math.abs(predict(p, r.n) - r.y) / r.y);
    }
    if (err < bs) { bs = err; best = tau; }
  }
  return best;
}

// the whole pipeline on a set of receipts: all-shops prices, then each shop's prices
function pipeline(rowsAll, cats, prior, tauFix) {
  const tau = tauFix ?? pickTau(rowsAll, cats, prior), global = fit(rowsAll, cats, prior, tau), shops = new Map();
  const by = new Map(); for (const r of rowsAll) { if (!by.has(r.shop)) by.set(r.shop, []); by.get(r.shop).push(r); }
  for (const [s, rs] of by) shops.set(s, rs.length >= 2 ? fit(rs, cats, global, rs.length < 8 ? Math.max(tau, 1.5) : tau) : global);
  return { tau, global, shops };
}

// purchases: [{ id, date, shop, total, lines: [{ cat, n, amount? }] }]
//   n = how many (decimals allowed for weight). amount = an exact amount you already know for that line (then n is ignored).
// opts: { cats: {cat: guess price}, boot (default 120), seed, tau }
export function estimateSpending(purchases, opts = {}) {
  const guess = { ...DEFAULT_CATS, ...(opts.cats || {}) }, B = opts.boot ?? 120, rand = mulberry(opts.seed ?? 7);
  const notes = [], rows = [], known = [];
  for (const p of purchases || []) {
    const n = {}, kn = {}; let knownSum = 0, ok = true;
    for (const l of p.lines || []) {
      if (!l.cat) { ok = false; break; }
      if (l.amount != null) { kn[l.cat] = (kn[l.cat] || 0) + +l.amount; knownSum += +l.amount; }
      else if (+l.n > 0) n[l.cat] = (n[l.cat] || 0) + +l.n;
      if (guess[l.cat] == null) guess[l.cat] = 300;
    }
    if (!ok || !(p.total > 0)) continue;
    rows.push({ id: p.id, shop: p.shop || '', n, kn, y: p.total - knownSum, total: p.total, date: p.date });
  }
  const cats = Object.keys(guess).filter((c) => rows.some((r) => r.n[c] || r.kn[c]));
  if (!rows.length) return { prices: {}, spend: {}, total: 0, receipts: 0, notes: ['No receipts yet.'], hints: [] };
  const fitRows = rows.filter((r) => r.y > 0 && Object.keys(r.n).length);
  if (rows.some((r) => r.y <= 0 && Object.keys(r.n).length)) notes.push('A receipt where the known amounts are already the whole total was not used for prices.');
  const main = pipeline(fitRows, cats, guess, opts.tau);

  // per receipt: count x price, scaled to the real total, known amounts added as they are
  const spendOf = (pl, rs) => {
    const sp = Object.fromEntries(cats.map((c) => [c, 0]));
    for (const r of rs) {
      const p = pl.shops.get(r.shop) || pl.global, raw = {}; let sum = 0;
      for (const [c, k] of Object.entries(r.n)) { raw[c] = k * (p[c] ?? guess[c]); sum += raw[c]; }
      for (const [c, v] of Object.entries(raw)) sp[c] += sum > 0 ? v * (r.y / sum) : 0;
      for (const [c, v] of Object.entries(r.kn)) sp[c] += v;
    }
    return sp;
  };
  const base = spendOf(main, rows);
  const gp = Object.fromEntries(cats.map((c) => [c, []])), sp = Object.fromEntries(cats.map((c) => [c, []]));
  for (let b = 0; b < B && fitRows.length >= 3; b++) {
    const s = fitRows.map(() => fitRows[Math.floor(rand() * fitRows.length)]);
    const pl = pipeline(s, cats, guess, main.tau), sd = spendOf(pl, rows);
    for (const c of cats) { gp[c].push(pl.global[c]); sp[c].push(sd[c]); }
  }
  const resid = fitRows.length ? Math.sqrt(fitRows.reduce((s, r) => s + ((predict(main.global, r.n) - r.y) / r.y) ** 2, 0) / fitRows.length) : 0;
  const total = rows.reduce((s, r) => s + r.total, 0), prices = {}, spend = {}, hints = [];
  for (const c of cats) {
    const recs = rows.filter((r) => r.n[c]).length, price = main.global[c];
    const lo = gp[c].length ? pct(gp[c], 0.1) : NaN, hi = gp[c].length ? pct(gp[c], 0.9) : NaN;
    const wide = isFinite(lo) ? (hi - lo) / price : Infinity;
    const quality = !recs ? 'guess' : wide <= 0.5 ? 'good' : wide <= 1.2 ? 'rough' : 'very rough';
    prices[c] = { price, low: lo, high: hi, receipts: recs, quality };
    // the range has two parts: how unsure the prices are (bootstrap) and how unevenly each receipt splits between categories (from the misfit)
    const bl = sp[c].length ? base[c] - pct(sp[c], 0.1) : 0, bh = sp[c].length ? pct(sp[c], 0.9) - base[c] : 0;
    const split = 1.28 * resid * Math.sqrt(rows.reduce((s, r) => { const v = (r.n[c] || 0) * main.global[c]; return s + v * v; }, 0));
    spend[c] = { amount: base[c], low: Math.max(0, base[c] - Math.hypot(Math.max(0, bl), split)), high: base[c] + Math.hypot(Math.max(0, bh), split), share: total ? base[c] / total : 0 };
    if (quality === 'rough' || quality === 'very rough') hints.push(`A receipt with mostly ${c} would help pin down their price.`);
  }
  const shopPrices = {}; for (const [s, p] of main.shops) shopPrices[s || '(no shop)'] = p;
  return { prices, shopPrices, spend, total, receipts: rows.length, usedForPrices: fitRows.length, tau: main.tau, residual: resid, notes, hints };
}
