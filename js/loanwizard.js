// Loan setup wizard: four short steps (what and who, the numbers, when and where, check and record).
// It uses the same maths as the Loan Planner (loanCalc) and records the same way: one loan account and one "borrowed" entry.
// Past loans: set the start date earlier and say how many payments you already made; those are recorded as payments from the account you chose.
import { get, commit, uid, stamp, nowStamp, rateFor, findOrAddCategory } from './core.js';
import { ACT, sheet, esc, toast } from './ui.js';
import { isLiability } from './finance.js';
import { loanCalc } from './loancalc.js';
import { LOAN_KINDS } from './loans.js';
import { button, textField, selectField } from './components.js';
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const m2 = (n) => (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const addMonths = (day, k) => { const [y, m, d] = day.split('-').map(Number), t = new Date(y, m - 1 + k, 1), last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`; };
export const STEPS = ['What and who', 'The numbers', 'When and where', 'Check and record'];

export function openLoanWizard() {
  const db = get(), accts = db.accounts.filter((a) => !a.deleted && !a.archived && !isLiability(a));
  if (!accts.length) { toast('Add an account first, then set up the loan.'); return; }
  const W = { step: 0, kind: 'personal', lender: '', principal: '', rate: '', months: '', fees: '', dueDay: '', lateFee: '', start: nowStamp().slice(0, 10), acct: accts[0].id, received: true, done: '0' };
  const s = sheet('<div id="lw"></div>', { title: 'Loan Setup', wide: true }), el = s.el.querySelector('#lw');
  const calc = () => loanCalc({ principal: num(W.principal), rate: num(W.rate), months: num(W.months), fees: num(W.fees), lateFee: num(W.lateFee) });
  const ok = () => W.step === 1 ? num(W.principal) > 0 && num(W.months) > 0 : true;
  const paid = () => Math.max(0, Math.min(Math.round(num(W.done)), Math.round(num(W.months))));
  function body() {
    if (W.step === 0) return `<p class="hint">A few short steps. Nothing is saved until the last one.</p>${selectField({ label: 'What kind of loan', id: 'lw-kind', value: W.kind, options: Object.entries(LOAN_KINDS).map(([k, l]) => ({ value: k, label: l })) })}${textField({ label: 'Who lent it (bank, person, company)', id: 'lw-lender', value: W.lender, placeholder: 'e.g. Pag-IBIG, Rakuten Bank' })}`;
    if (W.step === 1) return `<div class="two">${textField({ label: 'Amount borrowed', id: 'lw-principal', inputmode: 'decimal', value: W.principal, placeholder: 'e.g. 500000' })}${textField({ label: 'Interest % a year', id: 'lw-rate', inputmode: 'decimal', value: W.rate, placeholder: 'e.g. 8.5 (0 if none)' })}</div>
      <div class="two">${textField({ label: 'Length (months)', id: 'lw-months', inputmode: 'numeric', value: W.months, placeholder: 'e.g. 60' })}${textField({ label: 'Upfront fees', id: 'lw-fees', inputmode: 'decimal', value: W.fees, placeholder: 'taken before you get the money' })}</div>
      <div class="two">${textField({ label: 'Due day of month', id: 'lw-due', inputmode: 'numeric', value: W.dueDay, placeholder: '1–31' })}${textField({ label: 'Late fee % of the payment', id: 'lw-late', inputmode: 'decimal', value: W.lateFee, placeholder: 'e.g. 3' })}</div>
      <div id="lw-live" class="hint"></div>`;
    if (W.step === 2) return `${textField({ label: 'Start date', id: 'lw-start', value: W.start, placeholder: 'YYYY-MM-DD' })}${selectField({ label: 'Account used', id: 'lw-acct', value: W.acct, options: accts.map((a) => ({ value: a.id, label: `${a.name} · ${a.cur}` })) })}
      <label class="check"><input type="checkbox" id="lw-recv" ${W.received ? 'checked' : ''}> <span>The money arrived in this account (untick if it was paid straight to a shop or another person)</span></label>
      ${textField({ label: 'Payments already made', id: 'lw-done', inputmode: 'numeric', value: W.done, placeholder: '0 for a new loan' })}<small class="muted">Already paid ones are recorded as monthly payments from the account, dated month by month from the start date.</small>`;
    const c = calc(), n = paid();
    return `<ul class="calfacts"><li><span>${esc(LOAN_KINDS[W.kind])}${W.lender ? ' · ' + esc(W.lender) : ''}</span><b>${m2(num(W.principal))}</b></li><li><span>Rate and length</span><b>${num(W.rate)}% · ${num(W.months)} months</b></li><li><span>Monthly payment</span><b>${m2(c.monthly)}</b></li><li><span>Total interest</span><b>${m2(c.interest)}</b></li>${c.fees > 0 ? `<li><span>You receive after fees</span><b>${m2(c.net)}</b></li>` : ''}<li><span>Started</span><b>${esc(W.start)}</b></li>${n ? `<li><span>Already paid</span><b>${n} × ${m2(c.monthly)}</b></li>` : ''}</ul>`;
  }
  function draw() {
    el.innerHTML = `<div class="chips" aria-label="Steps">${STEPS.map((t, i) => button({ label: `${i + 1}. ${t}`, kind: 'chip', on: i === W.step, attr: { disabled: true } })).join('')}</div>${body()}
      <div class="btnrow">${W.step ? button({ label: 'Back', kind: 'ghost', e: 'lw-back' }) : button({ label: 'Close', kind: 'ghost', e: 'lw-close' })}${W.step < 3 ? button({ label: 'Next', kind: 'primary', e: 'lw-next', disabled: !ok() }) : button({ label: 'Record this loan', kind: 'primary', e: 'lw-save' })}</div>`;
    live();
  }
  function live() { const o = el.querySelector('#lw-live'); if (!o) return; if (!ok()) { o.textContent = 'Fill in the amount and the length to see the monthly payment.'; return; } const c = calc(); o.innerHTML = `Monthly payment <b>${m2(c.monthly)}</b> · total interest <b>${m2(c.interest)}</b> · you receive <b>${m2(c.net)}</b>`; }
  const map = { 'lw-kind': 'kind', 'lw-lender': 'lender', 'lw-principal': 'principal', 'lw-rate': 'rate', 'lw-months': 'months', 'lw-fees': 'fees', 'lw-due': 'dueDay', 'lw-late': 'lateFee', 'lw-start': 'start', 'lw-acct': 'acct', 'lw-done': 'done' };
  el.addEventListener('input', (e) => { const k = map[e.target.id]; if (k) { W[k] = e.target.value; if (W.step === 1) { live(); const nx = el.querySelector('[data-e=lw-next]'); if (nx) nx.disabled = !ok(); } } });
  el.addEventListener('change', (e) => { const k = map[e.target.id]; if (k) W[k] = e.target.value; if (e.target.id === 'lw-recv') W.received = e.target.checked; });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-e]'); if (!b) return; const a = b.dataset.e;
    if (a === 'lw-close') s.close(); else if (a === 'lw-back') { W.step--; draw(); } else if (a === 'lw-next' && ok()) { W.step++; draw(); } else if (a === 'lw-save') save();
  });
  function save() {
    const c = calc(), v = { principal: num(W.principal), rate: num(W.rate), months: Math.round(num(W.months)), fees: num(W.fees), lateFee: num(W.lateFee), dueDay: Math.round(num(W.dueDay)) };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(W.start)) { toast('Type the start date as YYYY-MM-DD.'); W.step = 2; draw(); return; }
    const n = paid();
    commit((d) => {
      const ra = d.accounts.find((a) => a.id === W.acct), fx = rateFor(d, ra.cur) || 1, name = `${W.lender.trim() || LOAN_KINDS[W.kind]} ${W.start.slice(0, 7)}`;
      const meta = { kind: W.kind, principal: v.principal, rate: v.rate, months: v.months, fees: v.fees, net: c.net, monthly: +c.monthly.toFixed(2), lateFee: v.lateFee, dueDay: v.dueDay, start: W.start, ...(W.lender.trim() ? { lender: W.lender.trim() } : {}) };
      const debt = stamp({ id: uid(), name, cur: ra.cur, type: 'loan', open: 0, include: false, archived: false, loan: meta, dueDay: v.dueDay }); d.accounts.push(debt);
      const lcat = v.fees > 0 ? findOrAddCategory(d, 'Financial loss', 'Loan fees', 'expense') : null, time = ' 09:00:00';
      d.txs.push(stamp({ id: uid(), kind: 'transfer', amount: v.principal, cur: ra.cur, fx, date: W.start + time, name: LOAN_KINDS[W.kind], cat: '', acct: debt.id, toAcct: W.received ? ra.id : '', toAmount: v.principal, notes: `Borrowed ${m2(v.principal)} at ${v.rate}% for ${v.months} months. Monthly ${m2(c.monthly)}.`, loan: true, loanNet: { principal: v.principal, fees: v.fees || 0, net: c.net },
        ...(v.fees > 0 ? { fee: v.fees, feeCat: lcat.id, feeBy: 'to', feeCur: ra.cur, feeFx: fx } : {}) }));
      for (let i = 1; i <= n; i++) d.txs.push(stamp({ id: uid(), kind: 'transfer', amount: +c.monthly.toFixed(2), cur: ra.cur, fx, date: addMonths(W.start, i) + time, name: `Payment: ${name}`, cat: '', acct: ra.id, toAcct: debt.id, toAmount: +c.monthly.toFixed(2), notes: 'Recorded by Loan Setup', debtPay: true }));
    });
    s.close(); toast(n ? `Loan recorded with ${n} past payment${n === 1 ? '' : 's'}.` : 'Loan recorded. Open the account to see the payment plan.');
  }
  draw();
}
ACT['loan-wizard'] = () => setTimeout(openLoanWizard, 90);
