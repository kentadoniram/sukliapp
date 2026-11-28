// Buy / sell / convert for crypto, stocks and other investments. Recorded as a movement between your cash account and the holding,
// marked as a trade (not ordinary spending), with fees saved as a financial loss and gains or losses worked out by average cost.
import { typeNames } from './accpage.js';
import { accLabel, assetName, isEarnAcct, get, commit, uid, stamp, nowStamp, rateFor, homeFx, walletOf, fmt, HOME, balances, findOrAddCategory, softDelete, exactAmt } from './core.js';
import { seg, button, textField, selectField } from './components.js';
import { look } from './appearance.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { isLiability } from './finance.js';
import { inInvest, pushHistory, exchangeOf, addAsset } from './invest.js';
import { enhanceSelect } from './picker.js';
import { localMs } from './earn.js';
import { priceDay } from './timezone.js';
import { TOP_TOKENS, ensureAsset, ensureUsdt } from './tokens.js';
import { openDatePicker } from './datepicker.js';
import { tradeFacts } from './tradefacts.js';

const money = (n, cur = HOME) => fmt(n, cur);
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const live = (l) => l.filter((x) => !x.deleted && !x.archived);
const r6 = (n) => Math.round(n * 1e6) / 1e6;

// the Theme 1 sliding segmented control (.t1seg), with a data-<name> on each slot so the form can read it
const t1Seg = (name, options, value, aria) => `<div class="t1seg wide" role="group" aria-label="${esc(aria)}" data-sel="${options.findIndex((o) => o.value === value)}" style="--n:${options.length};--sel:${Math.max(0, options.findIndex((o) => o.value === value))}">${options.map((o) => button({ html: esc(o.label), kind: 'plain', cls: `t1s-slot${o.value === value ? ' on' : ''}`, pressed: o.value === value, attr: { [`data-${name}`]: o.value, ...(o.title ? { title: o.title } : {}) } })).join('')}</div>`;
const COIN = { BTC: ['#F7931A', '₿'], ETH: ['#627EEA', 'Ξ'], USDT: ['#26A17B', '₮'], USDC: ['#2775CA', '$'], BNB: ['#F0B90B', 'B'], SOL: ['#9945FF', 'S'], XRP: ['#23292F', 'X'], DOGE: ['#C2A633', 'Ð'] };
const coinBadge = (cur) => { const [c, g] = COIN[cur] || ['#6B7886', String(cur || '?')[0]]; return `<span class="tr-coin" style="background:${c}" aria-hidden="true">${esc(g)}</span>`; };
const shortQty = (n) => (+n || 0).toLocaleString('en-US', { maximumFractionDigits: 8 });

export function openTrade(pre = {}) {
  try { ensureUsdt(); } catch { /* keep going */ }
  const db = get(), old = pre.edit ? db.txs.find((q) => q.id === pre.edit && !q.deleted && q.trade) : null;
  if (old) {   // editing: start from what was saved
    const x = old.trade, kid = db.txs.find((q) => !q.deleted && q.tradeOf === old.id), feeAcct = old.fee > 0 ? (old.feeBy === 'from' ? old.acct : old.toAcct) : kid ? kid.acct : '';
    pre = { ...pre, side: x.side, asset: x.asset, asset2: x.asset2, cashAcct: x.side === 'buy' ? old.acct : x.side === 'sell' ? old.toAcct : (feeAcct || ''), edit: old.id };
  }
  const hold = live(db.accounts).filter((a) => inInvest(a) && !isLiability(a) && !isEarnAcct(a)), cash = live(db.accounts).filter((a) => !isLiability(a) && !isEarnAcct(a));
  if (!hold.length) { toast('Add a coin or an investment first (Investments, Add).'); return; }
  const lastCash = cash.find((a) => a.id === db.settings.lastAcct && !inInvest(a)) || cash.find((a) => !inInvest(a)) || cash[0];
  const LEVELS = { Cryptocurrency: ['', 'Platform', 'Trading account'], 'Stocks and funds': ['', 'Platform'], 'Traditional accounts': ['', 'Currency', 'Category'] };
  const SEPR = ' › ', bals = balances(db), isCoin = (a) => a.type === 'crypto';
  // every choice sits in a path: Cryptocurrency > platform > trading account, or Traditional accounts > currency > category. The picker folds each level.
  const pathOf = (a) => (inInvest(a) ? [isCoin(a) ? 'Cryptocurrency' : 'Stocks and funds', exchangeOf(a) || 'No platform', ...(isCoin(a) ? [walletOf(a) || 'Spot'] : [])] : ['Traditional accounts', a.cur, typeNames[a.type] || 'Other']).join(SEPR);
  const WALLETS = ['Spot', 'Margin', 'Futures', 'Options', 'Earn', 'Funding', 'ETF', 'TradFi', 'Other'], rankW = (w) => { const i = WALLETS.indexOf(w); return i < 0 ? 99 : i; };
  const treeOpts = (l, sel, p) => { const sorted = l.slice().sort((x, y) => { const cx = inInvest(x) ? 0 : 1, cy = inInvest(y) ? 0 : 1; if (cx !== cy) return cx - cy;
      if (cx === 0) { const px = (exchangeOf(x) || '') === p ? 0 : 1, py = (exchangeOf(y) || '') === p ? 0 : 1; if (px !== py) return px - py; return (exchangeOf(x) || '').localeCompare(exchangeOf(y) || '') || rankW(walletOf(x) || 'Spot') - rankW(walletOf(y) || 'Spot') || x.cur.localeCompare(y.cur); }
      return (x.cur === HOME ? 0 : 1) - (y.cur === HOME ? 0 : 1) || x.cur.localeCompare(y.cur) || (typeNames[x.type] || '').localeCompare(typeNames[y.type] || '') || (x.name || '').localeCompare(y.name || ''); });
    const by = new Map(); for (const a of sorted) { const k = pathOf(a); if (!by.has(k)) by.set(k, []); by.get(k).push(a); }
    return [...by.entries()].map(([k, items]) => `<optgroup label="${esc(k)}">${items.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''} data-leaf="${esc(inInvest(a) && isCoin(a) ? a.cur : a.name || a.cur)}" data-sub="${esc(`${inInvest(a) && isCoin(a) ? `${assetName(a) !== a.cur ? assetName(a) + ' · ' : ''}` : ''}${fmt(bals.get(a.id) || 0, a.cur)}`)}">${esc(accLabel(a))} · ${esc(a.cur)}</option>`).join('')}</optgroup>`).join(''); };
  const opt = (l, sel) => treeOpts(l, sel, '');
  // platform first: the holding and the money side are listed for that platform, other platforms stay one tap away
  const plats = [...new Set(hold.map((a) => exchangeOf(a)).filter(Boolean))].sort((x, y) => x.localeCompare(y));
  const preA = hold.find((a) => a.id === pre.asset), plat0 = pre.platform != null ? pre.platform : preA ? exchangeOf(preA) : (db.settings.lastPlat && plats.includes(db.settings.lastPlat) ? db.settings.lastPlat : plats[0] || '');
  const platOpt = (sel) => [...plats, ''].map((p) => `<option value="${esc(p)}" ${p === sel ? 'selected' : ''}>${esc(p || 'No platform / other')}</option>`).join('');
  const holdFor = (p) => hold.filter((a) => (exchangeOf(a) || '') === p);
  const grp = (l, p, sel) => treeOpts(l, sel, p);
  const t1 = look().design !== 'legacy', hide = t1 ? ' tr-hide' : '';
  const sideSeg = `<div class="seg two3" role="group" aria-label="Kind">${[['buy', 'Buy'], ['sell', 'Sell'], ['convert', 'Convert']].map(([v, l]) => `${button({ html: `${l}`, kind: 'plain', cls: `${(pre.side || 'buy') === v ? 'on' : ''}`, attr: { 'data-side': v } })}`).join('')}</div>`;
  const tile = (id, cap) => `<div class="tr-slot" id="tslot-${id}" hidden><span class="tr-cap" id="cap-${id}">${cap}</span>${button({ html: '', kind: 'plain', cls: 'tr-tile', id: `tile-${id}` })}</div>`;
  const feeOpts = t1 ? [{ label: 'No fee', value: 'none' }, { label: '% of trade', value: 'pct' }, { label: 'Fixed', value: 'fixed' }] : [{ label: '0 Fee', value: 'none' }, { label: 'Fixed Amount', value: 'fixed' }, { label: '% of the Trade', value: 'pct' }];
  const feeSeg = t1 ? t1Seg('fm', feeOpts, 'none', 'Trading fee') : seg({ options: feeOpts, value: 'none', data: 'fm', aria: 'Trading fee' });
  const feeBlock = `<div class="feehead"><span class="feelab">Trading Fee</span>${feeSeg}</div>
    <select name="feeMode" hidden aria-hidden="true"><option value="none">0 Fee</option><option value="fixed">Fixed Amount</option><option value="pct">% of the Trade</option></select>
    <div id="feedet" class="feedet" hidden>${textField({ label: 'Fee Amount', spanId: 'l-fee', name: 'fee', inputmode: 'decimal', placeholder: '0' })}
      <div class="field"><span>Fee Responsibility</span>${(() => { const ro = [{ label: t1 ? 'Maker' : 'Taken from Maker', value: 'maker', title: 'Fee taken from the maker side' }, { label: t1 ? 'Taker' : 'Taken from Taker', value: 'taker', title: 'Fee taken from the taker side' }, { label: t1 ? 'Other asset' : 'Other Asset', value: 'other', title: 'Pay the fee with another asset you hold, for example BGB on Bitget' }]; return t1 ? t1Seg('resp', ro, null, 'Fee responsibility') : seg({ options: ro, value: null, data: 'resp', aria: 'Fee responsibility' }); })()}</div>
      ${selectField({ label: 'Pay the Fee With', lid: 'f-feeacct', hidden: true, name: 'feeAcct', aria: null, optionsHtml: '', after: '<small class="hint" id="feeacct-hint"></small>' })}</div>
    <select name="feeIn" hidden aria-hidden="true"></select>
    <div id="slot-fee"></div>`;
  const amtRows = `<div class="two">${textField({ label: 'Quantity', spanId: 'l-qty', cls: 'hasall', name: 'qty', inputmode: 'decimal', placeholder: 'e.g. 0.01', after: button({ label: t1 ? 'Max' : 'All', kind: 'plain', cls: 'allbtn', attr: { 'data-all': 'qty', 'hidden': true } }) })}${textField({ label: 'Price', spanId: 'l-price', lid: 'f-price', name: 'price', inputmode: 'decimal' })}</div>
    ${textField({ label: 'Total paid', spanId: 'l-total', lid: 'f-total', cls: 'hasall', name: 'total', inputmode: 'decimal', after: button({ label: t1 ? 'Max' : 'All', kind: 'plain', cls: 'allbtn', attr: { 'data-all': 'total', 'hidden': true } }) })}
    <div id="f-conv2" class="two" hidden>${textField({ label: 'Quantity', spanId: 'l-qty2', name: 'qty2', inputmode: 'decimal' })}${textField({ label: `Value in ${HOME} (Optional)`, spanId: 'l-worth', name: 'worth', inputmode: 'decimal' })}</div>`;
  const know = `<div class="tr-know" id="tr-know"><span>I know the…</span><div class="seg" role="group" aria-label="I know the">${button({ label: 'Quantity', kind: 'plain', cls: 'on', attr: { 'data-know': 'qty' } })}${button({ label: 'Total', kind: 'plain', attr: { 'data-know': 'total' } })}</div></div>`;
  const s = sheet(`<form id="tr" novalidate class="${t1 ? 'trade2' : ''}" data-side="${pre.side || 'buy'}">
    ${sideSeg}
    ${t1 ? button({ html: '', kind: 'plain', cls: 'tr-plat', id: 'tr-platbar' }) : ''}
    ${selectField({ label: 'Platform', cls: hide.trim(), name: 'plat', aria: null, optionsHtml: platOpt(plat0) })}
    ${t1 ? `<div class="tr-card tr-tiles">${tile('a', 'YOU GET')}${button({ html: '<span aria-hidden="true">⇅</span>', kind: 'plain', cls: 'tr-swap', id: 'tr-swap', aria: 'Swap the two sides', attr: { type: 'button', title: 'Swap the two sides' } })}${tile('b', 'CONVERT INTO')}${tile('c', 'YOU PAY WITH')}</div>` : ''}
    ${selectField({ label: 'Holding', spanId: 'l-asset', cls: hide.trim(), name: 'asset', aria: null, optionsHtml: opt(holdFor(plat0), pre.asset) })}
    ${t1 ? '' : `<div class="tr-swaprow">${button({ html: '<span aria-hidden="true">⇅</span> Swap', kind: 'plain', cls: 'tr-swap', id: 'tr-swap-l', aria: 'Swap the two sides', attr: { type: 'button' } })}</div>`}
    <p class="pairline${hide}" id="pair" aria-live="polite"></p>
    <div id="f-conv" hidden>${selectField({ label: 'Convert Into', cls: hide.trim(), name: 'asset2', aria: null, optionsHtml: opt(hold, (hold.find((a) => a.id !== (pre.asset || hold[0].id)) || hold[0]).id) })}</div>
    <div id="slot-a"><div id="f-cash">${selectField({ label: 'Paid From', spanId: 'l-cash', lid: 'lab-cash', cls: hide.trim(), name: 'cash', aria: null, optionsHtml: '' })}</div></div>
    ${t1 ? `<div class="tr-card tr-amt">${know}${amtRows}</div>` : amtRows}
    ${t1 ? `<div class="tr-card tr-fee"><b class="tr-feetitle">Fee</b>${feeBlock}</div><div class="tr-rows">${button({ html: '<span class="k">When</span><b class="v"></b><em>Edit</em>', kind: 'plain', cls: 'tr-row', id: 'tr-when' })}</div>`
      : `${feeBlock.replace('<div id="slot-fee"></div>', '<div id="slot-b"></div>')}<div class="field"><span>When</span>${button({ label: ``, kind: 'plain', cls: 'whenbtn', id: 'tr-when' })}</div>`}
    <div id="tr-sum" class="hint${t1 ? ' tr-sumline' : ''}" aria-live="polite"></div><div class="btnrow">${button({ label: 'Cancel', kind: 'ghost', attr: { 'data-x': true } })}${button({ html: `${old ? 'Save Changes' : 'Record'}`, kind: 'primary', cls: 'tr-go', submit: true })}</div></form>`, { title: old ? 'Edit Trade' : t1 ? 'Trade' : 'Buy, Sell or Convert', wide: true });
  const f = s.el.querySelector('#tr'); let side = pre.side || 'buy', last = '', feeOther = false, feeAcctPlat = null;
  const acct = (id) => db.accounts.find((a) => a.id === id);
  const fillCash = (keep) => { const p = f.plat.value, pool = [...cash.filter((x) => !inInvest(x)), ...cash.filter((x) => inInvest(x))], q = ((db.settings.tickers || {})[(acct(f.asset.value) || {}).cur] || {}).quote;
    const pref = keep && pool.some((x) => x.id === keep) ? keep : (pool.find((x) => p && exchangeOf(x) === p && x.cur === 'USDT' && walletOf(x) === 'Spot') || pool.find((x) => p && exchangeOf(x) === p && x.cur === 'USDT') || pool.find((x) => p && exchangeOf(x) === p && x.cur === q) || pool.find((x) => p && exchangeOf(x) === p && inInvest(x) && /USD|JPY|PHP|EUR|KRW/.test(x.cur)) || lastCash || pool[0] || {}).id;
    f.cash.innerHTML = grp(pool, p, pref); if (pref) f.cash.value = pref; };
  const fillFeeAcct = () => { const p = f.plat.value, keep = f.feeAcct.value, pool = [...cash.filter((x) => inInvest(x) && exchangeOf(x) === p), ...cash.filter((x) => !(inInvest(x) && exchangeOf(x) === p))]; f.feeAcct.innerHTML = grp(pool, p, keep || (pool[0] || {}).id); if (keep && pool.some((x) => x.id === keep)) f.feeAcct.value = keep; feeAcctPlat = p; };
  const moreCoins = () => { const p = f.plat.value; if (!p) return ''; const have = new Set(holdFor(p).map((x) => x.cur)); return `<optgroup label="Cryptocurrency${SEPR}${esc(p)}${SEPR}More coins (Top 50)">${TOP_TOKENS.filter((t) => !have.has(t.c)).map((t) => `<option value="tok:${t.c}" data-leaf="${t.c}" data-sub="${esc(t.n)}">${t.c} · ${esc(t.n)}</option>`).join('')}</optgroup>`; };
  // the asset list shows every platform as its own group (the one you are on is open, the others fold); picking an asset from another platform switches the platform
  const fillAsset = (sel) => { const cp = f.plat.value;
    f.asset.innerHTML = treeOpts(hold, sel, cp) + moreCoins(); const all = hold.some((x) => x.id === sel); if (sel && all) f.asset.value = sel; else if (holdFor(cp)[0]) f.asset.value = holdFor(cp)[0].id;
    const other = hold.filter((x) => x.id !== f.asset.value); f.asset2.innerHTML = grp(other.length ? other : hold, f.plat.value, other[0] && other[0].id); };
  fillAsset(pre.asset); fillCash(pre.cashAcct || '');
  enhanceSelect(f.plat, { title: 'Platform', onAdd: () => { s.close(); addAsset({ onDone: (id) => openTrade({ ...pre, asset: id, side: pre.side }) }); }, addLabel: 'Add a new platform (adds its first asset)' });
  enhanceSelect(f.asset, { title: 'Asset', tree: true, levels: LEVELS, onAdd: () => { const p = f.plat.value; s.close(); addAsset({ platform: p, onDone: (id) => openTrade({ ...pre, asset: id, side: pre.side }) }); }, addLabel: 'Entry: add a new asset' });
  enhanceSelect(f.cash, { title: 'Account', tree: true, levels: LEVELS, onAdd: () => { s.close(); import('./accpage.js').then((m) => m.openAccount(null, { exchange: f.plat.value })); }, addLabel: 'Add a new account' });
  enhanceSelect(f.asset2, { title: 'Convert Into', tree: true, levels: LEVELS });
  f.plat.addEventListener('change', () => { fillAsset(); fillCash(); sync(''); });
  f.asset.addEventListener('change', () => {
    if (String(f.asset.value).startsWith('tok:')) { const c = f.asset.value.slice(4), p = f.plat.value; const a = ensureAsset(p, c, 'Spot'); s.close(); openTrade({ ...pre, asset: a && a.id, side }); return; }   // the coin's (empty) balance is made here the first time
    { const a = acct(f.asset.value); if (a && (exchangeOf(a) || '') !== f.plat.value) { f.plat.value = exchangeOf(a) || ''; fillAsset(a.id); fillCash(); sync(''); return; } }
    fillCash(f.cash.value); });
  // the price fills itself from your last price or the live price (until you type your own); it never replaces what you typed
  let priceTouched = false;
  const autoPrice = () => { if (priceTouched || side === 'convert') return; const a0 = acct(f.asset.value), c0 = acct(f.cash.value); if (!a0 || !c0) return; const ra = rateFor(db, a0.cur), rc = rateFor(db, c0.cur);
    if (ra > 0 && rc > 0) { const v = r6(ra / rc); if (v > 0 && String(v) !== f.price.value) { f.price.value = String(v); f.price.dataset.auto = '1'; } } };
  // ---- Theme 1: platform bar, asset tiles, "I know the…" toggle, one-line Fee / When rows, sticky action footer, platform-first asset picker ----
  let known = 'qty', feeOpen = false;
  const SIDEWORD = { buy: 'Buy', sell: 'Sell', convert: 'Convert' };
  const tileHtml = (cur, title, sub) => `${coinBadge(cur)}<span class="tr-tt"><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="car" aria-hidden="true">▾</span>`;
  const t1Refresh = (from, { a, c, b2, conv, q, fee, fcur, cc }) => {
    const $ = (id) => s.el.querySelector(id), plat = f.plat.value, wl = a ? (walletOf(a) || 'Spot') : 'Spot';
    f.dataset.side = side; f.dataset.know = known;
    const pbH = `<span class="tr-pico" aria-hidden="true">${esc((plat || '?')[0].toUpperCase())}</span><span class="tr-pn"><b>${esc(plat || 'No platform')}</b>${plat ? ` <span>· ${esc(wl)} wallet</span>` : ''}</span><em>Change</em>`; { const pb = $('#tr-platbar'); if (pb._h !== pbH) { pb._h = pbH; pb.innerHTML = pbH; } }   // only repaint when it changed, so a tap that starts while a field blurs is not lost
    const T = (id, on, cap, html) => { $(`#tslot-${id}`).hidden = !on; if (on) { $(`#cap-${id}`).textContent = cap; const tl = $(`#tile-${id}`); if (tl._h !== html) { tl._h = html; tl.innerHTML = html; } } };
    const heldOn = (x) => `You hold ${shortQty(bals.get(x.id) || 0)} on ${exchangeOf(x) || 'this account'}`;
    T('a', !!a, conv ? 'CONVERT FROM' : side === 'buy' ? 'YOU GET' : 'YOU SELL', a ? tileHtml(a.cur, a.cur, conv ? `Balance ${shortQty(bals.get(a.id) || 0)}` : heldOn(a)) : '');
    T('b', conv && !!b2, 'CONVERT INTO', b2 ? tileHtml(b2.cur, b2.cur, heldOn(b2)) : '');
    T('c', !conv && !!c, side === 'buy' ? 'YOU PAY WITH' : 'YOU GET PAID IN', c ? tileHtml(c.cur, `${c.cur} · ${walletOf(c) || typeNames[c.type] || 'Account'}`, `Balance ${shortQty(bals.get(c.id) || 0)}`) : '');
    $('#tr-know').hidden = conv; $('#tr-know').querySelectorAll('[data-know]').forEach((b) => { const on = b.dataset.know === known; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    $('#f-total').classList.toggle('derived', !conv && known === 'qty'); f.qty.closest('label').classList.toggle('derived', !conv && known === 'total');
    $('#l-qty').textContent = conv ? `You give (${a ? a.cur : 'coin'})` : `Quantity (${a ? a.cur : 'coin'})`;
    $('#l-qty2').textContent = `You get (${b2 ? b2.cur : 'coin'})`;
    $('#l-total').textContent = conv ? '' : `${side === 'buy' ? 'Total you pay' : 'Total you get'} (${cc})`;
    const go = $('.tr-go'), qs = q > 0 ? `${shortQty(q)} ` : '', tot = num(f.total.value), q2 = num(f.qty2.value);
    go.textContent = old ? 'Save changes' : conv ? `Convert ${qs}${a ? a.cur : ''}${b2 ? ` to ${b2.cur}` : ''}` : `${SIDEWORD[side]} ${qs}${a ? a.cur : ''}`;
    f.querySelectorAll('.t1seg').forEach((g) => { const vis = [...g.querySelectorAll('.t1s-slot')].filter((x) => !x.hidden), i = vis.findIndex((x) => x.classList.contains('on')); g.dataset.sel = String(i); g.style.setProperty('--n', String(vis.length)); g.style.setProperty('--sel', String(Math.max(0, i))); });
    $('#tr-sum').textContent = conv ? (q > 0 && q2 > 0 ? `1 ${b2.cur} = ${shortQty(r6(q / q2))} ${a.cur}${fee > 0 ? ` · fee ${shortQty(r6(fee))} ${fcur}` : ''}` : '')
      : tot > 0 && c ? `${cc === HOME ? '' : 'About '}${money(tot * (homeFx(db, cc) || 0) || tot, cc === HOME ? cc : HOME)} · ${side === 'buy' ? 'average cost updates after you record' : 'profit is worked out by average cost'}` : '';
  };
  const openCoinPicker = (target) => {
    const cp = f.plat.value, isB = target === 'asset2', pool = isB ? hold.filter((x) => x.id !== f.asset.value) : hold, wOrd = (x, y) => rankW(walletOf(x) || 'Spot') - rankW(walletOf(y) || 'Spot') || x.cur.localeCompare(y.cur), here = pool.filter((x) => (exchangeOf(x) || '') === cp).sort(wOrd), others = pool.filter((x) => (exchangeOf(x) || '') !== cp).sort((x, y) => (exchangeOf(x) || '').localeCompare(exchangeOf(y) || '') || wOrd(x, y));
    const row = (x, sub) => button({ html: `${coinBadge(x.cur)}<span class="tr-tt"><b>${esc(x.cur)}</b><small>${esc(sub)}</small></span><span class="tr-bal"><b>${shortQty(bals.get(x.id) || 0)}</b><small>≈ ${money((bals.get(x.id) || 0) * (homeFx(db, x.cur) || 0))}</small></span>`, kind: 'plain', cls: `tr-prow${x.id === f[target].value ? ' on' : ''}`, attr: { 'data-v': x.id, 'data-q': `${x.cur} ${assetName(x)} ${exchangeOf(x) || ''}`.toLowerCase() } });
    const have = new Set(holdFor(cp).map((x) => x.cur)), tops = isB || !cp ? [] : TOP_TOKENS.filter((t) => !have.has(t.c));
    const oPlats = [...new Set(others.map((x) => exchangeOf(x) || 'No platform'))];
    const ps = sheet(`<div class="trade2 tr-pick"><label class="tr-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search coin or ticker" autocomplete="off" aria-label="Search coin or ticker"></label>
      ${here.length ? `<div class="tr-psec"><div class="tr-ph"><span class="tr-pico">${esc((cp || '?')[0].toUpperCase())}</span><b>On ${esc(cp || 'this platform')}</b><span>· what you hold here</span></div><div class="tr-card tr-raised">${here.map((x) => row(x, walletOf(x) || 'Spot')).join('')}</div></div>` : ''}
      ${tops.length ? `<div class="tr-psec"><p class="tr-pcap">Not held yet on ${esc(cp)} · top coins</p><div class="tr-chips">${tops.map((t, i) => `${button({ label: t.c, kind: 'plain', cls: `tr-chip${i >= 8 ? ' more' : ''}`, attr: { ...(i >= 8 ? { hidden: true } : {}), 'data-v': `tok:${t.c}`, 'data-q': `${t.c} ${t.n}`.toLowerCase() } })}`).join('')}${tops.length > 8 ? button({ label: 'More…', kind: 'plain', cls: 'tr-chip', attr: { 'data-more': true } }) : ''}</div></div>` : ''}
      ${others.length ? `${button({ html: `<span>Other platforms: ${esc(oPlats.slice(0, 3).join(', '))}${oPlats.length > 3 ? '…' : ''}</span><span aria-hidden="true">›</span>`, kind: 'plain', cls: 'tr-other', attr: { 'aria-expanded': 'false' } })}<div class="tr-card tr-raised" id="tr-others" hidden>${others.map((x) => row(x, `${exchangeOf(x) || 'No platform'} · ${walletOf(x) || 'Spot'}`)).join('')}</div>
      <p class="tr-note">Picking a coin from another platform switches the whole form to that platform.</p>` : ''}</div>`, { title: isB ? 'Convert into' : side === 'buy' ? 'You get' : side === 'sell' ? 'You sell' : 'Convert from' });
    const root = ps.el, others$ = root.querySelector('#tr-others'), otherBtn = root.querySelector('.tr-other');
    const showOthers = (on) => { if (others$) { others$.hidden = !on; otherBtn.setAttribute('aria-expanded', String(on)); } };
    root.addEventListener('click', (e) => {
      const v = e.target.closest('[data-v]'), more = e.target.closest('[data-more]');
      if (v) { ps.close(); f[target].value = v.dataset.v; f[target].dispatchEvent(new Event('change', { bubbles: true })); }
      else if (more) { root.querySelectorAll('.tr-chip.more').forEach((x) => { x.hidden = false; }); more.remove(); }
      else if (e.target.closest('.tr-other')) showOthers(others$.hidden);
    });
    root.querySelector('input').addEventListener('input', (e) => { const qy = e.target.value.trim().toLowerCase();
      root.querySelectorAll('[data-q]').forEach((x) => { const hit = !qy || x.dataset.q.includes(qy); x.hidden = !hit || (!qy && x.classList.contains('more')); if (qy && hit && x.classList.contains('more')) x.hidden = false; });
      const mb = root.querySelector('[data-more]'); if (mb) mb.hidden = !!qy; if (qy) showOthers(true); else showOthers(false); });
  };
  const sync = (from) => {
    if (from === 'price' || from === 'total') { priceTouched = true; f.price.dataset.auto = ''; } else if (from === '' || from === 'qty') autoPrice();
    const byTotal = t1 && known === 'total' && side !== 'convert';   // "I know the Total": the quantity is worked out from the total and the price
    if (byTotal && num(f.total.value) > 0 && num(f.price.value) > 0 && from !== 'qty') f.qty.value = String(r6(num(f.total.value) / num(f.price.value)));
    const q = num(f.qty.value), p = num(f.price.value), t = num(f.total.value);
    if (byTotal) { /* quantity already derived above */ } else if (from === 'total' && q > 0) f.price.value = String(r6(t / q)); else if (q > 0 && p > 0 && from !== 'total') f.total.value = String(r6(q * p));
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
    { const slot = $s(conv ? (t1 ? '#slot-fee' : '#slot-b') : '#slot-a'), box = $s('#f-cash'); if (box.parentNode !== slot) slot.appendChild(box); }   // when converting, "Pay the fee from" comes last, under the fee
    f.querySelector('[data-all=qty]').hidden = side === 'buy'; f.querySelector('[data-all=total]').hidden = side !== 'buy';   // All: the whole holding when selling or converting, the whole cash balance when buying
    const fi = f.feeIn, want = [c && c.cur, a && a.cur].filter((x, i, arr) => x && arr.indexOf(x) === i), have = [...fi.options].map((o) => o.value);
    if (want.join() !== have.join()) { const keep = fi.value; fi.innerHTML = want.map((x, i) => `<option value="${x}">${x}${i === 0 ? ' (the money used)' : ' (the asset itself)'}</option>`).join(''); if (want.includes(keep)) fi.value = keep; }
    if (feeOther && feeAcctPlat !== f.plat.value) fillFeeAcct();
    const fa = feeOther ? acct(f.feeAcct.value) : null; $s('#f-feeacct').hidden = !feeOther; if (fa) $s('#feeacct-hint').textContent = `Balance ${money(balances(db).get(fa.id) || 0, fa.cur)}. The fee is taken from this account and saved as its own entry.`;
    if (feeOther && f.feeMode.value === 'pct') f.feeMode.value = 'fixed';   // a % needs a price for that asset, which is never exact: only a fixed amount is offered
    { const pb = f.querySelector('[data-fm=pct]'); if (pb) pb.hidden = feeOther; }
    { const mode = f.feeMode.value; s.el.querySelector('#l-fee').textContent = mode === 'pct' ? 'Fee % of the Trade (e.g. 0.05)' : `Fee Amount (${(fa && fa.cur) || fi.value || 'currency'})`;
      s.el.querySelector('#feedet').hidden = mode === 'none';
      f.querySelectorAll('[data-fm]').forEach((bt) => { const on = bt.dataset.fm === mode; bt.classList.toggle('on', on); bt.setAttribute('aria-pressed', String(on)); });
      const payer = side === 'buy' ? (c && c.cur) : (a && a.cur), other = want.find((x) => x !== payer) || payer, mk = f.querySelector('[data-resp=maker]'), tk = f.querySelector('[data-resp=taker]');
      mk.dataset.cur = payer || ''; tk.dataset.cur = other || ''; const isMaker = fi.value === payer || payer === other; const ot = f.querySelector('[data-resp=other]'), mOn = !feeOther && isMaker, tOn = !feeOther && !isMaker; mk.classList.toggle('on', mOn); tk.classList.toggle('on', tOn); ot.classList.toggle('on', feeOther); mk.setAttribute('aria-pressed', String(mOn)); tk.setAttribute('aria-pressed', String(tOn)); ot.setAttribute('aria-pressed', String(feeOther)); }
    f.querySelectorAll('[data-side]').forEach((b) => b.classList.toggle('on', b.dataset.side === side));
    const fcur = (fa && fa.cur) || f.feeIn.value || (c && c.cur), fee = f.feeMode.value === 'none' ? 0 : f.feeMode.value === 'pct' ? ((fcur === (a && a.cur) ? q : (num(f.total.value) || 0)) * num(f.fee.value)) / 100 : num(f.fee.value); s.el.querySelector('#tr-sum').textContent = conv ? `${q || 0} ${a ? a.cur : ''} becomes ${num(f.qty2.value) || 0} ${acct(f.asset2.value) ? acct(f.asset2.value).cur : ''}.${fee ? ` Fee ${money(fee, fcur)} is saved as a financial loss.` : ''}` : (q && num(f.total.value) ? `${side === 'buy' ? 'Buy' : 'Sell'} ${q} ${a ? a.cur : ''} for ${money(num(f.total.value), c ? c.cur : HOME)}.${fee ? ` The fee of ${money(fee, fcur)} is saved separately as a financial loss.` : ''} This is not counted as spending.` : '');
    if (t1) t1Refresh(from, { a, c, b2, conv, q, fee, fcur, cc });
  };
  f.addEventListener('input', (e) => sync(e.target.name === 'fee' ? '' : e.target.name)); f.addEventListener('change', () => sync(''));
  f.addEventListener('click', (e) => { const m = e.target.closest('[data-fm]'), r = e.target.closest('[data-resp]'); if (m) { f.feeMode.value = m.dataset.fm; if (m.dataset.fm === 'none') f.fee.value = ''; sync(''); if (m.dataset.fm !== 'none') f.fee.focus(); } else if (r && r.dataset.resp === 'other') { feeOther = true; fillFeeAcct(); sync(''); } else if (r && r.dataset.cur && [...f.feeIn.options].some((o) => o.value === r.dataset.cur)) { feeOther = false; f.feeIn.value = r.dataset.cur; sync(''); } });
  f.querySelectorAll('[data-all]').forEach((b) => { b.onclick = () => {
    const src = b.dataset.all === 'qty' ? acct(f.asset.value) : acct(f.cash.value), v = src ? balances(db).get(src.id) || 0 : 0;
    if (!(v > 0)) { toast(`There is nothing in ${src ? src.name : 'that account'} to use.`); return; }
    const inp = f[b.dataset.all]; inp.value = exactAmt(v); inp.dispatchEvent(new Event('input', { bubbles: true }));
  }; });
  // Swap (16.50): Convert flips From and Into (and their quantities); Buy and Sell flip into each other, so the same asset and account swap roles
  const doSwap = () => {
    if (side === 'convert') {
      const a1 = f.asset.value, a2 = f.asset2.value, q1 = f.qty.value, q2 = f.qty2.value; if (!a2) return;
      f.asset.value = a2; if (f.asset.value !== a2) return;
      f.asset.dispatchEvent(new Event('change', { bubbles: true }));   // may switch the platform when the other coin lives elsewhere
      f.asset2.innerHTML = grp(hold.filter((x) => x.id !== f.asset.value), f.plat.value, a1); f.asset2.value = a1;
      if (f.asset2.value !== a1) f.asset2.value = (hold.find((x) => x.id !== f.asset.value) || {}).id || '';
      f.qty.value = q2; f.qty2.value = q1; f.asset2.dispatchEvent(new Event('change', { bubbles: true }));
    } else { side = side === 'buy' ? 'sell' : 'buy'; }
    sync('');
  };
  f.querySelectorAll('.tr-swap').forEach((b) => { b.onclick = doSwap; });
  f.querySelectorAll('[data-side]').forEach((b) => { b.onclick = () => { side = b.dataset.side; if (t1 && side === 'convert') feeOpen = true; sync(''); }; });
  if (t1) {
    const $ = (id) => s.el.querySelector(id);
    $('#tr-platbar').onclick = () => f.plat._pk && f.plat._pk.open();
    $('#tile-a').onclick = () => openCoinPicker('asset'); $('#tile-b').onclick = () => openCoinPicker('asset2'); $('#tile-c').onclick = () => f.cash._pk && f.cash._pk.open();
    f.querySelectorAll('[data-know]').forEach((b) => { b.onclick = () => { known = b.dataset.know; sync(''); }; });
  }
  let when = old ? old.date : nowStamp(); const whenBtn = s.el.querySelector('#tr-when'), showWhen = () => { const v = whenBtn.querySelector('.v'); (v || whenBtn).textContent = String(when).slice(0, 16); };
  whenBtn.onclick = () => openDatePicker(when, (v) => { when = v; showWhen(); }, { title: 'When Was It?' }); showWhen();
  { const x = s.el.querySelector('[data-x]'); if (x) x.onclick = () => s.close(); } sync('');
  if (old) {   // fill the form from the saved trade
    const x = old.trade; if (t1 && (x.feeAmt > 0 || x.feeOther)) feeOpen = true; f.plat.value = exchangeOf(acct(x.asset)) || ''; fillAsset(x.asset); if (x.asset2) f.asset2.value = x.asset2; if (pre.cashAcct) { fillCash(pre.cashAcct); f.cash.value = pre.cashAcct; }
    f.qty.value = String(x.qty); side = x.side; sync('');
    if (x.side === 'convert') { f.qty2.value = String(x.qty2); f.worth.value = String(r6(x.valueHome)); } else { f.total.value = String(r6(x.paidAmt)); const pm = String(old.notes || '').match(/Price ([\d.]+)/); f.price.value = pm ? pm[1] : String(r6(x.paidAmt / x.qty)); priceTouched = true; }
    if (x.feeOther && acct(x.feeOther)) { feeOther = true; fillFeeAcct(); f.feeAcct.value = x.feeOther; }
    sync(''); if (x.feeAmt > 0) { f.feeMode.value = 'fixed'; f.fee.value = String(x.feeAmt); if ([...f.feeIn.options].some((o) => o.value === x.feeCur)) f.feeIn.value = x.feeCur; } sync('');
  }
  f.onsubmit = async (e) => {
    e.preventDefault(); const q = num(f.qty.value), a = acct(f.asset.value), c = acct(f.cash.value); if (!(q > 0) || !a || !c) { toast('Enter the quantity.'); return; }
    const oa = feeOther ? acct(f.feeAcct.value) : null, feeCur = oa ? oa.cur : (f.feeIn.value || c.cur), feeAcct = oa || (feeCur === c.cur ? c : (feeCur === a.cur ? a : c)), tot0 = num(f.total.value) || num(f.price.value) * q;
    let fee = f.feeMode.value === 'none' ? 0 : Math.max(0, num(f.fee.value));
    if (f.feeMode.value === 'pct') fee = side === 'convert' ? q * fee / 100 : (feeCur === a.cur ? q : tot0) * fee / 100;
    if (side === 'convert' && feeCur === c.cur && feeAcct === c) { /* fee on the paying balance */ }
    let t = num(f.total.value); const tid = old ? old.id : uid();
    let rec, trade, name, asTransfer = false, fxOverride = 0;
    if (side === 'convert') {
      const b = acct(f.asset2.value), q2 = num(f.qty2.value); if (!b || b.id === a.id || !(q2 > 0)) { toast('Choose the other coin and the amount you receive.'); return; }
      const worth = num(f.worth.value) || q2 * (homeFx(db, b.cur) || 0); if (!(worth > 0)) { toast(`No price for ${b.cur} yet. Type what it is worth in ${HOME}.`); return; }
      name = `Convert ${q} ${a.cur} to ${q2} ${b.cur}`; trade = { side, asset: a.id, qty: q, asset2: b.id, qty2: q2, valueHome: worth, paidCur: a.cur, paidAmt: q, feeHome: fee * (homeFx(db, feeAcct.cur) || 0), feeCur: feeAcct.cur, feeAmt: fee, ...(oa ? { feeOther: oa.id } : {}) };
      rec = { amount: q, cur: a.cur, fx: rateFor(db, a.cur) || 1, acct: a.id, toAcct: b.id, toAmount: q2 };
    } else {
      if (!(t > 0)) { const p = num(f.price.value); t = p * q; } if (!(t > 0)) { toast('Enter the price or the total.'); return; }
      let hv = t * (homeFx(db, c.cur) || 0); const buy = side === 'buy';
      // v16.24: no rate between the money used and your home currency means the value of this trade is unknown. Warn first; offer a rate worked out from the coin's price;
      // otherwise it is recorded as a plain move of the asset (no profit or loss is claimed), not as a trade.
      if (!(hv > 0)) {
        const ra = rateFor(db, a.cur), sug = ra > 0 && t > 0 ? (q * ra) / t : 0;
        if (sug > 0 && await confirmDialog(`Sukli has no exchange rate for ${c.cur} (to ${HOME}) yet, so it cannot tell what this trade is worth.\n\nFrom today's price of ${a.cur} it looks like 1 ${c.cur} ≈ ${r6(sug)} ${HOME}. Use that rate for this entry?`, `Use ≈ ${r6(sug)}`, false, 'Not this one')) { hv = t * sug; fxOverride = sug; }
        else if (!(await confirmDialog(`Without a ${c.cur} rate this cannot be a trade, because the cost is unknown and any profit or loss would be wrong.\n\nRecord it as ${buy ? 'adding' : 'taking out'} ${q} ${a.cur} instead (a move of the asset, no profit or loss)? You can add a ${c.cur} rate later in Settings.`, 'Record as asset', false, 'Cancel'))) return;
        else asTransfer = true;
      }
      name = asTransfer ? `${buy ? 'Add' : 'Remove'} ${q} ${a.cur}` : `${buy ? 'Buy' : 'Sell'} ${q} ${a.cur}`; trade = asTransfer ? undefined : { side, asset: a.id, qty: q, valueHome: hv, paidCur: c.cur, paidAmt: t, feeHome: fee * (homeFx(db, feeAcct.cur) || 0), feeCur: feeAcct.cur, feeAmt: fee, ...(oa ? { feeOther: oa.id } : {}) };
      rec = buy ? { amount: t, cur: c.cur, fx: fxOverride || rateFor(db, c.cur) || (asTransfer ? 0 : 1), acct: c.id, toAcct: a.id, toAmount: q } : { amount: q, cur: a.cur, fx: rateFor(db, a.cur) || 1, acct: a.id, toAcct: c.id, toAmount: t };
      if (asTransfer && !buy) rec.fx = rateFor(db, a.cur) || 1;
    }
    const bal = balances(db), src = acct(rec.acct); let have = bal.get(src.id) || 0; if (old && old.acct === src.id) have += old.amount + (old.fee > 0 && old.feeBy === 'from' ? old.fee : 0);   // what this same trade already took out does not count twice
    if (have < rec.amount - 1e-9 && !(await confirmDialog(`${src.name} only has ${money(have, src.cur)}. Record it anyway?`, 'Record anyway'))) return;
    if (oa && fee > 0) { const hv = balances(db).get(oa.id) || 0; if (hv < fee - 1e-9 && !(await confirmDialog(`${oa.name} only has ${money(hv, oa.cur)} to pay the ${money(fee, oa.cur)} fee. Record it anyway?`, 'Record anyway'))) return; }
    commit((d) => {
      if (exchangeOf(a)) d.settings.lastPlat = exchangeOf(a);
      const tk = !old && !asTransfer && d.settings.tickers && side !== 'convert' && d.settings.tickers[a.cur]; if (tk && q > 0 && t > 0) { tk.price = +(t / q).toPrecision(8); tk.quote = c.cur; const ms = localMs(when) || Date.now(); tk.priceDate = priceDay(d, tk, a, ms); pushHistory(tk, tk.price, c.cur, 'trade', a, ms); }   // a ticker you added is priced by its last trade
      // the fee stays on the trade itself (like a transfer fee), so one row shows what happened and balances include it; only a fee paid from a third account is its own entry
      const onTrade = fee > 0 && (feeAcct.id === rec.acct || feeAcct.id === rec.toAcct), fcat = fee > 0 ? findOrAddCategory(d, 'Fees', 'Trading fee', 'expense') : null;
      const full = { kind: 'transfer', date: when, name, cat: '', notes: num(f.price.value) > 0 ? `Price ${r6(num(f.price.value))} ${c.cur}` : '', ...(trade ? { trade } : {}), ...rec,
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
  const db = get(), f = tradeFacts(db, t), fee = db.txs.find((q) => !q.deleted && q.tradeOf === t.id);
  const li = (k, v, sub = '') => `<li><span>${esc(k)}</span><b class="kv">${esc(v)}${sub ? `<small>${esc(sub)}</small>` : ''}</b></li>`;
  const feeVal = f.fee > 0 ? f.feeText : fee ? `${fee.amount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${fee.cur}` : f.feeText;
  const s = sheet(`<p class="tdname"><b>${esc(t.name)}</b></p><ul class="calfacts tradefacts">
    ${li('Filled Price', f.priceText)}
    ${li('Quantity', f.qtyText)}
    ${li('Transaction Value', f.valueText, [f.homeText, f.rateText].filter(Boolean).join(' · '))}
    ${li('Trading Fees', feeVal, f.feePct != null ? `${f.feePct.toFixed(f.feePct < 1 ? 3 : 2)}% of the transaction value` : '')}
    ${li('Date and Time', f.date)}</ul>
    <div class="btnrow">${button({ label: 'Delete', kind: 'danger-ghost', attr: { 'data-del': true } })}${button({ label: 'Edit', kind: 'ghost', attr: { 'data-edit': true } })}${button({ label: 'Close', kind: 'primary', attr: { 'data-x': true } })}</div>`, { title: 'Trade' });
  s.el.querySelector('[data-edit]').onclick = () => { s.close(); openTrade({ edit: t.id }); };
  s.el.querySelector('[data-x]').onclick = () => s.close();
  s.el.querySelector('[data-del]').onclick = () => { commit((d) => { for (const q of d.txs) if (q.id === t.id || q.tradeOf === t.id) softDelete(q); }); s.close(); toast('Trade moved to the recycle bin.'); };
}
const prevEdit = ACT.edit;
ACT.edit = (el) => { const t = get().txs.find((q) => q.id === el.dataset.id); if (t && t.trade) return tradeDetail(t); return prevEdit(el); };
