// Borrowing: a planner that shows what a loan really costs before you take it, recording a loan with fees taken upfront,
// charges and late fees on a debt, and the "financial losses" card for Home. Rough first version.
import { get, commit, uid, stamp, nowStamp, rateFor, findOrAddCategory, catMap, accountMap, balances, shiftMonth, groupColor, thisMonth, monthOf } from './core.js';
import { ACT, sheet, ic, esc, toast, confirmDialog } from './ui.js';
import { isLiability } from './finance.js';
import { loanCalc, smartKind } from './loancalc.js';
export { loanCalc, smartKind };

export const LOAN_KINDS = { home: 'Home loan', car: 'Car loan', personal: 'Personal loan', cash: 'Credit to cash', other: 'Other loan' };
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const m2 = (n) => (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function openLoanPlanner(pre = {}) {
  const db = get(), live = db.accounts.filter((a) => !a.deleted && !a.archived);
  const recv = live.filter((a) => !isLiability(a)), debts = live.filter((a) => a.type === 'loan');
  const s = sheet(`<form id="lp" novalidate>
    <p class="hint">See what a loan really costs before you take it. Nothing is saved until you press Record.</p>
    <label class="field"><span>What kind</span><select name="kind">${Object.entries(LOAN_KINDS).map(([k, l]) => `<option value="${k}" ${pre.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="two"><label class="field"><span>Amount borrowed</span><input name="principal" inputmode="decimal" value="${pre.principal || ''}" placeholder="e.g. 500000"></label>
      <label class="field"><span>Interest % a year</span><input name="rate" inputmode="decimal" value="${pre.rate || ''}" placeholder="e.g. 8.5"></label></div>
    <div class="two"><label class="field"><span>Length (months)</span><input name="months" inputmode="numeric" value="${pre.months || ''}" placeholder="e.g. 60"></label>
      <label class="field"><span>Due day of month</span><input name="dueDay" inputmode="numeric" value="${pre.dueDay || ''}" placeholder="1–31"></label></div>
    <div class="two"><label class="field"><span>Taken upfront (processing and other fees)</span><input name="fees" inputmode="decimal" value="${pre.fees || ''}" placeholder="0"></label>
      <label class="field"><span>Late fee % of the payment</span><input name="lateFee" inputmode="decimal" value="${pre.lateFee || ''}" placeholder="e.g. 3"></label></div>
    <div id="lp-out" class="lpout" aria-live="polite"></div>
    ${recv.length ? `<label class="field"><span>Money arrives in</span><select name="recv">${recv.map((a) => `<option value="${a.id}">${esc(a.name)} · ${a.cur}</option>`).join('')}</select></label>
    <label class="field"><span>Record the debt in</span><select name="debt"><option value="">A new loan account</option>${debts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>` : '<p class="hint">Add an account first to record a loan.</p>'}
    <div class="btnrow"><button type="button" class="btn ghost" data-close2>Close</button>${recv.length ? '<button type="button" class="btn" data-rec>Record this loan</button>' : ''}</div></form>`, { title: 'Loan planner', wide: true });
  const form = s.el.querySelector('#lp'), out = s.el.querySelector('#lp-out');
  const vals = () => ({ kind: form.kind.value, principal: num(form.principal.value), rate: num(form.rate.value), months: num(form.months.value), fees: num(form.fees.value), lateFee: num(form.lateFee.value), dueDay: Math.round(num(form.dueDay.value)) });
  const draw = () => {
    const v = vals(); if (!(v.principal > 0 && v.months > 0)) { out.innerHTML = '<p class="muted">Fill in the amount and the length to see the cost.</p>'; return; }
    const c = loanCalc(v), warn = [];
    if (c.fees > 0) warn.push(`${m2(c.fees)} is taken before you get the money, so you receive ${m2(c.net)}, not ${m2(v.principal)}, but you repay on the full ${m2(v.principal)}.`);
    if (c.costPct >= 40) warn.push(`Heavy: the loan costs ${Math.round(c.costPct)}% of the money you actually receive.`);
    else if (c.costPct >= 15) warn.push(`The loan costs ${Math.round(c.costPct)}% of the money you actually receive.`);
    if (['home', 'car'].includes(v.kind)) warn.push(`Over ${c.n} months you will pay ${m2(c.interest)} in interest alone (${Math.round((c.interest / v.principal) * 100)}% on top of what you borrow).`);
    if (v.kind === 'cash') warn.push('Credit to cash usually charges a fee and monthly interest from day one. Compare it with a personal loan.');
    if (c.lateEach > 0) warn.push(`Each late payment adds about ${m2(c.lateEach)}; paying every instalment late would add ${m2(c.lateAll)}. Late payments can also raise the interest and hurt your credit record.`);
    out.innerHTML = `<div class="facts three"><div><span>Monthly payment</span><b>${m2(c.monthly)}</b></div><div><span>Total interest</span><b class="cr">${m2(c.interest)}</b></div><div><span>Total you repay</span><b>${m2(c.totalPaid)}</b></div></div>
      <div class="facts three"><div><span>You receive</span><b class="cg">${m2(c.net)}</b></div><div><span>Fees upfront</span><b class="cr">${m2(c.fees)}</b></div><div><span>Real cost</span><b class="cr">${m2(c.cost)}</b></div></div>
      ${warn.map((w) => `<p class="lpwarn">${ic('spark')} ${esc(w)}</p>`).join('')}`;
  };
  form.addEventListener('input', draw); draw();
  s.el.querySelector('[data-close2]').onclick = () => s.close();
  const rec = s.el.querySelector('[data-rec]');
  if (rec) rec.onclick = async () => {
    const v = vals(); if (!(v.principal > 0 && v.months > 0)) { toast('Fill in the amount and the length first.'); return; }
    const c = loanCalc(v), ra = accountMap(get()).get(form.recv.value);
    const ok = await confirmDialog(`Record ${LOAN_KINDS[v.kind]}? You borrow ${m2(v.principal)}${c.fees > 0 ? `, ${m2(c.fees)} fees are deducted upfront, and ${m2(c.net)} arrives in ${ra.name}` : ` and ${m2(c.net)} arrives in ${ra.name}`}. The fees are saved as a financial loss for your statistics.`, 'Yes, record it');
    if (!ok) return;
    commit((d) => {
      let debt = form.debt.value && d.accounts.find((a) => a.id === form.debt.value);
      const meta = { kind: v.kind, principal: v.principal, rate: v.rate, months: v.months, fees: v.fees, net: c.net, monthly: +c.monthly.toFixed(2), lateFee: v.lateFee, dueDay: v.dueDay, start: nowStamp().slice(0, 10) };
      if (!debt) { debt = stamp({ id: uid(), name: `${LOAN_KINDS[v.kind]} ${nowStamp().slice(0, 7)}`, cur: ra.cur, type: 'loan', open: 0, include: false, archived: false, loan: meta, dueDay: v.dueDay }); d.accounts.push(debt); } else { debt.loan = meta; if (v.dueDay) debt.dueDay = v.dueDay; stamp(debt); }
      const fx = rateFor(d, ra.cur) || 1, when = nowStamp();
      d.txs.push(stamp({ id: uid(), kind: 'transfer', amount: v.principal, cur: ra.cur, fx, date: when, name: `${LOAN_KINDS[v.kind]}`, cat: '', acct: debt.id, toAcct: ra.id, toAmount: v.principal, notes: `Borrowed ${m2(v.principal)} at ${v.rate}% for ${v.months} months. Monthly ${m2(c.monthly)}.`, loan: true }));
      if (v.fees > 0) { const cat = findOrAddCategory(d, 'Financial loss', 'Loan fees', 'expense'); d.txs.push(stamp({ id: uid(), kind: 'expense', amount: v.fees, cur: ra.cur, fx, date: when, name: `Loan fees: ${LOAN_KINDS[v.kind]}`, cat: cat.id, acct: ra.id, notes: 'Deducted upfront from the loan', loan: true })); }
    });
    s.close(); toast('Loan recorded. Open the account to see the payment plan.');
  };
}
ACT['loan-plan'] = () => openLoanPlanner();

// a charge on a debt: interest, late fee, penalty. It raises what you owe and counts as a financial loss.
export function openLoanCharge(acctId) {
  const a = get().accounts.find((x) => x.id === acctId); if (!a) return;
  const s = sheet(`<form id="lc"><label class="field"><span>What was charged</span><select name="what"><option>Interest charge</option><option>Late fee</option><option>Penalty</option><option>Annual fee</option><option>Other charge</option></select></label>
    <label class="field"><span>Amount (${esc(a.cur)})</span><input name="amt" inputmode="decimal" autofocus></label>
    <div class="btnrow"><button type="button" class="btn ghost" data-close2>Cancel</button><button class="btn">Add charge</button></div></form>`, { title: `Charge on ${a.name}` });
  s.el.querySelector('[data-close2]').onclick = () => s.close();
  s.el.querySelector('#lc').onsubmit = (e) => { e.preventDefault(); const f = e.target, amt = num(f.amt.value); if (!(amt > 0)) return;
    commit((d) => { const cat = findOrAddCategory(d, 'Financial loss', f.what.value, 'expense'); d.txs.push(stamp({ id: uid(), kind: 'expense', amount: amt, cur: a.cur, fx: rateFor(d, a.cur) || 1, date: nowStamp(), name: f.what.value, cat: cat.id, acct: a.id, notes: `Charged on ${a.name}` })); });
    s.close(); toast('Added. It counts as a financial loss.'); };
}
ACT['loan-charge'] = (el) => openLoanCharge(el.dataset.id);

// plan, next due date and overdue warning shown on a loan's account page
export function loanBox(db, a, money) {
  const L = a.loan, today = nowStamp().slice(0, 10), dd = +(a.dueDay || (L && L.dueDay)) || 0;
  if (!L && !dd) return '';
  const [y, m, d0] = today.split('-').map(Number), last = (yy, mm) => new Date(yy, mm, 0).getDate(), p2 = (n) => String(n).padStart(2, '0');
  let due = dd ? `${y}-${p2(m)}-${p2(Math.min(dd, last(y, m)))}` : '';
  const paid = dd ? db.txs.some((t) => !t.deleted && t.kind === 'transfer' && t.toAcct === a.id && t.date.slice(0, 7) === today.slice(0, 7) && t.date.slice(0, 10) >= `${y}-${p2(m)}-01` && !t.loan) : false;
  let status = '';
  if (dd && !paid) { const days = Math.round((new Date(today) - new Date(due)) / 86400000); if (days > 0) { const late = L && L.monthly && L.lateFee ? L.monthly * L.lateFee / 100 : 0; status = `<p class="lpwarn">${ic('spark')} Payment was due ${esc(due)} (${days} day${days === 1 ? '' : 's'} ago) and none is recorded this month.${late ? ` A late fee of about ${money(late, a.cur)} may apply.` : ''} Late payments can add penalties and hurt your credit record.</p>`; } else status = `<p class="hint">Next payment due ${esc(due)}${days === 0 ? ' (today)' : ` (in ${-days} day${days === -1 ? '' : 's'})`}.</p>`; }
  else if (dd && paid) status = '<p class="hint">This month’s payment is recorded.</p>';
  return `<div class="cardbox"><h3>${L ? esc(LOAN_KINDS[L.kind] || 'Loan') : 'Payments'}</h3>
    ${L ? `<ul class="calfacts"><li><span>Borrowed</span><b>${money(L.principal, a.cur)}</b></li><li><span>Received after fees</span><b>${money(L.net, a.cur)}</b></li><li><span>Monthly payment</span><b>${money(L.monthly, a.cur)}</b></li><li><span>Rate and length</span><b>${L.rate}% · ${L.months} months</b></li></ul>` : ''}
    ${status}
    <div class="btnrow tight"><button class="btn sm ghost" data-act="loan-charge" data-id="${a.id}">Add interest, late fee or penalty</button></div></div>`;
}

// Home card: money lost to fees, interest and penalties, plus tax taken from interest
export function lossCard(db, ym, coll, R) {
  const cm = catMap(db), tx = db.txs.filter((t) => !t.deleted && t.kind === 'expense' && (cm.get(t.cat) || {}).group === 'Financial loss');
  const taxes = db.txs.filter((t) => !t.deleted && t.auto && t.tax > 0);
  const inM = (t) => t.date.startsWith(ym), sum = (l, f = (t) => t.amount * (t.fx || 1)) => l.reduce((a, t) => a + f(t), 0);
  const from = shiftMonth(ym, -11), in12 = (t) => monthOf(t.date) >= from && monthOf(t.date) <= ym;
  const by = new Map(); for (const t of tx.filter(in12)) { const n = (cm.get(t.cat) || {}).name || 'Other'; by.set(n, (by.get(n) || 0) + t.amount * (t.fx || 1)); }
  const tm = sum(taxes.filter(inM), (t) => t.tax * (t.fx || 1)), t12 = sum(taxes.filter(in12), (t) => t.tax * (t.fx || 1));
  if (!tx.length && !taxes.length) return '';
  return coll('h-loss', 'Money lost to fees and interest', `<ul class="calfacts"><li><span>This month</span><b class="cr">${R(sum(tx.filter(inM)))}</b></li><li><span>Last 12 months (by kind below)</span><b class="cr">${R(sum(tx.filter(in12)))}</b></li>
    ${[...by.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${esc(k)}</span><b>${R(v)}</b></li>`).join('')}
    ${t12 ? `<li><span>Tax taken from interest (12 months)</span><b>${R(t12)}</b></li>` : ''}</ul><p class="hint">Fees, interest charges, late fees and penalties you recorded.</p>`);
}
