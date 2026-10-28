// Debts tab: every loan and card you owe on, its interest, terms and due date, and which one to pay first and how much.
// Plain arithmetic on your own figures (no advice engine). Typed figures (monthly money for debts, a debt's rate or minimum) can always be changed or removed.
import { get, commit, stamp, balances, homeFx, fmt, HOME, nowStamp, thisMonth, shiftMonth } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog, ic } from './ui.js';
import { hdr, coll } from './screens.js';
import { openEntry } from './entry.js';
import { cardBilling, isLiability } from './finance.js';
import { loanProgress } from './loancalc.js';
import { loanPayments, LOAN_KINDS } from './loans.js';
import { orderDebts, allocate, simulate, light, learnBudget, rankRate } from './debtplan.js';

const live = (l) => l.filter((x) => !x.deleted);
const money = (n) => fmt(n, HOME);
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const p2 = (n) => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const dstr = (y, m, d) => `${y}-${p2(m)}-${p2(Math.min(d, lastDay(y, m)))}`;
const niceDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
const monthsText = (n) => (n >= 12 ? `${Math.floor(n / 12)} yr${Math.floor(n / 12) > 1 ? 's' : ''}${n % 12 ? ` ${n % 12} mo` : ''}` : `${n} mo`);
const whenText = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); };

// next payment date of a loan from its due day (this month's if it is still to come or still unpaid, else next month's)
function loanDue(db, a, today) {
  const L = a.loan, dd = +(a.dueDay || (L && L.dueDay)) || 0; if (!dd) return { due: null, days: null, overdue: false };
  const [y, m] = today.split('-').map(Number);
  const paid = db.txs.some((t) => !t.deleted && t.kind === 'transfer' && t.toAcct === a.id && !t.loan && t.date.slice(0, 7) === today.slice(0, 7));
  let due = dstr(y, m, dd), overdue = false;
  if (due < today) { if (paid) due = m === 12 ? dstr(y + 1, 1, dd) : dstr(y, m + 1, dd); else overdue = true; }
  return { due, days: Math.round((new Date(due) - new Date(today)) / 864e5), overdue };
}

// one record per debt you still owe on, with everything in the home currency
export function debtList(db) {
  const bal = balances(db), today = nowStamp().slice(0, 10), out = [];
  for (const a of live(db.accounts)) {
    if (a.archived || !isLiability(a)) continue;
    const ownedCur = Math.max(0, -(bal.get(a.id) || 0)); if (!(ownedCur * (homeFx(db, a.cur) || 1) >= 0.5)) continue;
    const fx = homeFx(db, a.cur) || 1, owed = ownedCur * fx, L = a.loan, D = a.debtInt || {}, dm = a.dm || {};
    let rate = null, addon = false, addonMonthly = 0, src = '';
    if (dm.rate > 0) { rate = +dm.rate; src = 'yours'; }
    else if (L && +L.rate > 0) { rate = (Math.pow(1 + (+L.rate) / 1200, 12) - 1) * 100; src = 'loan'; }
    else if (D.on && +D.rate > 0) { if (D.kind === 'addon') { addon = true; addonMonthly = ((+D.principal > 0 ? +D.principal : ownedCur) * +D.rate / 1200) * fx; rate = +D.rate; } else rate = +D.rate; src = 'account'; }
    let min = 0, minEst = false;
    if (dm.min > 0) min = dm.min * fx; else if (L && +L.monthly > 0) min = L.monthly * fx; else { min = owed * 0.05; minEst = true; }
    min = Math.min(min, owed);
    let due = null, days = null, overdue = false, dueAmount = null;
    if (a.type === 'card' || a.stmtDay > 0) { const c = cardBilling(db, a, bal.get(a.id)); due = c.due; days = c.days; overdue = c.overdue; dueAmount = c.dueAmount * fx; } else ({ due, days, overdue } = loanDue(db, a, today));
    let left = null; if (L && L.months) { const pr = loanProgress(L, loanPayments(db, a)); left = pr.paymentsLeft || null; }
    out.push({ id: a.id, name: a.name, type: a.type, kind: L ? (LOAN_KINDS[L.kind] || 'Loan') : (a.type === 'card' ? 'Credit card' : 'Loan or money owed'), cur: a.cur, owedCur: ownedCur, owed, rate, rateKnown: rate != null, addon, addonMonthly, src, min, minEst, minTyped: dm.min > 0, due, days, overdue, dueAmount, left, months: L ? L.months : null });
  }
  return out;
}

// the figure the plan uses: your own, else learned from your entries
export function budgetInfo(db) {
  const own = +db.settings.debtBudget > 0 ? +db.settings.debtBudget : null;
  const learned = learnBudget(live(db.txs), (t) => t.amount * (t.fx || 1), thisMonth(), shiftMonth);
  return { own, learned, value: own != null ? own : (learned && learned.free > 0 ? learned.free : null) };
}
const mode = (db) => (db.settings.debtMode === 'snowball' ? 'snowball' : 'avalanche');

const LIGHT = { green: ['green', 'Looks okay', 'Your monthly money covers every minimum payment with some room.'], yellow: ['yellow', 'Tight', 'You can cover the minimums, but there is little room if something unexpected comes up.'], red: ['red', 'Not enough', 'Your monthly money does not cover every minimum payment.'] };

export function debts(db) {
  const list = debtList(db), md = mode(db), b = budgetInfo(db), total = list.reduce((s, d) => s + d.owed, 0), minTotal = list.reduce((s, d) => s + d.min, 0);
  if (!list.length) return `<div class="debtpage">${hdr('Debts')}<section class="cardbox"><h3>No debts to track</h3><p class="hint">Add a credit card or a loan in <a href="#/accounts">Accounts</a> (type: Credit card, or Loan or money owed) and put what you owe on it. It will show up here with the order to pay.</p></section></div>`;
  const budget = b.value, alloc = budget != null ? allocate(list, budget, md) : null, lt = light(budget, minTotal), by = new Map(list.map((d) => [d.id, d]));
  const plan = budget != null ? simulate(list, budget, md) : null, other = budget != null ? simulate(list, budget, md === 'avalanche' ? 'snowball' : 'avalanche') : null, minOnly = simulate(list, minTotal, md);
  const unknownRate = list.filter((d) => !d.rateKnown), addons = list.filter((d) => d.addon);
  const srcText = b.own != null ? 'This is your own figure' : (b.learned ? `Worked out from your entries (last ${b.learned.months} month${b.learned.months > 1 ? 's' : ''})` : '');
  const budgetBox = `<div class="debtsum">
    <div class="dsrow"><span>You owe</span><b>${money(total)}</b></div>
    <div class="dsrow"><span>Minimum payments each month</span><b>${money(minTotal)}</b></div>
    <div class="dsrow"><span>You can put toward debts each month</span><b>${budget != null ? money(budget) : 'not known yet'}</b></div>
    ${b.own == null && b.learned && b.learned.free <= 0 ? `<p class="hint">Your entries (last ${b.learned.months} month${b.learned.months > 1 ? 's' : ''}) show spending of ${money(b.learned.spend)} against income of ${money(b.learned.income)} a month, so nothing is left over. Type a figure to see a plan, or check that all your income is recorded.</p>` : srcText ? `<p class="hint">${srcText}${b.own == null && b.learned ? `: income ${money(b.learned.income)} minus spending ${money(b.learned.spend)} a month` : ''}.</p>` : '<p class="hint">Sukli needs one whole month of entries to work this out. You can also type a figure.</p>'}
    <div class="btnrow tight"><button type="button" class="btn sm ghost" data-act="debt-budget">${b.own != null ? 'Change my figure' : 'Type my own figure'}</button>${b.own != null ? '<button type="button" class="btn sm ghost" data-act="debt-budget-clear">Remove my figure</button>' : ''}</div></div>`;
  const lightBox = budget != null && LIGHT[lt.color] ? `<div class="debtlight ${lt.color}"><span class="ld"></span><div><b>${LIGHT[lt.color][1]}</b><span>${LIGHT[lt.color][2]}${lt.color === 'red' ? ` You are short by ${money(minTotal - budget)} a month. Talk to the lender early about a lower payment or a longer term, and look for spending to cut.` : ''}</span></div></div>` : '';
  const first = alloc && alloc.rows.length ? alloc.rows : [];
  const orderBox = alloc ? `<ol class="payorder">${first.map((r, i) => { const d = by.get(r.id); return `<li class="${i === 0 ? 'first' : ''}"><div class="po-n">${i + 1}</div><div class="po-b"><b>${esc(d.name)}</b><span>Pay <b>${money(r.pay)}</b> this month${r.extra > 0.004 ? ` (${money(r.min)} minimum + ${money(r.extra)} extra)` : ' (the minimum)'}${r.short > 0.004 ? ` <em class="cr">short by ${money(r.short)}</em>` : ''}</span>${i === 0 && first.length > 1 && (md !== 'avalanche' || rankRate(d) > 0) ? `<small class="muted">${md === 'avalanche' ? 'It has the highest interest' : 'It is the smallest debt'}, so extra money goes here first.</small>` : (i === 0 && first.length > 1 ? '<small class="muted">No interest rate is set, so debts are listed by size. Set the rates for a better order.</small>' : '')}${d.overdue ? '<small class="cr">Overdue: pay this as soon as you can.</small>' : ''}</div></li>`; }).join('')}</ol>
    ${alloc.leftover > 0.004 ? `<p class="hint">${money(alloc.leftover)} of your monthly money is left after every debt this month.</p>` : ''}` : '<p class="hint">Once Sukli knows what you can put toward debts each month, the order to pay shows here.</p>';
  const cmp = (p) => (p.never ? 'not paid off at this rate' : `debt-free ${whenText(p.months)} (${monthsText(p.months)}), ${money(p.interest)} interest`);
  const planBox = plan ? `<ul class="calfacts"><li><span>${md === 'avalanche' ? 'Highest interest first' : 'Smallest debt first'}</span><b>${cmp(plan)}</b></li><li><span>${md === 'avalanche' ? 'Smallest debt first' : 'Highest interest first'}</span><b>${cmp(other)}</b></li><li><span>Minimums only</span><b>${cmp(minOnly)}</b></li></ul>` : '';
  const seg = `<div class="seg two debtmode" role="group" aria-label="Order of payment"><button type="button" data-act="debt-mode" data-m="avalanche" class="${md === 'avalanche' ? 'on' : ''}">Highest interest first</button><button type="button" data-act="debt-mode" data-m="snowball" class="${md === 'snowball' ? 'on' : ''}">Smallest debt first</button></div>`;
  const rateText = (d) => (!d.rateKnown ? '<b class="cr">Not set</b>' : d.addon ? `<b>${d.rate}% add-on</b>` : `<b>${(+d.rate).toFixed(2).replace(/\.?0+$/, '')}% a year</b> <small class="muted">(${(((Math.pow(1 + d.rate / 100, 1 / 12) - 1)) * 100).toFixed(2).replace(/\.?0+$/, '')}% a month)</small>`);
  const dueText = (d) => (d.due ? `<b class="${d.overdue ? 'cr' : ''}">${d.overdue ? 'Overdue since ' + niceDate(d.due) : niceDate(d.due) + (d.days != null ? (d.days === 0 ? ' (today)' : ` (${d.days} day${d.days === 1 ? '' : 's'})`) : '')}</b>` : '<span class="muted">not set</span>');
  const rows = orderDebts(list, md).map((d) => `<div class="debtrow ${d.overdue ? 'od' : ''}"><div class="dr-head"><div><b>${esc(d.name)}</b><small class="muted">${esc(d.kind)}${d.cur !== HOME ? ` · ${fmt(d.owedCur, d.cur)}` : ''}</small></div><b class="dr-owed">${money(d.owed)}</b></div>
    <ul class="calfacts"><li><span>Interest</span>${rateText(d)}</li><li><span>Term</span><b>${d.left ? `${d.left} payment${d.left > 1 ? 's' : ''} left` : (d.months ? `${d.months} months` : 'No fixed end')}</b></li><li><span>Next payment due</span>${dueText(d)}</li>${d.type === 'card' && d.dueAmount != null && d.dueAmount > 0 ? `<li><span>Statement amount due</span><b>${money(d.dueAmount)}</b></li>` : ''}<li><span>Minimum payment</span><b>${money(d.min)}</b>${d.minEst ? ' <small class="muted">(estimate: 5%)</small>' : ''}</li></ul>
    <div class="btnrow tight"><button type="button" class="btn sm" data-act="debt-pay" data-id="${d.id}">Pay this debt</button><button type="button" class="btn sm ghost" data-act="debt-edit" data-id="${d.id}">${d.rateKnown && d.src !== 'yours' && !d.minTyped ? 'Check or change figures' : 'Change figures'}</button></div></div>`).join('');
  const warn = `${unknownRate.length ? `<p class="lpwarn">${ic('spark')} No interest rate is set for ${unknownRate.map((d) => esc(d.name)).join(', ')}. The plan counts it as 0% until you set it, so the order may be wrong.</p>` : ''}${addons.length ? `<p class="hint">${addons.map((d) => esc(d.name)).join(', ')} uses add-on interest: a fixed charge on the original amount. Paying it off early may save little or nothing, so ask the lender what an early payoff costs.</p>` : ''}`;
  const limits = `<ul class="calfacts limits">
    <li><span>Credit cards (BSP)</span><b>Interest on an unpaid balance: at most 3% a month (36% a year). Cash advance fee: at most ₱200 each. The BSP kept these limits in August 2023 and said it would review them.</b></li>
    <li><span>Small loans from lending companies (SEC)</span><b>For loans of ₱10,000 or less over up to 4 months, taken or renewed from April 1, 2026: interest at most 6% a month, all charges together at most 12% a month, late penalty at most 5% a month. Circular 14 of 2025.</b></li>
    <li><span>If you pay more than these</span><b>Ask the lender to explain the charges, and you can complain to the BSP (banks and cards) or the SEC (lending companies).</b></li></ul><p class="hint">These come from news reports and can change. Check with the BSP or SEC for the current rule.</p>`;
  return `<div class="debtpage">${hdr('Debts')}
    <section class="cardbox"><h3>Can I pay?</h3>${budgetBox}${lightBox}</section>
    <section class="cardbox"><h3>Pay in this order</h3>${seg}${orderBox}${planBox}<p class="hint">An estimate from your own figures. Real balances change with new charges and late fees.</p></section>
    ${warn}
    <h2 class="subh">Your debts (${list.length})</h2>${rows}
    ${coll('d-limits', 'Interest limits in the Philippines', limits)}</div>`;
}

ACT['debt-pay'] = (el) => openEntry({ preset: { kind: 'transfer', debt: true, toAcct: el.dataset.id } });
ACT['debt-mode'] = (el) => commit((d) => { d.settings.debtMode = el.dataset.m === 'snowball' ? 'snowball' : 'avalanche'; });
ACT['debt-budget'] = () => {
  const db = get(), cur = db.settings.debtBudget || '', b = budgetInfo(db);
  const s = sheet(`<form novalidate><p class="hint">How much can you put toward all your debts together each month, in ${HOME}? ${b.learned ? `From your entries Sukli finds about ${money(b.learned.free)}.` : ''}</p>
    <label class="field"><span>Each month (${HOME})</span><input name="v" inputmode="decimal" value="${cur}" placeholder="e.g. 15000" autofocus></label>
    <div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn">Save</button></div></form>`, { title: 'Money for debts' });
  s.el.querySelector('[data-no]').onclick = () => s.close();
  s.el.querySelector('form').onsubmit = (e) => { e.preventDefault(); const n = num(e.target.v.value); s.dispose(); commit((d) => { if (n > 0) d.settings.debtBudget = n; else delete d.settings.debtBudget; }); toast(n > 0 ? 'Saved.' : 'Removed. Sukli will use your entries.'); };
};
ACT['debt-budget-clear'] = async () => { if (!(await confirmDialog('Remove your figure? Sukli will work it out from your entries instead.', 'Remove', true))) return; commit((d) => { delete d.settings.debtBudget; }); toast('Removed.'); };
ACT['debt-edit'] = (el) => {
  const db = get(), a = db.accounts.find((x) => x.id === el.dataset.id); if (!a) return;
  const d = debtList(db).find((x) => x.id === a.id) || {}, dm = a.dm || {}, hasDm = dm.rate > 0 || dm.min > 0;
  const s = sheet(`<form novalidate><p class="hint">These figures are only used for the plan on this tab. They do not add anything to the account.</p>
    <div class="two"><label class="field"><span>Interest % a year</span><input name="rate" inputmode="decimal" value="${dm.rate || (d.rateKnown && !d.addon && d.src !== 'yours' ? +(+d.rate).toFixed(2) : '')}" placeholder="e.g. 36" autofocus></label>
    <label class="field"><span>Minimum payment (${esc(a.cur)})</span><input name="min" inputmode="decimal" value="${dm.min || (d.min && !d.minEst ? +(d.min / (homeFx(db, a.cur) || 1)).toFixed(2) : '')}" placeholder="from your statement"></label></div>
    <p class="hint">3% a month is about 42.6% a year (36% if you do not count compounding). Either is fine for a rough plan.</p>
    <label class="field"><span>Payment due on day of month</span><input name="due" inputmode="numeric" value="${a.dueDay || ''}" placeholder="1–31"></label>
    <div class="btnrow">${hasDm ? '<button type="button" class="btn ghost" data-rm>Remove my figures</button>' : '<button type="button" class="btn ghost" data-no>Cancel</button>'}<button class="btn">Save</button></div></form>`, { title: a.name });
  const no = s.el.querySelector('[data-no]'); if (no) no.onclick = () => s.close();
  const rm = s.el.querySelector('[data-rm]'); if (rm) rm.onclick = () => { s.dispose(); commit((q) => { const x = q.accounts.find((z) => z.id === a.id); if (x) { delete x.dm; stamp(x); } }); toast('Removed.'); };
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault(); const f = e.target, r = num(f.rate.value), mn = num(f.min.value), dd = Math.round(num(f.due.value)); s.dispose();
    commit((q) => { const x = q.accounts.find((z) => z.id === a.id); if (!x) return; const n = {}; if (r > 0) n.rate = r; if (mn > 0) n.min = mn; if (n.rate || n.min) x.dm = n; else delete x.dm; if (dd >= 1 && dd <= 31) x.dueDay = dd; stamp(x); });
    toast('Saved.');
  };
};
export { rankRate };
