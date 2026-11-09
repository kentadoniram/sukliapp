// Performance of each TOKEN (a coin or stock, across every platform and wallet that holds it): what you still hold and its value,
// what it cost, profit on paper (unrealized), profit locked in by selling (realized), what it paid you (Earn interest and other income), the fees it cost,
// and the total return. All in your home currency. Costs are only known for units bought through Buy / sell (or a figure you typed); the rest is left out, never guessed.
import { balances, homeFx, factorFor } from './core.js';

const STABLE = new Set(['USD', 'USDT', 'USDC', 'DAI', 'FDUSD']);
export function tokenPerformance(db, book, accts, home) {
  const bal = balances(db), by = new Map(), ids = new Map();   // cur -> row, account id -> cur
  const row = (cur) => { if (!by.has(cur)) by.set(cur, { cur, qty: 0, value: 0, cost: 0, costQty: 0, unreal: 0, realized: 0, soldCost: 0, earned: 0, income: 0, fees: 0, trades: 0, first: '', platforms: new Set(), accounts: [] }); return by.get(cur); };
  for (const a of accts) {
    const r = row(a.cur), q = bal.get(a.id) || 0, px = a.cur === home ? 1 : homeFx(db, a.cur) || 0, p = book.pos.get(a.id);
    ids.set(a.id, a.cur); r.accounts.push(a.id); if (a.exchange) r.platforms.add(a.exchange);
    if (q > 0) { r.qty += q; r.value += q * px; }
    const cost = p && p.qty > 0 && p.cost > 0 ? p.cost : (a.costHome > 0 && q > 0 ? a.costHome : 0), cq = p && p.qty > 0 && p.cost > 0 ? p.qty : (cost > 0 ? q : 0);
    if (cost > 0 && px > 0) { r.cost += cost; r.costQty += cq; r.unreal += cq * px - cost; }
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
  return [...by.values()].filter((r) => r.value > 0 || r.realized || r.earned || r.income || r.fees || r.trades).map((r) => {
    const gain = r.unreal + r.realized + r.earned + r.income, invested = r.cost + r.soldCost;
    return { ...r, platforms: [...r.platforms].sort(), gain, invested, pct: invested > 0 ? gain / invested * 100 : null, cashLike: STABLE.has(r.cur) || r.cur === home };
  }).sort((a, b) => b.value - a.value);
}
