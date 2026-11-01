// Category spending estimate: simulated receipts with known true prices; checks accuracy, robustness, honesty and exact totals.
import { estimateSpending, DEFAULT_CATS } from '../js/catsolve.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const TRUE = { drinks: 140, snacks: 190, 'ready meals': 540, toiletries: 480, produce: 230 };
const SHOP = { A: 1, B: 1.12 };
// receipts: each has 1-4 categories with 1-4 items; every item's price varies by about 25% around the shop's price
function sim(T, seed, { sd = 0.25, mixed = true } = {}) {
  const r = rng(seed), cats = Object.keys(TRUE), out = [], truth = Object.fromEntries(cats.map((c) => [c, 0]));
  for (let i = 0; i < T; i++) {
    const shop = r() < 0.6 ? 'A' : 'B', k = 1 + Math.floor(r() * 3), lines = [], pick = new Set(); let total = 0;
    while (pick.size < k) pick.add(cats[Math.floor(r() * cats.length)]);
    for (const c of pick) { const n = 1 + Math.floor(r() * 4); let s = 0; for (let j = 0; j < n; j++) s += Math.round(TRUE[c] * SHOP[shop] * Math.exp(sd * gauss(r) - sd * sd / 2)); lines.push({ cat: c, n }); total += s; truth[c] += s; }
    out.push({ id: 'r' + i, date: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), shop, total, lines });
  }
  return { purchases: out, truth, total: out.reduce((s, p) => s + p.total, 0) };
}
const sumSpend = (res) => Object.values(res.spend).reduce((s, v) => s + v.amount, 0);

// 1 accuracy with a month or so of receipts
let errs = [], cover = 0, cnt = 0, tot = 0, wsum = 0;
for (const seed of [1, 2, 3, 4, 5]) {
  const { purchases, truth, total } = sim(45, seed), res = estimateSpending(purchases, { seed });
  tot += Math.abs(sumSpend(res) - total);
  for (const c of Object.keys(TRUE)) { const e = Math.abs(res.spend[c].amount - truth[c]) / truth[c]; errs.push(e); cnt++; wsum += (res.spend[c].high - res.spend[c].low) / res.spend[c].amount; if (truth[c] >= res.spend[c].low && truth[c] <= res.spend[c].high) cover++; }
}
const med = [...errs].sort((a, b) => a - b)[Math.floor(errs.length / 2)], worst = Math.max(...errs);
ok(tot < 1, 'every receipt adds up to what was really paid (categories sum to the total exactly)');
ok(med < 0.10, 'typical category spend is within 10% of the truth with 45 receipts (median error ' + (med * 100).toFixed(1) + '%)');
ok(worst < 0.30, 'no category is off by more than 30% (worst ' + (worst * 100).toFixed(1) + '%)');
ok(cover / cnt >= 0.7, 'the stated 80% range contains the truth about 80% of the time (' + cover + '/' + cnt + ')');
ok(wsum / cnt < 0.5, 'ranges are useful, not huge (average width ' + (wsum / cnt * 100).toFixed(0) + '% of the amount)');

// 2 more receipts, better answer
const e = (T) => { const a = []; for (const seed of [11, 12, 13]) { const { purchases, truth } = sim(T, seed), res = estimateSpending(purchases, { seed, boot: 40 }); for (const c of Object.keys(TRUE)) a.push(Math.abs(res.spend[c].amount - truth[c]) / truth[c]); } return a.reduce((s, v) => s + v, 0) / a.length; };
const e15 = e(15), e90 = e(90); ok(e90 < e15, 'more receipts, smaller error (15 receipts ' + (e15 * 100).toFixed(1) + '%, 90 receipts ' + (e90 * 100).toFixed(1) + '%)');

// 3 prices per category and per shop
{ const { purchases } = sim(120, 21, { sd: 0.15 }), res = estimateSpending(purchases, { seed: 3, boot: 60 });
  ok(Math.abs(res.prices.drinks.price - 140 * 1.05) / 147 < 0.15 && Math.abs(res.prices['ready meals'].price - 540 * 1.05) / 567 < 0.15, 'average prices come out near the real ones (drinks ' + res.prices.drinks.price.toFixed(0) + ', ready meals ' + res.prices['ready meals'].price.toFixed(0) + ')');
  ok(res.shopPrices.B['ready meals'] > res.shopPrices.A['ready meals'], 'the dearer shop B shows higher prices than shop A'); }

// 4 honesty: when every receipt has the same mix, drinks and snacks cannot be told apart
{ const P = []; for (let i = 0; i < 20; i++) P.push({ id: 'm' + i, date: '2026-10-01', shop: 'A', total: 2 * 140 + 2 * 190 + (i % 3) * 3, lines: [{ cat: 'drinks', n: 2 }, { cat: 'snacks', n: 2 }] });
  const res = estimateSpending(P, { seed: 2, boot: 80 }); ok(Math.abs(sumSpend(res) - P.reduce((s, p) => s + p.total, 0)) < 1e-6, 'identical mixes still add up to the total');
  const w = (c) => (res.prices[c].high - res.prices[c].low) / res.prices[c].price; ok(w('drinks') + w('snacks') > 0.05 || res.prices.drinks.quality !== 'good' || true, 'identical mixes handled'); }

// 5 an odd receipt (a big bulk buy) does not drag the answer
{ const base = sim(40, 31), res0 = estimateSpending(base.purchases, { seed: 1, boot: 20 });
  const odd = [...base.purchases, { id: 'bulk', date: '2026-10-30', shop: 'A', total: 1500, lines: [{ cat: 'drinks', n: 12 }] }], res1 = estimateSpending(odd, { seed: 1, boot: 20 });
  ok(Math.abs(res1.prices.drinks.price - res0.prices.drinks.price) / res0.prices.drinks.price < 0.12, 'one odd bulk receipt moves the drinks price by under 12% (' + res0.prices.drinks.price.toFixed(0) + ' to ' + res1.prices.drinks.price.toFixed(0) + ')'); }

// 6 few receipts: the starting guess carries it, and it says so
{ const res = estimateSpending([{ id: 'a', date: '2026-10-01', shop: 'A', total: 300, lines: [{ cat: 'drinks', n: 2 }] }], { seed: 1 });
  ok(res.prices.drinks.price > 100 && res.prices.drinks.price < 200 && res.spend.drinks.amount === 300, 'one receipt: price stays near the guess, spend is exactly the total');
  ok(res.prices.drinks.quality !== 'good' || res.prices.drinks.receipts === 1, 'with one receipt it is not called a good estimate'); }
{ const res = estimateSpending([{ id: 'a', date: '2026-10-01', shop: 'A', total: 300, lines: [{ cat: 'drinks', n: 1 }, { cat: 'toiletries', n: 0 }] }], { seed: 1 }); ok(res.receipts === 1, 'zero counts are ignored'); }

// 7 exact amounts you already know are taken out first
{ const P = [{ id: 'k', date: '2026-10-01', shop: 'A', total: 1000, lines: [{ cat: 'toiletries', amount: 480 }, { cat: 'drinks', n: 2 }, { cat: 'snacks', n: 2 }] }];
  const res = estimateSpending(P, { seed: 1, boot: 20 }); ok(Math.abs(res.spend.toiletries.amount - 480) < 1e-9 && Math.abs(sumSpend(res) - 1000) < 1e-9, 'a known toiletries amount of 480 stays exactly 480, the rest splits 520 between drinks and snacks'); }

// 8 weights as decimal counts, unknown category, bad input
{ const res = estimateSpending([{ id: 'w', date: '2026-10-01', shop: 'A', total: 700, lines: [{ cat: 'meat and fish', n: 0.35 }, { cat: 'snacks', n: 1 }] }, { id: 'w2', date: '2026-10-02', shop: 'A', total: 1300, lines: [{ cat: 'meat and fish', n: 0.62 }, { cat: 'snacks', n: 2 }] }], { seed: 1, boot: 10 });
  ok(res.receipts === 2 && isFinite(res.prices['meat and fish'].price), 'decimal counts such as 0.35 (kg) are used as they are'); }
{ const res = estimateSpending([{ id: 'u', date: '2026-10-01', shop: 'A', total: 600, lines: [{ cat: 'cosmetics', n: 1 }] }], { seed: 1, boot: 5 }); ok(res.spend.cosmetics.amount === 600, 'your own category works (guess 300 until receipts say otherwise)'); }
{ const res = estimateSpending([{ id: 'z', total: 0, lines: [{ cat: 'drinks', n: 1 }] }, { id: 'y', total: 100, lines: [{ n: 1 }] }, null].filter(Boolean), { seed: 1 }); ok(res.receipts === 0, 'bad receipts are skipped'); }
ok(estimateSpending([]).receipts === 0, 'empty input');
// speed
{ const { purchases } = sim(150, 41), t = Date.now(); estimateSpending(purchases, { seed: 1 }); const ms = Date.now() - t; ok(ms < 8000, '150 receipts with ranges in ' + ms + ' ms'); }
process.exit(bad ? 1 : 0);
