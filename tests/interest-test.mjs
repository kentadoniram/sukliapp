import * as I from '../js/interest.js';
import { emptyDb, stamp, HOME } from '../js/core.js';
import { postInterest, postDebtInterest, lockInfo } from '../js/finance.js';
let f=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c) f++;};
const near=(a,b,e=1e-3)=>Math.abs(a-b)<e;
ok('12% monthly -> 12.6825% effective', near(I.earFromNominal(12,'monthly'),12.6825,1e-3));
ok('effective back to nominal', near(I.nominalFromEar(12.6825,'monthly'),12,1e-3));
ok('daily compounds more than quarterly', I.earFromNominal(10,'daily')>I.earFromNominal(10,'quarterly'));
ok('interest for a year at 6% monthly', near(I.compInterest(100000,6,'monthly',12),6167.78,0.01));
ok('interest -> rate round trip', near(I.nominalFromInterest(100000,6167.78,'monthly',12),6,1e-3));
ok('add-on 8% for 12 months is about 14.4% real', near(I.addonToNominal(100000,8,12),14.45,0.05));
const a={apy:5,rates:[{from:'2026-10-08',rate:2}]};
ok('rate before change', I.rateAt(a,'2026-10-07')===5);
ok('rate from the change date', I.rateAt(a,'2026-10-08')===2 && I.rateAt(a,'2026-12-01')===2);
const pa={apy:1,promos:[{depFrom:'2026-10-01',depTo:'2026-10-31',rate:6,until:'2026-12-31'}]};
ok('promo active in its window', I.activePromos(pa,'2026-11-15').length===1 && I.activePromos(pa,'2027-01-01').length===0);
ok('period ends', I.isPeriodEnd('2026-02-28','monthly') && !I.isPeriodEnd('2026-02-28','quarterly') && I.isPeriodEnd('2026-12-31','yearly') && I.isPeriodEnd('2026-02-10','daily'));


const okc = (c, m) => ok(m, c);
// posting: monthly compounding posts once, at month end, at 23:55
{ const d = emptyDb(); d.accounts.push({ id: 'sv', name: 'Savings', cur: HOME, type: 'bank', open: 36500, openDate: '2026-01-01', apy: 10, taxPct: 0, interestFrom: '2026-01-01', compound: 'monthly' });
  const made = postInterest(d, '2026-01-31');
  okc(made.length === 1 && made[0].date === '2026-01-31 23:55:00', 'monthly: one entry at 23:55 on the last day');
  okc(near(made[0].amount, 36500 * 0.10 / 365 * 31, 0.05), 'monthly: 31 days of interest added together'); }
// rate change mid-month
{ const d = emptyDb(); d.accounts.push({ id: 'sv', name: 'Savings', cur: HOME, type: 'bank', open: 36500, openDate: '2026-01-01', apy: 10, rates: [{ from: '2026-01-11', rate: 0 }], taxPct: 0, interestFrom: '2026-01-01', compound: 'monthly' });
  const made = postInterest(d, '2026-01-31');
  okc(near(made[0].amount, 36500 * 0.10 / 365 * 10, 0.05), 'rate drop to 0% on the 11th: only 10 days earn'); }
// promo: only the deposited amount earns the higher rate
{ const d = emptyDb(); d.accounts.push({ id: 'sv', name: 'Savings', cur: HOME, type: 'bank', open: 0, openDate: '2026-01-01', apy: 0, taxPct: 0, interestFrom: '2026-01-02', compound: 'monthly', promos: [{ depFrom: '2026-01-01', depTo: '2026-01-01', rate: 36.5, until: '' }] });
  d.txs.push(stamp({ id: 'dep', kind: 'income', acct: 'sv', amount: 1000, cur: HOME, fx: 1, date: '2026-01-01 09:00:00' }));
  const made = postInterest(d, '2026-01-31');
  okc(made.length === 1 && near(made[0].amount, 1000 * 0.365 / 365 * 30, 0.05), 'promo rate earns on the deposited money'); }
// promo with a lock: the promo rate runs for the lock days only, and locked money is reported until it unlocks
{ const d = emptyDb(); d.accounts.push({ id: 'sv', name: 'Savings', cur: HOME, type: 'bank', open: 500, openDate: '2025-12-01', apy: 0, taxPct: 0, interestFrom: '2026-01-02', compound: 'monthly', promos: [{ depFrom: '2026-01-01', depTo: '2026-01-01', rate: 36.5, until: '', lockDays: 10, lockEnd: '' }] });
  d.txs.push(stamp({ id: 'dep', kind: 'income', acct: 'sv', amount: 1000, cur: HOME, fx: 1, date: '2026-01-01 09:00:00' }));
  const li = lockInfo(d, d.accounts[0], '2026-01-05'), li2 = lockInfo(d, d.accounts[0], '2026-01-20');
  okc(li.locked === 1000 && li.available === 500 && li.nextUnlock === '2026-01-11', 'locked money, free amount and unlock date');
  okc(li2.locked === 0 && li2.available === 1500, 'nothing locked after the lock ends');
  const made = postInterest(d, '2026-01-31');
  okc(made.length === 1 && near(made[0].amount, 10, 0.05), 'promo rate runs only for the 10 lock days'); }
// debt: nothing before the deadline, then charged on what is owed
{ const d = emptyDb(); d.accounts.push({ id: 'ln', name: 'Loan', cur: HOME, type: 'loan', open: -36500, openDate: '2026-01-01', debtInt: { on: true, rate: 10, kind: 'addon', comp: 'monthly', start: '2026-01-21', principal: 0 } });
  const made = postDebtInterest(d, '2026-01-31');
  okc(made.length === 1 && made[0].kind === 'expense' && made[0].autoDebt, 'debt interest is an expense on the debt');
  okc(near(made[0].amount, 36500 * 0.10 / 365 * 11, 0.05), 'charged only from the deadline (11 days)'); }
process.exit(f?1:0);
