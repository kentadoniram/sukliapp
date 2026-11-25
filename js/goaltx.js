// Savings contributions from Transfer entries (15.37): a transfer can be marked "counts toward a goal".
// Only goals you add money to by hand take these (a goal that follows an account already follows its balance).
import { factorFor, homeFx, HOME } from './core.js';
export const goalTxs = (db, id) => (db.txs || []).filter((t) => !t.deleted && t.kind === 'transfer' && t.goalId === id);
export const goalTxTotal = (db, id) => goalTxs(db, id).reduce((s, t) => s + (t.amount || 0) * factorFor(db, t), 0);
// goals a transfer can count toward: open ones that do not follow an account (plus the one already chosen)
export const goalChoices = (db, current = '') => (db.goals || []).filter((g) => !g.deleted && !g.acct && (!g.reachedAck || g.id === current));
// what a transfer of `amt` (in `fromCur`) adds to a goal that is saved in another currency: { cur, amt } (amt is null when that currency has no rate yet); null when no conversion is needed
export function goalAdds(db, g, fromCur, amt) {
  const gc = g && g.cur && g.cur !== HOME ? g.cur : HOME; if (!g || gc === fromCur || !(amt > 0)) return null;
  const gr = homeFx(db, gc), fr = homeFx(db, fromCur);
  return gr > 0 && fr > 0 ? { cur: gc, amt: amt * fr / gr } : { cur: gc, amt: null };
}
