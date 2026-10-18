// Spending safety: before an expense is saved, compare it with income, real cash, card bills and budgets.
import { monthParts, balances, rateFor, catMap, fmt } from './core.js';
import { cardInfo, today } from './finance.js';

export const SAFE_DEFAULT = { period: 'month', warnAt: 80, cardPct: 50, reserve: 0 };
export const safeCfg = (db) => ({ ...SAFE_DEFAULT, ...(db.settings.safety || {}) });
const NOT_CASH = ['card', 'loan', 'asset', 'invest', 'receivable'];
const sum = (l) => l.reduce((n, v) => n + v, 0);

// p = { amount (in the account's currency), acct (account id), cat (category id) }; returns warnings, worst first
export function safetyCheck(db, p) {
  const cfg = safeCfg(db), t0 = today(), [y, m, d] = t0.split('-').map(Number);
  const a = db.accounts.find((x) => x.id === p.acct);
  if (!a || !(p.amount > 0)) return [];
  const rate = rateFor(db, a.cur) || 1, x = p.amount * rate, money = (v) => fmt(v);
  const pad = (n) => String(n).padStart(2, '0'), ymd = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const start = cfg.period === 'rolling30' ? ymd(new Date(y, m - 1, d - 29)) : `${y}-${pad(m)}-01`;
  const months = [...new Set([start.slice(0, 7), t0.slice(0, 7)])];
  const parts = months.flatMap((mm) => monthParts(db, mm)).filter((q) => { const dd = q.t.date.slice(0, 10); return dd >= start && dd <= t0; });
  const income = sum(parts.filter((q) => q.kind === 'income').map((q) => q.v));
  const spent = sum(parts.filter((q) => q.kind !== 'income').map((q) => q.v));
  const bal = balances(db), live = db.accounts.filter((z) => !z.deleted && !z.archived);
  const cash = sum(live.filter((z) => z.include && !NOT_CASH.includes(z.type)).map((z) => (bal.get(z.id) || 0) * (rateFor(db, z.cur) || 1)));
  let cardOwed = 0, dueSoon = 0;
  for (const z of live.filter((c) => c.type === 'card')) {
    const c = cardInfo(db, z, bal.get(z.id)), r = rateFor(db, z.cur) || 1;
    cardOwed += c.owed * r;
    if (c.cycle) { if (c.cycle.days <= 30) dueSoon += c.cycle.amountDue * r; } else if (c.due && c.days <= 30) dueSoon += c.owed * r;
  }
  const onCard = a.type === 'card';
  const spent2 = spent + x, cash2 = onCard ? cash : cash - x, card2 = cardOwed + (onCard ? x : 0), due2 = dueSoon + (onCard ? x * 0 : 0);
  const per = cfg.period === 'rolling30' ? 'the last 30 days' : 'this month', out = [];
  if (income <= 0) out.push({ level: 'warn', text: `No income is recorded for ${per}. This ${money(x)} comes out of your balance (${money(cash2)} would be left).` });
  else if (spent2 > income) out.push({ level: 'bad', text: `Spending for ${per} would be ${money(spent2)}, more than the ${money(income)} you earned. You may have to use savings; consider holding back on spending that can wait.` });
  else if (spent2 >= income * cfg.warnAt / 100) out.push({ level: 'warn', text: `Spending for ${per} would reach ${Math.round(spent2 / income * 100)}% of your income (${money(spent2)} of ${money(income)}).` });
  if (income > 0 && card2 > income * cfg.cardPct / 100) out.push({ level: card2 > income ? 'bad' : 'warn', text: `Card balances would be ${money(card2)}, ${Math.round(card2 / income * 100)}% of your income for ${per}. Pay them down before adding more.` });
  if (due2 > 0 && cash2 - due2 < cfg.reserve) out.push({ level: cash2 - due2 < 0 ? 'bad' : 'warn', text: cash2 - due2 < 0 ? `Card payments of ${money(due2)} are due within 30 days and your cash after this would be ${money(cash2)}. You would have to use savings or borrow to pay them.` : `After the ${money(due2)} of card payments due soon, only ${money(cash2 - due2)} of cash would remain, below the ${money(cfg.reserve)} you want to keep.` });
  else if (cash2 < cfg.reserve) out.push({ level: cash2 < 0 ? 'bad' : 'warn', text: `Cash would drop to ${money(cash2)}, below the ${money(cfg.reserve)} you want to keep.` });
  const g = (catMap(db).get(p.cat) || {}).group, bud = g && db.budgets.find((b) => !b.deleted && b.group === g && b.amount > 0);
  if (bud) {
    const gs = sum(monthParts(db, t0.slice(0, 7)).filter((q) => q.kind !== 'income' && q.group === g).map((q) => q.v)) + x;
    if (gs > bud.amount) out.push({ level: 'bad', text: `This puts ${g} over its monthly budget: ${money(gs)} of ${money(bud.amount)}.` });
    else if (gs >= bud.amount * cfg.warnAt / 100) out.push({ level: 'warn', text: `${g} would be at ${Math.round(gs / bud.amount * 100)}% of its monthly budget.` });
  }
  return out.sort((q, w) => (w.level === 'bad') - (q.level === 'bad'));
}
