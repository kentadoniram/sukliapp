// Daily needs in the budget (15.37): what an ordinary day costs (trips, events and fixed bills left out, see trips.js dailyNeeds)
// is used to look ahead in the current month: spent so far + usual days still to come = where the month is heading.
// It is a guide built from your own entries. It never changes a saved total or a budget by itself.
import { monthParts, daysInMonth, thisMonth, nowStamp, fmt, HOME } from './core.js';
import { dailyNeeds } from './trips.js';

export function needsOutlook(db, ym = thisMonth()) {
  if (ym !== thisMonth()) return null;
  let u; try { u = dailyNeeds(db); } catch { return null; }
  if (!(u.perDay > 0) || u.days < 14) return null;
  const day = parseInt(nowStamp().slice(8, 10), 10), dim = daysInMonth(ym), daysLeft = Math.max(0, dim - day);
  const spent = monthParts(db, ym).filter((p) => p.kind === 'expense').reduce((s, p) => s + p.v, 0);
  const reserve = u.perDay * daysLeft, expected = spent + reserve;
  const budget = (db.budgets || []).filter((b) => !b.deleted && !b.off && b.amount > 0 && b.cat).reduce((s, b) => s + b.amount, 0);
  return { perDay: u.perDay, perMonth: u.perMonth, daysLeft, spent, reserve, expected, budget, room: budget > 0 ? budget - expected : null, over: budget > 0 && expected > budget };
}
const m = (n) => fmt(n, HOME, { round: true });
// the Budget page card
export function needsCard(db, ym) {
  const o = needsOutlook(db, ym); if (!o) return '';
  return `<ul class="calfacts"><li><span>A usual day costs about</span><b>${m(o.perDay)}</b></li>
    <li><span>Spent so far this month</span><b>${m(o.spent)}</b></li>
    <li><span>Usual days still to come (${o.daysLeft})</span><b>${m(o.reserve)}</b></li>
    <li><span><b>Where the month is heading</b></span><b>${m(o.expected)}</b></li>
    ${o.budget > 0 ? `<li><span>All your category budgets</span><b>${m(o.budget)}</b></li><li><span>${o.over ? 'Over your budgets by' : 'Room left'}</span><b class="${o.over ? 'cr' : 'cg'}">${m(Math.abs(o.room))}</b></li>` : ''}</ul>
    <p class="hint">Spent so far plus what the remaining days usually cost. Trips, events and fixed bills such as rent are not part of a usual day. It is a guide, not a limit.</p>`;
}
// an alert line for the Budget alerts list
export function needsAlert(db) {
  const o = needsOutlook(db); if (!o || !o.over || o.daysLeft < 1) return null;
  return { key: 'needs-outlook', kind: 'outlook', label: 'Daily needs', over: true, tone: 'warn', pct: o.expected / o.budget * 100, text: `At your usual daily pace you will spend about ${m(o.expected)} by the end of the month, ${m(-o.room)} over your budgets.` };
}
