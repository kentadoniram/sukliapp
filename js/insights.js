// Home-screen analysis. Plain maths over your own entries, all in base currency, nothing leaves the device.
import { monthParts, shiftMonth, thisMonth, nowStamp, daysInMonth } from './core.js';

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

export function pace(db, ym) {
  const e = elapsed(ym);
  const cur = cumulative(db, ym), prevYm = shiftMonth(ym, -1), prev = cumulative(db, prevYm);
  const spent = cur[e.day - 1] || 0;
  const base = baselineMonths(db, ym, 3);
  const usual = base.length ? sum(base.map((m) => totals(db, m).total)) / base.length : 0;
  const prevSame = prev.length ? (prev[Math.min(e.day, prev.length) - 1] || 0) : 0;
  const projected = e.live && e.day >= 3 ? (spent / e.day) * e.dim : spent;
  return { ...e, cur, prev, prevYm, spent, usual, prevSame, projected, dailyAvg: e.day ? spent / e.day : 0, baseCount: base.length };
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
