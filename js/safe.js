// Safe to spend: the money you hold in cash, bank and e-wallet accounts, minus what is already committed
// (everything owed on credit cards, plus loan and installment payments due in the next 30 days).
// Nothing here changes an entry. It only tells the truth about what is left to spend.
import { get, commit, stamp, uid, balances, homeFx, fmt, HOME, nowStamp } from './core.js';
import { isLiability } from './finance.js';
import { debtList } from './debts.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { button, seg, textField } from './components.js';
import { needsOutlook } from './dailyneeds.js';

const isOwedType = (a) => a.type === 'owed';
// Bills and Installments the person lists by hand: { id, name, amount (home currency), due 'YYYY-MM-DD', every 'once' | 'month', left (payments still to make, installments) }.
const dnum = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const dstr = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
export function addMonth(day, k = 1) { const [y, m, d] = day.split('-').map(Number), t = new Date(Date.UTC(y, m - 1 + k, 1)), last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`; }
// the payments of one bill that fall due from now up to `days` ahead, plus anything already overdue
export function billDues(b, today, days = 30) {
  const end = dnum(today) + days, out = []; let due = b.due, left = b.left > 0 ? b.left : (b.every === 'month' ? Infinity : 1), guard = 0;
  while (due && dnum(due) <= end && left > 0 && guard++ < 60) { out.push({ due, overdue: dnum(due) < dnum(today), amount: +b.amount || 0 }); if (b.every !== 'month') break; due = addMonth(due); left--; }
  return out;
}
export function safeToSpend(db) {
  const bal = balances(db); let money = 0;
  for (const a of db.accounts || []) {
    if (a.deleted || a.archived || !a.include || isLiability(a) || isOwedType(a) || a.type === 'card') continue;
    money += (bal.get(a.id) || 0) * (homeFx(db, a.cur) || 0);
  }
  const items = [], today = nowStamp().slice(0, 10), cardsDue = (db.settings || {}).safeCards === 'due';
  for (const d of debtList(db)) {
    if (d.type === 'card') {
      if (!cardsDue) { items.push({ name: d.name, kind: 'Credit card owed', amount: d.owed }); continue; }
      const soon = d.overdue || (d.days != null && d.days <= 30), amt = Math.min(d.owed, d.dueAmount || 0);
      if (soon && amt > 0) items.push({ name: d.name, kind: 'Card payment due within 30 days', amount: amt });
      continue;
    }
    const soon = d.overdue || (d.days != null && d.days <= 30);
    if (soon && d.min > 0) items.push({ name: d.name, kind: 'Payment due within 30 days', amount: Math.min(d.min, d.owed) });
  }
  for (const b of (db.settings || {}).bills || []) { const ds = billDues(b, today); if (ds.length) items.push({ name: b.name, kind: ds.length > 1 ? `${b.left > 0 ? 'Installment' : 'Bill'}, ${ds.length} payments due within 30 days` : `${b.left > 0 ? `Installment (${b.left} left)` : 'Bill'} due ${ds[0].due}${ds[0].overdue ? ' (overdue)' : ''}`, amount: ds.reduce((q, x) => q + x.amount, 0) }); }
  const committed = items.reduce((s, x) => s + x.amount, 0);
  let reserve = 0, daysLeft = 0; try { const o = needsOutlook(db); if (o) { reserve = o.reserve; daysLeft = o.daysLeft; } } catch { /* no estimate */ }
  return { money, committed, items, safe: money - committed, reserve, daysLeft, afterNeeds: money - committed - reserve };
}
let cur = null; const closeCur = () => { if (cur) { cur.close(); cur = null; } };
ACT['safe-info'] = () => {
  closeCur();
  const s = safeToSpend(get()), m = (n) => fmt(n, HOME, { round: true });
  cur = sheet(`<p class="hint">Your bank balance does not show what you already owe. This is what is really yours to spend.</p>
    <ul class="calfacts"><li><span>Cash, bank and e-wallet</span><b>${m(s.money)}</b></li>
    ${s.items.map((x) => `<li><span>${esc(x.name)}<small> ${esc(x.kind)}</small></span><b>-${m(x.amount)}</b></li>`).join('')}
    <li><span><b>Safe to spend</b></span><b>${m(s.safe)}</b></li>
    ${s.reserve > 0 ? `<li><span>Usual daily needs to month end<small> ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'}</small></span><b>-${m(s.reserve)}</b></li><li><span><b>Left after daily needs</b></span><b>${m(s.afterNeeds)}</b></li>` : ''}</ul>
    <div class="field"><span>Credit cards count</span>${seg({ options: [{ label: 'Everything owed', value: 'all', title: 'Safest: all card purchases are already spoken for' }, { label: 'Only what is due in 30 days', value: 'due' }], value: (get().settings.safeCards === 'due') ? 'due' : 'all', act: 'safe-cards', aria: 'How credit cards are counted', pack: (v) => v })}</div>
    <p class="hint">A card purchase is still an expense on the day you buy. With Everything owed it lowers this figure at once, even though the bank balance has not moved until you pay the card.</p>
    <div class="btnrow">${button({ label: 'Bills and Installments', kind: 'ghost', act: 'bills-open' })}</div>`, { title: 'Safe to Spend' });
};
ACT['safe-cards'] = (el) => { commit((d) => { d.settings.safeCards = el.dataset.v === 'due' ? 'due' : 'all'; }); closeCur(); ACT['safe-info'](); };
// the list the person keeps: what is still to pay (a bill) or paid in parts (an installment, a buy-now-pay-later plan)
const money = (n) => fmt(n, HOME, { round: true });
ACT['bills-open'] = () => {
  closeCur();
  const db = get(), today = nowStamp().slice(0, 10), list = [...(db.settings.bills || [])].sort((a, b) => (a.due < b.due ? -1 : 1));
  cur = sheet(`<p class="hint">List what you still have to pay: an unpaid bill, or an installment or buy-now-pay-later plan. Payments due in the next 30 days are taken off Safe to Spend. Sukli does not pay anything; tap Paid when you pay it.</p>
    ${list.length ? `<ul class="calfacts billlist">${list.map((b) => `<li><span><b>${esc(b.name)}</b><br><small class="muted">${money(b.amount)} · ${b.every === 'month' ? `every month${b.left > 0 ? `, ${b.left} left` : ''}` : 'once'} · next ${esc(b.due)}${b.due < today ? ' (overdue)' : ''}</small></span>
      <span class="aprbtns">${button({ label: 'Paid', kind: 'link', act: 'bill-paid', v: b.id })}${button({ label: 'Edit', kind: 'link', act: 'bill-edit', v: b.id })}${button({ label: 'Remove', kind: 'danger-link', act: 'bill-del', v: b.id })}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing listed yet.</p>'}
    <div class="btnrow">${button({ label: 'Add a Bill or Installment', kind: 'primary', act: 'bill-edit', v: '' })}</div>`, { title: 'Bills and Installments' });
};
ACT['bill-edit'] = (el) => {
  closeCur();
  const id = el.dataset.v || '', b = (get().settings.bills || []).find((x) => x.id === id) || { name: '', amount: '', due: nowStamp().slice(0, 10), every: 'once', left: '' };
  const sh = cur = sheet(`${textField({ label: 'What Is It', id: 'bl-name', value: b.name, placeholder: 'e.g. Phone bill, Laptop installment' })}
    <div class="two">${textField({ label: `Amount Each Time (${HOME})`, id: 'bl-amt', inputmode: 'decimal', value: b.amount || '' })}${textField({ label: 'Next Due Date', id: 'bl-due', type: 'date', value: b.due })}</div>
    <div class="field"><span>How Often</span>${seg({ options: [{ label: 'Once', value: 'once' }, { label: 'Every month', value: 'month' }], value: b.every, aria: 'How often', data: 'bl-every', pack: (v) => v })}</div>
    ${textField({ label: 'Payments Left (Installments, Optional)', id: 'bl-left', inputmode: 'numeric', value: b.left || '', placeholder: 'leave empty if it never ends', hidden: b.every !== 'month', attr: {} }).replace('<label class="field "', '<label class="field " id="bl-leftbox"')}
    <div class="btnrow">${button({ label: 'Save', kind: 'primary', id: 'bl-save' })}</div>`, { title: id ? 'Edit Bill' : 'Add a Bill or Installment' });
  let every = b.every;
  sh.el.addEventListener('click', (e) => { const x = e.target.closest('[data-bl-every]'); if (!x) return; every = x.dataset.blEvery; sh.el.querySelectorAll('[data-bl-every]').forEach((y) => { const on = y === x; y.classList.toggle('on', on); y.setAttribute('aria-pressed', String(on)); }); sh.el.querySelector('#bl-leftbox').hidden = every !== 'month'; });
  sh.el.querySelector('#bl-save').onclick = () => {
    const name = sh.el.querySelector('#bl-name').value.trim(), amount = parseFloat(String(sh.el.querySelector('#bl-amt').value).replace(/,/g, '')), due = sh.el.querySelector('#bl-due').value, left = parseInt(sh.el.querySelector('#bl-left').value, 10) || 0;
    if (!name) { toast('Give it a name.'); return; } if (!(amount > 0)) { toast('Type the amount.'); return; } if (!due) { toast('Choose the due date.'); return; }
    commit((d) => { const l = (d.settings.bills = d.settings.bills || []), rec = { id: id || uid(), name, amount, due, every, left: every === 'month' && left > 0 ? left : 0 }; const i = l.findIndex((x) => x.id === rec.id); if (i >= 0) l[i] = rec; else l.push(rec); });
    sh.close(); ACT['bills-open'](); };
};
ACT['bill-paid'] = (el) => { commit((d) => { const l = d.settings.bills || [], b = l.find((x) => x.id === el.dataset.v); if (!b) return;
  if (b.every !== 'month') { d.settings.bills = l.filter((x) => x !== b); return; }
  b.due = addMonth(b.due); if (b.left > 0) { b.left--; if (b.left === 0) d.settings.bills = l.filter((x) => x !== b); } }); toast('Marked as paid.'); ACT['bills-open'](); };
ACT['bill-del'] = async (el) => { const b = (get().settings.bills || []).find((x) => x.id === el.dataset.v); if (!b) return; if (!(await confirmDialog(`Remove ${b.name} from the list?`, 'Remove', true))) return; commit((d) => { d.settings.bills = (d.settings.bills || []).filter((x) => x.id !== b.id); }); ACT['bills-open'](); };
