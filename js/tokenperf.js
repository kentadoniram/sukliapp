// Performance of each TOKEN (a coin or stock, across every platform and wallet that holds it): what you still hold and its value,
// what it cost, profit on paper (unrealized), profit locked in by selling (realized), what it paid you (Earn interest and other income), the fees it cost,
// and the total return. All in your home currency. Costs are only known for units bought through Buy / sell (or a figure you typed); the rest is left out, never guessed.
import { balances, homeFx, factorFor } from './core.js';

// Units an account received as interest or income (they have no purchase cost, and are counted as "earned", never as profit on paper).
export function earnedUnits(db) {
  const m = new Map();
  for (const t of db.txs) if (!t.deleted && t.kind === 'income' && (t.earnDay || t.invIncome)) m.set(t.acct, (m.get(t.acct) || 0) + (t.amount || 0));
  return m;
}
// What the units we know the cost of cost, and how many they are: units bought by trades, or else the cost typed on the account (minus interest units, which came free).
export function openCost(a, q, p, got) {
  if (p && p.qty > 0 && p.cost > 0) return { cost: p.cost, qty: p.qty };
  if (a.costHome > 0 && q > 0) { const qq = Math.max(0, q - ((got && got.get(a.id)) || 0)); return qq > 0 ? { cost: a.costHome, qty: qq } : { cost: 0, qty: 0 }; }
  return { cost: 0, qty: 0 };
}
const STABLE = new Set(['USD', 'USDT', 'USDC', 'DAI', 'FDUSD']);
export function tokenPerformance(db, book, accts, home) {
  const bal = balances(db), by = new Map(), ids = new Map();   // cur -> row, account id -> cur
  const row = (cur) => { if (!by.has(cur)) by.set(cur, { cur, qty: 0, value: 0, cost: 0, costQty: 0, unreal: 0, realized: 0, soldCost: 0, earned: 0, income: 0, fees: 0, trades: 0, first: '', platforms: new Set(), accounts: [] }); return by.get(cur); };
  const got = earnedUnits(db);
  for (const a of accts) {
    const r = row(a.cur), q = bal.get(a.id) || 0, px = a.cur === home ? 1 : homeFx(db, a.cur) || 0, p = book.pos.get(a.id);
    ids.set(a.id, a.cur); r.accounts.push(a.id); if (a.exchange) r.platforms.add(a.exchange);
    if (q > 0) { r.qty += q; r.value += q * px; }
    const o = openCost(a, q, p, got);
    if (o.cost > 0 && px > 0) { r.cost += o.cost; r.costQty += o.qty; r.unreal += o.qty * px - o.cost; }
  }
  for (const x of book.realized) { const cur = ids.get(x.acct); if (!cur) continue; const r = row(cur); r.realized += x.gain; r.soldCost += x.cost; r.trades++; }
  const tradeTx = db.txs.filter((t) => !t.deleted && t.trade), tIds = new Map(tradeTx.map((t) => [t.id, t]));
  for (const t of tradeTx) {
    const cur = ids.get(t.trade.asset) || ids.get(t.trade.asset2); if (!cur) continue; const r = row(cur);
    if (!r.first || t.date < r.first) r.first = t.date;
    if (t.fee > 0) r.fees += t.fee * factorFor(db, t, t.feeCur || t.cur, t.feeFx || t.fx);
    if (t.trade.side === 'buy') r.trades++;
  }
  for (const t of db.txs) {
    if (t.deleted) continue;
    if (t.tradeOf && tIds.has(t.tradeOf)) { const tr = tIds.get(t.tradeOf), cur = ids.get(tr.trade.asset) || ids.get(tr.trade.asset2); if (cur) row(cur).fees += t.amount * factorFor(db, t); }
    else if (t.kind === 'income' && (t.earnDay || t.invIncome)) { const cur = t.invIncome ? ids.get(t.invIncome.asset) : t.cur; if (!cur || !by.has(cur)) continue; const v = t.amount * factorFor(db, t); const r = row(cur); if (t.earnDay) r.earned += v; else r.income += v; }
  }
  // the selling fee assumed for breakeven: what you really paid on this token's trades (fees / value traded), else 0.1%
  const feeIn = new Map(), valIn = new Map();
  for (const t of tradeTx) { const cur = ids.get(t.trade.asset) || ids.get(t.trade.asset2); if (!cur || !(t.trade.valueHome > 0)) continue; const f = (t.trade.feeHome || 0); feeIn.set(cur, (feeIn.get(cur) || 0) + f); valIn.set(cur, (valIn.get(cur) || 0) + t.trade.valueHome); }
  return [...by.values()].filter((r) => r.value > 0 || r.realized || r.earned || r.income || r.fees || r.trades).map((r) => {
    // gain = trading profit and loss only (paper profit + profit from selling, fees already inside). Interest and other income are kept apart in earned / income; total = all of it.
    const gain = r.unreal + r.realized, total = gain + r.earned + r.income, invested = r.cost + r.soldCost;
    const avgCost = r.costQty > 0 && r.cost > 0 ? r.cost / r.costQty : null;
    const feeRate = valIn.get(r.cur) > 0 ? Math.min(0.05, Math.max(0, feeIn.get(r.cur) / valIn.get(r.cur))) || 0.001 : 0.001;
    /* breakeven: the price per unit at which selling everything you hold (after the selling fee) brings your trading profit and loss to zero. Interest is not counted. */
    const breakeven = avgCost == null ? null : Math.max(0, (r.cost - r.realized) / (r.costQty * (1 - feeRate)));
    return { ...r, avgCost, breakeven, feeRate, platforms: [...r.platforms].sort(), gain, total, invested, pct: invested > 0 ? gain / invested * 100 : null, totalPct: invested > 0 ? total / invested * 100 : null, cashLike: STABLE.has(r.cur) || r.cur === home };
  }).sort((a, b) => b.value - a.value);
}
