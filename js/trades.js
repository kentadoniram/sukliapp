// Buy / sell / convert for crypto, stocks and other investments. Recorded as a movement between your cash account and the holding,
// marked as a trade (not ordinary spending), with fees saved as a financial loss and gains or losses worked out by average cost.
import { accLabel, get, commit, uid, stamp, nowStamp, rateFor, homeFx, fmt, HOME, balances, findOrAddCategory, softDelete, exactAmt } from './core.js';
import { seg } from './components.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { isLiability } from './finance.js';
import { inInvest, pushHistory, exchangeOf, addAsset } from './invest.js';
import { enhanceSelect } from './picker.js';
import { TOP_TOKENS, ensureAsset } from './tokens.js';
import { openDatePicker } from './datepicker.js';

const money = (n, cur = HOME) => fmt(n, cur);
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const live = (l) => l.filter((x) => !x.deleted && !x.archived);
const r6 = (n) => Math.round(n * 1e6) / 1e6;

export function openTrade(pre = {}) {
  const db = get(), old = pre.edit ? db.txs.find((q) => q.id === pre.edit && !q.deleted && q.trade) : null;
  if (old) {   // editing: start from what was saved
    const x = old.trade, kid = db.txs.find((q) => !q.deleted && q.tradeOf === old.id), feeAcct = old.fee > 0 ? (old.feeBy === 'from' ? old.acct : old.toAcct) : kid ? kid.acct : '';
    pre = { ...pre, side: x.side, asset: x.asset, asset2: x.asset2, cashAcct: x.side === 'buy' ? old.acct : x.side === 'sell' ? old.toAcct : (feeAcct || ''), edit: old.id };
  }
  const hold = live(db.accounts).filter((a) => inInvest(a) && !isLiability(a)), cash = live(db.accounts).filter((a) => !isLiability(a));
  if (!hold.length) { toast('Add a coin or an investment first (Investments, Add).'); return; }
  const lastCash = cash.find((a) => a.id === db.settings.lastAcct && !inInvest(a)) || cash.find((a) => !inInvest(a)) || cash[0];
  const opt = (l, sel) => l.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(accLabel(a))} · ${esc(a.cur)}</option>`).join('');
  // platform first: the holding and the money side are listed for that platform, other platforms stay one tap away
  const plats = [...new Set(hold.map((a) => exchangeOf(a)).filter(Boolean))].sort((x, y) => x.localeCompare(y));
  const preA = hold.find((a) => a.id === pre.asset), plat0 = pre.platform != null ? pre.platform : preA ? exchangeOf(preA) : (db.settings.lastPlat && plats.includes(db.settings.lastPlat) ? db.settings.lastPlat : plats[0] || '');
  const platOpt = (sel) => [...plats, ''].map((p) => `<option value="${esc(p)}" ${p === sel ? 'selected' : ''}>${esc(p || 'No platform / other')}</option>`).join('');
  const holdFor = (p) => hold.filter((a) => (exchangeOf(a) || '') === p);
  const grp = (l, p, sel) => { const on = l.filter((a) => p && exchangeOf(a) === p), off = l.filter((a) => !(p && exchangeOf(a) === p)); return (on.length ? `<optgroup label="On ${esc(p)}">${opt(on, sel)}</optgroup>` : '') + (off.length ? `<optgroup label="${on.length ? 'Other platforms and accounts' : 'Accounts'}">${opt(off, sel)}</optgroup>` : ''); };
  const s = sheet(`<form id="tr" novalidate>
    <div class="seg two3" role="group" aria-label="Kind">${[['buy', 'Buy'], ['sell', 'Sell'], ['convert', 'Convert']].map(([v, l]) => `<button type="button" data-side="${v}" class="${(pre.side || 'buy') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="field"><span>Platform</span><select name="plat">${platOpt(plat0)}</select></label>
    <label class="field"><span id="l-asset">Holding</span><select name="asset">${opt(holdFor(plat0), pre.asset)}</select></label>
    <p class="pairline" id="pair" aria-live="polite"></p>
    <div id="f-conv" hidden><label class="field"><span>Convert Into</span><select name="asset2">${opt(hold, (hold.find((a) => a.id !== (pre.asset || hold[0].id)) || hold[0]).id)}</select></label></div>
    <div id="slot-a"><div id="f-cash"><label class="field"><span id="l-cash">Paid From</span><select name="cash"></select></label></div></div>
    <div class="two"><label class="field hasall"><span id="l-qty">Quantity</span><input name="qty" inputmode="decimal" placeholder="e.g. 0.01"><button type="button" class="allbtn" data-all="qty" hidden>All</button></label><label class="field" id="f-price"><span id="l-price">Price</span><input name="price" inputmode="decimal"></label></div>
    <label class="field hasall" id="f-total"><span id="l-total">Total paid</span><input name="total" inputmode="decimal"><button type="button" class="allbtn" data-all="total" hidden>All</button></label>
    <div id="f-conv2" class="two" hidden><label class="field"><span id="l-qty2">Quantity</span><input name="qty2" inputmode="decimal"></label><label class="field"><span id="l-worth">Value in ${HOME} (Optional)</span><input name="worth" inputmode="decimal"></label></div>
    <div class="feehead"><span class="feelab">Trading Fee</span>${seg({ options: [{ label: '0 Fee', value: 'none' }, { label: 'Fixed Amount', value: 'fixed' }, { label: '% of the Trade', value: 'pct' }], value: 'none', data: 'fm', aria: 'Trading fee' })}</div>
    <select name="feeMode" hidden aria-hidden="true"><option value="none">0 Fee</option><option value="fixed">Fixed Amount</option><option value="pct">% of the Trade</option></select>
    <div id="feedet" class="feedet" hidden><label class="field"><span id="l-fee">Fee Amount</span><input name="fee" inputmode="decimal" placeholder="0"></label>
      <div class="field"><span>Fee Responsibility</span>${seg({ options: [{ label: 'Taken from Maker', value: 'maker' }, { label: 'Taken from Taker', value: 'taker' }], value: null, data: 'resp', aria: 'Fee responsibility' })}</div></div>
    <select name="feeIn" hidden aria-hidden="true"></select>
    <div id="slot-b"></div>
    <div class="field"><span>When</span><button type="button" class="whenbtn" id="tr-when"></button></div>
    <div id="tr-sum" class="hint" aria-live="polite"></div>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">${old ? 'Save Changes' : 'Record'}</button></div></form>`, { title: old ? 'Edit Trade' : 'Buy, Sell or Convert', wide: true });
  const f = s.el.querySelector('#tr'); let side = pre.side || 'buy', last = '';
  const acct = (id) => db.accounts.find((a) => a.id === id);
  const fillCash = (keep) => { const p = f.plat.value, pool = [...cash.filter((x) => !inInvest(x)), ...cash.filter((x) => inInvest(x))], q = ((db.settings.tickers || {})[(acct(f.asset.value) || {}).cur] || {}).quote;
    const pref = keep && pool.some((x) => x.id === keep) ? keep : (pool.find((x) => p && exchangeOf(x) === p && x.cur === q) || pool.find((x) => p && exchangeOf(x) === p && inInvest(x) && /USD|JPY|PHP|EUR|KRW/.test(x.cur)) || lastCash || pool[0] || {}).id;
    f.cash.innerHTML = grp(pool, p, pref); if (pref) f.cash.value = pref; };
  const moreCoins = () => { const p = f.plat.value; if (!p) return ''; const have = new Set(holdFor(p).map((x) => x.cur)); return `<optgroup label="More Coins (Top 50)">${TOP_TOKENS.filter((t) => !have.has(t.c)).map((t) => `<option value="tok:${t.c}">${t.c} · ${esc(t.n)}</option>`).join('')}</optgroup>`; };
  const fillAsset = (sel) => { const list = holdFor(f.plat.value); f.asset.innerHTML = (list.length ? opt(list, sel) : '') + moreCoins(); if (sel && list.some((x) => x.id === sel)) f.asset.value = sel;
    const other = hold.filter((x) => x.id !== f.asset.value); f.asset2.innerHTML = grp(other.length ? other : hold, f.plat.value, other[0] && other[0].id); };
  fillAsset(pre.asset); fillCash(lastCash && lastCash.id);
  enhanceSelect(f.plat, { title: 'Platform', onAdd: () => { s.close(); addAsset({ onDone: (id) => openTrade({ ...pre, asset: id, side: pre.side }) }); }, addLabel: 'Add a new platform (adds its first asset)' });
  enhanceSelect(f.asset, { title: 'Asset', onAdd: () => { const p = f.plat.value; s.close(); addAsset({ platform: p, onDone: (id) => openTrade({ ...pre, asset: id, side: pre.side }) }); }, addLabel: 'Add a new asset' });
  enhanceSelect(f.cash, { title: 'Account', onAdd: () => { s.close(); import('./accpage.js').then((m) => m.openAccount(null, { exchange: f.plat.value })); }, addLabel: 'Add a new account' });
  enhanceSelect(f.asset2, { title: 'Convert Into' });
  f.plat.addEventListener('change', () => { fillAsset(); fillCash(); sync(''); });
  f.asset.addEventListener('change', () => {
    if (String(f.asset.value).startsWith('tok:')) { const c = f.asset.value.slice(4), p = f.plat.value; const a = ensureAsset(p, c, 'Spot'); s.close(); openTrade({ ...pre, asset: a && a.id, side }); return; }   // the coin's (empty) balance is made here the first time
    fillCash(f.cash.value); });
  // the price fills itself from your last price or the live price (until you type your own); it never replaces what you typed
  let priceTouched = false;
  const autoPrice = () => { if (priceTouched || side === 'convert') return; const a0 = acct(f.asset.value), c0 = acct(f.cash.value); if (!a0 || !c0) return; const ra = rateFor(db, a0.cur), rc = rateFor(db, c0.cur);
    if (ra > 0 && rc > 0) { const v = r6(ra / rc); if (v > 0 && String(v) !== f.price.value) { f.price.value = String(v); f.price.dataset.auto = '1'; } } };
  const sync = (from) => {
    if (from === 'price' || from === 'total') { priceTouched = true; f.price.dataset.auto = ''; } else if (from === '' || from === 'qty') autoPrice();
    const q = num(f.qty.value), p = num(f.price.value), t = num(f.total.value);
    if (from === 'total' && q > 0) f.price.value = String(r6(t / q)); else if (q > 0 && p > 0 && from !== 'total') f.total.value = String(r6(q * p));
    const a = acct(f.asset.value), c = acct(f.cash.value), conv = side === 'convert';
    s.el.querySelector('#f-conv').hidden = !conv; s.el.querySelector('#f-cash').hidden = false; s.el.querySelector('#f-price').hidden = conv; s.el.querySelector('#f-total').hidden = conv;
    s.el.querySelector('#l-asset').textContent = conv ? 'Convert from' : side === 'buy' ? 'Buying' : 'Selling';
    const b2 = acct(f.asset2.value), $s = (id) => s.el.querySelector(id), cc = (c && c.cur) || 'currency';
    $s('#l-cash').textContent = conv ? 'Pay the Fee From' : side === 'buy' ? 'Paid From' : 'Money Goes To';
    $s('#l-total').textContent = `${side === 'buy' ? 'Total Paid' : 'Total Received'} (${cc})`;
    $s('#l-qty').textContent = `Quantity (${a ? a.cur : 'coin'})`;
    $s('#l-price').textContent = `Price (${cc})`;
    $s('#l-qty2').textContent = `Quantity (${b2 ? b2.cur : 'coin'})`;
    $s('#f-conv2').hidden = !conv;
    $s('#pair').textContent = a ? (conv ? (b2 ? `${a.cur}/${b2.cur}  ·  you give ${a.cur} and receive ${b2.cur}` : '') : `${a.cur}/${cc}  ·  ${side === 'buy' ? 'buying' : 'selling'} ${a.cur} ${side === 'buy' ? 'with' : 'for'} ${cc}`) : '';
    { const slot = $s(conv ? '#slot-b' : '#slot-a'), box = $s('#f-cash'); if (box.parentNode !== slot) slot.appendChild(box); }   // when converting, "Pay the fee from" comes last, under the fee
    f.querySelector('[data-all=qty]').hidden = side === 'buy'; f.querySelector('[data-all=total]').hidden = side !== 'buy';   // All: the whole holding when selling or converting, the whole cash balance when buying
    const fi = f.feeIn, want = [c && c.cur, a && a.cur].filter((x, i, arr) => x && arr.indexOf(x) === i), have = [...fi.options].map((o) => o.value);
    if (want.join() !== have.join()) { const keep = fi.value; fi.innerHTML = want.map((x, i) => `<option value="${x}">${x}${i === 0 ? ' (the money used)' : ' (the asset itself)'}</option>`).join(''); if (want.includes(keep)) fi.value = keep; }
    { const mode = f.feeMode.value; s.el.querySelector('#l-fee').textContent = mode === 'pct' ? 'Fee % of the Trade (e.g. 0.05)' : `Fee Amount (${fi.value || 'currency'})`;
      s.el.querySelector('#feedet').hidden = mode === 'none';
      f.querySelectorAll('[data-fm]').forEach((bt) => { const on = bt.dataset.fm === mode; bt.classList.toggle('on', on); bt.setAttribute('aria-pressed', String(on)); });
      const payer = side === 'buy' ? (c && c.cur) : (a && a.cur), other = want.find((x) => x !== payer) || payer, mk = f.querySelector('[data-resp=maker]'), tk = f.querySelector('[data-resp=taker]');
      mk.dataset.cur = payer || ''; tk.dataset.cur = other || ''; const isMaker = fi.value === payer || payer === other; mk.classList.toggle('on', isMaker); tk.classList.toggle('on', !isMaker); mk.setAttribute('aria-pressed', String(isMaker)); tk.setAttribute('aria-pressed', String(!isMaker)); }
    f.querySelectorAll('[data-side]').forEach((b) => b.classList.toggle('on', b.dataset.side === side));
    const fcur = f.feeIn.value || (c && c.cur), fee = f.feeMode.value === 'none' ? 0 : f.feeMode.value === 'pct' ? ((fcur === (a && a.cur) ? q : (num(f.total.value) || 0)) * num(f.fee.value)) / 100 : num(f.fee.value); s.el.querySelector('#tr-sum').textContent = conv ? `${q || 0} ${a ? a.cur : ''} becomes ${num(f.qty2.value) || 0} ${acct(f.asset2.value) ? acct(f.asset2.value).cur : ''}.${fee ? ` Fee ${money(fee, fcur)} is saved as a financial loss.` : ''}` : (q && num(f.total.value) ? `${side === 'buy' ? 'Buy' : 'Sell'} ${q} ${a ? a.cur : ''} for ${money(num(f.total.value), c ? c.cur : HOME)}.${fee ? ` The fee of ${money(fee, fcur)} is saved separately as a financial loss.` : ''} This is not counted as spending.` : '');
  };
  f.addEventListener('input', (e) => sync(e.target.name === 'fee' ? '' : e.target.name)); f.addEventListener('change', () => sync(''));
  f.addEventListener('click', (e) => { const m = e.target.closest('[data-fm]'), r = e.target.closest('[data-resp]'); if (m) { f.feeMode.value = m.dataset.fm; if (m.dataset.fm === 'none') f.fee.value = ''; sync(''); if (m.dataset.fm !== 'none') f.fee.focus(); } else if (r && r.dataset.cur && [...f.feeIn.options].some((o) => o.value === r.dataset.cur)) { f.feeIn.value = r.dataset.cur; sync(''); } });
  f.querySelectorAll('[data-all]').forEach((b) => { b.onclick = () => {
    const src = b.dataset.all === 'qty' ? acct(f.asset.value) : acct(f.cash.value), v = src ? balances(db).get(src.id) || 0 : 0;
    if (!(v > 0)) { toast(`There is nothing in ${src ? src.name : 'that account'} to use.`); return; }
    const inp = f[b.dataset.all]; inp.value = exactAmt(v); inp.dispatchEvent(new Event('input', { bubbles: true }));
  }; });
  f.querySelectorAll('[data-side]').forEach((b) => { b.onclick = () => { side = b.dataset.side; sync(''); }; });
  let when = old ? old.date : nowStamp(); const whenBtn = s.el.querySelector('#tr-when'), showWhen = () => { whenBtn.textContent = String(when).slice(0, 16); };
  whenBtn.onclick = () => openDatePicker(when, (v) => { when = v; showWhen(); }, { title: 'When Was It?' }); showWhen();
  s.el.querySelector('[data-x]').onclick = () => s.close(); sync('');
  if (old) {   // fill the form from the saved trade
    const x = old.trade; f.plat.value = exchangeOf(acct(x.asset)) || ''; fillAsset(x.asset); if (x.asset2) f.asset2.value = x.asset2; if (pre.cashAcct) { fillCash(pre.cashAcct); f.cash.value = pre.cashAcct; }
    f.qty.value = String(x.qty); side = x.side; sync('');
    if (x.side === 'convert') { f.qty2.value = String(x.qty2); f.worth.value = String(r6(x.valueHome)); } else { f.total.value = String(r6(x.paidAmt)); const pm = String(old.notes || '').match(/Price ([\d.]+)/); f.price.value = pm ? pm[1] : String(r6(x.paidAmt / x.qty)); priceTouched = true; }
    sync(''); if (x.feeAmt > 0) { f.feeMode.value = 'fixed'; f.fee.value = String(x.feeAmt); if ([...f.feeIn.options].some((o) => o.value === x.feeCur)) f.feeIn.value = x.feeCur; } sync('');
  }
  f.onsubmit = async (e) => {
    e.preventDefault(); const q = num(f.qty.value), a = acct(f.asset.value), c = acct(f.cash.value); if (!(q > 0) || !a || !c) { toast('Enter the quantity.'); return; }
    const feeCur = f.feeIn.value || c.cur, feeAcct = feeCur === c.cur ? c : (feeCur === a.cur ? a : c), tot0 = num(f.total.value) || num(f.price.value) * q;
    let fee = f.feeMode.value === 'none' ? 0 : Math.max(0, num(f.fee.value)); if (f.feeMode.value === 'pct') fee = side === 'convert' ? q * fee / 100 : (feeCur === a.cur ? q : tot0) * fee / 100;
    if (side === 'convert' && feeCur === c.cur && feeAcct === c) { /* fee on the paying balance */ }
    let t = num(f.total.value); const tid = old ? old.id : uid();
    let rec, trade, name;
    if (side === 'convert') {
      const b = acct(f.asset2.value), q2 = num(f.qty2.value); if (!b || b.id === a.id || !(q2 > 0)) { toast('Choose the other coin and the amount you receive.'); return; }
      const worth = num(f.worth.value) || q2 * (homeFx(db, b.cur) || 0); if (!(worth > 0)) { toast(`No price for ${b.cur} yet. Type what it is worth in ${HOME}.`); return; }
      name = `Convert ${q} ${a.cur} to ${q2} ${b.cur}`; trade = { side, asset: a.id, qty: q, asset2: b.id, qty2: q2, valueHome: worth, paidCur: a.cur, paidAmt: q, feeHome: fee * (homeFx(db, feeAcct.cur) || 0), feeCur: feeAcct.cur, feeAmt: fee };
      rec = { amount: q, cur: a.cur, fx: rateFor(db, a.cur) || 1, acct: a.id, toAcct: b.id, toAmount: q2 };
    } else {
      if (!(t > 0)) { const p = num(f.price.value); t = p * q; } if (!(t > 0)) { toast('Enter the price or the total.'); return; }
      const hv = t * (homeFx(db, c.cur) || 0), buy = side === 'buy';
      name = `${buy ? 'Buy' : 'Sell'} ${q} ${a.cur}`; trade = { side, asset: a.id, qty: q, valueHome: hv, paidCur: c.cur, paidAmt: t, feeHome: fee * (homeFx(db, feeAcct.cur) || 0), feeCur: feeAcct.cur, feeAmt: fee };
      rec = buy ? { amount: t, cur: c.cur, fx: rateFor(db, c.cur) || 1, acct: c.id, toAcct: a.id, toAmount: q } : { amount: q, cur: a.cur, fx: rateFor(db, a.cur) || 1, acct: a.id, toAcct: c.id, toAmount: t };
    }
    const bal = balances(db), src = acct(rec.acct); let have = bal.get(src.id) || 0; if (old && old.acct === src.id) have += old.amount + (old.fee > 0 && old.feeBy === 'from' ? old.fee : 0);   // what this same trade already took out does not count twice
    if (have < rec.amount - 1e-9 && !(await confirmDialog(`${src.name} only has ${money(have, src.cur)}. Record it anyway?`, 'Record anyway'))) return;
    commit((d) => {
      if (exchangeOf(a)) d.settings.lastPlat = exchangeOf(a);
      const tk = !old && d.settings.tickers && side !== 'convert' && d.settings.tickers[a.cur]; if (tk && q > 0 && t > 0) { tk.price = +(t / q).toPrecision(8); tk.quote = c.cur; tk.priceDate = when.slice(0, 10); pushHistory(tk, tk.price, c.cur, 'trade'); }   // a ticker you added is priced by its last trade
      // the fee stays on the trade itself (like a transfer fee), so one row shows what happened and balances include it; only a fee paid from a third account is its own entry
      const onTrade = fee > 0 && (feeAcct.id === rec.acct || feeAcct.id === rec.toAcct), fcat = fee > 0 ? findOrAddCategory(d, 'Fees', 'Trading fee', 'expense') : null;
      const full = { kind: 'transfer', date: when, name, cat: '', notes: num(f.price.value) > 0 ? `Price ${r6(num(f.price.value))} ${c.cur}` : '', trade, ...rec,
        ...(onTrade ? { fee, feeCat: fcat.id, feeBy: feeAcct.id === rec.acct ? 'from' : 'to', feeCur: feeAcct.cur, feeFx: rateFor(d, feeAcct.cur) || 1 } : { fee: 0, feeCat: '', feeBy: '', feeCur: '', feeFx: 0 }) };
      if (old) { const t0 = d.txs.find((q) => q.id === old.id); t0.rev = [{ at: Date.now(), date: t0.date, name: t0.name, amount: t0.amount, acct: t0.acct, toAcct: t0.toAcct, toAmount: t0.toAmount }, ...(t0.rev || [])].slice(0, 5); delete t0.trade; Object.assign(t0, full); stamp(t0);
        for (const q of d.txs) if (q.tradeOf === old.id && !q.deleted) softDelete(q); }   // the old separate fee entry is replaced below when one is still needed
      else d.txs.push(stamp({ id: tid, ...full }));
      if (fee > 0 && !onTrade) d.txs.push(stamp({ id: uid(), kind: 'expense', date: when, name: `Trading fee: ${name}`, cat: fcat.id, acct: feeAcct.id, cur: feeAcct.cur, fx: rateFor(d, feeAcct.cur) || 1, amount: fee, tradeOf: tid }));
    });
    s.close(); toast(old ? `${name} saved.` : `${name} recorded.`);
  };
}
ACT['trade-new'] = (el) => openTrade({ asset: el && el.dataset ? el.dataset.id : undefined });

// tapping a trade shows what it was and lets you delete it together with its fee
function tradeDetail(t) {
  const db = get(), x = t.trade, A = db.accounts.find((a) => a.id === x.asset) || { name: '?', cur: '' }, fee = db.txs.find((q) => !q.deleted && q.tradeOf === t.id);
  const s = sheet(`<p><b>${esc(t.name)}</b></p><ul class="calfacts"><li><span>Date</span><b>${esc(String(t.date).slice(0, 16))}</b></li><li><span>Worth when recorded</span><b>${money(x.valueHome)}</b></li>${fee ? `<li><span>Fee (financial loss)</span><b>${money(fee.amount, fee.cur)}</b></li>` : ''}</ul>
    <p class="hint">A trade is not counted as spending or income. Realized gains and losses are worked out on the Investments tab.</p>
    <div class="btnrow"><button type="button" class="btn danger ghost" data-del>Delete</button><button type="button" class="btn ghost" data-edit>Edit</button><button type="button" class="btn" data-x>Close</button></div>`, { title: 'Trade' });
  s.el.querySelector('[data-edit]').onclick = () => { s.close(); openTrade({ edit: t.id }); };
  s.el.querySelector('[data-x]').onclick = () => s.close();
  s.el.querySelector('[data-del]').onclick = () => { commit((d) => { for (const q of d.txs) if (q.id === t.id || q.tradeOf === t.id) softDelete(q); }); s.close(); toast('Trade moved to the recycle bin.'); };
}
const prevEdit = ACT.edit;
ACT.edit = (el) => { const t = get().txs.find((q) => q.id === el.dataset.id); if (t && t.trade) return tradeDetail(t); return prevEdit(el); };
