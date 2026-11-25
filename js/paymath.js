// Paying abroad: what a purchase would cost through each payment method (16.34). Pure maths, no screens.
// These are ESTIMATES for choosing a way to pay. They are never recorded as spending: the amount that actually posted is always the source of truth.
//   price (in the shop's currency)  ->  at the card network's rate (market rate + markup)  ->  plus foreign fee (percent and flat)  ->  minus cashback  =  you pay (in the method's currency)
//   you pay x home value of that currency = cost in home currency; the difference is measured against paying cash in the shop's currency.
// Starting guesses per account type are only a place to start: they are shown as "starting guess" until you set your own.
export const GUESS = { card: { markup: 0, fee: 2, flat: 0, cashback: 0 }, bank: { markup: 0, fee: 1, flat: 0, cashback: 0 }, ewallet: { markup: 1, fee: 0, flat: 0, cashback: 0 }, ic: { markup: 0, fee: 0, flat: 0, cashback: 0 }, crypto: { markup: 0.5, fee: 0.1, flat: 0, cashback: 0 }, cash: { markup: 1.5, fee: 0, flat: 0, cashback: 0 } };
const n = (x) => (Number.isFinite(+x) ? +x : 0);
// the assumptions for an account: what you saved on it (acct.pay), otherwise the starting guess for its type
export function profileOf(acct) {
  const own = acct && acct.pay && typeof acct.pay === 'object', g = GUESS[acct && acct.type] || GUESS.bank, p = own ? acct.pay : g;
  return { markup: n(p.markup), fee: n(p.fee), flat: n(p.flat), cashback: n(p.cashback), own: !!own };
}
// estimate({ amount, cur, home, per: (cur) => home value of one unit (0 when unknown), methods: [{ id, label, cur, profile }] })
export function estimate({ amount, cur, home, per, methods = [] }) {
  const a = n(amount), pc = per(cur);
  if (!(a > 0)) return { ok: false, why: 'Enter the price.' };
  if (!(pc > 0)) return { ok: false, why: `There is no exchange rate for ${cur} yet.` };
  const cashHome = a * pc, rows = [];
  for (const m of methods) {
    const ps = per(m.cur), p = m.profile || { markup: 0, fee: 0, flat: 0, cashback: 0 };
    if (!(ps > 0)) { rows.push({ id: m.id, label: m.label, cur: m.cur, noRate: true, profile: p }); continue; }
    const same = m.cur === cur, market = pc / ps;                       // 1 unit of the shop's currency in the method's currency, at the market rate
    const network = same ? 1 : market * (1 + p.markup / 100);            // the rate the card network / provider actually uses
    const charged = a * (same ? 1 : network);
    const feeAmt = same ? 0 : charged * p.fee / 100 + p.flat;
    const cashbackAmt = (charged + feeAmt) * p.cashback / 100;
    const pay = charged + feeAmt - cashbackAmt, costHome = pay * ps;
    rows.push({ id: m.id, label: m.label, cur: m.cur, same, market: same ? 1 : market, network, charged, feeAmt, cashbackAmt, pay, costHome, diff: costHome - cashHome, diffPct: cashHome > 0 ? (costHome - cashHome) / cashHome * 100 : 0, profile: p });
  }
  const priced = rows.filter((r) => !r.noRate); priced.sort((x, y) => x.costHome - y.costHome);
  const best = priced.length ? priced[0].id : null, ordered = [...priced, ...rows.filter((r) => r.noRate)];
  return { ok: true, cur, home, amount: a, market: pc, cashHome, rows: ordered, best };
}
// what a posted amount really worked out to, against the market rate at the time (for the entry's own record)
export function effective(postedHome, amount, mid) {
  const a = n(amount), p = n(postedHome); if (!(a > 0) || !(p > 0)) return null;
  const rate = p / a; return { rate, mid: n(mid), overPct: mid > 0 ? (rate - mid) / mid * 100 : null };
}
