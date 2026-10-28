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

// What you can put toward debts, learned from entries: the average of income minus spending over up to the last 3 whole months.
// Interest the app charged itself is left out (it is part of what you pay). Needs at least one whole month with entries.
export function learnBudget(txs, toHome, thisMonth, shiftMonth) {
  const months = [1, 2, 3].map((n) => shiftMonth(thisMonth, -n)), rows = [];
  for (const ym of months) {
    let inc = 0, out = 0, n = 0;
    for (const t of txs) { if (t.deleted || t.autoDebt || !String(t.date).startsWith(ym)) continue; if (t.kind === 'income') { inc += toHome(t); n++; } else if (t.kind === 'expense') { out += toHome(t); n++; } }
    if (n) rows.push({ ym, inc, out });
  }
  if (!rows.length) return null;
  const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  return { months: rows.length, income: avg('inc'), spend: avg('out'), free: Math.max(0, avg('inc') - avg('out')) };
}
