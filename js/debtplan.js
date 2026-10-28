// Debt arithmetic, kept free of the page so it can be tested.
// A debt here is { id, owed, rate, addon, addonMonthly, min } in one currency (the home currency). rate = % a year on what is still owed.
// Interest a month: declining debts owe owed x monthly rate; add-on debts owe a fixed amount (addonMonthly) while anything is left.

export const monthlyRate = (ratePct) => { const r = (+ratePct || 0) / 100; return r > 0 ? Math.pow(1 + r, 1 / 12) - 1 : 0; };

// the number used to rank debts "highest interest first" (add-on: the fixed monthly charge as a yearly % of what is left)
export const rankRate = (d) => (d.addon ? (d.owed > 0 ? (d.addonMonthly * 12 / d.owed) * 100 : 0) : +d.rate || 0);

// order of payment: avalanche = highest interest first, snowball = smallest debt first; ties go to the sooner due date
export function orderDebts(debts, mode = 'avalanche') {
  const key = (d) => (d.days == null ? 1e6 : d.days);
  return [...debts].sort((a, b) => (mode === 'snowball' ? (a.owed - b.owed) || (rankRate(b) - rankRate(a)) : (rankRate(b) - rankRate(a)) || (a.owed - b.owed)) || key(a) - key(b));
}

// What to pay this month. Minimums first (in order if the money cannot cover them all), then the rest to the first debt in line.
export function allocate(debts, budget, mode = 'avalanche') {
  const list = orderDebts(debts.filter((d) => d.owed > 0.004), mode); let left = Math.max(0, budget || 0);
  const rows = list.map((d) => ({ id: d.id, min: Math.min(d.min || 0, d.owed), pay: 0, extra: 0, short: 0 }));
  for (const r of rows) { const p = Math.min(r.min, left); r.pay = p; r.short = r.min - p; left -= p; }
  for (let i = 0; i < rows.length && left > 0.004; i++) { const d = list[i], room = Math.max(0, d.owed - rows[i].pay), x = Math.min(room, left); rows[i].extra = x; rows[i].pay += x; left -= x; }
  return { rows, leftover: left, minTotal: rows.reduce((s, r) => s + r.min, 0), shortTotal: rows.reduce((s, r) => s + r.short, 0) };
}

// Month by month until every debt is paid. Freed-up money rolls to the next debt in line. Gives up after 50 years or when nothing shrinks.
export function simulate(debts, budget, mode = 'avalanche', maxMonths = 600) {
  let ds = debts.filter((d) => d.owed > 0.004).map((d) => ({ ...d })); const start = ds.length; let interest = 0, m = 0; const paidOff = [];
  if (!ds.length) return { months: 0, interest: 0, never: false, paidOff };
  let last = ds.reduce((s, d) => s + d.owed, 0);
  while (ds.length && m < maxMonths) {
    m++;
    for (const d of ds) { const i = d.addon ? d.addonMonthly : d.owed * monthlyRate(d.rate); d.owed += i; interest += i; }
    const a = allocate(ds, budget, mode), by = new Map(a.rows.map((r) => [r.id, r.pay]));
    for (const d of ds) { d.owed = Math.max(0, d.owed - (by.get(d.id) || 0)); if (d.owed <= 0.004) paidOff.push({ id: d.id, month: m }); }
    ds = ds.filter((d) => d.owed > 0.004);
    const now = ds.reduce((s, d) => s + d.owed, 0);
    if (m >= 24 && ds.length && now >= last - 1e-6 && m % 12 === 0) return { months: m, interest, never: true, paidOff, left: ds.length, start };
    if (m % 12 === 0) last = now;
  }
  return { months: m, interest, never: ds.length > 0, paidOff, left: ds.length, start };
}

// "Can I pay?" light from what you can put toward debts each month against the minimums
export function light(budget, minTotal) {
  if (budget == null) return { color: 'none', text: '' };
  if (!(minTotal > 0)) return { color: 'green', text: '' };
  if (budget < minTotal) return { color: 'red', text: 'short' };
  return budget >= minTotal * 1.25 ? { color: 'green', text: 'ok' } : { color: 'yellow', text: 'tight' };
}

// Share of income that Sukli will suggest for all debts together. Minimums that are due still show in full (never hidden), and a figure you
// type yourself can go above this only if you choose "Use my figure anyway".
export const DEBT_SHARE = 0.4;

// What a normal month looks like, from up to the last 3 whole months of entries.
// classify(t) -> { name, cls } for an expense entry (cls: need, want or luxury). Interest the app charged itself is left out.
// Income is kept careful: if one month was much lower than the others, it counts halfway toward that low month.
export function learnMonths(txs, toHome, thisMonth, shiftMonth, classify = () => ({ name: 'Other', cls: 'want' })) {
  const months = [1, 2, 3].map((n) => shiftMonth(thisMonth, -n)), rows = [], cats = new Map();
  for (const ym of months) {
    let inc = 0, out = 0, need = 0, n = 0;
    for (const t of txs) {
      if (t.deleted || t.autoDebt || !String(t.date).startsWith(ym)) continue;
      if (t.kind === 'income') { inc += toHome(t); n++; }
      else if (t.kind === 'expense') { const v = toHome(t), c = classify(t) || {}; out += v; n++; if (c.cls === 'need') need += v; const k = c.name || 'Other'; const o = cats.get(k) || { name: k, cls: c.cls || 'want', total: 0 }; o.total += v; cats.set(k, o); }
    }
    if (n) rows.push({ ym, inc, out, need });
  }
  if (!rows.length) return null;
  const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length, lowInc = Math.min(...rows.map((r) => r.inc)), avgInc = avg('inc');
  const income = rows.length > 1 && lowInc < avgInc * 0.7 ? (avgInc + lowInc) / 2 : avgInc;
  return { months: rows.length, income, rawIncome: avgInc, spend: avg('out'), needs: avg('need'), free: Math.max(0, income - avg('out')),
    cats: [...cats.values()].map((c) => ({ name: c.name, cls: c.cls, avg: c.total / rows.length })).sort((a, b) => b.avg - a.avg) };
}
// kept for older callers
export const learnBudget = (txs, toHome, thisMonth, shiftMonth) => { const m = learnMonths(txs, toHome, thisMonth, shiftMonth); return m && { months: m.months, income: m.income, spend: m.spend, free: m.free }; };

// How much can go to debts this month. safe = income minus usual living costs; a cushion of 10% of income is kept back, and the share cap keeps the suggestion from eating the whole income.
// A figure you typed is respected up to that room, or fully when force is on.
export const CUSHION = 0.1;
export function cashRoom({ income, spend, typed = null, force = false }) {
  const safe = income == null ? null : Math.max(0, income - (spend || 0)), cap = income == null ? null : income * DEBT_SHARE, buffer = income == null ? 0 : income * CUSHION;
  const room = safe == null ? null : Math.max(0, Math.min(safe - buffer, cap));
  const use = typed != null ? (force ? typed : (room == null ? typed : Math.min(typed, room))) : room;
  return { safe, cap, buffer, room, use, typedCapped: typed != null && !force && room != null && typed > room + 0.5, share: income > 0 && use != null ? use / income : null };
}

// Payment habit into one debt, from transfers into it: { n, months (of the last 6 with a payment), usual (typical amount), last }
export function habit(payments, today, monthsBack = 6) {
  const [y, m] = today.split('-').map(Number), from = new Date(y, m - 1 - monthsBack, 1), cut = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`;
  const list = payments.filter((p) => p.date.slice(0, 10) >= cut && p.date.slice(0, 10) <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const ms = new Set(list.map((p) => p.date.slice(0, 7))), amts = list.map((p) => p.amount).sort((a, b) => a - b);
  const mid = amts.length ? (amts.length % 2 ? amts[(amts.length - 1) / 2] : (amts[amts.length / 2 - 1] + amts[amts.length / 2]) / 2) : 0;
  return { n: list.length, months: ms.size, usual: ms.size >= 2 ? mid : 0, last: list.length ? list[list.length - 1].date.slice(0, 10) : '' };
}

// This month's plan. Debts: { id, owed, rate, addon, addonMonthly, min, paid (already paid this month), usual, days (to the next due date or null), overdue }.
// 1. what is due (overdue first, then the nearest due date), 2. what you usually pay when that is more than the minimum, 3. any money left to the first debt
// in line (highest interest first or smallest first, with a due-soon nudge). Never more than funds; what cannot be covered is reported as short.
export function planMonth(debts, funds, mode = 'avalanche') {
  let left = Math.max(0, funds || 0);
  const act = debts.filter((d) => d.owed > 0.004);
  const rows = act.map((d) => { const need = Math.min(d.owed, Math.max(0, (d.min || 0) - (d.paid || 0))); const want = Math.min(d.owed, Math.max(need, (d.usual || 0) - (d.paid || 0))); return { id: d.id, d, need, want, base: 0, topup: 0, extra: 0, short: 0 }; });
  const dueKey = (r) => (r.d.overdue ? -1e6 + (r.d.days || 0) : r.d.days == null ? 1e6 : r.d.days);
  const byDue = [...rows].sort((a, b) => dueKey(a) - dueKey(b) || rankRate(b.d) - rankRate(a.d) || a.d.owed - b.d.owed);
  for (const r of byDue) { const p = Math.min(r.need, left); r.base = p; r.short = r.need - p; left -= p; }
  const soon = (r) => (r.d.overdue || (r.d.days != null && r.d.days <= 7) ? 0 : 1);
  const prio = (a, b) => soon(a) - soon(b) || (mode === 'snowball' ? (a.d.owed - b.d.owed) || (rankRate(b.d) - rankRate(a.d)) : (rankRate(b.d) - rankRate(a.d)) || (a.d.owed - b.d.owed));
  const byPrio = [...rows].sort(prio);
  for (const r of byPrio) { const x = Math.min(r.want - r.need, left); if (x > 0.004) { r.topup = x; left -= x; } }
  for (const r of byPrio) { if (left <= 0.004) break; const room = Math.max(0, r.d.owed - (r.paid || 0) - r.base - r.topup), x = Math.min(room, left); if (x > 0.004) { r.extra = x; left -= x; break; } }   // extra goes to the first debt in line that can still take it
  const out = byDue.map((r) => ({ id: r.id, need: r.need, base: r.base, topup: r.topup, extra: r.extra, pay: r.base + r.topup + r.extra, short: r.short, min: r.d.min, paid: r.d.paid || 0 }));
  const needTotal = rows.reduce((s, r) => s + r.need, 0), shortTotal = out.reduce((s, r) => s + r.short, 0);
  return { rows: out, leftover: left, needTotal, shortTotal, payTotal: out.reduce((s, r) => s + r.pay, 0), firstId: (byPrio[0] || {}).id || null };
}

// Ways to free up money: trim the biggest want and luxury categories a little (about 20%, more if the gap is large) until the gap is covered.
export function suggestCuts(cats, gap) {
  if (!(gap > 0)) return { rows: [], covered: 0, gap: 0 };
  const pool = cats.filter((c) => c.cls !== 'need' && c.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 5), pct = gap > pool.reduce((s, c) => s + c.avg * 0.2, 0) ? 0.4 : 0.2;
  const rows = []; let covered = 0;
  for (const c of pool) { if (covered >= gap) break; const cut = Math.min(c.avg * pct, gap - covered + c.avg * 0.02); rows.push({ name: c.name, avg: c.avg, cut, pct: Math.round(cut / c.avg * 100) }); covered += cut; }
  return { rows, covered, gap, enough: covered >= gap - 0.5 };
}
