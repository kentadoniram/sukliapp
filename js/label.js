// A blank label is filled in when the entry is saved.
//   transfer          "BDO - CIMB" (the two account names)
//   expense / income  the label you most often use for this category, amount, account and hour; otherwise the category name.
//                     The entry is put on the Review list so you can fix the label later.
import { norm } from './merchants.js';

export function transferLabel(from, to) { return `${(from && from.name) || '?'} - ${(to && to.name) || '?'}`; }

export function guessLabel(db, { kind, cat, amount, acct, hour }) {
  const cm = new Map(db.categories.map((c) => [c.id, c.name])), score = new Map();
  for (const t of db.txs) {
    if (t.deleted || t.auto || t.reval || t.kind !== kind || !t.name || !t.name.trim() || t.autoName) continue;
    let s = 0;
    if (cat && t.cat === cat) s += 3; else if (cat) continue;                        // only labels used in this category
    if (amount > 0 && t.amount > 0) { const r = Math.abs(Math.log(t.amount / amount)); if (r < 0.15) s += 3; else if (r < 0.5) s += 1; }
    if (acct && t.acct === acct) s += 1;
    const h = parseInt(String(t.date).slice(11, 13), 10); if (hour != null && !isNaN(h)) { const d = Math.min(Math.abs(h - hour), 24 - Math.abs(h - hour)); if (d <= 2) s += 1; }
    const k = norm(t.name), e = score.get(k) || { name: t.name.trim(), s: 0, n: 0 }; e.s += s; e.n++; score.set(k, e);
  }
  const top = [...score.values()].sort((a, b) => b.s - a.s || b.n - a.n)[0];
  if (top) return { name: top.name, from: 'history' };
  return { name: (cat && cm.get(cat)) || (kind === 'income' ? 'Income' : 'Expense'), from: 'category' };
}
