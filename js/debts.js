// Debts tab: every loan and card you owe on, its interest, terms and due date, and which one to pay first and how much.
// Plain arithmetic on your own figures (no advice engine). Typed figures (monthly money for debts, a debt's rate or minimum) can always be changed or removed.
import { get, commit, stamp, balances, homeFx, fmt, HOME, nowStamp, thisMonth, shiftMonth, catMap } from './core.js';
import { classOf } from './budgetsetup.js';
import { ACT, sheet, esc, toast, confirmDialog, ic } from './ui.js';
import { hdr, coll } from './screens.js';
import { openEntry } from './entry.js';
import { cardBilling, isLiability } from './finance.js';
import { loanProgress } from './loancalc.js';
import { loanPayments, LOAN_KINDS } from './loans.js';
import { orderDebts, simulate, learnMonths, cashRoom, habit, planMonth, suggestCuts, DEBT_SHARE, rankRate } from './debtplan.js';

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
    let cardPaid = 0;
    if (a.type === 'card' || a.stmtDay > 0) { const c = cardBilling(db, a, bal.get(a.id)); cardPaid = c.paid || 0; due = c.due; days = c.days; overdue = c.overdue; dueAmount = c.dueAmount * fx; } else ({ due, days, overdue } = loanDue(db, a, today));
    const pays = db.txs.filter((t) => !t.deleted && t.kind === 'transfer' && t.toAcct === a.id && !t.loan).map((t) => ({ date: t.date, amount: (t.toAmount != null ? t.toAmount : t.amount) * fx })), hb = habit(pays, today);
    const paid = (a.type === 'card' || a.stmtDay > 0) ? (cardPaid * fx) : pays.filter((x) => x.date.slice(0, 7) === today.slice(0, 7)).reduce((q, x) => q + x.amount, 0);
    let left = null; if (L && L.months) { const pr = loanProgress(L, loanPayments(db, a)); left = pr.paymentsLeft || null; }
    out.push({ id: a.id, name: a.name, type: a.type, kind: L ? (LOAN_KINDS[L.kind] || 'Loan') : (a.type === 'card' ? 'Credit card' : 'Loan or money owed'), cur: a.cur, owedCur: ownedCur, owed, rate, rateKnown: rate != null, addon, addonMonthly, src, min, minEst, minTyped: dm.min > 0, due, days, overdue, dueAmount, left, paid, usual: hb.usual, payN: hb.n, payMonths: hb.months, lateFee: !!(L && +L.lateFee > 0), months: L ? L.months : null });
  }
  return out;
}

// what a normal month looks like (income, living costs) and how much can go to debts this month
export function budgetInfo(db) {
  const own = +db.settings.debtBudget > 0 ? +db.settings.debtBudget : null, force = !!db.settings.debtForce, cm = catMap(db);
  const learned = learnMonths(live(db.txs), (t) => t.amount * (t.fx || 1), thisMonth(), shiftMonth, (t) => { const c = cm.get(t.cat); return { name: c ? c.name : 'Other', cls: classOf(c) }; });
  const known = learned && learned.income > 0 ? learned : null, r = cashRoom({ income: known ? known.income : null, spend: known ? known.spend : 0, typed: own, force });
  return { own, force, learned, known, ...r, value: r.use };
}
const mode = (db) => (db.settings.debtMode === 'snowball' ? 'snowball' : 'avalanche');
const pct = (x) => `${Math.round(x * 100)}%`;
const LIGHT = { green: ['green', 'Looks okay', 'Your money for debts covers what is due this month with some room.'], yellow: ['yellow', 'Tight', 'You can cover what is due, but there is little room if something unexpected comes up.'], red: ['red', 'Not enough', 'Your money for debts does not cover everything that is due this month.'] };

export function debts(db) {
  const list = debtList(db), md = mode(db), b = budgetInfo(db), total = list.reduce((s, d) => s + d.owed, 0), minTotal = list.reduce((s, d) => s + d.min, 0);
  if (!list.length) return `<div class="debtpage">${hdr('Debts')}<section class="cardbox"><h3>No debts to track</h3><p class="hint">Add a credit card or a loan in <a href="#/accounts">Accounts</a> (type: Credit card, or Loan or money owed) and put what you owe on it. It will show up here with the order to pay.</p></section></div>`;
  const needAll = list.reduce((s, d) => s + Math.min(d.owed, Math.max(0, d.min - d.paid)), 0);
  let funds = b.value, dip = false;
  if (b.own == null && funds != null && b.safe != null && funds < needAll - 0.5 && b.safe > funds) { funds = Math.min(needAll, b.safe); dip = true; }   // what is due may use the safety cushion, extra money never does
  const plan = funds != null ? planMonth(list, funds, md) : null, by = new Map(list.map((d) => [d.id, d]));
  const income = b.known ? b.known.income : null, spend = b.known ? b.known.spend : null;
  const colour = !plan ? 'none' : plan.shortTotal > 0.5 ? 'red' : (funds - plan.needTotal >= plan.needTotal * 0.25 ? 'green' : 'yellow');
  const sim = funds != null ? simulate(list, Math.max(funds, 0), md) : null, other = funds != null ? simulate(list, Math.max(funds, 0), md === 'avalanche' ? 'snowball' : 'avalanche') : null, minOnly = simulate(list, minTotal, md);
  const unknownRate = list.filter((d) => !d.rateKnown), addons = list.filter((d) => d.addon);
  const L = b.learned, thin = L && L.months < 2;
  // ---- your month
  let notes = '';
  if (b.own != null && b.typedCapped) notes += `<p class="lpwarn">${ic('spark')} You typed ${money(b.own)}${income ? ` (${pct(b.own / income)} of your income)` : ''}. Your own entries leave ${money(b.room)} after your usual spending and a safety cushion, and Sukli suggests at most ${pct(DEBT_SHARE)} of income for debts, so the plan uses <b>${money(b.room)}</b>. <button type="button" class="linkbtn" data-act="debt-force">Use my figure anyway</button></p>`;
  else if (b.own != null && b.force && b.room != null && b.own > b.room + 0.5) notes += `<p class="lpwarn">${ic('spark')} The plan uses your figure of ${money(b.own)}${income ? ` (${pct(b.own / income)} of your income)` : ''}, which is more than your entries leave after usual spending (${money(b.room)}). Something else would have to be cut. <button type="button" class="linkbtn" data-act="debt-unforce">Go back to the safe amount</button></p>`;
  else if (b.own != null) notes += '<p class="hint">The plan uses the figure you typed.</p>';
  if (!b.known && b.own == null) notes += '<p class="hint">Sukli needs one whole month of income and spending entries to work out what is left for debts. You can also type a figure.</p>';
  if (L && !b.known) notes += '<p class="hint">No income entries were found in the last months, so Sukli cannot tell what is left for debts. Record your income, or type a figure.</p>';
  if (dip) notes += `<p class="hint">To cover what is due, Sukli uses part of the safety cushion of ${money(b.buffer)} it normally keeps back.</p>`;
  if (b.known && thin) notes += '<p class="hint">This is based on only one month of entries, so treat it as a rough guide.</p>';
  if (b.known && b.known.rawIncome - b.known.income > 1) notes += `<p class="hint">One month had much lower income, so Sukli counts ${money(b.known.income)} a month to be careful.</p>`;
  const month = `<div class="debtsum">
    ${income != null ? `<div class="dsrow"><span>Income you usually get</span><b>${money(income)}</b></div><div class="dsrow"><span>Your usual spending</span><b>${money(spend)}</b></div><div class="dsrow"><span>Left after your usual spending</span><b>${money(b.safe)}</b></div><div class="dsrow"><span>Kept as a safety cushion</span><b>${money(Math.min(b.buffer, b.safe))}</b></div>` : ''}
    <div class="dsrow"><span>Due this month (minimums)</span><b>${money(plan ? plan.needTotal : minTotal)}</b></div>
    <div class="dsrow"><span>Suggested for debts this month</span><b>${funds != null ? money(funds) : 'not known yet'}${funds != null && income ? ` <small class="muted">(${pct(funds / income)} of income)</small>` : ''}</b></div>
    ${notes}<div class="btnrow tight"><button type="button" class="btn sm ghost" data-act="debt-budget">${b.own != null ? 'Change my figure' : 'Type my own figure'}</button>${b.own != null ? '<button type="button" class="btn sm ghost" data-act="debt-budget-clear">Remove my figure</button>' : ''}</div></div>`;
  // ---- shortfall and ways to find the money
  let short = '';
  if (plan && plan.shortTotal > 0.5) {
    const lines = plan.rows.filter((r) => r.short > 0.5).map((r) => { const d = by.get(r.id); return `<li><b>${esc(d.name)}</b>: short by ${money(r.short)}${d.due ? ` (due ${niceDate(d.due)})` : ''}</li>`; }).join('');
    const cuts = L ? suggestCuts(L.cats, plan.shortTotal) : { rows: [] };
    short = `<div class="debtlight red"><span class="ld"></span><div><b>Short by ${money(plan.shortTotal)} this month</b><span>You cannot cover everything that is due. Sukli pays the nearest due dates first, so these are the ones left short:</span><ul class="shortlist">${lines}</ul></div></div>
      <div class="cutbox"><b>Ways to find ${money(plan.shortTotal)}</b>${cuts.rows.length ? `<ul>${cuts.rows.map((c) => `<li>Spend about ${c.pct}% less on <b>${esc(c.name)}</b>: ${money(c.cut)} of your usual ${money(c.avg)} a month</li>`).join('')}</ul>${cuts.enough ? '' : '<p class="hint">That is not enough on its own.</p>'}` : '<p class="hint">Your entries show no wants or luxury spending to trim.</p>'}
      <ul><li>Ask the lender for a lower payment, a later due date or a longer term before you miss a payment.</li><li>If you can, add income this month (extra work, selling something you no longer use).</li></ul></div>`;
  }
  const lightBox = plan && colour !== 'red' && LIGHT[colour] ? `<div class="debtlight ${colour}"><span class="ld"></span><div><b>${LIGHT[colour][1]}</b><span>${LIGHT[colour][2]}</span></div></div>` : '';
  // ---- the plan
  const reason = (d, r, i) => {
    const bits = [];
    if (d.overdue) bits.push('<span class="cr">Overdue: pay as soon as you can</span>');
    else if (d.days != null && d.days <= 14) bits.push(`Due ${niceDate(d.due)} (${d.days === 0 ? 'today' : `${d.days} day${d.days === 1 ? '' : 's'}`}). Paying late can add interest or fees`);
    else if (d.due) bits.push(`Due ${niceDate(d.due)}`);
    if (r.topup > 0.5 && d.usual > 0) bits.push(`You usually pay about ${money(d.usual)} (${d.payMonths} of the last 6 months)`);
    if (r.extra > 0.5) bits.push(md === 'avalanche' ? (rankRate(d) > 0 ? 'Extra here because it has the highest interest of the debts that can take it' : 'Extra here (no rate set, so listed by size)') : 'Extra here because it is the smallest debt');
    if (d.paid > 0.5) bits.push(`Already paid ${money(d.paid)} this month`);
    return bits.map((x) => `<small class="muted">${x}</small>`).join('');
  };
  const order = plan ? `<ol class="payorder">${plan.rows.map((r, i) => { const d = by.get(r.id), parts = [r.base > 0.5 ? `${money(r.base)} due` : '', r.topup > 0.5 ? `${money(r.topup)} usual top-up` : '', r.extra > 0.5 ? `${money(r.extra)} extra` : ''].filter(Boolean);
    return `<li class="${i === 0 ? 'first' : ''}${d.overdue ? ' od' : ''}"><div class="po-n">${i + 1}</div><div class="po-b"><b>${esc(d.name)}</b><span>${r.pay > 0.5 ? `Pay <b>${money(r.pay)}</b>${parts.length > 1 ? ` <small class="muted">(${parts.join(' + ')})</small>` : ''}` : (r.need > 0.5 ? 'No money left for this one this month' : 'Nothing more to pay this month')}${r.short > 0.5 ? ` <em class="cr">short by ${money(r.short)}</em>` : ''}</span>${reason(d, r, i)}</div></li>`; }).join('')}</ol>
    <p class="hint">Total ${money(plan.payTotal)}${income ? ` (${pct(plan.payTotal / income)} of your income)${spend != null ? `. That leaves about ${money(Math.max(0, income - plan.payTotal))} for living, and you usually spend ${money(spend)}.` : '.'}` : '.'}${plan.leftover > 0.5 ? ` ${money(plan.leftover)} of the money for debts is not needed this month.` : ''}</p>` : '<p class="hint">Once Sukli knows what is left for debts this month, the order and amounts show here.</p>';
  const cmp = (p) => (p.never ? 'not paid off at this rate' : `debt-free ${whenText(p.months)} (${monthsText(p.months)}), ${money(p.interest)} interest`);
  const planBox = sim ? `<h4 class="subh">If you keep this up every month</h4><ul class="calfacts"><li><span>${md === 'avalanche' ? 'Extra to highest interest' : 'Extra to smallest debt'}</span><b>${cmp(sim)}</b></li><li><span>${md === 'avalanche' ? 'Extra to smallest debt' : 'Extra to highest interest'}</span><b>${cmp(other)}</b></li><li><span>Minimums only</span><b>${cmp(minOnly)}</b></li></ul>` : '';
  const seg = `<div class="seg two debtmode" role="group" aria-label="Where extra money goes"><button type="button" data-act="debt-mode" data-m="avalanche" class="${md === 'avalanche' ? 'on' : ''}">Extra to highest interest</button><button type="button" data-act="debt-mode" data-m="snowball" class="${md === 'snowball' ? 'on' : ''}">Extra to smallest debt</button></div>`;
  const rateText = (d) => (!d.rateKnown ? '<b class="cr">Not set</b>' : d.addon ? `<b>${d.rate}% add-on</b>` : `<b>${(+d.rate).toFixed(2).replace(/\.?0+$/, '')}% a year</b> <small class="muted">(${(((Math.pow(1 + d.rate / 100, 1 / 12) - 1)) * 100).toFixed(2).replace(/\.?0+$/, '')}% a month)</small>`);
  const dueText = (d) => (d.due ? `<b class="${d.overdue ? 'cr' : ''}">${d.overdue ? 'Overdue since ' + niceDate(d.due) : niceDate(d.due) + (d.days != null ? (d.days === 0 ? ' (today)' : ` (${d.days} day${d.days === 1 ? '' : 's'})`) : '')}</b>` : '<span class="muted">not set</span>');
  const hist = (d) => (d.payN ? `<li><span>Your payments</span><b>${d.payN} in the last 6 months${d.usual > 0 ? `, usually ${money(d.usual)}` : ''}</b></li>` : '<li><span>Your payments</span><span class="muted">none recorded in the last 6 months</span></li>');
  const rows = orderDebts(list, md).map((d) => `<div class="debtrow ${d.overdue ? 'od' : ''}"><div class="dr-head"><div><b>${esc(d.name)}</b><small class="muted">${esc(d.kind)}${d.cur !== HOME ? ` · ${fmt(d.owedCur, d.cur)}` : ''}</small></div><b class="dr-owed">${money(d.owed)}</b></div>
    <ul class="calfacts"><li><span>Interest</span>${rateText(d)}</li><li><span>Term</span><b>${d.left ? `${d.left} payment${d.left > 1 ? 's' : ''} left` : (d.months ? `${d.months} months` : 'No fixed end')}</b></li><li><span>Next payment due</span>${dueText(d)}</li>${d.type === 'card' && d.dueAmount != null && d.dueAmount > 0 ? `<li><span>Statement amount due</span><b>${money(d.dueAmount)}</b></li>` : ''}<li><span>Minimum payment</span><b>${money(d.min)}</b>${d.minEst ? ' <small class="muted">(estimate: 5%)</small>' : ''}</li>${hist(d)}</ul>
    <div class="btnrow tight"><button type="button" class="btn sm" data-act="debt-pay" data-id="${d.id}">Pay this debt</button><button type="button" class="btn sm ghost" data-act="debt-edit" data-id="${d.id}">${d.rateKnown && d.src !== 'yours' && !d.minTyped ? 'Check or change figures' : 'Change figures'}</button></div></div>`).join('');
  const warn = `${unknownRate.length ? `<p class="lpwarn">${ic('spark')} No interest rate is set for ${unknownRate.map((d) => esc(d.name)).join(', ')}. The plan counts it as 0% until you set it, so the order of extra money may be wrong.</p>` : ''}${list.some((d) => d.minEst) ? '<p class="hint">Some minimums are estimates (5% of what you owe). Set the real ones from your statements so the due amounts are right.</p>' : ''}${addons.length ? `<p class="hint">${addons.map((d) => esc(d.name)).join(', ')} uses add-on interest: a fixed charge on the original amount. Paying it off early may save little or nothing, so ask the lender what an early payoff costs.</p>` : ''}`;
  const limits = `<ul class="calfacts limits">
    <li><span>Credit cards (BSP)</span><b>Interest on an unpaid balance: at most 3% a month (36% a year). Cash advance fee: at most ₱200 each. The BSP kept these limits in August 2023 and said it would review them.</b></li>
    <li><span>Small loans from lending companies (SEC)</span><b>For loans of ₱10,000 or less over up to 4 months, taken or renewed from April 1, 2026: interest at most 6% a month, all charges together at most 12% a month, late penalty at most 5% a month. Circular 14 of 2025.</b></li>
    <li><span>If you pay more than these</span><b>Ask the lender to explain the charges, and you can complain to the BSP (banks and cards) or the SEC (lending companies).</b></li></ul><p class="hint">These come from news reports and can change. Check with the BSP or SEC for the current rule.</p>`;
  return `<div class="debtpage">${hdr('Debts')}
    <section class="cardbox"><h3>Your month</h3>${month}${lightBox}${short}</section>
    <section class="cardbox"><h3>What to pay now</h3>${order}${plan ? `<h4 class="subh">Where extra money goes</h4>${seg}` : ''}${planBox}<p class="hint">An estimate from your own entries. It pays what is due soonest first, follows how you usually pay, and keeps money for living. Real balances change with new charges and late fees.</p></section>
    ${warn}
    <h2 class="subh">Your debts (${list.length})</h2>${rows}
    ${coll('d-limits', 'Interest limits in the Philippines', limits)}</div>`;
}

ACT['debt-pay'] = (el) => openEntry({ preset: { kind: 'transfer', debt: true, toAcct: el.dataset.id } });
ACT['debt-mode'] = (el) => commit((d) => { d.settings.debtMode = el.dataset.m === 'snowball' ? 'snowball' : 'avalanche'; });
ACT['debt-budget'] = () => {
  const db = get(), cur = db.settings.debtBudget || '', b = budgetInfo(db);
  const s = sheet(`<form novalidate><p class="hint">The most you want to put toward all your debts together each month, in ${HOME}. ${b.room != null ? `Your entries leave about ${money(b.room)} after your usual spending. Sukli will not plan more than that unless you choose “Use my figure anyway”.` : ''}</p>
    <label class="field"><span>Each month (${HOME})</span><input name="v" inputmode="decimal" value="${cur}" placeholder="e.g. 15000" autofocus></label>
    <div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn">Save</button></div></form>`, { title: 'Money for debts' });
  s.el.querySelector('[data-no]').onclick = () => s.close();
  s.el.querySelector('form').onsubmit = (e) => { e.preventDefault(); const n = num(e.target.v.value); s.dispose(); commit((d) => { if (n > 0) d.settings.debtBudget = n; else delete d.settings.debtBudget; }); toast(n > 0 ? 'Saved.' : 'Removed. Sukli will use your entries.'); };
};
ACT['debt-force'] = () => commit((d) => { d.settings.debtForce = true; });
ACT['debt-unforce'] = () => commit((d) => { delete d.settings.debtForce; });
ACT['debt-budget-clear'] = async () => { if (!(await confirmDialog('Remove your figure? Sukli will work it out from your entries instead.', 'Remove', true))) return; commit((d) => { delete d.settings.debtBudget; delete d.settings.debtForce; }); toast('Removed.'); };
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
