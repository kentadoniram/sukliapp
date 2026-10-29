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

// Steady payer: pays this debt in at least 4 of the last 6 months and about the installment (not more). Then the plan keeps to the installment.
export const steady = (d) => (d.payMonths || 0) >= 4 && d.min > 0 && !d.minEst && d.usual > 0 && d.usual <= d.min * 1.15;

// This month's plan for what must or usually gets paid. Debts: { id, owed, rate, addon, addonMonthly, min, paid (already paid this month), usual,
// payMonths, days (to the next due date or null), overdue, flex (no fixed deadline, such as a friend or family) }.
// 1. what is due (overdue first, then the nearest due date; flexible debts last and with no minimum), 2. what you usually pay when that is more than
// the minimum. Never more than funds; what cannot be covered is reported as short. Extra money is NOT assigned here (see suggestExtra).
export function planMonth(debts, funds, mode = 'avalanche') {
  let left = Math.max(0, funds || 0);
  const act = debts.filter((d) => d.owed > 0.004);
  const rows = act.map((d) => { const need = d.flex ? 0 : Math.min(d.owed, Math.max(0, (d.min || 0) - (d.paid || 0))); const want = d.flex ? need : Math.min(d.owed, Math.max(need, (d.usual || 0) - (d.paid || 0))); return { id: d.id, d, need, want, base: 0, topup: 0, extra: 0, short: 0 }; });
  const dueKey = (r) => (r.d.flex ? 2e6 : r.d.overdue ? -1e6 + (r.d.days || 0) : r.d.days == null ? 1e6 : r.d.days);
  const byDue = [...rows].sort((a, b) => dueKey(a) - dueKey(b) || rankRate(b.d) - rankRate(a.d) || a.d.owed - b.d.owed);
  for (const r of byDue) { const p = Math.min(r.need, left); r.base = p; r.short = r.need - p; left -= p; }
  const prio = priority(mode);
  const byPrio = [...rows].sort((a, b) => prio(a.d, b.d));
  for (const r of byPrio) { const x = Math.min(r.want - r.need, left); if (x > 0.004) { r.topup = x; left -= x; } }
  const out = byDue.map((r) => ({ id: r.id, need: r.need, base: r.base, topup: r.topup, extra: 0, pay: r.base + r.topup, short: r.short, min: r.d.min, paid: r.d.paid || 0, flex: !!r.d.flex, steady: steady(r.d) }));
  const needTotal = rows.reduce((s2, r) => s2 + r.need, 0), shortTotal = out.reduce((s2, r) => s2 + r.short, 0);
  return { rows: out, leftover: left, needTotal, shortTotal, payTotal: out.reduce((s2, r) => s2 + r.pay, 0), firstId: (byPrio[0] || {}).id || null };
}
// who gets extra money first: debts due within 7 days or overdue, never flexible ones before fixed ones, then highest interest or smallest debt
const priority = (mode) => (a, b) => {
  const soon = (d) => (d.overdue || (d.days != null && d.days <= 7) ? 0 : 1), fl = (d) => (d.flex ? 1 : 0);
  return fl(a) - fl(b) || soon(a) - soon(b) || (mode === 'snowball' ? (a.owed - b.owed) || (rankRate(b) - rankRate(a)) : (rankRate(b) - rankRate(a)) || (a.owed - b.owed));
};

// Is paying E extra on this debt worth it? Compares the interest saved with what the money could earn in savings and with any fee for paying early.
// ctx: { saveRate (yearly % after tax of your best savings you can reach, 0 if none) }
export function evalExtra(d, E, ctx = {}) {
  const save = +ctx.saveRate || 0;
  if (d.addon) return { worth: false, why: 'Add-on interest is a fixed charge on the original amount, so paying early saves little or nothing. Ask the lender what an early payoff costs.' };
  if (!(d.rate > 0)) return { worth: false, why: d.flex ? 'No interest and no deadline: pay it when you comfortably can.' : 'No interest is set, so paying early would not save anything. Set the rate to check.' };
  if (save > 0 && d.rate < save + 2) return { worth: false, why: `Your savings earn about ${save.toFixed(1).replace(/\.0$/, '')}% and this debt costs ${(+d.rate).toFixed(1).replace(/\.0$/, '')}%, so keeping the money in savings is about as good.` };
  const s0 = simulate([d], Math.max(d.min || 0, 0.01)), s1 = simulate([{ ...d, owed: Math.max(0, d.owed - E) }], Math.max(d.min || 0, 0.01));
  const saving = s0.never ? E * (d.rate / 100) : Math.max(0, s0.interest - s1.interest), cost = E * ((+d.earlyPct || 0) / 100), monthsSaved = s0.never ? 0 : Math.max(0, s0.months - s1.months);
  const net = saving - cost - E * (save / 100) * Math.min(12, Math.max(1, s0.months || 12)) / 12;
  if (saving < 1) return { worth: false, why: 'The interest saved would be too small to matter.' };
  if (cost > 0 && saving <= cost) return { worth: false, why: `The fee for paying early (about ${cost.toFixed(0)}) is as much as the interest saved.`, saving, cost };
  if (save > 0 && net <= 0) return { worth: false, why: 'The interest saved is not more than savings would earn on the same money.', saving, cost };
  return { worth: true, saving, cost, monthsSaved, why: `Saves about ${Math.round(saving)} in interest${monthsSaved >= 1 ? ` and ${monthsSaved} month${monthsSaved === 1 ? '' : 's'} sooner` : ''}.${d.loanLike && !d.earlyPct ? ' Ask the lender if there is a fee for paying early.' : ''}` };
}

// Optional extra on top of the plan: only from money left after what is due and your habit, only when cash is not thin, and only where it is worth it.
// ctx: { saveRate, liquid (cash you hold now, home currency), spend (usual monthly spending) }
export function suggestExtra(debts, plan, mode = 'avalanche', ctx = {}) {
  if (ctx.liquid != null && ctx.spend > 0 && ctx.liquid < ctx.spend) return { rows: [], total: 0, blocked: 'Your cash accounts hold less than one month of your usual spending. Keep that as a cushion before paying anything extra.' };
  let pool = plan.leftover; const act = debts.filter((d) => d.owed > 0.004).sort(priority(mode)), by = new Map(plan.rows.map((r) => [r.id, r])), rows = [];
  for (const d of act) {
    const r = by.get(d.id), room = Math.max(0, d.owed - (r ? r.pay : 0)); if (room <= 0.004) continue;
    const E = Math.min(room, Math.max(pool, Math.min(room, plan.leftover)));
    const ev = evalExtra(d, E > 0 ? E : room, ctx);
    if (ev.worth && pool > 0.5) { const x = Math.min(room, pool); pool -= x; rows.push({ id: d.id, extra: x, ...ev, saving: evalExtra(d, x, ctx).saving }); }
    else rows.push({ id: d.id, extra: 0, worth: false, why: ev.worth ? 'No money is left over this month.' : ev.why });
  }
  return { rows, total: rows.reduce((s2, r) => s2 + r.extra, 0), blocked: '' };
}

// Keep money in an interest-earning account until just before a due date? saver: { name, net (yearly % after tax), fee (usual transfer fee), free (money not locked) }
export function parkIdea({ amount, days, saver, before = 1 }) {
  if (!saver) return { ok: false };
  if (days == null || days < before + 2) return { ok: false, why: 'Due too soon to park the money.' };
  if (saver.free < amount) return { ok: false, why: `Not enough free money in ${saver.name}${saver.lockNote ? ` (${saver.lockNote})` : ''}.` };
  const hold = days - before, interest = amount * (saver.net / 100) * hold / 365, fee = saver.fee || 0;
  if (interest < 1) return { ok: false, why: `It would earn under 1 in ${saver.name}, not worth the trouble.` };
  if (fee >= interest) return { ok: false, why: `Moving it costs ${fee.toFixed(0)}, more than the ${interest.toFixed(0)} it would earn.`, interest, fee };
  return { ok: true, hold, moveOn: before, interest, fee, net: interest - fee, name: saver.name };
}

// Ways to free up money: trim the biggest want and luxury categories a little (about 20%, more if the gap is large) until the gap is covered.
export function suggestCuts(cats, gap) {
  if (!(gap > 0)) return { rows: [], covered: 0, gap: 0 };
  const pool = cats.filter((c) => c.cls !== 'need' && c.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 5), pct = gap > pool.reduce((s, c) => s + c.avg * 0.2, 0) ? 0.4 : 0.2;
  const rows = []; let covered = 0;
  for (const c of pool) { if (covered >= gap) break; const cut = Math.min(c.avg * pct, gap - covered + c.avg * 0.02); rows.push({ name: c.name, avg: c.avg, cut, pct: Math.round(cut / c.avg * 100) }); covered += cut; }
  return { rows, covered, gap, enough: covered >= gap - 0.5 };
}
