// Daily average as a ROLLING window: the spending of the last 7 consecutive calendar days (days with nothing count as 0) divided by 7.
// It moves forward every day, whichever weekday it starts on. Also the same figure for every day of the last 12 months, to show what is typical.
import { partsBetween, nowStamp } from './core.js';

const pad = (n) => String(n).padStart(2, '0');
const fmtD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (s, n) => { const d = new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12); d.setDate(d.getDate() + n); return fmtD(d); };
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quant = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)))]; };

// spending per calendar day, nDays long, ending on endStr; [dates, values]
export function dailySpend(db, endStr, nDays) {
  const start = addDays(endStr, -(nDays - 1)), by = new Map();
  for (const p of partsBetween(db, start, endStr)) if (p.kind === 'expense') { const d = p.t.date.slice(0, 10); by.set(d, (by.get(d) || 0) + p.v); }
  const dates = [], vals = [];
  for (let i = 0; i < nDays; i++) { const d = addDays(start, i); dates.push(d); vals.push(by.get(d) || 0); }
  return { dates, vals };
}
// the average of each run of w consecutive days (the first w-1 days have no full window yet)
export function rollingAvg(vals, w = 7) {
  const out = new Array(vals.length).fill(null); let run = 0;
  for (let i = 0; i < vals.length; i++) { run += vals[i]; if (i >= w) run -= vals[i - w]; if (i >= w - 1) out[i] = run / w; }
  return out;
}
export const today = () => nowStamp().slice(0, 10);
export function firstDate(db) { let m = ''; for (const t of db.txs) if (!t.deleted && !t.reval && t.date && (!m || t.date < m)) m = t.date; return m.slice(0, 10); }

export function rollingSummary(db, endStr = today(), { days = 365, w = 7 } = {}) {
  const first = firstDate(db), { dates, vals } = dailySpend(db, endStr, days + w - 1), avg = rollingAvg(vals, w);
  const series = [];
  for (let i = w - 1; i < dates.length; i++) if (first && addDays(dates[i], -(w - 1)) >= first) series.push({ date: dates[i], avg: avg[i] });
  const nums = series.map((x) => x.avg), now = avg[avg.length - 1];
  const recent = series.slice(-90).map((x) => x.avg), before = series.slice(0, -90).map((x) => x.avg);
  const hi = series.reduce((m, x) => (!m || x.avg > m.avg ? x : m), null), lo = series.reduce((m, x) => (!m || x.avg < m.avg ? x : m), null);
  const mr = recent.length >= 30 ? median(recent) : 0, mb = before.length >= 30 ? median(before) : 0;
  const trendPct = mr && mb ? (mr - mb) / mb : null;
  // average spending per day for each calendar month in the window (partial months count the days that exist)
  const months = new Map();
  for (let i = w - 1; i < dates.length; i++) { const ym = dates[i].slice(0, 7); if (first && dates[i] < first) continue; const m = months.get(ym) || { ym, sum: 0, n: 0 }; m.sum += vals[i]; m.n++; months.set(ym, m); }
  return {
    now, series, typical: median(nums), low: quant(nums, 0.25), high: quant(nums, 0.75), hi, lo, recent: mr, before: mb, trendPct,
    trend: trendPct == null ? '' : trendPct > 0.1 ? 'rising' : trendPct < -0.1 ? 'falling' : 'steady',
    months: [...months.values()].sort((a, b) => (a.ym < b.ym ? -1 : 1)).map((m) => ({ ym: m.ym, avg: m.sum / m.n, days: m.n })),
    enough: series.length >= 30,
  };
}
