// Item price solver: cupcake example, tax 8/10 with per-group rounding, decimal weights, price change, typed price, item identity.
import { solveShop, parseQty, itemKey, sameCandidates, typicalFor } from '../js/itemsolve.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const P = (id, date, total, items) => ({ id, date, total, items });
const I = (name, qty, tax = 0, unit = 'pc') => ({ name, qty, tax, unit });
const get = (r, name) => r.items.find((i) => i.names.includes(name));

// 1 quantities are exact
let q = parseQty('0.35', 'kg'); ok(q.ok && q.milli === 350 && q.text === '0.35', '0.35 kg is exactly 350 thousandths');
q = parseQty('0,35', 'kg'); ok(q.ok && q.milli === 350, 'comma decimal 0,35 is 0.35');
q = parseQty('1.5', 'pc'); ok(!q.ok && /whole/i.test(q.error), 'pieces reject a decimal and say why');
q = parseQty('2', 'pc'); ok(q.ok && q.milli === 2000, '2 pieces');
q = parseQty('0.0004', 'kg'); ok(!q.ok, 'too many decimals are refused, never rounded to 0 or 1');
q = parseQty('0', 'kg'); ok(!q.ok, 'zero is refused');
q = parseQty('1,200', 'g'); ok(q.ok && q.milli === 1200000, '1,200 g is twelve hundred');
q = parseQty('0.350', 'kg'); ok(q.ok && q.milli === 350, '0.350 kg is 350 thousandths');

// 2 the user's example: 2 cupcakes + 1 bottle = 120, then 1 + 1 = 70
let r = solveShop([P('a', '2026-10-01', 120, [I('Cupcake', 2), I('Water bottle', 1)])]);
ok(get(r, 'Cupcake').status === 'narrowed' && get(r, 'Cupcake').high <= 60.5 && get(r, 'Water bottle').status === 'narrowed', 'one purchase alone gives only ranges');
r = solveShop([P('a', '2026-10-01', 120, [I('Cupcake', 2), I('Water bottle', 1)]), P('b', '2026-10-05', 70, [I('Cupcake', 1), I('Water bottle', 1)])]);
ok(get(r, 'Cupcake').status === 'solved' && get(r, 'Cupcake').price === 50 && get(r, 'Water bottle').price === 20, 'two purchases solve cupcake 50 and bottle 20');

// 3 Japan tax: food 8%, other 10%, rounded down per tax group
const tot = (lines) => { let f = 0, o = 0; for (const [p, qn, t] of lines) (t === 'food' ? (f += p * qn) : (o += p * qn)); return Math.floor(f * 1.08) + Math.floor(o * 1.10); };
const o1 = [['x', 3, 'food', 138], ['y', 1, 'other', 215]], o2 = [['x', 1, 'food', 138], ['y', 2, 'other', 215]], o3 = [['x', 2, 'food', 138], ['y', 3, 'other', 215]];
const T = (l) => tot(l.map(([, qn, t, p]) => [p, qn, t]));
r = solveShop([P('1', '2026-10-01', T(o1), [I('Onigiri', 3, 'food'), I('Bag', 1, 'other')]), P('2', '2026-10-02', T(o2), [I('Onigiri', 1, 'food'), I('Bag', 2, 'other')]), P('3', '2026-10-03', T(o3), [I('Onigiri', 2, 'food'), I('Bag', 3, 'other')])]);
const on = get(r, 'Onigiri'), bg = get(r, 'Bag');
ok(on.low <= 138 && on.high >= 138 && bg.low <= 215 && bg.high >= 215, 'tax mix: the true prices stay inside the ranges (rounding does not break it)');
ok(on.high - on.low <= 4 && bg.high - bg.low <= 4, 'tax mix: ranges are narrow (' + [on.low, on.high, bg.low, bg.high].map((v) => +v.toFixed(1)).join(' ') + ')');
ok(Math.abs(on.rate - 0.08) < 1e-9 && Math.abs(bg.rate - 0.10) < 1e-9, 'rates come from the food / other class');
// the rates are settings
r = solveShop([P('1', '2026-10-01', 108, [I('A', 1, 'food')])], { rates: { food: 0.10 } }); ok(get(r, 'A').high < 100, 'a changed food rate changes the answer');
// tax-included price is shown too
r = solveShop([P('1', '2026-10-01', 108, [I('Rice ball', 1, 'food')]), P('2', '2026-10-02', 216, [I('Rice ball', 2, 'food')])]);
ok(get(r, 'Rice ball').price === 100 && get(r, 'Rice ball').priceIncl === 108, 'price 100 before tax, 108 with tax');

// 4 decimal weights
const beef = (kg) => Math.floor(kg * 1980 * 1.08);
r = solveShop([P('w1', '2026-10-01', beef(0.35), [{ name: 'Beef', milli: 350, unit: 'kg', tax: 'food' }]), P('w2', '2026-10-04', beef(0.62), [{ name: 'Beef', milli: 620, unit: 'kg', tax: 'food' }])]);
const bf = get(r, 'Beef'); ok(bf.low <= 1980 && bf.high >= 1980 && bf.high - bf.low < 6, 'beef per kg stays near 1980 with real decimals (' + bf.low.toFixed(1) + ' to ' + bf.high.toFixed(1) + ')');
r = solveShop([P('w1', '2026-10-01', 200, [{ name: 'Flour', qty: 500, unit: 'g', tax: 0 }])]); ok(Math.abs(get(r, 'Flour').high - 400) < 1e-6 && get(r, 'Flour').unit === 'kg', '500 g for 200 means 400 per kg');
// a decimal weight changes the answer (it is not rounded to 0 or 1)
const a1 = solveShop([P('w', '2026-10-01', 700, [{ name: 'Pork', milli: 350, unit: 'kg', tax: 0 }])]), a2 = solveShop([P('w', '2026-10-01', 700, [{ name: 'Pork', milli: 1000, unit: 'kg', tax: 0 }])]);
ok(Math.abs(get(a1, 'Pork').high - 2000) < 1 && Math.abs(get(a2, 'Pork').high - 700) < 1, '0.35 kg and 1 kg give different prices per kg');

// 5 a price changed: the newest purchases win, older ones are left out and said so
r = solveShop([P('o', '2026-09-01', 120, [I('Cupcake', 2), I('Water bottle', 1)]), P('p', '2026-09-02', 70, [I('Cupcake', 1), I('Water bottle', 1)]),
  P('n1', '2026-10-20', 140, [I('Cupcake', 2), I('Water bottle', 1)]), P('n2', '2026-10-21', 80, [I('Cupcake', 1), I('Water bottle', 1)])]);
ok(get(r, 'Cupcake').price === 60 && get(r, 'Water bottle').price === 20 && r.dropped.length === 2 && r.notes.length === 1, 'price rise: new prices 60 / 20, two old purchases left out with a note');

// 6 a price you type solves the rest; a one-item purchase solves that item
r = solveShop([P('a', '2026-10-01', 120, [I('Cupcake', 2), I('Water bottle', 1)])], { typed: { 'Water bottle': { price: 20 } } });
ok(get(r, 'Cupcake').price === 50, 'typed bottle price 20 solves the cupcake');
r = solveShop([P('a', '2026-10-01', 120, [I('Cupcake', 2, 'other'), I('Water bottle', 1, 'other')])], { typed: { 'Water bottle': { price: 22, incl: true } } });
ok(get(r, 'Water bottle').status === 'solved' && get(r, 'Water bottle').price === 20, 'typed price with tax (22 incl. 10%) is 20 before tax');
r = solveShop([P('a', '2026-10-01', 50, [I('Gum', 1)])]); ok(get(r, 'Gum').price === 50, 'a single item purchase is solved');
// a scanned line price helps solve a typed purchase
r = solveShop([P('s', '2026-10-01', 120, [{ ...I('Cupcake', 2), line: 100 }, I('Water bottle', 1)])]); ok(get(r, 'Water bottle').price === 20 && get(r, 'Cupcake').price === 50, 'a scanned line price is an extra equation');
// more unknowns than equations: still honest
r = solveShop([P('a', '2026-10-01', 300, [I('A', 1), I('B', 1), I('C', 1)])]); ok(['A', 'B', 'C'].every((n) => get(r, n).status === 'narrowed'), 'three unknowns, one equation: all narrowed, none invented');
// whole-yen narrowing: 3 items, shared price must be whole
r = solveShop([P('a', '2026-10-01', 100, [I('A', 3, 'food')])]); ok(get(r, 'A').price === 31, 'whole yen: 3 x A with 8% tax = 100 (within rounding) can only be 31');
r = solveShop([P('a', '2026-10-01', 100, [I('A', 3, 'food')])], { whole: false }); ok(get(r, 'A').status === 'narrowed', 'without the whole-yen rule it stays a range');
r = solveShop([P('a', '2026-10-01', 100, [I('A', 3, 'food')])], { rounding: 'floor' }); ok(get(r, 'A').price === 31, 'a known rounding rule (floor) still agrees');

// 7 which items are one item
const kn = new Map([[itemKey('ポカリスエット 500ml'), true]]);
ok(itemKey('ポカリスエット　500ML', kn) === itemKey('ポカリスエット 500ml'), 'width and capital letters do not make a new item');
ok(itemKey('ポカリスエット 1L', kn) !== itemKey('ポカリスエット 500ml'), 'a different size is a different item');
const kn2 = new Map([[itemKey('pocari sweat 500ml'), true]]);
ok(itemKey('aquarius 500ml', kn2) !== itemKey('pocari sweat 500ml'), 'Aquarius is NOT joined with Pocari by itself');
ok(itemKey('Pocari Swet 500ml', kn2) === itemKey('pocari sweat 500ml'), 'a small typo joins the same item');
// without a link: narrowed; with the user's link: solved
const set = [P('a', '2026-10-01', 250, [I('Pocari 500ml', 1), I('Snack', 2)]), P('b', '2026-10-02', 200, [I('Aquarius 500ml', 1), I('Snack', 1)])];
r = solveShop(set); ok(['Pocari 500ml', 'Aquarius 500ml', 'Snack'].every((n) => get(r, n).status !== 'solved'), 'unlinked drinks: nothing is guessed');
r = solveShop(set, { same: { 'Aquarius 500ml': 'Pocari 500ml' } }); ok(get(r, 'Snack').price === 50 && get(r, 'Pocari 500ml').price === 150 && get(r, 'Pocari 500ml').names.length === 2, 'when you say they cost the same at this shop: snack 50, drink 150');
// suggestions only
r = solveShop([P('a', '2026-10-01', 150, [I('Pocari 500ml', 1)]), P('b', '2026-10-02', 150, [I('Aquarius 500ml', 1)]), P('c', '2026-10-03', 90, [I('Egg sandwich', 1)])]);
const cat = (i) => (/pocari|aquarius/.test(i.key) ? 'drinks' : 'meal');
ok(sameCandidates(r, cat).length === 1, 'same price in the same category is only suggested: "same price as?"');
ok(sameCandidates(r, () => '').length === 0, 'no category, no suggestion');
r = solveShop([P('a', '2026-10-01', 120, [I('Burger', 1)]), P('b', '2026-10-02', 90, [I('Egg sandwich', 1), I('Gum', 0 + 1)]), P('c', '2026-10-03', 30, [I('Gum', 1)])]);
const cat2 = (i) => (/burger|sandwich/.test(i.key) ? 'meal' : 'snack');
const gum = typicalFor(r, 'burger', cat2); ok(gum === null, 'a solved item gets no estimate');
r = solveShop([P('a', '2026-10-01', 120, [I('Burger', 1)]), P('b', '2026-10-02', 200, [I('Egg sandwich', 1), I('Tea', 1)])]);
const ty = typicalFor(r, 'egg sandwich', (i) => (/burger|sandwich/.test(i.key) ? 'meal' : 'drink')); ok(ty && ty.about && ty.low === 120 && ty.high === 120, 'egg sandwich gets only a labelled rough range from solved items in its category');
// bad input is skipped, never crashes
r = solveShop([P('x', '2026-10-01', 0, [I('A', 1)]), P('y', '2026-10-01', 100, [{ name: '', qty: 1 }])]); ok(r.items.length <= 1, 'bad purchases are skipped');
r = solveShop([]); ok(r.items.length === 0, 'empty input');
process.exit(bad ? 1 : 0);
