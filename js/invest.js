// Investments tab: crypto grouped by exchange (every coin is its own balance with its own market value), plus investments and
// other financial products such as MP2. First rough version: valuation and structure; buy/sell comes next.
import { get, commit, uid, stamp, balances, homeFx, fmt, HOME, CUR, CRYPTO, curName, rateFor } from './core.js';
import { ACT, sheet, ic, esc, toast, promptDialog } from './ui.js';
import { hdr, money, coll } from './screens.js';
import { openAccountDetail, openAccount } from './accpage.js';
import { tradeBook } from './tradecalc.js';

const live = (l) => l.filter((x) => !x.deleted);
export const inInvest = (a) => !a.archived && (a.type === 'crypto' || a.type === 'invest' || a.invtab);
const val = (db, a, v) => v * (homeFx(db, a.cur) || 0);
const priced = (db, a) => a.cur === HOME || (homeFx(db, a.cur) || 0) > 0;
const EXCH = /bybit|bitget|okx|binance|kucoin|mexc|gate\.io|coins\.ph|phantom|metamask|ledger|trust wallet/i;
const exchangeOf = (a) => a.exchange || ((a.name.match(EXCH) || [''])[0] ? (a.name.match(EXCH)[0].replace(/^./, (c) => c.toUpperCase())) : '');
export const ASSET_TYPES = { crypto: 'Cryptocurrency', stock: 'Stocks', etf: 'ETFs', fund: 'Funds', bond: 'Bonds', other: 'Other investments' };
const MARKETS = ['NASDAQ', 'NYSE', 'TSE (Tokyo)', 'KRX (Korea)', 'PSE (Philippines)', 'HKEX', 'Other'];
const PLATFORMS = ['Binance', 'Bybit', 'Bitget', 'OKX', 'Coins.ph', 'Moomoo', 'Interactive Brokers', 'SBI Securities', 'Rakuten Securities', 'Webull', 'COL Financial', 'Kiwoom', 'Toss Securities'];
const assetTypeOf = (a) => a.assetType || (a.type === 'crypto' ? 'crypto' : '');
const isAsset = (a) => !!assetTypeOf(a);
const gmode = () => { try { return localStorage.getItem('sukli-invgroup') === 'type' ? 'type' : 'platform'; } catch { return 'platform'; } };
ACT['inv-group'] = (el) => { try { localStorage.setItem('sukli-invgroup', el.dataset.v); } catch { /* blocked */ } window.dispatchEvent(new Event('sukli-render')); };
const COINS = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'TON', 'ADA'];

export function investments(db) {
  const bal = balances(db), items = live(db.accounts).filter(inInvest), book = tradeBook(db.txs);
  const crypto = items.filter(isAsset), other = items.filter((a) => !isAsset(a)), mode = gmode(), tickers = db.settings.tickers || {};
  const total = items.reduce((s, a) => s + val(db, a, bal.get(a.id) || 0), 0), unpriced = items.filter((a) => !priced(db, a) && (bal.get(a.id) || 0) !== 0);
  const byEx = new Map(); for (const a of crypto) { const k = mode === 'type' ? (ASSET_TYPES[assetTypeOf(a)] || 'Other investments') : (exchangeOf(a) || 'Wallets and other'); if (!byEx.has(k)) byEx.set(k, []); byEx.get(k).push(a); }
  const exSum = (l) => l.reduce((s, a) => s + val(db, a, bal.get(a.id) || 0), 0);
  const qty = (n, cur) => `${n.toLocaleString('en-US', { maximumFractionDigits: Math.max(2, Math.min(8, (CUR[cur] || { dec: 2 }).dec)) })} ${cur}`;
  const paidTxt = (a) => { const p = book.pos.get(a.id); if (!p || !(p.qty > 0)) return ''; const e = Object.entries(p.paid || {}).filter(([, v]) => v > 0); return e.length ? ` · paid ${e.map(([c, v]) => qty(v, c)).join(' + ')}` : ''; };
  const basis = (a) => { const p = book.pos.get(a.id), px = homeFx(db, a.cur) || 0; if (!p || !(p.qty > 0) || !(p.cost > 0) || !px) return ''; const un = p.qty * px - p.cost; return ` · cost ${money(p.cost)} · <span class="${un >= 0 ? 'cg' : 'cr'}">${un >= 0 ? '+' : '−'}${money(Math.abs(un))} (${(un / p.cost * 100).toFixed(1)}%)</span>`; };
  const yr = String(new Date().getFullYear()), thisYear = book.realized.filter((x) => x.date.startsWith(yr)).reduce((q, x) => q + x.gain, 0), nm = (id) => (db.accounts.find((a) => a.id === id) || { name: '?' }).name;
  const gains = book.realized.length ? coll('i-gain', `Realized gains and losses <small class="muted gsum">${book.total >= 0 ? '+' : '−'}${money(Math.abs(book.total))}</small>`, `<ul class="calfacts"><li><span>All time</span><b class="${book.total >= 0 ? 'cg' : 'cr'}">${money(book.total)}</b></li><li><span>This year</span><b class="${thisYear >= 0 ? 'cg' : 'cr'}">${money(thisYear)}</b></li>
    ${book.realized.slice(-6).reverse().map((x) => `<li><span>${esc(x.date.slice(0, 10))} · ${esc(nm(x.acct))}</span><b class="${x.gain >= 0 ? 'cg' : 'cr'}">${x.gain >= 0 ? '+' : '−'}${money(Math.abs(x.gain))}</b></li>`).join('')}</ul><p class="hint">Average-cost method, after fees. Units you held before using Sukli have no known cost and are left out of gains.</p>`, '') : '';
  const holding = (a, tot) => { const b = bal.get(a.id) || 0, v = val(db, a, b), ok = priced(db, a), px = homeFx(db, a.cur) || 0;
    return `<button class="row acct hold" data-act="acct" data-id="${a.id}"><i class="badge sm" style="background:var(--xfer)">${esc(a.cur.slice(0, 1))}</i>
      <span class="rmain"><strong>${a.cur === 'USD' || a.cur === HOME ? esc(a.name) : `${esc((tickers[a.cur] && tickers[a.cur].ticker) || a.cur)} <small class="muted">${esc(curName(a.cur) || '')}${a.market ? ` · ${esc(a.market)}` : ''}</small>`}</strong><small>${qty(b, a.cur)}${paidTxt(a)}${ok && a.cur !== HOME ? ` · price ${money(px)}` : ''}${tot > 0 && ok ? ` · ${Math.round((v / tot) * 100)}%` : ''}${basis(a)}</small></span>
      <span class="ramt"><b>${ok ? money(v) : '<small class="muted">no price</small>'}</b></span></button>`; };
  const exHtml = [...byEx.entries()].sort((x, y) => exSum(y[1]) - exSum(x[1])).map(([ex, list]) => {
    const t = exSum(list); return coll('ix-' + ex, `${esc(ex)} <small class="muted gsum">${money(t)}</small>`,
      `<div class="rows plain">${list.slice().sort((a, b) => val(db, b, bal.get(b.id) || 0) - val(db, a, bal.get(a.id) || 0)).map((a) => holding(a, t)).join('')}</div>
       ${mode === 'platform' && ex !== 'Wallets and other' ? `<div class="btnrow left"><button type="button" class="btn sm ghost" data-act="inv-coin" data-ex="${esc(ex)}">+ Add an asset to ${esc(ex)}</button></div>` : ''}`, ''); }).join('');
  const otherHtml = other.length ? coll('i-other', `Investments and other products <small class="muted gsum">${money(exSum(other))}</small>`, `<div class="rows plain">${other.sort((a, b) => val(db, b, bal.get(b.id) || 0) - val(db, a, bal.get(a.id) || 0)).map((a) => { const b = bal.get(a.id) || 0;
    return `<button class="row acct" data-act="acct" data-id="${a.id}"><i class="badge sm" style="background:var(--line)">${esc((a.name || '?').slice(0, 1))}</i><span class="rmain"><strong>${esc(a.name)}</strong><small>${esc(a.exchange || (a.type === 'invest' ? 'Investment' : 'Other product'))} · ${fmt(b, a.cur)}</small></span><span class="ramt"><b>${priced(db, a) ? money(val(db, a, b)) : '<small class="muted">no rate</small>'}</b></span></button>`; }).join('')}</div>`, '') : '';
  return `${hdr('Investments', '<button class="btn sm ghost" data-act="trade-new">Buy / sell</button> <button class="btn sm" data-act="inv-new">Add</button>')}
    <section class="nwcard"><div class="nwmain"><span>Market value</span><b>${money(total)}</b><small>${crypto.length} asset${crypto.length === 1 ? '' : 's'} in ${byEx.size} ${mode === 'type' ? 'type' : 'place'}${byEx.size === 1 ? '' : 's'} · ${other.length} other</small></div></section>
    ${unpriced.length ? `<p class="hint">No price yet for ${unpriced.map((a) => esc(a.cur)).join(', ')}, so ${unpriced.length === 1 ? 'it is' : 'they are'} left out of the total. Prices load when you are online, or set one in Settings, Exchange rates.</p>` : ''}
    ${crypto.length ? `<div class="seg sm small" role="group" aria-label="Group by">${[['platform', 'By platform'], ['type', 'By asset type']].map(([v, l]) => `<button type="button" data-act="inv-group" data-v="${v}" class="${mode === v ? 'on' : ''}" aria-pressed="${mode === v}">${l}</button>`).join('')}</div>` : ''}
    ${gains}${exHtml}${otherHtml}${tickerCard(db, tickers)}
    ${items.length ? '' : '<p class="empty">Nothing here yet. Add an exchange coin, an investment, or any account marked “Show in Investments” (for example MP2).</p>'}
    <p class="hint">Each coin or share is its own balance at its platform (for example USDT, BNB and NVDA). The line under it shows the amount, what you paid, and today’s price; the right side is the value in ${HOME}.</p>`;
}

// manual tickers: any coin, token, stock or fund, on any platform or market (Tokyo, Korea, NASDAQ...), kept apart from real currencies
function tickerCard(db, tickers) {
  const used = new Set(db.accounts.filter((a) => !a.deleted).map((a) => a.cur)), list = Object.entries(tickers).filter(([k]) => used.has(k));
  if (!list.length) return '';
  return coll('i-tick', 'Tickers and prices <small class="muted gsum">added by you</small>', `<ul class="calfacts">${list.map(([k, t]) => `<li><span>${esc(t.ticker || k)} <small class="muted">${esc(t.name || '')}${t.market ? ' · ' + esc(t.market) : ''}</small></span><b>${t.price > 0 ? fmt(t.price, t.quote) : 'no price'} <button type="button" class="linkbtn" data-act="inv-price" data-sym="${esc(k)}">${t.price > 0 ? 'Change' : 'Set price'}</button></b></li>`).join('')}</ul>
    <p class="hint">Price per unit in the currency you trade it in. A buy or sell updates it to the trade price. It is also what the value in ${HOME} is based on.</p>`, '');
}
ACT['inv-price'] = async (el) => {
  const k = el.dataset.sym, t = (get().settings.tickers || {})[k]; if (!t) return;
  const v = await promptDialog(`Price of 1 ${t.ticker || k} in ${t.quote || 'USD'}`, t.price > 0 ? String(t.price) : '', { type: 'number' });
  if (v == null) return; const n = parseFloat(v); if (!(n > 0)) return;
  commit((d) => { d.settings.tickers[k].price = n; d.settings.tickers[k].priceDate = new Date().toISOString().slice(0, 10); });
};
function addAsset(pre = {}) {
  const typeOpts = Object.entries(ASSET_TYPES).map(([k, l]) => `<option value="${k}" ${(pre.type || 'crypto') === k ? 'selected' : ''}>${l}</option>`).join('');
  const s = sheet(`<form id="ic">
    <label class="field"><span>Asset type</span><select name="type">${typeOpts}</select></label>
    <label class="field"><span>Platform or broker</span><input name="ex" value="${esc(pre.platform || '')}" list="exl2" placeholder="Binance, Bybit, Bitget, Moomoo, SBI…" required autocomplete="off"><datalist id="exl2">${PLATFORMS.map((x) => `<option value="${x}">`).join('')}</datalist></label>
    <div class="two"><label class="field"><span>Ticker</span><input name="coin" placeholder="BNB, BGB, NVDA, 7203, 005930" required autocomplete="off" style="text-transform:uppercase"></label>
      <label class="field"><span>Name (optional)</span><input name="name" placeholder="NVIDIA, Toyota, Samsung…" autocomplete="off"></label></div>
    <label class="field" id="mk"><span>Market (for shares and ETFs)</span><select name="market"><option value="">None</option>${MARKETS.map((m) => `<option>${m}</option>`).join('')}</select></label>
    <div class="two"><label class="field"><span>Price currency</span><input name="quote" value="${esc(pre.quote || 'USDT')}" list="ql" autocomplete="off" style="text-transform:uppercase"><datalist id="ql">${['USD', 'USDT', 'JPY', 'KRW', 'PHP', 'EUR', 'HKD'].map((x) => `<option value="${x}">`).join('')}</datalist></label>
      <label class="field"><span>Price per unit (optional)</span><input name="price" inputmode="decimal" placeholder="e.g. 740"></label></div>
    <div class="two"><label class="field"><span>Amount you hold now</span><input name="amt" inputmode="decimal" placeholder="0"></label>
      <label class="field"><span>Decimals</span><input name="dec" inputmode="numeric" placeholder="auto"></label></div>
    <p class="hint">Creates its own balance, kept separate from PHP, JPY or USDT. Tickers on exchanges that are not listed (Tokyo, Korea, anywhere) can be added the same way. Without a price the value shows once you buy or sell it, or set a price later.</p>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Add asset</button></div></form>`, { title: 'Add an asset' });
  const f = s.el.querySelector('#ic'), sync = () => { s.el.querySelector('#mk').hidden = f.type.value === 'crypto'; }; f.type.onchange = sync; sync();
  s.el.querySelector('[data-x]').onclick = () => s.close();
  f.onsubmit = (e) => { e.preventDefault(); const exn = f.ex.value.trim(), raw = f.coin.value.trim().toUpperCase(), type = f.type.value, market = type === 'crypto' ? '' : f.market.value;
    let sym = raw.replace(/[^A-Z0-9]/g, ''); if (/^\d/.test(sym)) sym = ((market.match(/^[A-Z]+/) || ['X'])[0].slice(0, 3)) + sym; sym = sym.slice(0, 10);
    const amt = parseFloat(String(f.amt.value).replace(/,/g, '')) || 0, price = parseFloat(f.price.value) || 0, quote = f.quote.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'USD', dec = Math.min(12, Math.max(0, parseInt(f.dec.value, 10) || (type === 'crypto' ? 6 : 4)));
    if (!exn || sym.length < 2) { toast('Enter the platform and a ticker.'); return; }
    if (get().accounts.some((a) => !a.deleted && a.cur === sym && (a.exchange || '').toLowerCase() === exn.toLowerCase())) { toast(`${exn} already has a ${sym} balance.`); return; }
    commit((d) => {
      d.settings.tickers = d.settings.tickers || {}; const old = d.settings.tickers[sym] || {};
      d.settings.tickers[sym] = { ...old, ticker: raw, name: f.name.value.trim() || old.name || '', assetType: type, market: market || old.market || '', quote: price > 0 || !old.quote ? quote : old.quote, ...(price > 0 ? { price, priceDate: new Date().toISOString().slice(0, 10) } : {}) };
      if (!CRYPTO.includes(sym)) { d.settings.curDec = d.settings.curDec || {}; if (!d.settings.curDec[sym]) { d.settings.curDec[sym] = dec; CUR[sym].dec = dec; } }
      d.accounts.push(stamp({ id: uid(), name: `${exn} ${raw}`, cur: sym, type: type === 'crypto' ? 'crypto' : 'invest', assetType: type, market, exchange: exn, open: amt, include: false, archived: false, invtab: true })); });
    s.close(); toast(`${raw} added to ${exn}.`); };
}
ACT['inv-coin'] = (el) => addAsset({ platform: el.dataset.ex || '' });
ACT['inv-new'] = () => {
  const s = sheet(`<div class="btnrow col"><button class="btn wide" data-k="coin">Add an asset: crypto, stock, ETF, bond…</button><button class="btn wide ghost" data-k="acct">Add MP2 or another product (an account)</button></div>
    <p class="hint">Assets have a ticker and a platform. MP2 and similar are plain accounts shown in Investments.</p>`, { title: 'Add to Investments' });
  s.el.querySelector('[data-k=coin]').onclick = () => { s.close(); addAsset(); };
  s.el.querySelector('[data-k=acct]').onclick = () => { s.close(); openAccount(null, { type: 'invest', invtab: true }); };
};
