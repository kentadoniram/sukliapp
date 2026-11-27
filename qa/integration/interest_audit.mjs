// INTEGRATION: automatic interest on a normal bank / wallet account (like Maya Savings) re-derived with a plain loop.
// Daily compounding on the running balance, tax withheld per entry, gross = net + tax, and the account balance grows by exactly the credited interest.
import { ok, near, done } from '../lib.mjs';
import { emptyDb, balances, stamp, live } from '../../js/core.js';
import { postInterest } from '../../js/finance.js';

const db = emptyDb(), start = '2026-01-01', days = 45;
db.accounts.push(stamp({ id: 'a-maya', name: 'Maya Savings', cur: 'PHP', type: 'bank', open: 10000, openDate: start, apy: 6, compound: 'daily', interestFrom: start, include: true }));
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const last = addDays(start, days - 1);
postInterest(db, last);
const mine = live(db.txs).filter((t) => t.auto && t.acct === 'a-maya').sort((a, b) => (a.date < b.date ? -1 : 1));
ok(mine.length === days, `one interest entry per day (${mine.length} of ${days})`);

let bal = 10000, gSum = 0, tSum = 0, nSum = 0, worst = 0;
for (let i = 0; i < days; i++) {
  const gross = +(bal * 0.06 / 365).toFixed(2), tax = +(gross * 0.2).toFixed(2), net = +(gross - tax).toFixed(2);
  const t = mine[i]; if (t) worst = Math.max(worst, Math.abs(t.amount - net));
  gSum += gross; tSum += tax; nSum += net; bal += net;
}
ok(worst <= 0.011, `each day's credited interest matches the plain loop (largest gap ${worst.toFixed(4)})`);
const eSum = mine.reduce((s, t) => s + t.amount, 0), tt = mine.reduce((s, t) => s + (t.tax || 0), 0), gg = mine.reduce((s, t) => s + (t.gross || t.amount), 0);
ok(near(eSum, nSum, 0.5), `earned after tax ${eSum.toFixed(2)} equals the plain loop ${nSum.toFixed(2)}`);
ok(near(gg, eSum + tt, 0.01), 'gross = credited + tax withheld, on every entry added up');
ok(near(tt, tSum, 0.5), `tax withheld ${tt.toFixed(2)} equals the plain loop ${tSum.toFixed(2)}`);
const b = balances(db, last + ' 23:59:59').get('a-maya');
ok(near(b, 10000 + eSum, 0.01), `balance ${b.toFixed(2)} = opening + credited interest`);
// running it again adds nothing (no double posting)
const n0 = live(db.txs).length; postInterest(db, last); ok(live(db.txs).length === n0, 'posting again the same day adds no duplicate entries');
// a second day later adds exactly one
postInterest(db, addDays(last, 1)); ok(live(db.txs).length === n0 + 1, 'the next day adds exactly one entry');
done();
