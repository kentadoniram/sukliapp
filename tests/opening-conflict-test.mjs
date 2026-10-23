// Standalone: opening date later than the first transaction is moved back to that first transaction.
import { emptyDb, balances, openDateOf, openDates } from '../js/core.js';
import { accountHistory } from '../js/finance.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const db = emptyDb();
db.accounts.push({ id: 'a1', name: 'Grab Pay', open: 79, openDate: '2026-10-03' });
db.accounts.push({ id: 'a2', name: 'Cash', open: 100, openDate: '2026-01-01' });
db.txs.push({ id: 't1', kind: 'expense', acct: 'a1', amount: 10, date: '2026-09-20 10:00:00', cur: db.settings.base });
db.txs.push({ id: 't2', kind: 'expense', acct: 'a2', amount: 5, date: '2026-02-01 10:00:00', cur: db.settings.base });
const od = openDates(db);
ok(od.get('a1') === '2026-09-20', 'conflict moves opening to first transaction (' + od.get('a1') + ')');
ok(od.get('a2') === '2026-01-01', 'no conflict keeps the date');
ok(openDateOf(db.accounts[0]) === '2026-10-03', 'stored date untouched');
const h = accountHistory(db, 'a1');
ok(h.opening && h.opening.date === '2026-09-20', 'history shows the moved date');
ok(Math.abs((balances(db).get('a1') || 0) - 69) < 0.005, 'balance = 79 - 10');
process.exit(bad ? 1 : 0);
