// Savings goal check: is the goal realistically on track? It looks at what you REALLY did, not only at a schedule:
//   saved so far, what you actually put in lately, what you usually have left after spending (income minus expenses), your other goals,
//   and the target amount and date. The needed-per-month figure is only a reference. A missed month is not a warning when your real progress is
//   still enough, and keeping to a plan is not "on track" when the money actually saved will not reach the target.
import { balances, homeFx, nowStamp, shiftMonth } from './core.js';
import { totals } from './insights.js';
import { goalStats } from './savings.js';

const MONTH = 30.4375, live = (l) => (l || []).filter((x) => !x.deleted);
const dayNum = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Math.round(new Date(y, m - 1, d).getTime() / 864e5); };
const isoOf = (dn) => { const d = new Date(dn * 864e5 + 12 * 36e5); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
const R = (n) => Math.round(n);

// what you usually have left each month: income minus expenses over up to the last 3 finished months that have entries
export function usualLeftover(db, today = nowStamp().slice(0, 10)) {
  const ym = today.slice(0, 7), vals = [];
  for (let i = 1; i <= 6 && vals.length < 3; i++) { const m = shiftMonth(ym, -i), inc = totals(db, m, 'income').total, exp = totals(db, m).total; if (inc > 0 || exp > 0) vals.push(inc - exp); }
  return { months: vals.length, perMonth: vals.length ? Math.max(0, vals.reduce((s, x) => s + x, 0) / vals.length) : null };
}
// what actually went into the goal over the last `days` days (home currency): the change of the linked account, or the deposits you added by hand
export function recentSaved(db, g, today, days) {
  const from = isoOf(dayNum(today) - days);
  if (g.acct) {
    const a = live(db.accounts).find((x) => x.id === g.acct); if (!a) return 0;
    const fx = homeFx(db, a.cur) || 1; return ((balances(db).get(a.id) || 0) - (balances(db, from + ' 00:00:00').get(a.id) || 0)) * fx;
  }
  return (g.log || []).filter((r) => String(r.date).slice(0, 10) >= from).reduce((s, r) => s + (r.amt || 0), 0);
}
// level: ontrack | early | behind (can catch up) | risk (not realistic with your usual leftover) | late (target date passed) | reached | none
export function goalOutlook(db, g, today = nowStamp().slice(0, 10)) {
  const s = goalStats(db, g, today), out = { level: 'none', lines: [], needed: null, actual: null, leftover: null, shortBy: 0, eta: null, saved: s.saved, target: s.target };
  if (s.reached) { out.level = 'reached'; return out; }
  if (!g.due || !(s.target > 0)) return out;
  const days = dayNum(g.due) - dayNum(today), since = g.created ? dayNum(today) - dayNum(g.created) : 90;
  if (days < 0) { out.level = 'late'; out.lines.push(`The target date has passed and ${R(s.left).toLocaleString()} is still to save.`); return out; }
  const monthsLeft = Math.max(days / MONTH, 1 / MONTH), needed = s.left / monthsLeft, win = Math.min(90, Math.max(since, 0)), enough = win >= 14;
  const actual = enough ? recentSaved(db, g, today, win) / (win / MONTH) : null;
  const lo = usualLeftover(db, today), others = live(db.goals).filter((x) => x.id !== g.id && !x.reachedAck && x.due && dayNum(x.due) >= dayNum(today)).reduce((sum, x) => { const st = goalStats(db, x, today); return st.reached ? sum : sum + st.left / Math.max(1, (dayNum(x.due) - dayNum(today)) / MONTH); }, 0);
  const room = lo.perMonth == null ? null : Math.max(0, lo.perMonth - others);
  Object.assign(out, { needed, actual, leftover: room, months: monthsLeft });
  const projected = s.saved + (actual != null ? Math.max(0, actual) * monthsLeft : 0);
  if (enough && projected >= s.target * 0.98) { out.level = 'ontrack'; out.lines.push(`At the pace you really saved lately (${R(actual).toLocaleString()} a month) you reach it by the target date.`); return out; }
  if (!enough) {   // too early to judge by actual saving: only say something when it cannot work out of your usual leftover
    if (room != null && room + 1e-9 < needed * 0.9) { out.level = 'risk'; out.lines.push(`You need about ${R(needed).toLocaleString()} a month, but you usually have about ${R(room).toLocaleString()} left after spending and your other goals.`); }
    else { out.level = 'early'; out.lines.push('Too early to tell. Add some money and check again in a few weeks.'); }
    return out;
  }
  out.shortBy = Math.max(0, s.target - projected);
  const pace = Math.max(actual || 0, 0), best = Math.max(pace, room || 0);
  if (room != null && room >= needed * 0.9) {
    out.level = 'behind';
    out.lines.push(`You saved about ${R(Math.max(actual, 0)).toLocaleString()} a month lately; reaching it needs about ${R(needed).toLocaleString()}.`);
    out.lines.push(`You usually have about ${R(room).toLocaleString()} left each month, so you can still catch up.`);
  } else {
    out.level = 'risk';
    out.lines.push(room == null ? `You saved about ${R(Math.max(actual, 0)).toLocaleString()} a month lately; reaching it needs about ${R(needed).toLocaleString()}. No income entries were found to judge your leftover.`
      : `Reaching it needs about ${R(needed).toLocaleString()} a month, but you usually have about ${R(room).toLocaleString()} left after spending and your other goals.`);
    if (best > 0) { out.eta = dayNum(today) + Math.ceil((s.left / best) * MONTH); out.lines.push(`At about ${R(best).toLocaleString()} a month you would reach it around ${new Date(out.eta * 864e5 + 12 * 36e5).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}. Move the date, lower the target, or save more.`); }
    else out.lines.push('Nothing is being saved yet. Move the date, lower the target, or start adding money.');
  }
  return out;
}
export const snoozed = (db, g, today) => ((db.settings.goalSnooze || {})[g.id] || '') > today;
// goals worth a reminder now (not snoozed), most serious first
export function goalReminders(db, today = nowStamp().slice(0, 10)) {
  const rank = { late: 0, risk: 1, behind: 2 };
  return live(db.goals).filter((g) => !g.reachedAck && !snoozed(db, g, today)).map((g) => ({ g, o: goalOutlook(db, g, today) })).filter((x) => x.o.level in rank).sort((a, b) => rank[a.o.level] - rank[b.o.level]);
}
