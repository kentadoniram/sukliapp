// An imported Starting Balance keeps its date: shown in history, counted in balances only from that day.
import fs from 'node:fs';
import { emptyDb, balances, openDateOf } from '../js/core.js';
import { importBluecoins } from '../js/importer.js';
import { accountHistory } from '../js/finance.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const db = emptyDb(); importBluecoins(db, fs.readFileSync(process.argv[2], 'utf8'));
const w = db.accounts.find((a) => a.name === 'Wallet' && a.open) || db.accounts.find((a) => a.open);   // the file may carry only some Starting Balance rows
ok(w && w.open && openDateOf(w), 'an account with opening has its date (' + (w && w.name + ' ' + w.open + ' ' + openDateOf(w)) + ')');
const od0 = openDateOf(w), dayBefore = new Date(Date.parse(od0) - 864e5).toISOString().slice(0, 10) + ' 23:59:59';
ok((balances(db, dayBefore).get(w.id) || 0) === 0, 'nothing before the opening date');
ok(balances(db, od0 + ' 23:59:59').get(w.id) >= 0, 'counted from the opening date');
const h = accountHistory(db, w.id);
ok(h.opening && h.opening.amount === w.open, 'history reports the opening line');
const last = h[0], now = balances(db).get(w.id);
ok(Math.abs(last.bal - now) < 0.005, 'history ends at the current balance (' + last.bal + ' vs ' + now + ')');
const dated = db.accounts.filter((a) => !a.deleted && a.open).every((a) => openDateOf(a));
ok(dated, 'every account with an opening balance has its date');
process.exit(bad ? 1 : 0);
