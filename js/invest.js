// Investments tab: crypto grouped by exchange (every coin is its own balance with its own market value), plus investments and
// other financial products such as MP2. First rough version: valuation and structure; buy/sell comes next.
import { get, commit, uid, stamp, balances, homeFx, fmt, HOME, CUR, curName } from './core.js';
import { ACT, sheet, ic, esc, toast } from './ui.js';
import { hdr, money, coll } from './screens.js';
import { openAccountDetail, openAccount } from './accpage.js';
import { tradeBook } from './tradecalc.js';

const live = (l) => l.filter((x) => !x.deleted);
export const inInvest = (a) => !a.archived && (a.type === 'crypto' || a.type === 'invest' || a.invtab);
const val = (db, a, v) => v * (homeFx(db, a.cur) || 0);
const priced = (db, a) => a.cur === HOME || (homeFx(db, a.cur) || 0) > 0;
const EXCH = /bybit|bitget|okx|binance|kucoin|mexc|gate\.io|coins\.ph|phantom|metamask|ledger|trust wallet/i;
const exchangeOf = (a) => a.exchange || ((a.name.match(EXCH) || [''])[0] ? (a.name.match(EXCH)[0].replace(/^./, (c) => c.toUpperCase())) : '');
const COINS = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'TON', 'ADA'];

export function investments(db) {
  const bal = balances(db), items = live(db.accounts).filter(inInvest), book = tradeBook(db.txs);
  const crypto = items.filter((a) => a.type === 'crypto'), other = items.filter((a) => a.type !== 'crypto');
  const total = items.reduce((s, a) => s + val(db, a, bal.get(a.id) || 0), 0), unpriced = items.filter((a) => !priced(db, a) && (bal.get(a.id) || 0) !== 0);
  const byEx = new Map(); for (const a of crypto) { const k = exchangeOf(a) || 'Wallets and other'; if (!byEx.has(k)) byEx.set(k, []); byEx.get(k).push(a); }
  const exSum = (l) => l.reduce((s, a) => s + val(db, a, bal.get(a.id) || 0), 0);
  const basis = (a) => { const p = book.pos.get(a.id), px = homeFx(db, a.cur) || 0; if (!p || !(p.qty > 0) || !(p.cost > 0) || !px) return ''; const un = p.qty * px - p.cost; return ` · cost ${money(p.cost)} · <span class="${un >= 0 ? 'cg' : 'cr'}">${un >= 0 ? '+' : '−'}${money(Math.abs(un))} (${(un / p.cost * 100).toFixed(1)}%)</span>`; };
  const yr = String(new Date().getFullYear()), thisYear = book.realized.filter((x) => x.date.startsWith(yr)).reduce((q, x) => q + x.gain, 0), nm = (id) => (db.accounts.find((a) => a.id === id) || { name: '?' }).name;
  const gains = book.realized.length ? coll('i-gain', `Realized gains and losses <small class="muted gsum">${book.total >= 0 ? '+' : '−'}${money(Math.abs(book.total))}</small>`, `<ul class="calfacts"><li><span>All time</span><b class="${book.total >= 0 ? 'cg' : 'cr'}">${money(book.total)}</b></li><li><span>This year</span><b class="${thisYear >= 0 ? 'cg' : 'cr'}">${money(thisYear)}</b></li>
    ${book.realized.slice(-6).reverse().map((x) => `<li><span>${esc(x.date.slice(0, 10))} · ${esc(nm(x.acct))}</span><b class="${x.gain >= 0 ? 'cg' : 'cr'}">${x.gain >= 0 ? '+' : '−'}${money(Math.abs(x.gain))}</b></li>`).join('')}</ul><p class="hint">Average-cost method, after fees. Units you held before using Sukli have no known cost and are left out of gains.</p>`, '') : '';
  const holding = (a, tot) => { const b = bal.get(a.id) || 0, v = val(db, a, b), ok = priced(db, a), px = homeFx(db, a.cur) || 0;
    return `<button class="row acct hold" data-act="acct" data-id="${a.id}"><i class="badge sm" style="background:var(--xfer)">${esc(a.cur.slice(0, 1))}</i>
      <span class="rmain"><strong>${a.cur === 'USD' || a.cur === HOME ? esc(a.name) : `${esc(a.cur)} <small class="muted">${esc(curName(a.cur) || '')}</small>`}</strong><small>${fmt(b, a.cur)}${ok && a.cur !== HOME ? ` · price ${money(px)}` : ''}${tot > 0 && ok ? ` · ${Math.round((v / tot) * 100)}%` : ''}${basis(a)}</small></span>
      <span class="ramt"><b>${ok ? money(v) : '<small class="muted">no price</small>'}</b></span></button>`; };
  const exHtml = [...byEx.entries()].sort((x, y) => exSum(y[1]) - exSum(x[1])).map(([ex, list]) => {
    const t = exSum(list); return coll('ix-' + ex, `${esc(ex)} <small class="muted gsum">${money(t)}</small>`,
      `<div class="rows plain">${list.slice().sort((a, b) => val(db, b, bal.get(b.id) || 0) - val(db, a, bal.get(a.id) || 0)).map((a) => holding(a, t)).join('')}</div>
       ${ex !== 'Wallets and other' ? `<div class="btnrow left"><button type="button" class="btn sm ghost" data-act="inv-coin" data-ex="${esc(ex)}">+ Add a coin to ${esc(ex)}</button></div>` : ''}`, ''); }).join('');
  const otherHtml = other.length ? coll('i-other', `Investments and other products <small class="muted gsum">${money(exSum(other))}</small>`, `<div class="rows plain">${other.sort((a, b) => val(db, b, bal.get(b.id) || 0) - val(db, a, bal.get(a.id) || 0)).map((a) => { const b = bal.get(a.id) || 0;
    return `<button class="row acct" data-act="acct" data-id="${a.id}"><i class="badge sm" style="background:var(--line)">${esc((a.name || '?').slice(0, 1))}</i><span class="rmain"><strong>${esc(a.name)}</strong><small>${esc(a.exchange || (a.type === 'invest' ? 'Investment' : 'Other product'))} · ${fmt(b, a.cur)}</small></span><span class="ramt"><b>${priced(db, a) ? money(val(db, a, b)) : '<small class="muted">no rate</small>'}</b></span></button>`; }).join('')}</div>`, '') : '';
  return `${hdr('Investments', '<button class="btn sm ghost" data-act="trade-new">Buy / sell</button> <button class="btn sm" data-act="inv-new">Add</button>')}
    <section class="nwcard"><div class="nwmain"><span>Market value</span><b>${money(total)}</b><small>${crypto.length} coin balance${crypto.length === 1 ? '' : 's'} at ${byEx.size} place${byEx.size === 1 ? '' : 's'} · ${other.length} other</small></div></section>
    ${unpriced.length ? `<p class="hint">No price yet for ${unpriced.map((a) => esc(a.cur)).join(', ')}, so ${unpriced.length === 1 ? 'it is' : 'they are'} left out of the total. Prices load when you are online, or set one in Settings, Exchange rates.</p>` : ''}
    ${gains}${exHtml}${otherHtml}
    ${items.length ? '' : '<p class="empty">Nothing here yet. Add an exchange coin, an investment, or any account marked “Show in Investments” (for example MP2).</p>'}
    <p class="hint">Each coin is its own balance at its exchange (for example USDT, BTC and SOL on Binance). Value = amount × today’s price in ${HOME}.</p>`;
}

// add a coin balance to an exchange: its own account with its own balance
function addCoin(ex = '') {
  const s = sheet(`<form id="ic"><label class="field"><span>Exchange or wallet</span><input name="ex" value="${esc(ex)}" list="exl2" placeholder="e.g. Binance, Bybit, Bitget" required autocomplete="off"><datalist id="exl2">${['Binance', 'Bybit', 'Bitget', 'OKX', 'Coins.ph'].map((x) => `<option value="${x}">`).join('')}</datalist></label>
    <label class="field"><span>Coin</span><input name="coin" list="coinl" placeholder="USDT, BTC, SOL…" required autocomplete="off" style="text-transform:uppercase"><datalist id="coinl">${COINS.map((x) => `<option value="${x}">`).join('')}</datalist></label>
    <label class="field"><span>Amount you hold now</span><input name="amt" inputmode="decimal" placeholder="0"></label>
    <p class="hint">Creates a separate balance named like “Binance BTC”. Its value follows the coin’s price.</p>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Add coin</button></div></form>`, { title: ex ? `Add a coin to ${ex}` : 'Add a coin' });
  s.el.querySelector('[data-x]').onclick = () => s.close();
  s.el.querySelector('#ic').onsubmit = (e) => { e.preventDefault(); const f = e.target, exn = f.ex.value.trim(), coin = f.coin.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), amt = parseFloat(String(f.amt.value).replace(/,/g, '')) || 0; if (!exn || !coin) return;
    if (get().accounts.some((a) => !a.deleted && a.type === 'crypto' && a.cur === coin && (a.exchange || '').toLowerCase() === exn.toLowerCase())) { toast(`${exn} already has a ${coin} balance.`); return; }
    commit((d) => { if (!CUR[coin]) { d.settings.curDec = d.settings.curDec || {}; if (!d.settings.curDec[coin]) d.settings.curDec[coin] = 6; }
      d.accounts.push(stamp({ id: uid(), name: `${exn} ${coin}`, cur: coin, type: 'crypto', exchange: exn, open: amt, include: false, archived: false })); });
    s.close(); toast(`${coin} added to ${exn}.`); };
}
ACT['inv-coin'] = (el) => addCoin(el.dataset.ex || '');
ACT['inv-new'] = () => {
  const s = sheet(`<div class="btnrow col"><button class="btn wide" data-k="coin">Add a coin on an exchange</button><button class="btn wide ghost" data-k="acct">Add an investment or other product (MP2, funds, stocks)</button></div>
    <p class="hint">For MP2 and similar, choose any type in the account form and tick “Show in Investments”.</p>`, { title: 'Add to Investments' });
  s.el.querySelector('[data-k=coin]').onclick = () => { s.close(); addCoin(''); };
  s.el.querySelector('[data-k=acct]').onclick = () => { s.close(); openAccount(null, { type: 'invest', invtab: true }); };
};
