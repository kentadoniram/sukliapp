// Savings contributions from Transfer entries (15.37): a transfer can be marked "counts toward a goal".
// Only goals you add money to by hand take these (a goal that follows an account already follows its balance).
import { factorFor } from './core.js';
export const goalTxs = (db, id) => (db.txs || []).filter((t) => !t.deleted && t.kind === 'transfer' && t.goalId === id);
export const goalTxTotal = (db, id) => goalTxs(db, id).reduce((s, t) => s + (t.amount || 0) * factorFor(db, t), 0);
// goals a transfer can count toward: open ones that do not follow an account (plus the one already chosen)
export const goalChoices = (db, current = '') => (db.goals || []).filter((g) => !g.deleted && !g.acct && (!g.reachedAck || g.id === current));
