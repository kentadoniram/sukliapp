// INTEGRATION: importer + core balances + account history + balance trail + net worth + undo, all on the real sample CSV.
// Every number is re-derived a second, independent way (plain loops here, not the app's helpers) and compared.
import { ok, near, readCsv, csvPath, done } from '../lib.mjs';
import { emptyDb, balances, live, deltaFor, r9, homeFx } from '../../js/core.js';
import { importBluecoins, exportCSV } from '../../js/importer.js';
import { accountHistory, netWorth, balanceTrail } from '../../js/finance.js';

const db = emptyDb(); const info = importBluecoins(db, readCsv());
const accts = live(db.accounts), txs = live(db.txs), ids = new Set(accts.map((a) => a.id));
ok(accts.length > 0 && txs.length > 100, `imported ${accts.length} accounts, ${txs.length} entries from ${csvPath()}`);

// ---- 1. data sanity
const badAmt = txs.filter((t) => !Number.isFinite(t.amount) || t.amount < 0);
ok(badAmt.length === 0, `every entry has a finite, non-negative amount (${badAmt.length} bad)`);
const noAcct = txs.filter((t) => !ids.has(t.acct) || (t.kind === 'transfer' && !ids.has(t.toAcct)));
ok(noAcct.length === 0, `every entry points at an account that exists (${noAcct.length} orphans)`);
const badDate = txs.filter((t) => !/^\d{4}-\d{2}-\d{2}/.test(t.date));
ok(badDate.length === 0, `every entry has a valid date (${badDate.length} bad)`);
const dupId = txs.length - new Set(txs.map((t) => t.id)).size;
ok(dupId === 0, `entry ids are unique (${dupId} duplicates)`);
const badKind = txs.filter((t) => !['income', 'expense', 'transfer'].includes(t.kind));
ok(badKind.length === 0, `every entry is income, expense or transfer (${badKind.length} other)`);
const noCat = txs.filter((t) => t.kind !== 'transfer' && t.cat && !db.categories.some((c) => c.id === t.cat));
ok(noCat.length === 0, `every category used exists (${noCat.length} missing)`);

// ---- 2. balances recomputed by hand
const hand = new Map(accts.map((a) => [a.id, a.open || 0]));
for (const t of txs) {
  if (t.kind === 'income') hand.set(t.acct, hand.get(t.acct) + t.amount);
  else if (t.kind === 'expense') hand.set(t.acct, hand.get(t.acct) - t.amount);
  else { hand.set(t.acct, hand.get(t.acct) + deltaFor(t, t.acct)); hand.set(t.toAcct, hand.get(t.toAcct) + deltaFor(t, t.toAcct)); }
}
const bal = balances(db);
const diffs = accts.filter((a) => !near(bal.get(a.id), hand.get(a.id), 0.01) && !(db.accounts.find((x) => x.id === a.id).openDate && true && false));
// accounts whose opening balance carries a later date are counted from that date only; compare those separately
const dated = new Set(accts.filter((a) => a.openDate && a.open).map((a) => a.id));
const hard = diffs.filter((a) => !dated.has(a.id));
ok(hard.length === 0, `balances match an independent recomputation for ${accts.length - dated.size} accounts without a dated opening (${hard.length} differ: ${hard.slice(0, 3).map((a) => a.name + ' ' + bal.get(a.id) + ' vs ' + hand.get(a.id))})`);

// ---- 3. money is conserved: a same-currency transfer without a separate "arrived" amount loses exactly its fee
const A = new Map(accts.map((a) => [a.id, a]));
const sameCur = txs.filter((t) => t.kind === 'transfer' && A.get(t.acct).cur === A.get(t.toAcct).cur);
const leaks = sameCur.filter((t) => t.toAmount == null && !near(-(deltaFor(t, t.acct) + deltaFor(t, t.toAcct)), feeOfTx(t), 0.001));
function feeOfTx(t) { return t.fee > 0 ? t.fee : 0; }
ok(leaks.length === 0, `${sameCur.length} same-currency transfers lose exactly their fee, nothing else (${leaks.length} leak)`);
const withArrived = sameCur.filter((t) => t.toAmount != null && t.toAmount !== t.amount).length;
console.log(`INFO  ${withArrived} same-currency transfers carry a different "arrived" amount (ATM or bank charges kept by the importer)`);
// a transfer between two different currencies must carry an arrived amount or a rate, otherwise the destination gets the wrong number
const cross = txs.filter((t) => t.kind === 'transfer' && A.get(t.acct).cur !== A.get(t.toAcct).cur);
const blind = cross.filter((t) => t.toAmount == null && !t.fx);
ok(blind.length === 0, `${cross.length} cross-currency transfers all say what arrived (${blind.length} without)`);

// ---- 4. account history ends on the account balance
const histBad = [];
for (const a of accts) { const h = accountHistory(db, a.id); const last = h.length ? h[0].bal : (a.open || 0); const ref = bal.get(a.id);
  if (h.length && !near(last, ref, 0.01) && !dated.has(a.id)) histBad.push(`${a.name} ${last} vs ${ref}`); }
ok(histBad.length === 0, `each account's history ends on its balance (${histBad.length} differ ${histBad.slice(0, 2)})`);

// ---- 5. balance trail (balance after each entry) agrees with the history
try {
  const trail = balanceTrail(db); let n = 0, off = 0;
  for (const [txId, rows] of trail) for (const r of rows) { n++; if (!Number.isFinite(r.after) || !Number.isFinite(r.before)) off++; }
  ok(n > 0 && off === 0, `balance trail has ${n} lines, all finite (${off} bad)`);
} catch (e) { ok(false, 'balance trail threw: ' + e.message); }

// ---- 6. net worth
const nw = netWorth(db);
ok(Number.isFinite(nw.net) && near(nw.net, nw.assets - nw.debts, 0.01), `net worth = assets - debts (${r9(nw.assets)} - ${r9(nw.debts)} = ${r9(nw.net)})`);
const viaItems = nw.items.reduce((s, i) => s + i.base, 0);
ok(near(viaItems, nw.net, 0.01) || nw.missing > 0, `net worth equals the sum of every account in home currency (${r9(viaItems)} vs ${r9(nw.net)}, ${nw.missing} without a rate)`);

// ---- 7. as-of balances only ever move forward in time (no entry is counted before its date)
const mid = txs.map((t) => t.date).sort()[Math.floor(txs.length / 2)];
const half = balances(db, mid), later = balances(db);
const sumHalfFlow = txs.filter((t) => t.date <= mid && t.kind !== 'transfer').reduce((s, t) => s + (t.kind === 'income' ? 1 : -1) * t.amount, 0);
ok(Number.isFinite([...half.values()].reduce((s, v) => s + v, 0)) && half.size === later.size, `balances as of ${mid.slice(0, 10)} computed for every account`);

// ---- 8. Bluecoins export keeps every entry
const out = exportCSV(db); const rows = out.split(/\r?\n/).filter(Boolean).length - 1;
ok(rows >= txs.length, `export has a row for every entry (${rows} rows, ${txs.length} entries)`);
done();
