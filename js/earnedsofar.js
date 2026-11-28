// "Earned so far" on the Accounts page: what banks and e-wallets (never investments) gave you for free.
// Four kinds: interest paid by the account, extra a person paid you above what they owed (a gift), cashback and discounts.
import { live, factorFor } from './core.js';
import { esc, ACT, sheet } from './ui.js';
import { money } from './screens.js';
import { button } from './components.js';

export const KINDS = [['interest', 'Bank interest', 'Paid into the account by the bank or e-wallet'], ['gift', 'Paid back extra', 'More than they owed you, kept as a gift or interest'], ['cashback', 'Cashback', 'Returned to you after a purchase'], ['discount', 'Discounts', 'Taken off the price at the till']];

export function earnedSoFar(db, isInv) {
  const accs = new Map(db.accounts.map((a) => [a.id, a])), ok = (t) => { const a = accs.get(t.acct); return !!a && !isInv(a); };
  const rows = [], add = (kind, t, amt) => { if (amt > 0) rows.push({ kind, t, acct: accs.get(t.acct), val: amt * factorFor(db, t) }); };
  for (const t of live(db.txs)) {
    if (!ok(t)) continue;
    if (t.kind === 'income' && !t.earnDay && !t.invIncome) {
      if (t.cashbackOf) add('cashback', t, t.amount);
      else if (t.overpaid) add('gift', t, t.amount);
      else if (t.auto) add('interest', t, t.amount);
    }
    if (t.kind === 'expense' && t.adj && t.adj.discAmt > 0) add('discount', t, t.adj.discAmt);
  }
  const sum = (l) => l.reduce((q, r) => q + r.val, 0), yr = String(new Date().getFullYear());
  const by = Object.fromEntries(KINDS.map(([k]) => [k, rows.filter((r) => r.kind === k)]));
  return { rows, by, total: sum(rows), totalYr: sum(rows.filter((r) => String(r.t.date).startsWith(yr))), sum, yr };
}

ACT['acct-earned'] = async () => {
  const { get } = await import('./core.js'), { inInvestAcct } = await import('./accpage.js');
  const db = get(), E = earnedSoFar(db, inInvestAcct), names = Object.fromEntries(KINDS.map(([k, l]) => [k, l]));
  const kindRows = KINDS.map(([k, l, h]) => `<div class="dsrow"><span><b>${l}</b><small class="hint">${h}</small></span><b>${money(E.sum(E.by[k]))}</b></div>`).join('');
  const accs = new Map(); for (const r of E.rows) { const n = r.acct.name; accs.set(n, (accs.get(n) || 0) + r.val); }
  const byAcct = [...accs].sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div class="dsrow"><span>${esc(n)}</span><b>${money(v)}</b></div>`).join('');
  const recent = E.rows.slice().sort((a, b) => String(b.t.date).localeCompare(String(a.t.date))).slice(0, 40).map((r) => `<li class="ohr"><span class="ohl"><b>${esc(names[r.kind])}</b><small>${esc(String(r.t.date).slice(0, 10))} · ${esc(r.acct.name)}${r.t.name ? ' · ' + esc(r.t.name) : ''}</small></span><b>${money(r.val)}</b></li>`).join('');
  sheet(`<div class="debtsum"><div class="dsrow"><span>Earned so far, all time</span><b>${money(E.total)}</b></div><div class="dsrow"><span>This year (${E.yr})</span><b>${money(E.totalYr)}</b></div></div>
    <h3 class="subh">By kind</h3><div class="debtsum">${kindRows}</div>
    ${byAcct ? `<h3 class="subh">By account</h3><div class="debtsum">${byAcct}</div>` : ''}
    <h3 class="subh">Latest</h3>${recent ? `<ul class="calfacts">${recent}</ul>` : '<p class="hint">Nothing earned on banks or e-wallets yet.</p>'}
    <p class="hint">Investment accounts are not included here; their earnings are in Investments.</p>`, { title: 'Earned So Far', wide: true });
};
export const earnedBtn = (db, isInv, cls = '') => button({ html: `<span class="nwk">Earned so far</span><b class="nwv">${money(earnedSoFar(db, isInv).total)}</b>`, kind: 'plain', cls: `nwsp nwearn ${cls}`, act: 'acct-earned' });
