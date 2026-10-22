// Buy / sell / convert for crypto, stocks and other investments. Recorded as a movement between your cash account and the holding,
// marked as a trade (not ordinary spending), with fees saved as a financial loss and gains or losses worked out by average cost.
import { get, commit, uid, stamp, nowStamp, rateFor, homeFx, fmt, HOME, balances, findOrAddCategory, softDelete } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { isLiability } from './finance.js';
import { inInvest, pushHistory } from './invest.js';

const money = (n, cur = HOME) => fmt(n, cur);
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const live = (l) => l.filter((x) => !x.deleted && !x.archived);
const r6 = (n) => Math.round(n * 1e6) / 1e6;

export function openTrade(pre = {}) {
  const db = get(), hold = live(db.accounts).filter((a) => inInvest(a) && !isLiability(a)), cash = live(db.accounts).filter((a) => !isLiability(a));
  if (!hold.length) { toast('Add a coin or an investment first (Investments, Add).'); return; }
  const lastCash = cash.find((a) => a.id === db.settings.lastAcct && !inInvest(a)) || cash.find((a) => !inInvest(a)) || cash[0];
  const opt = (l, sel) => l.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)} · ${esc(a.cur)}</option>`).join('');
  const s = sheet(`<form id="tr" novalidate>
    <div class="seg two3" role="group" aria-label="Kind">${[['buy', 'Buy'], ['sell', 'Sell'], ['convert', 'Convert']].map(([v, l]) => `<button type="button" data-side="${v}" class="${(pre.side || 'buy') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="field"><span id="l-asset">Holding</span><select name="asset">${opt(hold, pre.asset)}</select></label>
    <div id="f-conv" hidden><label class="field"><span>Convert into</span><select name="asset2">${opt(hold, (hold.find((a) => a.id !== (pre.asset || hold[0].id)) || hold[0]).id)}</select></label>
      <div class="two"><label class="field"><span>Amount you receive</span><input name="qty2" inputmode="decimal"></label><label class="field"><span>Worth in ${HOME} (optional)</span><input name="worth" inputmode="decimal"></label></div></div>
    <div id="f-cash"><label class="field"><span id="l-cash">Paid from</span><select name="cash">${opt([...cash.filter((a) => !inInvest(a)), ...cash.filter((a) => inInvest(a))], lastCash && lastCash.id)}</select></label></div>
    <div class="two"><label class="field"><span id="l-qty">Units</span><input name="qty" inputmode="decimal" placeholder="e.g. 0.01"></label><label class="field" id="f-price"><span>Price per unit</span><input name="price" inputmode="decimal"></label></div>
    <label class="field" id="f-total"><span id="l-total">Total paid</span><input name="total" inputmode="decimal"></label>
    <label class="field"><span id="l-fee">Fee (in the account’s currency)</span><input name="fee" inputmode="decimal" placeholder="0"></label>
    <div id="tr-sum" class="hint" aria-live="polite"></div>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Record</button></div></form>`, { title: 'Buy / sell', wide: true });
  const f = s.el.querySelector('#tr'); let side = pre.side || 'buy', last = '';
  const acct = (id) => db.accounts.find((a) => a.id === id);
  const sync = (from) => {
    const q = num(f.qty.value), p = num(f.price.value), t = num(f.total.value);
    if (from === 'total' && q > 0) f.price.value = String(r6(t / q)); else if (q > 0 && p > 0 && from !== 'total') f.total.value = String(r6(q * p));
    const a = acct(f.asset.value), c = acct(f.cash.value), conv = side === 'convert';
    s.el.querySelector('#f-conv').hidden = !conv; s.el.querySelector('#f-cash').hidden = false; s.el.querySelector('#f-price').hidden = conv; s.el.querySelector('#f-total').hidden = conv;
    s.el.querySelector('#l-asset').textContent = conv ? 'Convert from' : side === 'buy' ? 'Buying' : 'Selling';
    s.el.querySelector('#l-cash').textContent = conv ? 'Pay the fee from' : side === 'buy' ? 'Paid from' : 'Money goes to';
    s.el.querySelector('#l-total').textContent = side === 'buy' ? 'Total paid' : 'Total received';
    s.el.querySelector('#l-qty').textContent = conv ? 'Amount you give' : 'Units';
    s.el.querySelector('#l-fee').textContent = `Fee (in ${c ? c.cur : 'the account’s currency'})`;
    f.querySelectorAll('[data-side]').forEach((b) => b.classList.toggle('on', b.dataset.side === side));
    const fee = num(f.fee.value); s.el.querySelector('#tr-sum').textContent = conv ? `${q || 0} ${a ? a.cur : ''} becomes ${num(f.qty2.value) || 0} ${acct(f.asset2.value) ? acct(f.asset2.value).cur : ''}.${fee ? ` Fee ${money(fee, c.cur)} is saved as a financial loss.` : ''}` : (q && num(f.total.value) ? `${side === 'buy' ? 'Buy' : 'Sell'} ${q} ${a ? a.cur : ''} for ${money(num(f.total.value), c ? c.cur : HOME)}.${fee ? ` The fee of ${money(fee, c.cur)} is saved separately as a financial loss.` : ''} This is not counted as spending.` : '');
  };
  f.addEventListener('input', (e) => sync(e.target.name)); f.addEventListener('change', () => sync(''));
  f.querySelectorAll('[data-side]').forEach((b) => { b.onclick = () => { side = b.dataset.side; sync(''); }; });
  s.el.querySelector('[data-x]').onclick = () => s.close(); sync('');
  f.onsubmit = async (e) => {
    e.preventDefault(); const q = num(f.qty.value), fee = Math.max(0, num(f.fee.value)), a = acct(f.asset.value), c = acct(f.cash.value); if (!(q > 0) || !a || !c) { toast('Enter the number of units.'); return; }
    let t = num(f.total.value); const when = nowStamp(), tid = uid();
    let rec, trade, name;
    if (side === 'convert') {
      const b = acct(f.asset2.value), q2 = num(f.qty2.value); if (!b || b.id === a.id || !(q2 > 0)) { toast('Choose the other coin and the amount you receive.'); return; }
      const worth = num(f.worth.value) || q2 * (homeFx(db, b.cur) || 0); if (!(worth > 0)) { toast(`No price for ${b.cur} yet. Type what it is worth in ${HOME}.`); return; }
      name = `Convert ${q} ${a.cur} to ${q2} ${b.cur}`; trade = { side, asset: a.id, qty: q, asset2: b.id, qty2: q2, valueHome: worth, paidCur: a.cur, paidAmt: q, feeHome: fee * (homeFx(db, c.cur) || 0) };
      rec = { amount: q, cur: a.cur, fx: rateFor(db, a.cur) || 1, acct: a.id, toAcct: b.id, toAmount: q2 };
    } else {
      if (!(t > 0)) { const p = num(f.price.value); t = p * q; } if (!(t > 0)) { toast('Enter the price or the total.'); return; }
      const hv = t * (homeFx(db, c.cur) || 0), buy = side === 'buy';
      name = `${buy ? 'Buy' : 'Sell'} ${q} ${a.cur}`; trade = { side, asset: a.id, qty: q, valueHome: hv, paidCur: c.cur, paidAmt: t, feeHome: fee * (homeFx(db, c.cur) || 0) };
      rec = buy ? { amount: t, cur: c.cur, fx: rateFor(db, c.cur) || 1, acct: c.id, toAcct: a.id, toAmount: q } : { amount: q, cur: a.cur, fx: rateFor(db, a.cur) || 1, acct: a.id, toAcct: c.id, toAmount: t };
    }
    const bal = balances(db), src = acct(rec.acct), have = bal.get(src.id) || 0;
    if (have < rec.amount - 1e-9 && !(await confirmDialog(`${src.name} only has ${money(have, src.cur)}. Record it anyway?`, 'Record anyway'))) return;
    commit((d) => {
      const tk = d.settings.tickers && side !== 'convert' && d.settings.tickers[a.cur]; if (tk && q > 0 && t > 0) { tk.price = +(t / q).toPrecision(8); tk.quote = c.cur; tk.priceDate = when.slice(0, 10); pushHistory(tk, tk.price, c.cur, 'trade'); }   // a ticker you added is priced by its last trade
      d.txs.push(stamp({ id: tid, kind: 'transfer', date: when, name, cat: '', notes: `Price per unit ${r6(num(f.price.value))}`.replace(/ 0$/, ''), trade, ...rec }));
      if (fee > 0) { const cat = findOrAddCategory(d, 'Financial loss', 'Trading fees', 'expense'); d.txs.push(stamp({ id: uid(), kind: 'expense', date: when, name: `Trading fee: ${name}`, cat: cat.id, acct: c.id, cur: c.cur, fx: rateFor(d, c.cur) || 1, amount: fee, tradeOf: tid })); }
    });
    s.close(); toast(`${name} recorded.`);
  };
}
ACT['trade-new'] = (el) => openTrade({ asset: el && el.dataset ? el.dataset.id : undefined });

// tapping a trade shows what it was and lets you delete it together with its fee
function tradeDetail(t) {
  const db = get(), x = t.trade, A = db.accounts.find((a) => a.id === x.asset) || { name: '?', cur: '' }, fee = db.txs.find((q) => !q.deleted && q.tradeOf === t.id);
  const s = sheet(`<p><b>${esc(t.name)}</b></p><ul class="calfacts"><li><span>Date</span><b>${esc(String(t.date).slice(0, 16))}</b></li><li><span>Worth when recorded</span><b>${money(x.valueHome)}</b></li>${fee ? `<li><span>Fee (financial loss)</span><b>${money(fee.amount, fee.cur)}</b></li>` : ''}</ul>
    <p class="hint">A trade is not counted as spending or income. Realized gains and losses are worked out on the Investments tab.</p>
    <div class="btnrow"><button type="button" class="btn danger ghost" data-del>Delete</button><button type="button" class="btn" data-x>Close</button></div>`, { title: 'Trade' });
  s.el.querySelector('[data-x]').onclick = () => s.close();
  s.el.querySelector('[data-del]').onclick = () => { commit((d) => { for (const q of d.txs) if (q.id === t.id || q.tradeOf === t.id) softDelete(q); }); s.close(); toast('Trade moved to the recycle bin.'); };
}
const prevEdit = ACT.edit;
ACT.edit = (el) => { const t = get().txs.find((q) => q.id === el.dataset.id); if (t && t.trade) return tradeDetail(t); return prevEdit(el); };
