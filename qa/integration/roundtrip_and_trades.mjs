// INTEGRATION: export -> import round trips (Sukli CSV, JSON backup shape) keep every number; trade maths on seeded random data.
import { ok, near, readCsv, rng, done } from '../lib.mjs';
import { emptyDb, balances, live, r9 } from '../../js/core.js';
import { importBluecoins } from '../../js/importer.js';
import { exportSukliCSV, importSukliCSV } from '../../js/sukliCsv.js';
import { tradeBook } from '../../js/tradecalc.js';
import { netWorth } from '../../js/finance.js';

// ---- A. Sukli CSV round trip on the real sample
const src = emptyDb(); importBluecoins(src, readCsv());
const csv = exportSukliCSV(src);
const dst = emptyDb(); const st = importSukliCSV(dst, csv);
const sa = live(src.txs), da = live(dst.txs);
ok(da.length === sa.length, `Sukli CSV round trip keeps every entry (${sa.length} -> ${da.length}, skipped ${st.skipped})`);
const key = (t, db) => `${t.date}|${t.kind}|${r9(t.amount)}|${(db.accounts.find((a) => a.id === t.acct) || {}).name}`;
const multi = (arr, db) => { const m = new Map(); for (const t of arr) m.set(key(t, db), (m.get(key(t, db)) || 0) + 1); return m; };
const ms = multi(sa, src), md = multi(da, dst); let miss = 0; for (const [k, n] of ms) if ((md.get(k) || 0) !== n) miss++;
ok(miss === 0, `every entry arrives with the same date, kind, amount and account (${miss} differ)`);
const bs = balances(src), bd = balances(dst);
const byName = (db, b) => { const m = new Map(); for (const a of live(db.accounts)) m.set(a.name + '|' + a.cur, (m.get(a.name + '|' + a.cur) || 0) + (b.get(a.id) || 0)); return m; };
const ns = byName(src, bs), nd = byName(dst, bd); let balDiff = [];
for (const [k, v] of ns) if (!near(v, nd.get(k) || 0, 0.01)) balDiff.push(`${k} ${v} vs ${nd.get(k)}`);
ok(balDiff.length === 0, `account balances identical after the round trip (${balDiff.length} differ ${balDiff.slice(0, 2)})`);
ok(near(netWorth(src).net, netWorth(dst).net, 0.5), `net worth identical after the round trip (${r9(netWorth(src).net)} vs ${r9(netWorth(dst).net)})`);
// importing the same file twice must not double anything
const again = importSukliCSV(dst, csv);
ok(live(dst.txs).length === da.length, `importing the same file again adds nothing (${live(dst.txs).length} vs ${da.length}, skipped ${again.skipped})`);

// ---- B. JSON backup is a plain copy
const copy = JSON.parse(JSON.stringify(src));
ok(live(copy.txs).length === sa.length && near(netWorth(copy).net, netWorth(src).net, 1e-6), 'JSON backup copy gives the same entries and net worth');

// ---- C. trade book on seeded random trades (average-cost method)
const R = rng(20261122); let allOk = true, why = '';
for (let round = 0; round < 300 && allOk; round++) {
  const list = []; let qtyHeld = 0, costIn = 0, proceeds = 0, feesOut = 0, soldQty = 0, day = 1;
  const n = 2 + Math.floor(R() * 12);
  for (let i = 0; i < n; i++) {
    const date = `2026-01-${String(day++).padStart(2, '0').slice(-2)}`.replace(/^2026-01-(\d)$/, '2026-01-0$1');
    const dd = `2026-${String(1 + Math.floor(day / 28)).padStart(2, '0')}-${String(1 + (day % 28)).padStart(2, '0')}`;
    const fee = Math.round(R() * 20 * 100) / 100;
    if (qtyHeld <= 0 || R() < 0.55) { const q = Math.round((0.1 + R() * 5) * 1e4) / 1e4, v = Math.round(q * (50 + R() * 100) * 100) / 100;
      list.push({ id: 't' + i, date: dd, trade: { side: 'buy', asset: 'X', qty: q, valueHome: v, feeHome: fee } }); qtyHeld += q; costIn += v + fee; }
    else { const q = Math.round(qtyHeld * (0.1 + R() * 0.9) * 1e4) / 1e4, v = Math.round(q * (30 + R() * 150) * 100) / 100;
      list.push({ id: 't' + i, date: dd, trade: { side: 'sell', asset: 'X', qty: q, valueHome: v, feeHome: fee } }); qtyHeld -= q; soldQty += q; proceeds += v; feesOut += fee; }
  }
  const b = tradeBook(list); const p = b.pos.get('X') || { qty: 0, cost: 0 };
  // conservation: money in (buys + fees) = cost still held + cost of what was sold; and gain = proceeds - sold cost - sell fees
  const soldCost = b.realized.reduce((s, r) => s + r.cost, 0), gain = b.realized.reduce((s, r) => s + r.gain, 0);
  const c1 = near(costIn, p.cost + soldCost, 1e-6), c2 = near(b.total, gain, 1e-9), c3 = near(gain, proceeds - soldCost - feesOut, 1e-6), c4 = p.qty >= -1e-9 && p.cost >= -1e-6 && near(p.qty, qtyHeld, 1e-6);
  if (!(c1 && c2 && c3 && c4)) { allOk = false; why = `round ${round}: cost ${c1} total ${c2} gain ${c3} qty ${c4} (${JSON.stringify(list).slice(0, 200)})`; }
}
ok(allOk, `300 random buy/sell sequences: cost in = cost held + cost sold, gain = proceeds - cost - fees, never negative holdings ${why}`);
// selling everything at the buy price loses exactly the fees
const flat = tradeBook([{ id: 'a', date: '2026-01-01', trade: { side: 'buy', asset: 'Y', qty: 2, valueHome: 100, feeHome: 1 } }, { id: 'b', date: '2026-01-02', trade: { side: 'sell', asset: 'Y', qty: 2, valueHome: 100, feeHome: 1 } }]);
ok(near(flat.total, -2, 1e-9) && flat.pos.get('Y').qty === 0, 'buy and sell at the same price loses exactly the two fees');
// order independence: the same trades listed in another order give the same answer
const L = [{ id: '1', date: '2026-01-01', trade: { side: 'buy', asset: 'Z', qty: 1, valueHome: 10, feeHome: 0 } }, { id: '2', date: '2026-01-02', trade: { side: 'buy', asset: 'Z', qty: 1, valueHome: 30, feeHome: 0 } }, { id: '3', date: '2026-01-03', trade: { side: 'sell', asset: 'Z', qty: 1, valueHome: 50, feeHome: 0 } }];
ok(near(tradeBook(L).total, tradeBook([...L].reverse()).total, 1e-9) && near(tradeBook(L).total, 30), 'trade list order does not change the result (gain 30)');
// selling a coin you never bought must not create profit out of nothing
const ghost = tradeBook([{ id: 'g', date: '2026-01-01', trade: { side: 'sell', asset: 'GHOST', qty: 5, valueHome: 500, feeHome: 0 } }]);
ok(near(ghost.total, 0, 1e-9), 'selling units with no known cost adds no made-up profit');
done();
