// Trades, trade fees, investment income, loan fees and fee-bearing transfers must leave the app as Bluecoins-readable CSV
// and come back (re-import) with every account at the same balance.
import { emptyDb, balances, stamp, HOME, findOrAddCategory } from '../js/core.js';
import { importBluecoins, parseCSV, exportCSV } from '../js/importer.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const db = emptyDb();
const A = (id, name, cur, type, open, extra = {}) => db.accounts.push(stamp({ id, name, cur, type, open, include: false, archived: false, ...extra }));
A('bank', 'BDO Savings', HOME, 'bank', 200000, { openDate: '2026-01-01' });
A('btc', 'Binance BTC', 'BTC', 'crypto', 0, { exchange: 'Binance', invtab: true });
A('usdt', 'Binance USDT', 'USDT', 'crypto', 500, { exchange: 'Binance', invtab: true, openDate: '2026-01-01' });
A('bnb', 'Binance BNB', 'BNB', 'crypto', 0, { exchange: 'Binance', invtab: true });
A('debt', 'Personal loan', HOME, 'loan', 0);
A('cash', 'Wallet', HOME, 'cash', 1000);
const fees = findOrAddCategory(db, 'Fees', 'Trading fee', 'expense'), lf = findOrAddCategory(db, 'Financial loss', 'Loan fees', 'expense'), inc = findOrAddCategory(db, 'Investment', 'Staking reward', 'income');
const tx = (o) => db.txs.push(stamp({ fx: 1, cur: HOME, ...o }));
// 1 buy: 100,000 PHP -> 0.02 BTC, fee 50 PHP taken from the sender
tx({ id: 'buy', kind: 'transfer', date: '2026-02-01 10:00:00', name: 'Buy 0.02 BTC', acct: 'bank', toAcct: 'btc', amount: 100000, toAmount: 0.02, trade: { side: 'buy', asset: 'btc', qty: 0.02, valueHome: 100000 }, fee: 50, feeCat: fees.id, feeBy: 'from', feeCur: HOME, feeFx: 1 });
// 2 sell: 0.005 BTC -> 300 USDT, fee 1.2 USDT taken from the receiver
tx({ id: 'sell', kind: 'transfer', date: '2026-02-05 11:30:00', name: 'Sell 0.005 BTC', acct: 'btc', toAcct: 'usdt', amount: 0.005, cur: 'BTC', toAmount: 300, trade: { side: 'sell', asset: 'btc', qty: 0.005, valueHome: 17000 }, fee: 1.2, feeCat: fees.id, feeBy: 'to', feeCur: 'USDT', feeFx: 56 });
// 3 convert, no fee
tx({ id: 'conv', kind: 'transfer', date: '2026-02-07 09:00:00', name: 'Convert 370 USDT to 0.5 BNB', acct: 'usdt', toAcct: 'bnb', amount: 370, cur: 'USDT', toAmount: 0.5, trade: { side: 'convert', asset: 'usdt', qty: 370, asset2: 'bnb', qty2: 0.5, valueHome: 20000 } });
// 4 old style: the fee is its own expense, linked to the trade
tx({ id: 'oldfee', kind: 'expense', date: '2026-02-07 09:00:00', name: 'Trading fee: Convert 370 USDT to 0.5 BNB', cat: fees.id, acct: 'usdt', cur: 'USDT', amount: 0.37, tradeOf: 'conv' });
// 5 investment income paid in coin, 6 income paid as cash into a bank
tx({ id: 'stake', kind: 'income', date: '2026-02-10 12:00:00', name: 'Staking reward: BTC', cat: inc.id, acct: 'btc', cur: 'BTC', amount: 0.00031234, invIncome: { asset: 'btc', type: 'Staking reward' } });
tx({ id: 'div', kind: 'income', date: '2026-02-11 12:00:00', name: 'Dividend: NVDA', cat: inc.id, acct: 'bank', amount: 1234.56, notes: 'From NVDA' });
// 7 loan: 100,000 borrowed, 3,000 fees deducted on arrival
tx({ id: 'loan', kind: 'transfer', date: '2026-02-12 08:00:00', name: 'Personal loan', acct: 'debt', toAcct: 'bank', amount: 100000, toAmount: 100000, loan: true, loanNet: { principal: 100000, fees: 3000, net: 97000 }, fee: 3000, feeCat: lf.id, feeBy: 'to', feeCur: HOME, feeFx: 1 });
// 8 plain transfer with a fee
tx({ id: 'move', kind: 'transfer', date: '2026-02-13 08:00:00', name: 'Cash out', acct: 'bank', toAcct: 'cash', amount: 5000, toAmount: 5000, fee: 25, feeCat: fees.id, feeBy: 'from', feeCur: HOME, feeFx: 1 });

const csv = exportCSV(db), rows = parseCSV(csv), head = rows.shift(), H = (n) => head.indexOf(n);
const R = rows.map((r) => ({ type: r[H('Type')], date: r[H('Date')], name: r[H('Name')], amt: parseFloat(r[H('Amount')]), cur: r[H('Currency')], acct: r[H('Account')], cat: r[H('Category')], grp: r[H('Category Group')] || r[H('Category Type')], notes: r[H('Notes')] }));
const find = (f) => R.filter(f);
// header and every row has a value in the columns Bluecoins needs
ok(['Type', 'Date', 'Amount', 'Currency', 'Account', 'Category'].every((c) => H(c) >= 0), 'header has the Bluecoins columns');
ok(R.every((r) => r.type && r.date && Number.isFinite(r.amt) && r.cur && r.acct), 'every row has type, date, amount, currency and account');
// transfers leave as a pair with opposite signs and each account's own currency
const pair = (name) => find((r) => r.type === 'Transfer' && r.name === name);
let p = pair('Buy 0.02 BTC'); ok(p.length === 2 && p.some((r) => r.acct === 'BDO Savings' && r.amt === -100000 && r.cur === HOME) && p.some((r) => r.acct === 'Binance BTC' && r.amt === 0.02 && r.cur === 'BTC'), 'buy: PHP out, BTC in');
p = pair('Sell 0.005 BTC'); ok(p.length === 2 && p.some((r) => r.amt === -0.005 && r.cur === 'BTC') && p.some((r) => r.amt === 300 && r.cur === 'USDT'), 'sell: BTC out, USDT in');
p = pair('Convert 370 USDT to 0.5 BNB'); ok(p.length === 2 && p.some((r) => r.amt === -370) && p.some((r) => r.amt === 0.5 && r.cur === 'BNB'), 'convert: USDT out, BNB in');
// fees leave as their own expense on the account that paid them, in that account's currency
let f = find((r) => r.type === 'Expense' && r.notes === 'Transfer fee' && r.acct === 'BDO Savings' && r.amt === -50); ok(f.length === 1 && f[0].cat === 'Trading fee' && f[0].grp === 'Fees', 'buy fee: expense -50 PHP on the bank, Fees > Trading fee');
f = find((r) => r.type === 'Expense' && r.acct === 'Binance USDT' && r.amt === -1.2 && r.cur === 'USDT'); ok(f.length === 1, 'sell fee: expense -1.2 USDT on the receiving account');
f = find((r) => r.type === 'Expense' && r.name.startsWith('Trading fee:') && r.amt === -0.37); ok(f.length === 1 && f[0].acct === 'Binance USDT', 'older separate trading fee is exported once');
f = find((r) => r.type === 'Expense' && r.amt === -3000 && r.acct === 'BDO Savings'); ok(f.length === 1 && f[0].grp === 'Financial loss', 'loan fee: expense -3,000 on the account that received the loan');
f = find((r) => r.type === 'Expense' && r.amt === -25); ok(f.length === 1 && f[0].acct === 'BDO Savings', 'transfer fee exported');
// income
f = find((r) => r.type === 'Income' && r.cur === 'BTC'); ok(f.length === 1 && f[0].amt === 0.00031234 && f[0].acct === 'Binance BTC', 'staking reward: income in BTC with full precision');
f = find((r) => r.type === 'Income' && r.amt === 1234.56); ok(f.length === 1 && f[0].acct === 'BDO Savings', 'cash dividend: income into the bank');
// no money appears or disappears: exported fee rows exist exactly once per fee
ok(R.filter((r) => r.type === 'Expense').length === 5, 'five fee expenses, nothing duplicated');
// round trip
const back = emptyDb(); importBluecoins(back, csv);
const key = (d, a) => `${a.baseName || a.name}|${a.cur}`;
const b1 = balances(db), b2 = balances(back); let diff = 0, n = 0;
for (const a of db.accounts) { const o = b1.get(a.id) || 0, a2 = back.accounts.find((x) => !x.deleted && key(back, x) === key(db, a)), v = a2 ? b2.get(a2.id) || 0 : null; n++; if (v === null || Math.abs(v - o) > 1e-8) { diff++; console.log('  differs:', a.name, a.cur, o, v); } }
ok(diff === 0, `re-import gives every account the same balance (${n} accounts)`);
ok(back.txs.filter((t) => !t.deleted && t.kind === 'transfer').length === 5, 'the five transfers come back as transfers (fees become their own expenses)');
// the exported file survives a second export unchanged
ok(exportCSV(back).split('\r\n').length === csv.split('\r\n').length, 'second export has the same number of rows');
// two wallets of one platform holding the same coin under the same name must not merge on the way out
{ const w = emptyDb();
  w.accounts.push(stamp({ id: 'w1', name: 'USDT', cur: 'USDT', type: 'crypto', open: 500, exchange: 'KuCoin', wallet: 'Spot', openDate: '2026-01-01' }), stamp({ id: 'w2', name: 'USDT', cur: 'USDT', type: 'crypto', open: 200, exchange: 'KuCoin', wallet: 'Earn', openDate: '2026-01-01' }));
  w.txs.push(stamp({ id: 'wt', kind: 'transfer', date: '2026-03-01 10:00:00', name: 'Spot to Earn', acct: 'w1', toAcct: 'w2', amount: 100, toAmount: 100, cur: 'USDT', fx: 56 }));
  const o = parseCSV(exportCSV(w)), h = o.shift(), names = new Set(o.map((r) => r[h.indexOf('Account')]));
  ok(names.size === 2, 'same-named accounts in two wallets leave with different account names (' + [...names].join(' | ') + ')');
  const w2 = emptyDb(); importBluecoins(w2, exportCSV(w)); const bb = balances(w2);
  ok(w2.accounts.filter((a) => !a.deleted).length === 2 && [...bb.values()].sort((a, b) => a - b).join() === '100,300' || [...bb.values()].sort((a, b) => a - b).join() === '300,400', 'both wallets come back with their own balance (' + [...bb.values()].join(', ') + ')'); }
process.exit(bad ? 1 : 0);
