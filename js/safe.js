// Safe to spend: the money you hold in cash, bank and e-wallet accounts, minus what is already committed
// (everything owed on credit cards, plus loan and instalment payments due in the next 30 days).
// Nothing here changes an entry. It only tells the truth about what is left to spend.
import { get, balances, homeFx, fmt, HOME } from './core.js';
import { isLiability } from './finance.js';
import { debtList } from './debts.js';
import { ACT, sheet, esc } from './ui.js';

const isOwedType = (a) => a.type === 'owed';
export function safeToSpend(db) {
  const bal = balances(db); let money = 0;
  for (const a of db.accounts || []) {
    if (a.deleted || a.archived || !a.include || isLiability(a) || isOwedType(a) || a.type === 'card') continue;
    money += (bal.get(a.id) || 0) * (homeFx(db, a.cur) || 0);
  }
  const items = [];
  for (const d of debtList(db)) {
    if (d.type === 'card') { items.push({ name: d.name, kind: 'Credit card owed', amount: d.owed }); continue; }
    const soon = d.overdue || (d.days != null && d.days <= 30);
    if (soon && d.min > 0) items.push({ name: d.name, kind: 'Payment due within 30 days', amount: Math.min(d.min, d.owed) });
  }
  const committed = items.reduce((s, x) => s + x.amount, 0);
  return { money, committed, items, safe: money - committed };
}
ACT['safe-info'] = () => {
  const s = safeToSpend(get()), m = (n) => fmt(n, HOME, { round: true });
  sheet(`<p class="hint">Your bank balance does not show what you already owe. This is what is really yours to spend.</p>
    <ul class="calfacts"><li><span>Cash, bank and e-wallet</span><b>${m(s.money)}</b></li>
    ${s.items.map((x) => `<li><span>${esc(x.name)}<small> ${esc(x.kind)}</small></span><b>-${m(x.amount)}</b></li>`).join('')}
    <li><span><b>Safe to spend</b></span><b>${m(s.safe)}</b></li></ul>
    <p class="hint">A card purchase is still an expense on the day you buy. It lowers this figure at once, even though the bank balance has not moved until you pay the card.</p>`, { title: 'Safe to spend' });
};
