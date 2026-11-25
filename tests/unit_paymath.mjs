import { estimate, profileOf, effective, GUESS } from '../js/paymath.js';
let f = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const rates = { JPY: 0.4, PHP: 1, USDT: 58 }, per = (c) => rates[c] || 0;
const r = estimate({ amount: 1500, cur: 'JPY', home: 'PHP', per, methods: [
  { id: 'c', label: 'Card', cur: 'PHP', profile: { markup: 1, fee: 2, flat: 0, cashback: 1 } },
  { id: 'd', label: 'Debit', cur: 'PHP', profile: { markup: 0, fee: 1, flat: 0, cashback: 0 } },
  { id: 'j', label: 'JPY bank', cur: 'JPY', profile: { markup: 5, fee: 5, flat: 100, cashback: 0 } },
  { id: 'u', label: 'USDT', cur: 'USDT', profile: { markup: 0.5, fee: 0.1, flat: 0, cashback: 0 } },
  { id: 'x', label: 'No rate', cur: 'ZZZ', profile: {} }] });
ok('cash cost is price x market', r.ok && near(r.cashHome, 600));
const c = r.rows.find((x) => x.id === 'c'), d = r.rows.find((x) => x.id === 'd');
ok('card: network rate = market x (1+markup)', near(c.network, 0.4 * 1.01));
ok('card: fee then cashback', near(c.charged, 606) && near(c.feeAmt, 12.12) && near(c.cashbackAmt, 6.1812) && near(c.pay, 606 + 12.12 - 6.1812));
ok('debit is cheaper than card here', d.costHome < c.costHome && near(d.diff, 6));
ok('same currency has no conversion or fee', r.rows.find((x) => x.id === 'j').same && near(r.rows.find((x) => x.id === 'j').costHome, 600));
const u = r.rows.find((x) => x.id === 'u'); ok('USDT goes through the home value', near(u.costHome, 1500 * 0.4 / 58 * 1.005 * 1.001 * 58));
ok('a method without a rate is listed last and marked', r.rows[r.rows.length - 1].noRate);
ok('cheapest is flagged', r.best === 'j' || r.best === 'd');
ok('diff % is against cash', near(d.diffPct, 1));
ok('no price gives a message', !estimate({ amount: 0, cur: 'JPY', home: 'PHP', per }).ok);
ok('no rate for the price currency gives a message', /no exchange rate/.test(estimate({ amount: 5, cur: 'ZZZ', home: 'PHP', per }).why));
ok('profile falls back to the type guess', profileOf({ type: 'card' }).fee === GUESS.card.fee && !profileOf({ type: 'card' }).own);
ok('own settings win', profileOf({ type: 'card', pay: { markup: 3, fee: 0, flat: 0, cashback: 2 } }).markup === 3 && profileOf({ type: 'card', pay: { markup: 3 } }).own);
const e = effective(606, 1500, 0.4); ok('effective rate vs market', near(e.rate, 0.404) && near(e.overPct, 1));
console.log(f ? 'FAILED ' + f : 'all passed'); process.exit(f ? 1 : 0);
