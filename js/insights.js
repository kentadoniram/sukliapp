// Home-screen analysis. Plain maths over your own entries, all in base currency, nothing leaves the device.
import { monthParts, shiftMonth, thisMonth, nowStamp, daysInMonth } from './core.js';
import { median, quantile } from './stats.js';

const sum = (a) => a.reduce((s, x) => s + x, 0);

// totals of one month by group for one kind
export function totals(db, ym, kind = 'expense') {
  const by = new Map(); let total = 0;
  for (const p of monthParts(db, ym)) {
    if (p.kind !== kind) continue;
    total += p.v; by.set(p.group, (by.get(p.group) || 0) + p.v);
  }
  return { total, by };
}

// up to n earlier months that actually have spending, newest first
export function baselineMonths(db, ym, n = 3) {
  const out = [];
  for (let i = 1; i <= 18 && out.length < n; i++) {
    const m = shiftMonth(ym, -i);
    if (totals(db, m).total > 0) out.push(m);
  }
  return out;
}

// how far into the month are we? (a past month counts as complete)
export function elapsed(ym) {
  const dim = daysInMonth(ym);
  if (ym === thisMonth()) return { day: Math.min(dim, +nowStamp().slice(8, 10)), dim, live: true };
  return { day: dim, dim, live: false };
}

// cumulative spending per day, for the pace chart
export function cumulative(db, ym) {
  const dim = daysInMonth(ym), day = new Array(dim).fill(0);
  for (const p of monthParts(db, ym)) if (p.kind === 'expense') day[+p.t.date.slice(8, 10) - 1] += p.v;
  let run = 0;
  return day.map((v) => (run += v));
}

// Pace. Spending is not even through the month (rent and card payments come early), so a straight run-rate guesses badly. Instead: for each of up to 6 earlier
// months, how much bigger the final total was than what had been spent by this same day (total / spent so far). Projection = spent so far x the median of those ratios;
// the range is their 10th to 90th percentile; the chance of finishing above your usual month is the share of those ratios that would (with 1 added to each side,
// so a few months never say 0% or 100%). Needs 3+ earlier months, day 3 or later, and at least 10% of a typical month already spent; otherwise the straight run-rate is used.
export const PACE = { months: 6, minMonths: 3, minDay: 3, minShare: 0.1 };
export function paceProfile(db, ym, day) {
  const curves = baselineMonths(db, ym, PACE.months).map((m) => { const c = cumulative(db, m), tot = c[c.length - 1]; return { m, c, tot }; }).filter((x) => x.tot > 0);
  const at = (x, d) => x.c[Math.min(d, x.c.length) - 1] || 0;
  const frac = (d) => median(curves.map((x) => at(x, d) / x.tot));
  const ratios = curves.map((x) => ({ m: x.m, r: at(x, day) > 0 ? x.tot / at(x, day) : null })).filter((x) => x.r != null);
  return { n: curves.length, frac, ratios, months: curves.map((x) => x.m) };
}
export function pace(db, ym) {
  const e = elapsed(ym);
  const cur = cumulative(db, ym), prevYm = shiftMonth(ym, -1), prev = cumulative(db, prevYm);
  const spent = cur[e.day - 1] || 0;
  const base = baselineMonths(db, ym, 3);
  const usual = base.length ? sum(base.map((m) => totals(db, m).total)) / base.length : 0;
  const prevSame = prev.length ? (prev[Math.min(e.day, prev.length) - 1] || 0) : 0;
  const projectedLinear = e.live && e.day >= 3 ? (spent / e.day) * e.dim : spent;
  let projected = projectedLinear, low = null, high = null, method = 'run-rate', chanceOverUsual = null, prof = null;
  if (e.live && e.day >= PACE.minDay) {
    prof = paceProfile(db, ym, e.day);
    const rs = prof.ratios.map((x) => x.r);
    if (prof.n >= PACE.minMonths && rs.length >= PACE.minMonths && prof.frac(e.day) >= PACE.minShare && spent > 0) {
      projected = spent * median(rs); low = spent * quantile(rs, 0.1); high = spent * quantile(rs, 0.9); method = 'monthly pattern';
      if (usual > 0) chanceOverUsual = (rs.filter((r) => spent * r > usual).length + 1) / (rs.length + 2);
    }
  }
  return { ...e, cur, prev, prevYm, spent, usual, prevSame, projected, projectedLinear, low, high, method, chanceOverUsual, profile: prof, dailyAvg: e.day ? spent / e.day : 0, baseCount: base.length };
}

// the last n months of spent and came-in, oldest first
export function trend(db, ym, n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = shiftMonth(ym, -i);
    out.push({ m, spent: totals(db, m).total, income: totals(db, m, 'income').total });
  }
  return out;
}

// one group over time (for the detail sheet)
export function groupTrend(db, ym, group, kind, n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = shiftMonth(ym, -i);
    out.push({ m, v: sum(monthParts(db, m).filter((p) => p.kind === kind && p.group === group).map((p) => p.v)) });
  }
  return out;
}
