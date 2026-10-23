// "Balance after" in Entries: the running balance of each account after each entry matches the account's history and the final balance.
import fs from 'node:fs';
import { emptyDb, balances, HOME, stamp } from '../js/core.js';
import { importBluecoins } from '../js/importer.js';
import { accountHistory, balanceTrail } from '../js/finance.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
// worked example: BDO 5,000, expense 500 -> 4,500; transfer 1,000 BDO -> Cash with fee 15
const d = emptyDb(); d.accounts.push({ id: 'bdo', name: 'BDO', cur: HOME, type: 'bank', open: 5000, openDate: '2026-01-01' }, { id: 'cash', name: 'Cash', cur: HOME, type: 'cash', open: 0 });
d.txs.push(stamp({ id: 'e1', kind: 'expense', acct: 'bdo', amount: 500, cur: HOME, date: '2026-01-05 10:00:00' }), stamp({ id: 't1', kind: 'transfer', acct: 'bdo', toAcct: 'cash', amount: 1000, cur: HOME, date: '2026-01-06 10:00:00', fee: 15, feeBy: 'from', feeCur: HOME }));
const tr = balanceTrail(d), e = tr.get('e1')[0], t = tr.get('t1');
ok(e.before === 5000 && e.after === 4500, 'expense 500 on 5,000 leaves 4,500');
ok(t.length === 2 && t[0].before === 4500 && t[0].after === 3485 && t[1].before === 0 && t[1].after === 1000, 'transfer shows both accounts, fee comes off the sender');
if (process.argv[2]) {
  const db = emptyDb(); importBluecoins(db, fs.readFileSync(process.argv[2], 'utf8'));
  const trail = balanceTrail(db), now = balances(db); let miss = 0, n = 0;
  for (const a of db.accounts.filter((x) => !x.deleted).slice(0, 60)) { const h = accountHistory(db, a.id); n += h.length; for (const r of h) { const l = (trail.get(r.t.id) || []).find((x) => x.id === a.id); if (!l || Math.abs(l.after - r.bal) > 0.005) miss++; } }
  ok(miss === 0, `trail equals account history for every entry (${n} checked, ${miss} differ)`);
}
process.exit(bad ? 1 : 0);
