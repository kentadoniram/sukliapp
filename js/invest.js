// Investments tab: crypto grouped by exchange (every coin is its own balance with its own market value), plus investments and
// other financial products such as MP2. First rough version: valuation and structure; buy/sell comes next.
import { enhanceSelect, pickAll } from './picker.js';
import { WALLETS, walletOf, accLabel, get, commit, uid, stamp, balances, homeFx, fmt, HOME, CUR, CRYPTO, curName, rateFor, nowStamp, findOrAddCategory, factorFor } from './core.js';
import { ACT, sheet, ic, esc, toast, promptDialog, confirmDialog } from './ui.js';
import { hdr, money, coll } from './screens.js';
import { openAccountDetail, openAccount } from './accpage.js';
import { tradeBook } from './tradecalc.js';

const live = (l) => l.filter((x) => !x.deleted);
export const inInvest = (a) => !a.archived && (a.type === 'crypto' || a.type === 'invest' || a.invtab);
const val = (db, a, v) => v * (homeFx(db, a.cur) || 0);
const priced = (db, a) => a.cur === HOME || (homeFx(db, a.cur) || 0) > 0;
const EXCH = /bybit|bitget|okx|binance|kucoin|mexc|gate\.io|coins\.ph|phantom|metamask|ledger|trust wallet/i;
const rawEx = (a) => a.exchange || ((a.name.match(EXCH) || [''])[0] ? (a.name.match(EXCH)[0].replace(/^./, (c) => c.toUpperCase())) : '');
const sqp = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// One spelling per platform: "binance", "Binance " and "BINANCE" are the same place. The known name wins, then the most used spelling.
let _canonFor = null, _canon = new Map();
function canonMap() {
  const db = get(); if (_canonFor === db.accounts && _canon.size >= 0 && _canonN === db.accounts.length + ':' + db.accounts.map((a) => a.exchange || '').join('|')) return _canon;
  const m = new Map(), cnt = new Map();
  for (const p of PLATFORMS) m.set(sqp(p), p);
  for (const a of db.accounts) { if (a.deleted) continue; const r = rawEx(a).trim(); if (!r) continue; const k = sqp(r); if (!cnt.has(k)) cnt.set(k, new Map()); cnt.get(k).set(r, (cnt.get(k).get(r) || 0) + 1); }
  for (const [k, spell] of cnt) if (!m.has(k)) m.set(k, [...spell.entries()].sort((x, y) => y[1] - x[1] || (x[0] === x[0].toLowerCase()) - (y[0] === y[0].toLowerCase()))[0][0]);
  _canonFor = db.accounts; _canonN = db.accounts.length + ':' + db.accounts.map((a) => a.exchange || '').join('|'); _canon = m; return m;
}
let _canonN = '';
export const exchangeOf = (a) => { const r = rawEx(a).trim(); return r ? canonMap().get(sqp(r)) || r : ''; };
// the existing spelling of a typed platform, or '' when it is new
export const canonPlatform = (typed) => { const t = String(typed || '').trim(); return t ? canonMap().get(sqp(t)) || t : ''; };
// a typed name that is not known but is one slip away from a known one (Binace -> Binance)
export function nearPlatform(typed) {
  const t = sqp(typed); if (t.length < 4 || canonMap().has(t)) return '';
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  for (const [k, v] of canonMap()) if (k !== t && (lev(k, t) <= 1 || (k.length >= 4 && (k.startsWith(t) || t.startsWith(k))))) return v;
  return '';
}
// every platform the user has (used first) plus the popular ones, for pick lists
export function platformNames() {
  const db = get(), used = new Map(); for (const a of db.accounts) { if (a.deleted) continue; const e = exchangeOf(a); if (e) used.set(e, (used.get(e) || 0) + 1); }
  const u = [...used.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map((x) => x[0]);
  return { used: u, popular: PLATFORMS.filter((p) => !u.includes(p)) };
}
export const ASSET_TYPES = { crypto: 'Cryptocurrency', stock: 'Stocks', etf: 'ETFs', fund: 'Funds', bond: 'Bonds', other: 'Other investments' };
const MARKETS = ['NASDAQ', 'NYSE', 'TSE (Tokyo)', 'KRX (Korea)', 'PSE (Philippines)', 'HKEX', 'Other'];
const PLATFORMS = ['Binance', 'Bybit', 'Bitget', 'OKX', 'Coins.ph', 'Moomoo', 'Interactive Brokers', 'SBI Securities', 'Rakuten Securities', 'Webull', 'COL Financial', 'Kiwoom', 'Toss Securities'];
const assetTypeOf = (a) => a.assetType || (a.type === 'crypto' ? 'crypto' : '');
const isAsset = (a) => !!assetTypeOf(a);
const gmode = () => { try { const v = localStorage.getItem('sukli-invgroup'); return v === 'type' || v === 'risk' ? v : 'platform'; } catch { return 'platform'; } };
// "By group": how risky or steady a holding is. Automatic by default; the user can set a group (or make a new one) for any ticker.
export const RISK_GROUPS = ['Stablecoins', 'Major coins', 'High-volatility coins', 'Stocks and ETFs', 'Funds and bonds', 'Other'];
const STABLE = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'RLUSD', 'USDE', 'USD', 'EUR'], MAJOR = ['BTC', 'ETH', 'BNB', 'XRP', 'SOL'];
export const riskOf = (db, a) => { const tk = (db.settings.tickers || {})[a.cur] || {}; if (tk.riskGroup) return tk.riskGroup; const t = assetTypeOf(a) || tk.assetType || '';
  if (STABLE.includes(a.cur)) return 'Stablecoins'; if (t === 'stock' || t === 'etf') return 'Stocks and ETFs'; if (t === 'fund' || t === 'bond') return 'Funds and bonds';
  if (t === 'crypto' || a.type === 'crypto') return MAJOR.includes(a.cur) ? 'Major coins' : 'High-volatility coins'; return 'Other'; };
ACT['inv-group'] = (el) => { try { localStorage.setItem('sukli-invgroup', el.dataset.v); } catch { /* blocked */ } window.dispatchEvent(new Event('sukli-render')); };
const COINS = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'TON', 'ADA'];

export function investments(db) {
  const bal = balances(db), items = live(db.accounts).filter(inInvest), book = tradeBook(db.txs);
  const crypto = items.filter(isAsset), other = items.filter((a) => !isAsset(a)), mode = gmode(), tickers = db.settings.tickers || {};
  const total = items.reduce((s, a) => s + val(db, a, bal.get(a.id) || 0), 0), unpriced = items.filter((a) => !priced(db, a) && (bal.get(a.id) || 0) !== 0);
  const byEx = new Map(); for (const a of crypto) { const k = mode === 'type' ? (ASSET_TYPES[assetTypeOf(a)] || 'Other investments') : mode === 'risk' ? riskOf(db, a) : (exchangeOf(a) || 'Wallets and other'); if (!byEx.has(k)) byEx.set(k, []); byEx.get(k).push(a); }
  const exSum = (l) => l.reduce((s, a) => s + val(db, a, bal.get(a.id) || 0), 0);
  const qty = (n, cur) => `${n.toLocaleString('en-US', { maximumFractionDigits: Math.max(2, Math.min(8, (CUR[cur] || { dec: 2 }).dec)) })} ${cur}`;
  const paidTxt = (a) => { const p = book.pos.get(a.id); if (!p || !(p.qty > 0)) return ''; const e = Object.entries(p.paid || {}).filter(([, v]) => v > 0); return e.length ? ` · paid ${e.map(([c, v]) => qty(v, c)).join(' + ')}` : ''; };
  const basis = (a) => { const p = book.pos.get(a.id), px = homeFx(db, a.cur) || 0; if (!p || !(p.qty > 0) || !(p.cost > 0) || !px) return ''; const un = p.qty * px - p.cost; return ` · cost ${money(p.cost)} · <span class="${un >= 0 ? 'cg' : 'cr'}">${un >= 0 ? '+' : '−'}${money(Math.abs(un))} (${(un / p.cost * 100).toFixed(1)}%)</span>`; };
  const yr = String(new Date().getFullYear()), thisYear = book.realized.filter((x) => x.date.startsWith(yr)).reduce((q, x) => q + x.gain, 0), nm = (id) => (db.accounts.find((a) => a.id === id) || { name: '?' }).name;
  const gains = book.realized.length ? coll('i-gain', `Realized gains and losses <small class="muted gsum">${book.total >= 0 ? '+' : '−'}${money(Math.abs(book.total))}</small>`, `<ul class="calfacts"><li><span>All time</span><b class="${book.total >= 0 ? 'cg' : 'cr'}">${money(book.total)}</b></li><li><span>This year</span><b class="${thisYear >= 0 ? 'cg' : 'cr'}">${money(thisYear)}</b></li>
    ${book.realized.slice(-6).reverse().map((x) => `<li><span>${esc(x.date.slice(0, 10))} · ${esc(nm(x.acct))}</span><b class="${x.gain >= 0 ? 'cg' : 'cr'}">${x.gain >= 0 ? '+' : '−'}${money(Math.abs(x.gain))}</b></li>`).join('')}</ul><p class="hint">Average-cost method, after fees. Units you held before using Sukli have no known cost and are left out of gains.</p>`, '') : '';
  // inside a platform: its wallets (Spot, Futures, Margin, Earn…), each with its own assets, when there is more than one wallet or a wallet other than Spot
  // what a wallet has earned so far (interest, staking, dividends), counted in your home currency
  const earnCats = new Set(db.categories.filter((c) => !c.deleted && c.group === 'Earn').map((c) => c.id));
  const earnedTxt = (l) => { const ids = new Set(l.map((a) => a.id)); let e = 0; for (const t of db.txs) if (!t.deleted && t.kind === 'income' && ids.has(t.acct) && (t.auto || t.invIncome || earnCats.has(t.cat))) e += t.amount * factorFor(db, t); return e > 0 ? ` · earned ${money(e)}` : ''; };
  const walletBlocks = (list, t) => { const srt = (l) => l.slice().sort((a, b) => val(db, b, bal.get(b.id) || 0) - val(db, a, bal.get(a.id) || 0));
    const ws = new Map(); for (const a of list) { const w = a.exchange ? walletOf(a) : ''; if (!ws.has(w)) ws.set(w, []); ws.get(w).push(a); }
    if (mode !== 'platform' || (ws.size === 1 && (ws.has('Spot') || ws.has('')))) return `<div class="rows plain">${srt(list).map((a) => holding(a, t)).join('')}</div>`;
    return [...ws.entries()].sort((x, y) => (WALLETS.indexOf(x[0]) + 1 || 99) - (WALLETS.indexOf(y[0]) + 1 || 99) || x[0].localeCompare(y[0])).map(([w, l]) => `<h4 class="wlt">${esc(w || 'Other')} <small class="muted">${money(exSum(l))}${earnedTxt(l)}</small></h4><div class="rows plain">${srt(l).map((a) => holding(a, t)).join('')}</div>`).join(''); };
  const holding = (a, tot) => { const b = bal.get(a.id) || 0, v = val(db, a, b), ok = priced(db, a), px = homeFx(db, a.cur) || 0;
    return `<button class="row acct hold" data-act="acct" data-id="${a.id}"><i class="badge sm" style="background:var(--xfer)">${esc(a.cur.slice(0, 1))}</i>
      <span class="rmain"><strong>${a.cur === 'USD' || a.cur === HOME ? esc(a.name) : `${esc((tickers[a.cur] && tickers[a.cur].ticker) || a.cur)} <small class="muted">${esc(curName(a.cur) || '')}${a.market ? ` · ${esc(a.market)}` : ''}</small>`}</strong><small>${qty(b, a.cur)}${paidTxt(a)}${ok && a.cur !== HOME ? ` · price ${money(px)}` : ''}${tot > 0 && ok ? ` · ${Math.round((v / tot) * 100)}%` : ''}${basis(a)}</small></span>
      <span class="ramt"><b>${ok ? money(v) : '<small class="muted">no price</small>'}</b></span></button>`; };
  const exHtml = [...byEx.entries()].sort((x, y) => mode === 'risk' ? (((RISK_GROUPS.indexOf(x[0]) + 1) || 99) - ((RISK_GROUPS.indexOf(y[0]) + 1) || 99)) || x[0].localeCompare(y[0]) : exSum(y[1]) - exSum(x[1])).map(([ex, list]) => {
    const t = exSum(list); return coll('ix-' + ex, `<span class="exname">${esc(ex)}</span> <small class="muted gsum">${money(t)}</small>`,
      `${walletBlocks(list, t)}
       ${mode === 'platform' && ex !== 'Wallets and other' ? `<div class="btnrow left"><button type="button" class="btn sm" data-act="inv-add" data-ex="${esc(ex)}">Record activity on ${esc(ex)}</button><button type="button" class="btn sm ghost" data-act="inv-coin" data-ex="${esc(ex)}">+ Add an asset to ${esc(ex)}</button><button type="button" class="btn sm ghost" data-act="inv-rename" data-ex="${esc(ex)}">Rename platform</button></div>` : ''}`, ''); }).join('');
  const otherHtml = other.length ? coll('i-other', `Investments and other products <small class="muted gsum">${money(exSum(other))}</small>`, `<div class="rows plain">${other.sort((a, b) => val(db, b, bal.get(b.id) || 0) - val(db, a, bal.get(a.id) || 0)).map((a) => { const b = bal.get(a.id) || 0;
    return `<button class="row acct" data-act="acct" data-id="${a.id}"><i class="badge sm" style="background:var(--line)">${esc((a.name || '?').slice(0, 1))}</i><span class="rmain"><strong>${esc(a.name)}</strong><small>${esc(a.exchange || (a.type === 'invest' ? 'Investment' : 'Other product'))} · ${fmt(b, a.cur)}</small></span><span class="ramt"><b>${priced(db, a) ? money(val(db, a, b)) : '<small class="muted">no rate</small>'}</b></span></button>`; }).join('')}</div>`, '') : '';
  return `${hdr('Investments', '<button class="btn sm" data-act="inv-add">Record activity</button> <button class="btn sm ghost" data-act="inv-new">Add asset</button>')}
    <section class="nwcard one"><div class="nwmain"><span>Market value</span><b>${money(total)}</b><small>${crypto.length} asset${crypto.length === 1 ? '' : 's'} in ${byEx.size} ${mode === 'type' ? 'type' : mode === 'risk' ? 'group' : 'place'}${byEx.size === 1 ? '' : 's'} · ${other.length} other</small><small class="updated">${updatedLine(db)}</small></div></section>
    ${unpriced.length ? `<p class="hint">No price yet for ${unpriced.map((a) => esc(a.cur)).join(', ')}, so ${unpriced.length === 1 ? 'it is' : 'they are'} left out of the total. Prices load when you are online, or set one in Settings, Exchange rates.</p>` : ''}
    ${crypto.length ? `<div class="seg sm small" role="group" aria-label="Group by">${[['platform', 'By platform'], ['type', 'By asset type'], ['risk', 'By group']].map(([v, l]) => `<button type="button" data-act="inv-group" data-v="${v}" class="${mode === v ? 'on' : ''}" aria-pressed="${mode === v}">${l}</button>`).join('')}</div>${mode === 'risk' ? '<p class="hint">Groups: stablecoins (steady value), major coins, high-volatility coins, stocks, funds. Open a ticker below to move it to another group or make your own.</p>' : ''}` : ''}
    ${performanceCard(db, bal, book, items)}${incomeCard(db)}${feesCard(db, book)}${predictCard(db)}${gains}${exHtml}${otherHtml}${tickerCard(db, tickers)}
    ${items.length ? '' : '<p class="empty">Nothing here yet. Add an exchange coin, an investment, or any account marked “Show in Investments” (for example MP2).</p>'}
    <p class="hint">Each coin or share is its own balance at its platform (for example USDT, BNB and NVDA). The line under it shows the amount, what you paid, and today’s price; the right side is the value in ${HOME}.</p>`;
}

// manual tickers: any coin, token, stock or fund, on any platform or market (Tokyo, Korea, NASDAQ...), kept apart from real currencies
function tickerCard(db, tickers) {
  const used = new Set(db.accounts.filter((x) => !x.deleted).map((x) => x.cur)), list = Object.entries(tickers).filter(([k, t]) => used.has(k) && (t.price > 0 || t.live || t.history));
  if (!list.length) return '';
  return coll('i-tick', 'Tickers and prices <small class="muted gsum">tap one for its history</small>', `<ul class="calfacts">${list.map(([k, t]) => { const a = db.accounts.find((x) => !x.deleted && x.cur === k), now = a ? priceNow(db, a) : null;
    return `<li><span><button type="button" class="linkbtn" data-act="inv-ticker" data-sym="${esc(k)}"><b>${esc(t.ticker || k)}</b></button> <small class="muted">${esc(t.name || '')}${t.market ? ' · ' + esc(t.market) : ''}</small><br><small class="muted">${a ? esc(priceStamp(db, a)) : ''}</small></span><b>${now ? fmt(now.v, now.quote) : (t.price > 0 ? fmt(t.price, t.quote) : 'no price')} ${t.live || t.cgId ? '' : `<button type="button" class="linkbtn" data-act="inv-price" data-sym="${esc(k)}">${t.price > 0 ? 'Update' : 'Set price'}</button>`}</b></li>`; }).join('')}</ul>
    <p class="hint">Coins with a price feed update by themselves when you are online. For shares and other assets, enter the price from time to time (or trade): each entry is kept so you can see how it moved.</p>`, '');
}
ACT['inv-price'] = async (el) => {
  const k = el.dataset.sym, t = (get().settings.tickers || {})[k]; if (!t) return;
  const v = await promptDialog(`Price of 1 ${t.ticker || k} in ${t.quote || 'USD'}`, t.price > 0 ? String(t.price) : '', { type: 'number' });
  if (v == null) return; const n = parseFloat(v); if (!(n > 0)) return;
  commit((d) => { d.settings.tickers[k].price = n; d.settings.tickers[k].priceDate = new Date().toISOString().slice(0, 10); pushHistory(d.settings.tickers[k], n, d.settings.tickers[k].quote, 'manual'); });
};
export function addAsset(pre = {}) {
  const typeOpts = Object.entries(ASSET_TYPES).map(([k, l]) => `<option value="${k}" ${(pre.type || 'crypto') === k ? 'selected' : ''}>${l}</option>`).join('');
  const s = sheet(`<form id="ic">
    <label class="field"><span>Asset type</span><select name="type">${typeOpts}</select></label>
    <label class="field"><span>Platform or broker</span><input name="ex" value="${esc(pre.platform || '')}" placeholder="Pick one below or type your own" required autocomplete="off"></label>
    ${platformChips()}
    <label class="field"><span>Wallet inside the platform</span><select name="wallet">${[...new Set([...WALLETS, ...get().accounts.map((x) => x.wallet).filter(Boolean)])].map((w) => `<option ${(pre.wallet || 'Spot') === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select></label>
    <div class="two"><label class="field"><span>Ticker</span><input name="coin" placeholder="BNB, BGB, NVDA, 7203, 005930" required autocomplete="off" style="text-transform:uppercase"></label>
      <label class="field"><span>Name (optional)</span><input name="name" placeholder="NVIDIA, Toyota, Samsung…" autocomplete="off"></label></div>
    <label class="field" id="mk"><span>Market (for shares and ETFs)</span><select name="market"><option value="">None</option>${MARKETS.map((m) => `<option>${m}</option>`).join('')}</select></label>
    <div class="two"><label class="field"><span>Price currency</span><input name="quote" value="${esc(pre.quote || 'USDT')}" list="ql" autocomplete="off" style="text-transform:uppercase"><datalist id="ql">${['USD', 'USDT', 'JPY', 'KRW', 'PHP', 'EUR', 'HKD'].map((x) => `<option value="${x}">`).join('')}</datalist></label>
      <label class="field"><span>Price per unit (optional)</span><input name="price" inputmode="decimal" placeholder="e.g. 740"></label></div>
    <label class="field" id="cgf"><span>Live price id (CoinGecko, optional)</span><input name="cg" placeholder="e.g. bitget-token" autocomplete="off" autocapitalize="off"><small class="muted">Looks the price up online on its own. Leave empty to set prices yourself.</small></label>
    <div class="two"><label class="field"><span>Amount you hold now</span><input name="amt" inputmode="decimal" placeholder="0"></label>
      <label class="field"><span>Decimals</span><input name="dec" inputmode="numeric" placeholder="auto"></label></div>
    <p class="hint">Creates its own balance, kept separate from PHP, JPY or USDT. Tickers on exchanges that are not listed (Tokyo, Korea, anywhere) can be added the same way. Without a price the value shows once you buy or sell it, or set a price later.</p>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Add asset</button></div></form>`, { title: 'Add an asset' });
  pickAll(s.el, { wallet: { title: 'Wallet', addLabel: 'Add a new wallet', onAdd: async () => { const nm = (await promptDialog('New wallet', '', { okLabel: 'Add', hint: 'For example: Launchpool, Savings, Copy trading' }))?.trim(); if (!nm) return; const sel = s.el.querySelector('select[name=wallet]'); if (![...sel.options].some((o) => o.value.toLowerCase() === nm.toLowerCase())) sel.add(new Option(nm, nm)); sel.value = [...sel.options].find((o) => o.value.toLowerCase() === nm.toLowerCase()).value; sel.dispatchEvent(new Event('change', { bubbles: true })); } } });
  const f = s.el.querySelector('#ic'), sync = () => { s.el.querySelector('#mk').hidden = f.type.value === 'crypto'; s.el.querySelector('#cgf').hidden = f.type.value !== 'crypto'; }; s.el.querySelectorAll('[data-plat]').forEach((b) => { b.onclick = () => { f.ex.value = b.dataset.plat; }; }); f.type.onchange = sync; sync();
  s.el.querySelector('[data-x]').onclick = () => s.close();
  f.onsubmit = async (e) => { e.preventDefault(); const exn0 = f.ex.value.trim(), raw = f.coin.value.trim().toUpperCase(), type = f.type.value, market = type === 'crypto' ? '' : f.market.value;
    let sym = raw.replace(/[^A-Z0-9]/g, ''); if (/^\d/.test(sym)) sym = ((market.match(/^[A-Z]+/) || ['X'])[0].slice(0, 3)) + sym; sym = sym.slice(0, 10);
    const amt = parseFloat(String(f.amt.value).replace(/,/g, '')) || 0, price = parseFloat(f.price.value) || 0, quote = f.quote.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'USD', dec = Math.min(12, Math.max(0, parseInt(f.dec.value, 10) || (type === 'crypto' ? 6 : 4)));
    let exn = canonPlatform(exn0);
    if (!exn || sym.length < 2) { toast('Enter the platform and a ticker.'); return; }
    const nr = nearPlatform(exn); if (nr && !(await confirmDialog(`Did you mean ${nr}? You typed ${exn}.`, `Yes, ${nr}`))) { /* keep what was typed */ } else if (nr) exn = nr;
    const wal = f.wallet.value || 'Spot';
    if (get().accounts.some((a) => !a.deleted && a.cur === sym && (a.exchange || '').toLowerCase() === exn.toLowerCase() && (a.wallet || 'Spot').toLowerCase() === wal.toLowerCase())) { toast(`${exn} already has a ${sym} balance in ${wal}. Choose another wallet, or use that one.`); return; }
    const nid = uid();
    commit((d) => {
      d.settings.tickers = d.settings.tickers || {}; const old = d.settings.tickers[sym] || {};
      d.settings.tickers[sym] = { ...old, ticker: raw, name: f.name.value.trim() || old.name || '', assetType: type, market: market || old.market || '', quote: price > 0 || !old.quote ? quote : old.quote, ...(f.cg.value.trim() || KNOWN_CG[sym] ? { cgId: f.cg.value.trim().toLowerCase() || KNOWN_CG[sym] } : {}), ...(price > 0 ? { price, priceDate: new Date().toISOString().slice(0, 10) } : {}) };
      if (price > 0) pushHistory(d.settings.tickers[sym], price, quote, 'manual');
      if (!CRYPTO.includes(sym)) { d.settings.curDec = d.settings.curDec || {}; if (!d.settings.curDec[sym]) { d.settings.curDec[sym] = dec; CUR[sym].dec = dec; } }
      d.accounts.push(stamp({ id: nid, name: `${exn}${wal === 'Spot' ? '' : ' ' + wal} ${raw}`, wallet: wal, cur: sym, type: type === 'crypto' ? 'crypto' : 'invest', assetType: type, market, exchange: exn, open: amt, include: false, archived: false, invtab: true })); });
    s.close(); toast(`${raw} added to ${exn}${wal === 'Spot' ? '' : ' (' + wal + ')'}.`); if (pre.onDone) pre.onDone(nid); if (navigator.onLine) import('./rates.js').then((m) => m.fetchRates({ quiet: true })).catch(() => {}); };
}
// rename a platform on every account that uses it (also in the account names that start with it); naming it like another platform merges the two
export async function renamePlatform(old) {
  if (!old) return;
  const v = (await promptDialog('Rename platform', old, { okLabel: 'Rename', hint: 'Every account on this platform is renamed with it. If you type the name of another platform you have, the two become one.' }))?.trim();
  if (!v || v === old) return;
  const same = v.toLowerCase() === old.toLowerCase(), merge = !same && platformNames().used.some((u) => u.toLowerCase() === v.toLowerCase()), target = merge ? canonPlatform(v) : v, name = target;
  if (merge && !(await confirmDialog(`${target} already exists. Move everything from ${old} into ${target}?`, 'Move them'))) return;
  let n = 0; const low = old.toLowerCase();
  commit((d) => { for (const a of d.accounts) { if (a.deleted || (exchangeOf(a) || '').toLowerCase() !== low) continue; const pre = a.name.toLowerCase().startsWith(low) ? a.name.slice(old.length) : null;
    a.exchange = name; if (pre !== null) a.name = name + pre; stamp(a); n++; }
    if (d.settings.lastPlat && d.settings.lastPlat.toLowerCase() === low) d.settings.lastPlat = name; });
  toast(`${n} ${n === 1 ? 'account' : 'accounts'} moved to ${name}.`);
}
ACT['inv-rename'] = (el) => renamePlatform(el.dataset.ex);
ACT['inv-coin'] = (el) => addAsset({ platform: el.dataset.ex || '' });
ACT['inv-new'] = () => {
  const s = sheet(`<div class="btnrow col"><button class="btn wide" data-k="coin">Add an asset: crypto, stock, ETF, bond…</button><button class="btn wide ghost" data-k="acct">Add MP2 or another product (an account)</button></div>
    <p class="hint">Assets have a ticker and a platform. MP2 and similar are plain accounts shown in Investments.</p>`, { title: 'Add to Investments' });
  s.el.querySelector('[data-k=coin]').onclick = () => { s.close(); addAsset(); };
  s.el.querySelector('[data-k=acct]').onclick = () => { s.close(); openAccount(null, { type: 'invest', invtab: true }); };
};

// ---------- prices, history, performance, income, predictions ----------
const KNOWN_CG = { BGB: 'bitget-token', MNT: 'mantle', OKB: 'okb', KCS: 'kucoin-shares', HYPE: 'hyperliquid', SUI: 'sui', AVAX: 'avalanche-2', DOT: 'polkadot', LINK: 'chainlink', NEAR: 'near', ARB: 'arbitrum', OP: 'optimism' };
const today = () => new Date().toISOString().slice(0, 10);
export function pushHistory(tk, price, quote, src) {
  if (!tk || !(price > 0)) return; const h = tk.history = tk.history || [], last = h[h.length - 1], day = today();
  // every manual update or trade is its own record (never overwritten); the automatic daily price keeps one record per day, the last one of the day
  if (src === 'live' && last && last.date === day && last.src === 'live') { last.price = price; last.quote = quote; last.ts = Date.now(); } else h.push({ date: day, ts: Date.now(), price, quote, src });
  if (h.length > 400) h.splice(0, h.length - 400);
}
const ensureTicker = (d, a) => { d.settings.tickers = d.settings.tickers || {}; return d.settings.tickers[a.cur] || (d.settings.tickers[a.cur] = { ticker: a.cur, name: '', assetType: assetTypeOf(a) || 'other', quote: 'USD' }); };
const fmtDay = (ts) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
function updatedLine(db) {
  const l = db.settings.live, tk = Object.values(db.settings.tickers || {}).filter((t) => t.price > 0 && !t.live && t.priceDate).map((t) => t.priceDate).sort().pop();
  return `${l && l.ts ? `Live crypto prices updated ${esc(fmtDay(l.ts))}` : 'Live prices not loaded yet (they load when you are online)'}${tk ? ` · latest price you set or traded: ${esc(tk)}` : ''}`;
}
const priceNow = (db, a) => { const tk = (db.settings.tickers || {})[a.cur] || {}, q = tk.quote || 'USD', hq = homeFx(db, q) || 0, hv = homeFx(db, a.cur) || 0; return hq > 0 && hv > 0 ? { v: hv / hq, quote: q } : null; };
const priceStamp = (db, a) => { const tk = (db.settings.tickers || {})[a.cur] || {}, l = db.settings.live; if ((tk.live || tk.cgId) && l && l.ts) return `live, ${fmtDay(l.ts)}`; return tk.priceDate ? `set ${tk.priceDate}` : 'no update yet'; };
function platformChips() {
  const db = get(), cnt = new Map(); for (const a of db.accounts) { const ex = exchangeOf(a); if (!a.deleted && ex && (isAsset(a) || a.invtab)) cnt.set(ex, (cnt.get(ex) || 0) + 1); }
  const used = [...cnt.entries()].sort((x, y) => y[1] - x[1]).map((x) => x[0]), pop = PLATFORMS.filter((p) => !used.some((u) => u.toLowerCase() === p.toLowerCase()));
  const chip = (p) => `<button type="button" class="chip plat" data-plat="${esc(p)}"><b>${esc(p)}</b></button>`;
  return `<div class="platlist">${used.length ? `<small class="muted">You used</small><div class="chips">${used.map(chip).join('')}</div>` : ''}<small class="muted">Popular</small><div class="chips">${pop.map(chip).join('')}</div></div>`;
}
// what each asset is worth now against what you paid (live where a price is known, otherwise your last price)
// trading fees and realized losses live here, in Investments only (Entries just shows each fee inside its trade)
function feesCard(db, book) {
  const trades = db.txs.filter((t) => !t.deleted && t.trade), ids = new Set(trades.map((t) => t.id));
  const parts = []; // {date, name, v}
  for (const t of trades) if (t.fee > 0) parts.push({ date: t.date, name: t.name, v: t.fee * factorFor(db, t, t.feeCur || t.cur, t.feeFx || t.fx) });
  for (const t of db.txs) if (!t.deleted && t.tradeOf && ids.has(t.tradeOf)) parts.push({ date: t.date, name: (trades.find((x) => x.id === t.tradeOf) || {}).name || t.name, v: t.amount * factorFor(db, t) });
  const fees = parts.reduce((x, p) => x + p.v, 0), losses = book.realized.filter((r) => r.gain < 0).reduce((x, r) => x + r.gain, 0);
  if (!parts.length && !losses) return '';
  const yr = String(new Date().getFullYear()), thisYr = parts.filter((p) => p.date.startsWith(yr)).reduce((x, p) => x + p.v, 0);
  return coll('i-fees', `Fees and losses <small class="muted gsum">${money(fees + Math.abs(losses))}</small>`,
    `<ul class="calfacts"><li><span>Trading fees, all time</span><b class="cr">${money(fees)}</b></li><li><span>Trading fees, this year</span><b>${money(thisYr)}</b></li><li><span>Realized losses on sales</span><b class="cr">${money(Math.abs(losses))}</b></li></ul>
    <h3 class="subh">Latest fees</h3><ul class="calfacts">${parts.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6).map((p) => `<li><span>${esc(p.date.slice(0, 10))} · ${esc(p.name)}</span><b>${money(p.v)}</b></li>`).join('') || '<li><span>No fees recorded</span><b></b></li>'}</ul>
    <p class="hint">Each fee is saved with its trade and also counted as an expense. They appear here, not as losses in Entries.</p>`, '');
}
function performanceCard(db, bal, book, items) {
  const rows = items.filter(isAsset).map((a) => { const p = book.pos.get(a.id), q = bal.get(a.id) || 0, v = val(db, a, q), cost = p && p.qty > 0 && p.cost > 0 ? p.cost : (a.costHome || 0); return { a, q, v, cost, own: !(p && p.qty > 0 && p.cost > 0) }; })
    .filter((r) => r.q > 0 && priced(db, r.a) && !['USD', 'USDT', 'USDC', 'DAI', 'FDUSD', HOME].includes(r.a.cur));   // cash-like balances have no gain to show
  if (!rows.length) return '';
  const known = rows.filter((r) => r.cost > 0), unk = rows.filter((r) => !(r.cost > 0)), tc = known.reduce((x, r) => x + r.cost, 0), tv = known.reduce((x, r) => x + r.v, 0), mx = Math.max(1, ...known.map((r) => Math.max(r.cost, r.v)));
  const nm = (a) => ((db.settings.tickers || {})[a.cur] || {}).ticker || a.cur;
  const bar = (r) => `<div class="perf"><div class="perfhead"><b>${esc(nm(r.a))}</b> <small class="muted">${esc(r.a.exchange || '')}</small><span class="${r.v >= r.cost ? 'cg' : 'cr'}">${r.v >= r.cost ? '+' : '−'}${money(Math.abs(r.v - r.cost))} (${((r.v - r.cost) / r.cost * 100).toFixed(1)}%)</span></div>
    <div class="perfbars"><i class="pb paid" style="width:${(r.cost / mx * 100).toFixed(1)}%"></i><small>paid ${money(r.cost)}${r.own ? ' (your figure)' : ''}</small></div>
    <div class="perfbars"><i class="pb now ${r.v >= r.cost ? 'up' : 'down'}" style="width:${(r.v / mx * 100).toFixed(1)}%"></i><small>now ${money(r.v)}</small></div></div>`;
  return coll('i-perf', `Performance <small class="muted gsum">${tc > 0 ? `${tv >= tc ? '+' : '−'}${money(Math.abs(tv - tc))} (${((tv - tc) / tc * 100).toFixed(1)}%)` : ''}</small>`,
    `${known.sort((x, y) => y.v - x.v).map(bar).join('') || '<p class="hint">Buy through Buy / sell, or tell Sukli what you paid, to compare.</p>'}
    ${unk.length ? `<p class="hint">No known cost: ${unk.slice(0, 8).map((r) => `${esc((r.a.exchange ? r.a.exchange + ' ' : '') + nm(r.a))} <button type="button" class="linkbtn" data-act="inv-cost" data-id="${r.a.id}">I paid…</button>`).join(', ')}${unk.length > 8 ? ` and ${unk.length - 8} more` : ''}</p>` : ''}
    <p class="hint">Value uses today’s price: live for coins with a price feed, otherwise the price you last set or traded at (tap a ticker below to update it and see its history).</p>`, '');
}
ACT['inv-cost'] = async (el) => {
  const a = get().accounts.find((x) => x.id === el.dataset.id); if (!a) return;
  const v = await promptDialog(`In total, how much did you pay for ${a.cur}? (in ${HOME})`, a.costHome ? String(a.costHome) : '', { type: 'number' });
  if (v == null) return; const n = parseFloat(v); if (!(n > 0)) return; commit((d) => { const x = d.accounts.find((q) => q.id === a.id); x.costHome = n; stamp(x); });
};
// income from investments: staking, airdrops, dividends, yield: any date, any amount
const INCOME_TYPES = ['Staking reward', 'Airdrop', 'Dividend', 'Interest or yield', 'Other distribution'];
// income kinds, grouped so a long list is easy to scan: crypto rewards, dividends and interest, the user's own kinds, then the normal income categories by their group
const KIND_GROUPS = [['Crypto rewards', ['Staking reward', 'Airdrop']], ['Dividends and interest', ['Dividend', 'Interest or yield']], ['Other investment income', ['Other distribution']]];
function kindOptions(db, incCats, pick = '') {
  const mine = db.settings.incomeKinds || [], o = (v, l) => `<option value="${esc(v)}" ${v === pick ? 'selected' : ''}>${esc(l)}</option>`;
  const inv = KIND_GROUPS.map(([g, l]) => `<optgroup label="${g}">${l.map((t) => o('inv:' + t, t)).join('')}</optgroup>`).join('');
  const own = mine.length ? `<optgroup label="Your own kinds">${mine.map((t) => o('inv:' + t, t)).join('')}</optgroup>` : '';
  const by = new Map(); for (const c of incCats) { const g = c.group || 'Other'; if (!by.has(g)) by.set(g, []); by.get(g).push(c); }
  return inv + own + [...by.entries()].map(([g, l]) => `<optgroup label="Income: ${esc(g)}">${l.map((c) => o('cat:' + c.id, c.name)).join('')}</optgroup>`).join('');
}
function incomeCard(db) {
  const list = db.txs.filter((t) => !t.deleted && t.invIncome); if (!list.length) return '';
  const v = (t) => t.amount * factorFor(db, t), yr = String(new Date().getFullYear()), by = new Map();
  for (const t of list) by.set(t.invIncome.type, (by.get(t.invIncome.type) || 0) + v(t));
  const nm = (id) => { const a = db.accounts.find((x) => x.id === id); return a ? ((db.settings.tickers || {})[a.cur] || {}).ticker || a.cur : '?'; };
  return coll('i-inc', `Investment income <small class="muted gsum">${money(list.reduce((q, t) => q + v(t), 0))}</small>`,
    `<ul class="calfacts"><li><span>This year</span><b class="cg">${money(list.filter((t) => t.date.startsWith(yr)).reduce((q, t) => q + v(t), 0))}</b></li>${[...by.entries()].map(([k, x]) => `<li><span>${esc(k)}</span><b>${money(x)}</b></li>`).join('')}</ul>
    <h3 class="subh">Latest</h3><ul class="calfacts">${list.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6).map((t) => `<li><span>${esc(t.date.slice(0, 10))} · ${esc(t.invIncome.type)} · ${esc(nm(t.invIncome.asset))}</span><b>${fmt(t.amount, t.cur)}</b></li>`).join('')}</ul>`, '<button type="button" class="btn sm ghost" data-act="inv-income">+ Income</button>');
}
export function openIncome(pre = {}) {
  const db = get(), hold = db.accounts.filter((a) => !a.deleted && !a.archived && inInvest(a)), cash = db.accounts.filter((a) => !a.deleted && !a.archived && !isLiabilityType(a));
  if (!hold.length) { toast('Add an asset or an investment first.'); return; }
  const nm = (a) => `${esc(a.exchange ? a.exchange + ' · ' : '')}${esc(((db.settings.tickers || {})[a.cur] || {}).ticker || a.name)}`;
  const incCats = (db.categories || []).filter((c) => !c.deleted && (c.kind === 'income' || c.kind === 'both') && c.name);
  const s = sheet(`<form id="ii"><label class="field"><span>Income from</span><select name="asset">${hold.map((a) => `<option value="${a.id}" ${a.id === pre.asset ? 'selected' : ''}>${nm(a)}</option>`).join('')}</select></label>
    <label class="field"><span>Kind</span><select name="type">${kindOptions(db, incCats)}</select></label>
    <div class="two"><label class="field"><span id="ii-l">Amount received</span><input name="amt" inputmode="decimal" required></label><label class="field"><span>Date</span><input name="date" type="date" value="${today()}"></label></div>
    <label class="field"><span>Received as</span><select name="as"><option value="asset">More of the asset itself (units)</option>${cash.length ? '<option value="cash">Cash into an account</option>' : ''}</select></label>
    <label class="field" id="ii-c" hidden><span>Paid into</span><select name="cash"></select></label>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save</button></div></form>`, { title: 'Investment income' });
  const f = s.el.querySelector('#ii');
  // "Cash into an account": accounts on the same platform as the asset first, then the others; an account can be added from the list
  const fillCash = () => { const a = db.accounts.find((x) => x.id === f.asset.value), p = a ? exchangeOf(a) : '', on = cash.filter((x) => p && exchangeOf(x) === p), off = cash.filter((x) => !(p && exchangeOf(x) === p)), o = (l) => l.map((x) => `<option value="${x.id}">${esc(x.name)} · ${esc(x.cur)}</option>`).join('');
    f.cash.innerHTML = (on.length ? `<optgroup label="On ${esc(p)}">${o(on)}</optgroup>` : '') + (off.length ? `<optgroup label="${on.length ? 'Other platforms and accounts' : 'Accounts'}">${o(off)}</optgroup>` : ''); };
  fillCash();
  enhanceSelect(f.asset, { title: 'Income from' }); enhanceSelect(f.type, { title: 'Kind', addLabel: 'Add a new kind', onAdd: async () => { const k = (await promptDialog('New kind of income', '', { okLabel: 'Add', hint: 'For example: Lending interest, Referral bonus, Cashback reward' }))?.trim(); if (!k) return; const known = [...INCOME_TYPES, ...(get().settings.incomeKinds || [])].find((x) => x.toLowerCase() === k.toLowerCase()); const name = known || k; if (!known) commit((d) => { d.settings.incomeKinds = [...(d.settings.incomeKinds || []), k]; }); f.type.innerHTML = kindOptions(get(), incCats, 'inv:' + name); f.type.value = 'inv:' + name; } }); enhanceSelect(f.as); enhanceSelect(f.cash, { title: 'Paid into', onAdd: () => { const a = db.accounts.find((x) => x.id === f.asset.value); s.close(); openAccount(null, { exchange: a ? exchangeOf(a) : '' }); }, addLabel: 'Add a new account or platform' });
  f.asset.addEventListener('change', fillCash);
  f.as.onchange = () => { s.el.querySelector('#ii-c').hidden = f.as.value !== 'cash'; };
  s.el.querySelector('[data-x]').onclick = () => s.close();
  f.onsubmit = (e) => { e.preventDefault(); const amt = parseFloat(String(f.amt.value).replace(/,/g, '')) || 0; if (!(amt > 0)) return;
    const a = db.accounts.find((x) => x.id === f.asset.value), dest = f.as.value === 'cash' ? db.accounts.find((x) => x.id === f.cash.value) : a, isInv = f.type.value.startsWith('inv:'), type = isInv ? f.type.value.slice(4) : ((db.categories.find((c) => 'cat:' + c.id === f.type.value) || {}).name || 'Income');
    if (!dest) { toast('Choose where it was paid into.'); return; }
    commit((d) => { const cat = isInv ? findOrAddCategory(d, 'Earn', type, 'income') : d.categories.find((c) => 'cat:' + c.id === f.type.value);
      d.txs.push(stamp({ id: uid(), kind: 'income', amount: amt, cur: dest.cur, fx: rateFor(d, dest.cur) || 1, date: `${f.date.value || today()} 12:00:00`, name: `${type}: ${((d.settings.tickers || {})[a.cur] || {}).ticker || a.cur}`, cat: cat.id, acct: dest.id, ...(isInv ? { invIncome: { asset: a.id, type } } : { notes: `From ${((d.settings.tickers || {})[a.cur] || {}).ticker || a.cur}` }) })); });
    s.close(); toast(`${type} saved.`); };
}
const isLiabilityType = (a) => a.type === 'card' || a.type === 'loan';
ACT['inv-income'] = () => openIncome();
// predictions: your own estimates, kept apart from the actual price
const allPreds = (db) => Object.entries(db.settings.tickers || {}).flatMap(([k, t]) => (t.predictions || []).map((p) => ({ ...p, sym: k, t })));
function predictCard(db) {
  const list = allPreds(db).sort((a, b) => (a.by < b.by ? -1 : 1)), held = db.accounts.some((a) => !a.deleted && inInvest(a) && isAsset(a));
  if (!held) return '';
  const actual = (sym) => { const a = db.accounts.find((x) => !x.deleted && x.cur === sym); return a ? priceNow(db, a) : null; };
  return coll('i-pred', 'My predictions <small class="muted gsum">your estimates</small>', `${list.length ? list.map((p) => { const act = actual(p.sym), gap = act && act.quote === p.quote ? (p.price - act.v) / act.v * 100 : null, a = db.accounts.find((x) => !x.deleted && x.cur === p.sym);
      return `<div class="pred"><div class="predtop"><b>${esc(p.t.ticker || p.sym)}</b><button type="button" class="linkbtn" data-act="inv-pdel" data-sym="${esc(p.sym)}" data-id="${esc(p.id)}">Remove</button></div>
        <div><span class="estbadge">Your estimate</span> ${fmt(p.price, p.quote)} by ${esc(p.by)}${p.note ? ` <small class="muted">· ${esc(p.note)}</small>` : ''}</div>
        <div>${act ? `<span class="actbadge">Actual</span> ${fmt(act.v, act.quote)} <small class="muted">· ${a ? esc(priceStamp(db, a)) : ''}</small>${gap != null ? ` · <b class="${gap >= 0 ? 'cg' : 'cr'}">${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}% to reach it</b>` : ''}` : '<span class="actbadge">Actual</span> <small class="muted">no price yet</small>'}</div></div>`; }).join('') : '<p class="hint">Write down where you think an asset will be, and by when. Your estimate is always shown apart from the real price.</p>'}`,
    '<button type="button" class="btn sm ghost" data-act="inv-predict">+ Add</button>');
}
function openPredict(pre = {}) {
  const db = get(), hold = db.accounts.filter((a) => !a.deleted && inInvest(a) && isAsset(a)), seen = new Set(), uniq = hold.filter((a) => (seen.has(a.cur) ? false : seen.add(a.cur)));
  if (!uniq.length) { toast('Add an asset first.'); return; }
  const s = sheet(`<form id="ip"><label class="field"><span>Asset</span><select name="asset">${uniq.map((a) => `<option value="${esc(a.cur)}" ${a.cur === pre.sym ? 'selected' : ''}>${esc(((db.settings.tickers || {})[a.cur] || {}).ticker || a.cur)} ${esc(curName(a.cur) || '')}</option>`).join('')}</select></label>
    <div class="two"><label class="field"><span>Your estimate (price per unit)</span><input name="price" inputmode="decimal" required></label><label class="field"><span>Currency</span><input name="quote" value="USD" style="text-transform:uppercase"></label></div>
    <label class="field"><span>By when</span><input name="by" type="date" value="${new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)}"></label>
    <label class="field"><span>Why (optional)</span><input name="note" autocomplete="off"></label>
    <p class="hint">This is your own guess. It is never used as the price of the asset.</p>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save estimate</button></div></form>`, { title: 'Add a prediction' });
  pickAll(s.el);
  const f = s.el.querySelector('#ip'); s.el.querySelector('[data-x]').onclick = () => s.close();
  const pq = () => { const t = (db.settings.tickers || {})[f.asset.value]; if (t && t.quote) f.quote.value = t.quote; }; f.asset.onchange = pq; pq();
  f.onsubmit = (e) => { e.preventDefault(); const p = parseFloat(String(f.price.value).replace(/,/g, '')) || 0; if (!(p > 0)) return; const a = uniq.find((x) => x.cur === f.asset.value);
    commit((d) => { const tk = ensureTicker(d, a); (tk.predictions = tk.predictions || []).push({ id: uid(), price: p, quote: f.quote.value.trim().toUpperCase() || 'USD', by: f.by.value, note: f.note.value.trim(), made: today() }); });
    s.close(); toast('Estimate saved.'); };
}
ACT['inv-predict'] = (el) => openPredict({ sym: el && el.dataset ? el.dataset.sym : undefined });
ACT['inv-pdel'] = (el) => commit((d) => { const t = (d.settings.tickers || {})[el.dataset.sym]; if (t) t.predictions = (t.predictions || []).filter((p) => p.id !== el.dataset.id); });
// change how a ticker is shown (its label and its full name) everywhere; the coin or share itself and every entry stay the same
export function renameTicker(sym) {
  const tk = (get().settings.tickers || {})[sym]; if (!tk) return;
  const s = sheet(`<form id="tkrn"><label class="field"><span>Shown as (short label)</span><input name="t" value="${esc(tk.ticker || sym)}" maxlength="12" required autocomplete="off" autocapitalize="characters"></label>
    <label class="field"><span>Full name (optional)</span><input name="n" value="${esc(tk.name || '')}" maxlength="40" placeholder="NVIDIA, Toyota, Bitget Token…" autocomplete="off"></label>
    <p class="hint">Only the way it is written changes. Balances, trades and prices stay as they are. Account names that use the old label are updated.</p>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save</button></div></form>`, { title: `Rename ${tk.ticker || sym}` });
  s.el.querySelector('[data-x]').onclick = () => s.close();
  s.el.querySelector('#tkrn').onsubmit = (e) => { e.preventDefault(); const f = e.target, t = f.t.value.trim().toUpperCase(), n = f.n.value.trim(), old = tk.ticker || sym; if (!t) return; let k = 0;
    commit((d) => { const x = d.settings.tickers[sym]; if (!x) return; x.ticker = t; x.name = n;
      for (const a of d.accounts) { if (a.deleted || a.cur !== sym) continue; const pre = a.exchange ? `${a.exchange} ${old}` : old; if (t !== old && a.name === pre) { a.name = a.exchange ? `${a.exchange} ${t}` : t; stamp(a); k++; } } });
    s.close(); toast(`Renamed to ${t}${k ? `, ${k} ${k === 1 ? 'account name' : 'account names'} updated` : ''}.`); };
}
// a ticker's price history: how it moved from one update to the next
ACT['inv-ticker'] = (el) => {
  const db = get(), sym = el.dataset.sym, tk = (db.settings.tickers || {})[sym]; if (!tk) return;
  const h = [...(tk.history || [])], a = db.accounts.find((x) => !x.deleted && x.cur === sym), now = a ? priceNow(db, a) : null;
  const W = 300, H = 70, xs = h.map((p) => p.price), lo = Math.min(...xs), hi = Math.max(...xs), X = (i) => (h.length > 1 ? 6 + (i / (h.length - 1)) * (W - 12) : W / 2), Y = (v) => (hi === lo ? H / 2 : H - 8 - ((v - lo) / (hi - lo)) * (H - 16));
  const spark = h.length > 1 ? `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Price history"><path d="${h.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.price).toFixed(1)}`).join('')}" fill="none" stroke="var(--line)" stroke-width="2"/>${h.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.price).toFixed(1)}" r="3" fill="${p.src === 'live' ? 'var(--line)' : 'var(--xfer)'}"/>`).join('')}</svg>` : '';
  const s = sheet(`<p><b>${esc(tk.ticker || sym)}</b> <span class="muted">${esc(tk.name || '')}${tk.market ? ' · ' + esc(tk.market) : ''}</span></p>
    <ul class="calfacts"><li><span>Price now</span><b>${now ? fmt(now.v, now.quote) : 'no price'}</b></li><li><span>Last update</span><b>${a ? esc(priceStamp(db, a)) : ''}</b></li></ul>
    ${spark}<small class="muted">Blue dots: live prices. Purple dots: prices you set or traded at.</small>
    <ul class="calfacts">${h.length ? h.slice().reverse().slice(0, 30).map((p, i, arr) => { const prev = arr[i + 1], ch = prev ? (p.price - prev.price) / prev.price * 100 : null; return `<li><span>${esc(p.date)}${p.ts && p.src !== 'live' ? ' ' + esc(new Date(p.ts).toTimeString().slice(0, 5)) : ''} <small class="muted">${p.src === 'live' ? 'daily close' : p.src === 'trade' ? 'trade' : 'you set'}</small></span><b>${fmt(p.price, p.quote || tk.quote)}${ch != null ? ` <small class="${ch >= 0 ? 'cg' : 'cr'}">${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(1)}%</small>` : ''}</b></li>`; }).join('') : '<li><span>No history yet</span><b></b></li>'}</ul>
    <label class="field"><span>Group</span><select name="rg">${[...new Set([...RISK_GROUPS, ...Object.values(db.settings.tickers || {}).map((t) => t.riskGroup).filter(Boolean)])].map((g) => `<option ${g === (a ? riskOf(db, a) : tk.riskGroup) ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
    <div class="btnrow"><button type="button" class="btn ghost" data-pr>Set price</button><button type="button" class="btn ghost" data-rn>Rename</button><button type="button" class="btn ghost" data-pd>Add prediction</button><button type="button" class="btn" data-x>Close</button></div>`, { title: 'Price history' });
  const setGroup = (g) => commit((d) => { const t = (d.settings.tickers || {})[sym]; if (t) t.riskGroup = g; });
  pickAll(s.el, { rg: { title: 'Group', addLabel: 'Add a new group', onAdd: async () => { const g = (await promptDialog('New group', '', { okLabel: 'Add', hint: 'For example: Long-term, Speculative, Retirement' }))?.trim(); if (!g) return; const sel = s.el.querySelector('select[name=rg]'); if (![...sel.options].some((o) => o.value === g)) sel.add(new Option(g, g)); sel.value = g; setGroup(g); } } });
  s.el.querySelector('select[name=rg]').addEventListener('change', (e) => setGroup(e.target.value));
  s.el.querySelector('[data-x]').onclick = () => s.close();
  s.el.querySelector('[data-rn]').onclick = () => { s.close(); renameTicker(sym); };
  s.el.querySelector('[data-pr]').onclick = () => { s.close(); if (!tk.price && !tk.cgId) { /* ensure the ticker exists for hand pricing */ } ACT['inv-price']({ dataset: { sym } }); };
  s.el.querySelector('[data-pd]').onclick = () => { s.close(); openPredict({ sym }); };
};

// One entry menu for investments, same order everywhere: Trade, Transfer, Expense, Income.
// From a platform or an asset the platform is already chosen; fees of trades are booked as expenses on their own.
export function invEntryMenu({ id = '', ex = '' } = {}) {
  const db = get(), a0 = db.accounts.find((x) => x.id === id), plat0 = ex || (a0 ? exchangeOf(a0) : '');
  const items = live(db.accounts).filter((x) => !x.archived && inInvest(x));
  // the middle + button arrives here without an account: the first thing offered is which account the entry is for
  const opts = items.map((x) => `<option value="${x.id}" ${a0 && a0.id === x.id ? 'selected' : ''}>${esc(accLabel(x))}</option>`).join('');
  const s = sheet(`${a0 || plat0 ? '' : `<label class="field"><span>Which account is it for?</span><select name="acc"><option value="">Not sure yet, choose later</option>${opts}</select></label>`}
    <div class="invopts">${[['trade', 'Trade', 'Buy, sell or convert; the fee is saved with it'], ['transfer', 'Transfer', 'Move money or coins between accounts'], ['expense', 'Expense', 'Buy goods, cashback, other costs'], ['income', 'Income', 'Yield, dividend, reward, or other income']].map(([k, l, h]) => `<button type="button" class="invopt ${k === 'trade' ? 'main' : ''}" data-k="${k}"><b>${l}</b><small>${h}</small></button>`).join('')}</div>`, { title: plat0 ? `Record activity on ${plat0}` : 'What do you want to record?' });
  pickAll(s.el, { acc: { title: 'Account', addLabel: 'Add a new asset', onAdd: () => { s.close(); addAsset({ onDone: (nid) => invEntryMenu({ id: nid }) }); } } });
  s.el.querySelectorAll('[data-k]').forEach((b) => { b.onclick = async () => { const k = b.dataset.k, sel = s.el.querySelector('select[name=acc]'), pick = sel ? sel.value : '';
    const a = a0 || db.accounts.find((x) => x.id === pick), plat = plat0 || (a ? exchangeOf(a) : '');
    const first = a || db.accounts.find((x) => !x.deleted && !x.archived && inInvest(x) && plat && exchangeOf(x) === plat); s.close();
    if (k === 'trade') return (await import('./trades.js')).openTrade({ asset: first && first.id, platform: plat || undefined });
    if (k === 'income') return openIncome({ asset: first && first.id });
    const { openEntry } = await import('./entry.js'); openEntry({ preset: k === 'transfer' ? { kind: 'transfer', acct: first ? first.id : '' } : { kind: 'expense', acct: first ? first.id : '' } }); }; });
}
ACT['inv-add'] = (el) => invEntryMenu({ id: el && el.dataset ? el.dataset.id : '', ex: el && el.dataset ? el.dataset.ex : '' });
