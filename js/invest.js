// Investments tab: crypto grouped by exchange (every coin is its own balance with its own market value), plus investments and
// other financial products such as MP2. First rough version: valuation and structure; buy/sell comes next.
import { isCoin, coinIcon, flagOf, assetIcon } from './curpicker.js';
import { enhanceSelect, pickAll, pickerList } from './picker.js';
import { tipBtn } from './interest.js';
import { groupColor, compact, WALLETS, WALLET_INFO, walletOf, accLabel, get, commit, uid, stamp, balances, homeFx, fmt, HOME, CUR, CRYPTO, curName, rateFor, nowStamp, findOrAddCategory, factorFor, allCurrencies, ensureCurrency } from './core.js';
import { ACT, sheet, ic, esc, toast, promptDialog, confirmDialog } from './ui.js';
import { hdr, coll, pieLabels, ui } from './screens.js';
import { openAccountDetail, openAccount } from './accpage.js';
import { tradeBook } from './tradecalc.js';
import { pendingReview } from './tradereview.js';
import { tokenPerformance } from './tokenperf.js';
import { button } from './components.js';
import { ensureUsdt, TRADING_WALLETS } from './tokens.js';

const live = (l) => l.filter((x) => !x.deleted);
// The Investments tab can show its values in its own currency (Settings: invCur), apart from the home currency used elsewhere.
let invC = HOME, invK = 1;
const f2 = (n, cur, o = {}) => fmt(n, cur, { ...o, dp2: true });   // Investments cards: money always shows exactly 2 decimals
const money = (n) => f2(n * invK, invC);
function setInvCur(db) { const c = (db.settings && db.settings.invCur) || HOME, r = c === HOME ? 1 : homeFx(db, c); if (c !== HOME && r > 0) { invC = c; invK = 1 / r; } else { invC = HOME; invK = 1; } }
export const inInvest = (a) => !a.archived && (a.type === 'crypto' || a.type === 'invest' || a.invtab);
const val = (db, a, v) => v * (homeFx(db, a.cur) || 0);
const priced = (db, a) => a.cur === HOME || (homeFx(db, a.cur) || 0) > 0;
const EXCH = /bybit|bitget|okx|binance|kucoin|mexc|gate\.io|coins\.ph|phantom|metamask|ledger|trust wallet/i;
const rawEx = (a) => a.exchange || ((a.name.match(EXCH) || [''])[0] ? (a.name.match(EXCH)[0].replace(/^./, (c) => c.toUpperCase())) : '');
const sqp = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// One spelling per platform: "binance", "Binance " and "BINANCE" are the same place. The known name wins, then the most used spelling.
let _canonFor = null, _canon = new Map();
function canonMap() {
  const db = get(), mine = (db.settings && db.settings.platforms) || [], key = db.accounts.length + ':' + db.accounts.map((a) => a.exchange || '').join('|') + '#' + mine.join('|'); if (_canonFor === db.accounts && _canonN === key) return _canon;
  const m = new Map(), cnt = new Map();
  for (const p of PLATFORMS) m.set(sqp(p), p);
  for (const p of mine) m.set(sqp(p), p);
  for (const a of db.accounts) { if (a.deleted) continue; const r = rawEx(a).trim(); if (!r) continue; const k = sqp(r); if (!cnt.has(k)) cnt.set(k, new Map()); cnt.get(k).set(r, (cnt.get(k).get(r) || 0) + 1); }
  for (const [k, spell] of cnt) if (!m.has(k)) m.set(k, [...spell.entries()].sort((x, y) => y[1] - x[1] || (x[0] === x[0].toLowerCase()) - (y[0] === y[0].toLowerCase()))[0][0]);
  _canonFor = db.accounts; _canonN = key; _canon = m; return m;
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
  for (const p of (db.settings.platforms || [])) { const e = canonPlatform(p); if (e && !used.has(e)) used.set(e, 0); }
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
const wtabs = () => { try { return JSON.parse(localStorage.getItem('sukli-wtab') || '{}'); } catch { return {}; } };
ACT['inv-wtab'] = (el) => { try { localStorage.setItem('sukli-wtab', JSON.stringify({ ...wtabs(), [el.dataset.ex]: el.dataset.w })); } catch { /* blocked */ } window.dispatchEvent(new Event('sukli-render')); };
ACT['inv-group'] = (el) => { try { localStorage.setItem('sukli-invgroup', el.dataset.v); } catch { /* blocked */ } window.dispatchEvent(new Event('sukli-render')); };
const COINS = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'TON', 'ADA'];

// the same amount in the other currency (USD, or the home currency when the tab already shows USD)
function altOf(db, n) { const other = invC === 'USD' ? HOME : 'USD', r = other === HOME ? 1 : homeFx(db, other); return r > 0 && other !== invC ? `${f2(n / r, other)}` : ''; }
const emptyOn = () => { try { return localStorage.getItem('sukli-invempty') === '1'; } catch { return false; } };
ACT['inv-empty'] = () => { try { localStorage.setItem('sukli-invempty', emptyOn() ? '0' : '1'); } catch { /* blocked */ } window.dispatchEvent(new Event('sukli-render')); };
// a second line with the same value in USD (or in the home currency when the tab already shows USD)
function eqLine(db, total) {
  const other = invC === 'USD' ? HOME : 'USD', r = other === HOME ? 1 : homeFx(db, other); if (!(r > 0) || other === invC) return '';
  return `<small class="muted">≈ ${f2(total / r, other)} ${esc(other)}</small>`;
}
ACT['inv-cur'] = () => {
  const db = get(), cur = (db.settings && db.settings.invCur) || HOME, ok = (c) => c === HOME || homeFx(db, c) > 0, common = [...new Set([HOME, 'USD', 'USDT', 'JPY', 'KRW', 'PHP', 'EUR', 'HKD'])].filter(ok);
  const opt = (c) => ({ value: c, label: `${c} · ${curName(c)}${c === HOME ? ' (home currency)' : ''}`, group: '' });
  pickerList([...common.map((c) => ({ ...opt(c), group: 'Common' })), ...allCurrencies().filter((c) => ok(c) && !common.includes(c)).map((c) => ({ ...opt(c), group: 'All with a known rate' }))], { value: cur, title: 'Show Investments In',
    onPick: (v) => commit((d) => { d.settings.invCur = v === HOME ? '' : v; }) });
};

// ---------- market value over time (recorded values only) ----------
const PLAT_COLORS = ['#2F6FDE', '#1F9D6B', '#C2410C', '#7C3AED', '#0E7490', '#BE185D', '#A16207', '#4D7C0F'];
const platColor = (n) => { let h = 0; for (const c of String(n).toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PLAT_COLORS[h % PLAT_COLORS.length]; };
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// One point per day on which something was recorded: an entry in an investment account, or a price (live, set by you, or from a trade).
// Value = what you held at the end of that day x the last price recorded on or before that day, in your home currency
// (quote currencies are converted at today's rate, the rate history is not kept). Nothing is estimated between the points.
export function valueSeries(db) {
  const items = live(db.accounts).filter(inInvest), tickers = db.settings.tickers || {}, ids = new Set(items.map((a) => a.id)), days = new Set([localDay()]);
  for (const t of db.txs) if (!t.deleted && (ids.has(t.acct) || ids.has(t.toAcct))) days.add(String(t.date).slice(0, 10));
  const hist = new Map();
  for (const a of items) { const h = ((tickers[a.cur] || {}).history || []).filter((p) => p && p.price > 0 && p.date).slice().sort((x, y) => (x.date + (x.ts || 0) < y.date + (y.ts || 0) ? -1 : 1)); hist.set(a.cur, h); for (const p of h) days.add(p.date); }
  let list = [...days].filter((d) => d <= localDay()).sort();
  if (list.length > 160) { const step = Math.ceil(list.length / 160); list = list.filter((d, i) => i % step === 0 || i === list.length - 1); }
  const now = new Map(), pxAt = (a, day) => {
    if (a.cur === HOME) return 1; const h = hist.get(a.cur) || [];
    if (!h.length) return homeFx(db, a.cur) || 0;
    let p = h[0]; for (const q of h) { if (q.date <= day) p = q; else break; }
    const qf = (!p.quote || p.quote === HOME) ? 1 : (now.has(p.quote) ? now.get(p.quote) : (now.set(p.quote, homeFx(db, p.quote) || 0), now.get(p.quote)));
    return p.price * qf; };
  const out = [];
  for (const d of list) { const b = balances(db, d + ' 23:59:59'); let v = 0, any = false; for (const a of items) { const q = b.get(a.id) || 0; if (Math.abs(q) > 1e-12) { any = true; v += q * pxAt(a, d); } } if (any || out.length) out.push({ d, v }); }
  while (out.length && out[0].v === 0) out.shift();
  return out;
}
function miniSvg(pts) {
  if (pts.length < 2) return '';
  const W = 160, H = 64, lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v)), X = (i) => 2 + (i / (pts.length - 1)) * (W - 4), Y = (v) => (hi === lo ? H / 2 : H - 4 - ((v - lo) / (hi - lo)) * (H - 8));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${line}L${X(pts.length - 1).toFixed(1)} ${H}L${X(0).toFixed(1)} ${H}Z" fill="var(--iv-rec)" opacity=".14"/><path d="${line}" fill="none" stroke="var(--iv-rec)" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
const RANGES = [['1M', 30], ['3M', 91], ['1Y', 365], ['All', 0]];
ACT['inv-graph'] = () => {
  const db = get(); setInvCur(db); const all = valueSeries(db);
  const W = 320, H = 190, PL = 8, PR = 8, PT = 14, PB = 22;
  const s = sheet(`<div id="ivg"></div>`, { title: `Market value in ${invC}`, wide: true });
  let range = 'All', cur = null;
  const pick = () => { const r = RANGES.find((x) => x[0] === range), days = r ? r[1] : 0; if (!days) return all; const cut = localDay(new Date(Date.now() - days * 864e5)); const sub = all.filter((p) => p.d >= cut); return sub.length >= 2 ? sub : all.slice(-2); };
  const draw = () => {
    const pts = pick(), box = s.el.querySelector('#ivg');
    if (all.length < 2) { box.innerHTML = `<p class="hint">Not enough history yet. A point is recorded each day something changes: you trade or record activity, you set a price, or live prices load. Come back after a few days and the line will fill in.</p><div class="btnrow"><button type="button" class="btn" data-x>Close</button></div>`; box.querySelector('[data-x]').onclick = () => s.close(); return; }
    const vals = pts.map((p) => p.v * invK), lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1, y0 = lo - pad, y1 = hi + pad;
    const t0 = Date.parse(pts[0].d), t1 = Date.parse(pts[pts.length - 1].d) || t0 + 1, X = (d) => PL + ((Date.parse(d) - t0) / ((t1 - t0) || 1)) * (W - PL - PR), Y = (v) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)} ${Y(p.v * invK).toFixed(1)}`).join(''), area = `${line}L${X(pts[pts.length - 1].d).toFixed(1)} ${H - PB}L${X(pts[0].d).toFixed(1)} ${H - PB}Z`;
    const first = pts[0], last = pts[pts.length - 1], ch = (last.v - first.v) * invK, pc = first.v ? (last.v - first.v) / Math.abs(first.v) * 100 : 0;
    const gridY = [0, 0.5, 1].map((f) => { const v = y0 + (y1 - y0) * f; return `<line x1="${PL}" x2="${W - PR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--rule)" stroke-width="1"/><text x="${PL + 2}" y="${(Y(v) - 3).toFixed(1)}" class="ivax">${esc(f2(v, invC))}</text>`; }).join('');
    cur = pts[pts.length - 1];
    box.innerHTML = `<div class="ivseg seg sm small" role="group" aria-label="Range">${RANGES.map(([l]) => `<button type="button" data-rg="${l}" class="${l === range ? 'on' : ''}" aria-pressed="${l === range}">${l}</button>`).join('')}</div>
      <div class="ivread"><b id="ivv">${esc(f2(last.v * invK, invC))}</b> <small id="ivd" class="muted">${esc(last.d)}</small><br><small id="ivc" class="${ch >= 0 ? 'cg' : 'cr'}">${ch >= 0 ? '+' : '−'}${esc(f2(Math.abs(ch), invC))} (${pc >= 0 ? '+' : '−'}${Math.abs(pc).toFixed(2)}%) since ${esc(first.d)}</small></div>
      <svg id="ivsvg" class="ivchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Market value over time" style="touch-action:pan-y">${gridY}<path d="${area}" fill="var(--iv-rec)" opacity=".12"/><path d="${line}" fill="none" stroke="var(--iv-rec)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
        ${pts.length <= 60 ? pts.map((p) => `<circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.v * invK).toFixed(1)}" r="2.6" fill="var(--sheet)" stroke="var(--iv-rec)" stroke-width="1.6"/>`).join('') : ''}
        <g id="ivx" hidden><line id="ivxl" y1="${PT}" y2="${H - PB}" stroke="var(--ink2)" stroke-dasharray="3 3"/><circle id="ivxc" r="4.5" fill="var(--iv-rec)" stroke="var(--sheet)" stroke-width="2"/></g>
        <text x="${PL}" y="${H - 6}" class="ivax">${esc(first.d)}</text><text x="${W - PR}" y="${H - 6}" text-anchor="end" class="ivax">${esc(last.d)}</text></svg>
      <small class="muted">Touch or drag the graph to read a day. Each point is a day something was recorded (an entry, or a price you set, traded at or that loaded live): what you held that day times the last price recorded by then. Nothing is estimated between points. Prices in other currencies use today’s exchange rate.</small>
      <ul class="calfacts"><li><span>Highest</span><b>${esc(f2(Math.max(...vals), invC))}</b></li><li><span>Lowest</span><b>${esc(f2(Math.min(...vals), invC))}</b></li><li><span>Points</span><b>${pts.length}</b></li></ul>
      <div class="btnrow"><button type="button" class="btn" data-x>Close</button></div>`;
    box.querySelectorAll('[data-rg]').forEach((b) => { b.onclick = () => { range = b.dataset.rg; draw(); }; });
    box.querySelector('[data-x]').onclick = () => s.close();
    const svg = box.querySelector('#ivsvg'), g = box.querySelector('#ivx'), xl = box.querySelector('#ivxl'), xc = box.querySelector('#ivxc');
    const at = (ev) => { const r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W; let best = pts[0], bd = 1e9; for (const p of pts) { const d = Math.abs(X(p.d) - px); if (d < bd) { bd = d; best = p; } }
      g.removeAttribute('hidden'); xl.setAttribute('x1', X(best.d)); xl.setAttribute('x2', X(best.d)); xc.setAttribute('cx', X(best.d)); xc.setAttribute('cy', Y(best.v * invK));
      box.querySelector('#ivv').textContent = f2(best.v * invK, invC); box.querySelector('#ivd').textContent = best.d;
      const c2 = (best.v - first.v) * invK, p2 = first.v ? (best.v - first.v) / Math.abs(first.v) * 100 : 0, el = box.querySelector('#ivc'); el.className = c2 >= 0 ? 'cg' : 'cr'; el.textContent = `${c2 >= 0 ? '+' : '−'}${f2(Math.abs(c2), invC)} (${p2 >= 0 ? '+' : '−'}${Math.abs(p2).toFixed(2)}%) since ${first.d}`; };
    svg.addEventListener('pointerdown', at); svg.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) at(e); });
  };
  draw();
};

// ---------- pie: where your money is (the same donut and legend as the Home pie) ----------
const PIE_COLORS = ['#2F6FDE', '#1F9D6B', '#C2410C', '#7C3AED', '#0E7490', '#BE185D', '#A16207', '#4D7C0F', '#64748B'];
function distribution(db, mode) {
  const bal = balances(db), items = live(db.accounts).filter(inInvest), groups = new Map(); let negSum = 0;
  for (const a of items) {
    const v = val(db, a, bal.get(a.id) || 0); if (v < -0.005) negSum += v; if (!(v > 0.005)) continue;
    const k = !isAsset(a) ? 'Other products' : mode === 'type' ? (ASSET_TYPES[assetTypeOf(a)] || 'Other investments') : mode === 'risk' ? riskOf(db, a) : (exchangeOf(a) || 'Wallets and other');
    if (!groups.has(k)) groups.set(k, { name: k, v: 0, list: [] }); const g = groups.get(k); g.v += v; g.list.push({ a, v });
  }
  const out = [...groups.values()].sort((x, y) => y.v - x.v); out.neg = negSum; return out;
}
ACT['inv-pie'] = () => {
  const db = get(); setInvCur(db); let mode = gmode(), sel = '';
  const s = sheet('<div id="ivp"></div>', { title: 'Where Your Money Is', wide: true });
  const draw = () => {
    const all = distribution(db, mode), total = all.reduce((t, x) => t + x.v, 0), box = s.el.querySelector('#ivp');
    const top = all.slice(0, 8), rest = all.slice(8), slices = top.map((x, i) => ({ ...x, c: mode === 'platform' ? platColor(x.name) : PIE_COLORS[i % PIE_COLORS.length] }));
    if (rest.length) slices.push({ name: 'Everything else', v: rest.reduce((t, x) => t + x.v, 0), list: rest.flatMap((x) => x.list), c: PIE_COLORS[8], other: true });
    const pct = (v) => (total ? (v / total * 100).toFixed(2) : "0.00"), C = 2 * Math.PI * 52; let acc = 0;
    const arcs = slices.map((x) => { const len = total ? (x.v / total) * C : 0, d = Math.max(0, len - 1.5);
      const el = `<circle class="slice ${sel === x.name ? 'picked' : ''}" data-pk="${esc(x.name)}" data-tip="${esc(`${x.name}: ${money(x.v)} (${pct(x.v)}%)`)}" cx="70" cy="70" r="52" fill="none" stroke="${x.c}" stroke-width="${sel === x.name ? 32 : 26}" stroke-dasharray="${d.toFixed(2)} ${(C - d).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 70 70)"></circle>`; acc += len; return el; }).join('');
    const labels = pieLabels(slices.map((x) => (total ? x.v / total : 0))), cur = slices.find((x) => x.name === sel);
    box.innerHTML = `<div class="seg sm small" role="group" aria-label="Group by">${[['platform', 'By platform'], ['type', 'By asset type'], ['risk', 'By group']].map(([v, l]) => `<button type="button" data-md="${v}" class="${mode === v ? 'on' : ''}" aria-pressed="${mode === v}">${l}</button>`).join('')}</div>
      ${slices.length ? `<div class="wentpie"><svg class="donut sm" viewBox="-30 -12 200 164" role="img" aria-label="Where your money is">${arcs}${labels}<text x="70" y="68" text-anchor="middle" class="dl">Total</text><text x="70" y="86" text-anchor="middle" class="dv">${esc(compact(total * invK, invC))}</text></svg>
      <ul class="pielegend">${slices.map((x) => `<li><button type="button" data-pk="${esc(x.name)}" class="${sel === x.name ? 'on' : ''}"><i class="dot2" style="background:${x.c}"></i><span class="pl">${esc(x.name)}</span><b class="pp">${pct(x.v)}%</b><small>${money(x.v)}</small></button></li>`).join('')}</ul></div>
      <p class="hint tap">Tap a slice or a name to see what is inside it.${all.neg < -0.005 ? ` Negative balances (${money(-all.neg)} owed) are not in the pie, so its total is higher than Market value.` : ''}</p>` : '<p class="empty">Nothing with a balance and a price to show yet.</p>'}
      ${cur ? `<h3>${esc(cur.name)} <small class="muted">${money(cur.v)} · ${pct(cur.v)}%</small></h3><ul class="calfacts">${cur.list.sort((a, b) => b.v - a.v).map((x) => `<li><span>${esc(x.a.cur === HOME || x.a.cur === 'USD' ? x.a.name : ((db.settings.tickers || {})[x.a.cur] || {}).ticker || x.a.cur)}</span><b>${money(x.v)} <small class="muted">${pct(x.v)}%</small></b></li>`).join('')}</ul>` : ''}
      <div class="btnrow"><button type="button" class="btn" data-x>Close</button></div>`;
    box.querySelectorAll('[data-md]').forEach((b) => { b.onclick = () => { mode = b.dataset.md; sel = ''; draw(); }; });
    box.querySelectorAll('[data-pk]').forEach((b) => { b.onclick = () => { sel = sel === b.dataset.pk ? '' : b.dataset.pk; draw(); }; });
    box.querySelector('[data-x]').onclick = () => s.close();
  };
  draw();
};
export function investments(db) {
  setInvCur(db);
  const bal = balances(db), items = live(db.accounts).filter(inInvest), book = tradeBook(db.txs);
  const cryptoAll = items.filter(isAsset), other = items.filter((a) => !isAsset(a)), mode = gmode(), tickers = db.settings.tickers || {};
  // assets with nothing in them are hidden (they come back as soon as they hold something, or with the "Show empty" link)
  const keepEmpty = (a) => a.cur === 'USDT' && a.exchange && TRADING_WALLETS.includes(walletOf(a));   // USDT is always listed in a trading wallet
  const showEmpty = emptyOn(), crypto = cryptoAll.filter((a) => showEmpty || keepEmpty(a) || Math.abs(bal.get(a.id) || 0) > 1e-12), hiddenN = cryptoAll.length - crypto.length;
  const total = items.reduce((s, a) => s + val(db, a, bal.get(a.id) || 0), 0), unpriced = items.filter((a) => !priced(db, a) && (bal.get(a.id) || 0) !== 0);
  const byEx = new Map(); for (const a of cryptoAll) { if (!showEmpty && !keepEmpty(a) && Math.abs(bal.get(a.id) || 0) <= 1e-12 && mode === 'platform') { const k0 = exchangeOf(a) || 'Wallets and other'; if (!byEx.has(k0)) byEx.set(k0, []); continue; } if (!crypto.includes(a)) continue; const k = mode === 'type' ? (ASSET_TYPES[assetTypeOf(a)] || 'Other investments') : mode === 'risk' ? riskOf(db, a) : (exchangeOf(a) || 'Wallets and other'); if (!byEx.has(k)) byEx.set(k, []); byEx.get(k).push(a); }
  if (mode === 'platform') for (const p of (db.settings.platforms || [])) { const e = canonPlatform(p); if (e && !byEx.has(e)) byEx.set(e, []); }
  const exSum = (l) => l.reduce((s, a) => s + val(db, a, bal.get(a.id) || 0), 0);
  const qty = (n, cur) => `${n.toLocaleString('en-US', { maximumFractionDigits: Math.max(2, Math.min(8, (CUR[cur] || { dec: 2 }).dec)) })} ${cur}`;
  const paidTxt = (a) => { const p = book.pos.get(a.id); if (!p || !(p.qty > 0)) return ''; const e = Object.entries(p.paid || {}).filter(([, v]) => v > 0); return e.length ? ` · paid ${e.map(([c, v]) => qty(v, c)).join(' + ')}` : ''; };
  const basis = (a) => { const p = book.pos.get(a.id), px = homeFx(db, a.cur) || 0; if (!p || !(p.qty > 0) || !(p.cost > 0) || !px) return ''; const un = p.qty * px - p.cost; return ` · cost ${money(p.cost)} · <span class="${un >= 0 ? 'cg' : 'cr'}">${un >= 0 ? '+' : '−'}${money(Math.abs(un))} (${(un / p.cost * 100).toFixed(2)}%)</span>`; };
  const yr = String(new Date().getFullYear()), thisYear = book.realized.filter((x) => x.date.startsWith(yr)).reduce((q, x) => q + x.gain, 0), nm = (id) => (db.accounts.find((a) => a.id === id) || { name: '?' }).name;
  // Unrealized profit (still held, on paper), Realized profit (locked in by selling) and Earned (interest paid by Earn products). Earned counts as realized income.
  const earnedTx = db.txs.filter((t) => !t.deleted && t.earnDay && t.kind === 'income'), eVal = (t) => (t.amount || 0) * (t.fx || homeFx(db, t.cur) || 1);
  const earned = earnedTx.reduce((q, t) => q + eVal(t), 0), earnedYr = earnedTx.filter((t) => String(t.date).startsWith(yr)).reduce((q, t) => q + eVal(t), 0);
  const unreal = [...book.pos].reduce((q, [id, p]) => { const a = db.accounts.find((x) => x.id === id), px = a ? homeFx(db, a.cur) || 0 : 0; return p && p.qty > 0 && p.cost > 0 && px ? q + p.qty * px - p.cost : q; }, 0);
  const sg = (v) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`, cl = (v) => (v >= 0 ? 'cg' : 'cr'), realTotal = book.total + earned;
  const recent = [...book.realized.map((x) => ({ date: x.date, label: nm(x.acct), v: x.gain })), ...earnedTx.map((t) => ({ date: t.date, label: `${nm(t.earnAcct || t.acct)} · interest${t.earnOpen ? ' (still adding up)' : ''}`, v: eVal(t) }))].sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 8);
  const gains = book.realized.length || earnedTx.length || unreal ? coll('i-gain', `Realized Gains and Losses <small class="muted gsum">${sg(realTotal)}</small>`, `<ul class="calfacts"><li><span>Unrealized Profit <small class="muted">on paper, still held</small></span><b class="${cl(unreal)}">${sg(unreal)}</b></li><li><span>Realized Profit <small class="muted">locked in by selling</small></span><b class="${cl(book.total)}">${sg(book.total)}</b></li><li><span>Earned <small class="muted">interest from Earn</small></span><b class="${cl(earned)}">${sg(earned)}</b></li><li><span>Realized + Earned, this year</span><b class="${cl(thisYear + earnedYr)}">${sg(thisYear + earnedYr)}</b></li><li><span>Realized + Earned, all time</span><b class="${cl(realTotal)}">${sg(realTotal)}</b></li>
    ${recent.map((x) => `<li><span>${esc(String(x.date).slice(0, 10))} · ${esc(x.label)}</span><b class="${cl(x.v)}">${sg(x.v)}</b></li>`).join('')}</ul><p class="hint">Average-cost method, after fees. Units you held before using Sukli have no known cost and are left out of gains. Earned is the interest your Earn products paid, added up day by day.</p>`, '') : '';
  // inside a platform: its wallets (Spot, Futures, Margin, Earn…), each with its own assets, when there is more than one wallet or a wallet other than Spot
  // what a wallet has earned so far (interest, staking, dividends), counted in your home currency
  const earnCats = new Set(db.categories.filter((c) => !c.deleted && c.group === 'Earn').map((c) => c.id));
  const earnedTxt = (l) => { const ids = new Set(l.map((a) => a.id)); let e = 0; for (const t of db.txs) if (!t.deleted && t.kind === 'income' && ids.has(t.acct) && (t.auto || t.invIncome || earnCats.has(t.cat))) e += t.amount * factorFor(db, t); return e > 0 ? ` · earned ${money(e)}` : ''; };
  const walletBlocks = (list, t) => { const srt = (l) => l.slice().sort((a, b) => val(db, b, bal.get(b.id) || 0) - val(db, a, bal.get(a.id) || 0));
    const ws = new Map(); for (const a of list) { const w = a.exchange ? walletOf(a) : ''; if (!ws.has(w)) ws.set(w, []); ws.get(w).push(a); }
    if (mode !== 'platform' || (ws.size === 1 && (ws.has('Spot') || ws.has('')))) return `<div class="rows plain">${srt(list).map((a) => holding(a, t)).join('')}</div>`;
    // one wallet at a time: a row of tabs (Spot, Margin, Futures, Earn…) and only the chosen wallet's assets below
    const order = [...ws.entries()].sort((x, y) => (WALLETS.indexOf(x[0]) + 1 || 99) - (WALLETS.indexOf(y[0]) + 1 || 99) || x[0].localeCompare(y[0])), ex = exchangeOf(list[0]) || '';
    const pick = (wtabs()[ex] && ws.has(wtabs()[ex])) ? wtabs()[ex] : ws.has('Spot') ? 'Spot' : order[0][0], l = ws.get(pick);
    return `<div class="wtabs" role="tablist" aria-label="Account type">${order.map(([w, x]) => `${button({ label: w || 'Other', kind: 'chip', cls: `wtab w-${(w || 'other').toLowerCase().replace(/[^a-z0-9]/g, '')}`, on: w === pick, act: 'inv-wtab', attr: { role: 'tab', 'aria-selected': String(w === pick), 'data-ex': ex, 'data-w': w } })}`).join('')}</div>
      <p class="hint wtsum">${esc(pick || 'Other')}: ${money(exSum(l))}${earnedTxt(l)}${pick === 'Earn' ? ' · Earn only collects interest. Coins move in and out with Internal Transfer.' : ''}</p><div class="rows plain">${srt(l).map((a) => holding(a, t)).join('')}</div>`; };
  const holding = (a, tot) => { const b = bal.get(a.id) || 0, v = val(db, a, b), ok = priced(db, a), px = homeFx(db, a.cur) || 0;
    const ic = assetIcon(a, tickers); return `<button class="row acct hold" data-act="acct" data-id="${a.id}"><i class="badge sm ${ic.coin ? 'coinbadge' : ''}" style="background:${ic.coin ? 'transparent' : ic.manual ? groupColor(a.type) : 'var(--xfer)'}">${ic.html}</i>
      <span class="rmain"><strong>${a.cur === 'USD' || a.cur === HOME ? esc(a.name) : `${esc((tickers[a.cur] && tickers[a.cur].ticker) || a.cur)} <small class="muted">${esc(curName(a.cur) || '')}${a.market ? ` · ${esc(a.market)}` : ''}</small>`}</strong><small>${qty(b, a.cur)}${paidTxt(a)}${ok && a.cur !== HOME ? ` · price ${money(px)}` : ''}${tot > 0 && ok ? ` · ${Math.round((v / tot) * 100)}%` : ''}${basis(a)}</small></span>
      <span class="ramt"><b>${ok ? money(v) : '<small class="muted">no price</small>'}</b></span></button>`; };
  const exHtml = [...byEx.entries()].sort((x, y) => mode === 'risk' ? (((RISK_GROUPS.indexOf(x[0]) + 1) || 99) - ((RISK_GROUPS.indexOf(y[0]) + 1) || 99)) || x[0].localeCompare(y[0]) : exSum(y[1]) - exSum(x[1])).map(([ex, list]) => {
    const t = exSum(list); return `<div class="ivplat" style="--pc:${platColor(ex)}">` + coll('ix-' + ex, `<span class="exname" ${ex === 'Wallets and other' ? '' : `data-act="plat-open" data-ex="${esc(ex)}" role="button" title="Settings for the whole exchange"`}>${esc(ex)}</span> <span class="gsum2"><b>${money(t)}</b>${altOf(db, t) ? ` <small class="muted">≈ ${altOf(db, t)}</small>` : ''}</span>`,
      `${list.length ? walletBlocks(list, t) : `<p class="hint">${cryptoAll.some((a) => (exchangeOf(a) || 'Wallets and other') === ex) ? 'Nothing with a balance here. Empty assets are hidden.' : 'No assets here yet.'}</p>`}
       ${mode === 'platform' && ex !== 'Wallets and other' ? `<div class="btnrow left oneline"><button type="button" class="btn sm iv-rec" data-act="inv-add" data-ex="${esc(ex)}" aria-label="Record activity on ${esc(ex)}">Record</button><button type="button" class="btn sm ghost iv-add" data-act="inv-coin" data-ex="${esc(ex)}" aria-label="Add an asset to ${esc(ex)}">+ Asset</button><button type="button" class="btn sm ghost" data-act="inv-internal" data-ex="${esc(ex)}" aria-label="Internal transfer between wallets on ${esc(ex)}">Internal</button><button type="button" class="btn sm ghost" data-act="inv-rename" data-ex="${esc(ex)}" aria-label="Rename platform ${esc(ex)}">Rename</button>${list.length || cryptoAll.some((a) => (exchangeOf(a) || 'Wallets and other') === ex) ? '' : `<button type="button" class="btn sm ghost danger" data-act="inv-platdel" data-ex="${esc(ex)}" aria-label="Remove platform ${esc(ex)}">Remove</button>`}</div>` : ''}`, '') + '</div>'; }).join('');
  // one header card for all the crypto platforms, so the other investments (bonds, government savings, funds) are not buried below a long list of exchanges
  if (crypto.length && ui.collapsed['i-crypto'] === undefined) ui.collapsed['i-crypto'] = byEx.size >= 3;
  const cryptoCard = crypto.length ? `<div class="ivgroup">${coll('i-crypto', `Crypto <small class="muted gsum">${money(exSum(crypto))} · ${byEx.size} ${byEx.size === 1 ? 'place' : 'places'}</small>`, exHtml)}</div>` : exHtml;
  const otherHtml = other.length ? coll('i-other', `Bonds, Savings, and Other Investments <small class="muted gsum">${money(exSum(other))}</small>`, `<div class="rows plain">${other.sort((a, b) => val(db, b, bal.get(b.id) || 0) - val(db, a, bal.get(a.id) || 0)).map((a) => { const b = bal.get(a.id) || 0;
    return `<button class="row acct" data-act="acct" data-id="${a.id}"><i class="badge sm" style="background:var(--line)">${esc((a.name || '?').slice(0, 1))}</i><span class="rmain"><strong>${esc(a.name)}</strong><small>${esc(a.exchange || (a.type === 'invest' ? 'Investment' : 'Other product'))} · ${f2(b, a.cur)}</small></span><span class="ramt"><b>${priced(db, a) ? money(val(db, a, b)) : '<small class="muted">no rate</small>'}</b></span></button>`; }).join('')}</div>`, '') : '';
  setTimeout(() => { if (ensureUsdt()) window.dispatchEvent(new Event('sukli-render')); }, 30);
  setTimeout(() => { const el = document.getElementById('ivmini'); if (el) el.innerHTML = miniSvg(valueSeries(get())); }, 40);
  return `<div class="invpage">${hdr('Investments', `<button class="btn sm iv-rec" data-act="inv-add">Record activity</button> <button class="btn sm ghost iv-add" data-act="inv-new">Add asset</button>${pendingReview(db).length ? ` <button class="btn sm ghost" data-act="trade-review">Review trades (${pendingReview(db).length})</button>` : ''} <button class="btn sm ghost curchip" data-act="inv-cur" aria-label="Show Investments in ${esc(invC)}. Tap to change." title="Currency shown in Investments">${esc(invC)} ▾</button>`)}
    <section class="nwcard one"><div class="nwmain nwsplit"><div class="nwl"><span>Market value in ${esc(invC)}</span><b>${money(total)}</b>${eqLine(db, total)}<small>${crypto.length} asset${crypto.length === 1 ? '' : 's'} in ${byEx.size} ${mode === 'type' ? 'type' : mode === 'risk' ? 'group' : 'place'}${byEx.size === 1 ? '' : 's'} · ${other.length} other</small></div><button type="button" class="ivgraph" data-act="inv-graph" aria-label="Open the graph of your market value over time"><span id="ivmini" class="ivmini"></span></button><small class="updated">${updatedLine(db)}</small></div></section>
    ${(() => { const odd = items.map((x) => x.cur).filter((c, i, l) => l.indexOf(c) === i && tickers[c] && oddPrices(tickers[c].history || []).size); return odd.length ? `<p class="hint warnline">A saved price looks wrong for ${odd.map((c) => `<button type="button" class="linkbtn" data-act="inv-ticker" data-sym="${esc(c)}">${esc(tickers[c].ticker || c)}</button>`).join(', ')}. Open it and delete the price marked “looks off”; the value and the graph then use the price before it.</p>` : ''; })()}
    ${unpriced.length ? `<p class="hint">No price yet for ${unpriced.map((a) => esc(a.cur)).join(', ')}, so ${unpriced.length === 1 ? 'it is' : 'they are'} left out of the total. Prices load when you are online, or set one in Settings, Exchange rates.</p>` : ''}
    ${items.length ? `<div class="grprow">${crypto.length ? `<div class="seg sm small" role="group" aria-label="Group by">${[['platform', 'By platform'], ['type', 'By asset type'], ['risk', 'By group']].map(([v, l]) => `<button type="button" data-act="inv-group" data-v="${v}" class="${mode === v ? 'on' : ''}" aria-pressed="${mode === v}">${l}</button>`).join('')}</div>` : ''}<button type="button" class="piebtn" data-act="inv-pie" aria-label="Pie chart of where your money is" title="Pie chart">${ic('pie')}</button></div>${crypto.length && mode === 'risk' ? '<p class="hint">Groups: stablecoins (steady value), major coins, high-volatility coins, stocks, funds. Open a ticker below to move it to another group or make your own.</p>' : ''}` : ''}
    ${cryptoAll.length && (hiddenN || showEmpty) ? `<p class="hint emptylink">${showEmpty ? 'Showing empty assets too.' : `${hiddenN} empty asset${hiddenN === 1 ? ' is' : 's are'} hidden.`} <button type="button" class="linkbtn" data-act="inv-empty">${showEmpty ? 'Hide empty assets' : 'Show them'}</button></p>` : ''}
    ${performanceCard(db, bal, book, items)}${tokenCard(db, book, items)}${incomeCard(db)}${feesCard(db, book)}${predictCard(db)}${gains}${cryptoCard}${otherHtml}${tickerCard(db, tickers)}
    ${items.length ? '' : '<p class="empty">Nothing here yet. Add an exchange coin, an investment, or any account marked “Show in Investments” (for example MP2).</p>'}
    <p class="hint">Each coin or share is its own balance at its platform (for example USDT, BNB and NVDA). The line under it shows the amount, what you paid, and today’s price; the right side is the value in ${invC}. <button type="button" class="linkbtn" data-act="glossary">Words explained</button></p></div>`;
}

// manual tickers: any coin, token, stock or fund, on any platform or market (Tokyo, Korea, NASDAQ...), kept apart from real currencies
function tickerCard(db, tickers) {
  const used = new Set(db.accounts.filter((x) => !x.deleted).map((x) => x.cur)), list = Object.entries(tickers).filter(([k, t]) => used.has(k) && (t.price > 0 || t.live || t.history));
  if (!list.length) return '';
  return coll('i-tick', 'Tickers and Prices <Small Class="muted Gsum">tap One for Its History</small>', `<ul class="calfacts">${list.map(([k, t]) => { const a = db.accounts.find((x) => !x.deleted && x.cur === k), now = a ? priceNow(db, a) : null;
    return `<li><span><button type="button" class="linkbtn" data-act="inv-ticker" data-sym="${esc(k)}"><b>${esc(t.ticker || k)}</b></button> <small class="muted">${esc(t.name || '')}${t.market ? ' · ' + esc(t.market) : ''}</small><br><small class="muted">${a ? esc(priceStamp(db, a)) : ''}</small></span><b>${now ? f2(now.v, now.quote) : (t.price > 0 ? f2(t.price, t.quote) : 'no price')} ${t.live || t.cgId ? '' : `<button type="button" class="linkbtn" data-act="inv-price" data-sym="${esc(k)}">${t.price > 0 ? 'Update' : 'Set price'}</button>`}</b></li>`; }).join('')}</ul>
    <p class="hint">Coins with a price feed update by themselves when you are online. For shares and other assets, enter the price from time to time (or trade): each entry is kept so you can see how it moved.</p>`, '');
}
ACT['inv-price'] = async (el) => {
  const k = el.dataset.sym, t = (get().settings.tickers || {})[k]; if (!t) return;
  const v = await promptDialog(`Price of 1 ${t.ticker || k} in ${t.quote || 'USD'}`, t.price > 0 ? String(t.price) : '', { type: 'number' });
  if (v == null) return; const n = parseFloat(v); if (!(n > 0)) return;
  commit((d) => { d.settings.tickers[k].price = n; d.settings.tickers[k].priceDate = new Date().toISOString().slice(0, 10); pushHistory(d.settings.tickers[k], n, d.settings.tickers[k].quote, 'manual'); });
};
// every currency and coin for the Price currency list: the usual ones first, then what you already use, then the rest
function quoteOptions(sel) {
  const db = get(), used = new Set([...db.accounts.filter((a) => !a.deleted).map((a) => a.cur), ...Object.values(db.settings.tickers || {}).map((t) => t.quote).filter(Boolean)]);
  const common = [...new Set(['USD', 'USDT', 'JPY', 'KRW', 'PHP', 'EUR', 'HKD', HOME])], mine = [...used].filter((c) => !common.includes(c) && !(db.settings.tickers || {})[c]).sort();
  const rest = allCurrencies().filter((c) => !common.includes(c) && !mine.includes(c));
  const o = (c) => `<option value="${esc(c)}" ${c === sel ? 'selected' : ''}>${esc(c)} · ${esc(curName(c))}</option>`;
  const all = new Set([...common, ...mine, ...rest]); const extra = all.has(sel) ? '' : o(sel);
  return `${extra}<optgroup label="Common">${common.map(o).join('')}</optgroup>${mine.length ? `<optgroup label="Already in your accounts">${mine.map(o).join('')}</optgroup>` : ''}<optgroup label="All currencies and coins">${rest.map(o).join('')}</optgroup>`;
}
// a platform or broker can be added on its own, before any asset exists; returns its name (or '' when cancelled)
export async function addPlatform() {
  const raw = (await promptDialog('New platform or broker', '', { okLabel: 'Add', hint: 'For example: Binance, Moomoo, SBI Securities, a bank, or your own wallet name.' }))?.trim();
  if (!raw) return '';
  let nm = canonPlatform(raw); const nr = nearPlatform(nm);
  if (nr && await confirmDialog(`Did you mean ${nr}? You typed ${nm}.`, `Yes, ${nr}`, false, `No, keep ${nm}`)) nm = nr;
  const have = platformNames().used.some((u) => u.toLowerCase() === nm.toLowerCase()) || (get().settings.platforms || []).some((u) => u.toLowerCase() === nm.toLowerCase());
  if (!have) commit((d) => { d.settings.platforms = [...(d.settings.platforms || []), nm]; });
  toast(have ? `${nm} is already in your list.` : `${nm} added. Now add its assets.`);
  return nm;
}
ACT['inv-newplat'] = () => addPlatform();
ACT['inv-platdel'] = async (el) => { const ex = el.dataset.ex; if (!(await confirmDialog(`Remove ${ex} from your platforms? It has no assets.`, 'Remove', true))) return;
  commit((d) => { d.settings.platforms = (d.settings.platforms || []).filter((p) => canonPlatform(p).toLowerCase() !== ex.toLowerCase()); }); };
export function addAsset(pre = {}) {
  const typeOpts = Object.entries(ASSET_TYPES).map(([k, l]) => `<option value="${k}" ${(pre.type || 'crypto') === k ? 'selected' : ''}>${l}</option>`).join('');
  const s = sheet(`<form id="ic">
    <label class="field"><span>Asset type</span><select name="type">${typeOpts}</select></label>
    <label class="field"><span>Platform or broker</span><input name="ex" value="${esc(pre.platform || '')}" placeholder="Pick one below or type your own" required autocomplete="off"></label>
    ${platformChips()}
    <label class="field"><span>Trading Account Inside the Platform</span><select name="wallet">${[...new Set([...WALLETS, ...Object.values(get().settings.acctTypes || {}).flat(), ...get().accounts.map((x) => x.wallet).filter(Boolean)])].map((w) => `<option ${(pre.wallet || 'Spot') === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select><small class="muted" id="wal-h"></small></label>
    <div id="tkchips"></div>
    <div class="two"><label class="field"><span>Ticker ${tipBtn('ticker')}</span><input name="coin" placeholder="BNB, BGB, NVDA, 7203, 005930" required autocomplete="off" style="text-transform:uppercase"></label>
      <label class="field"><span>Name (Optional) ${tipBtn('assetname')}</span><input name="name" placeholder="NVIDIA, Toyota, Samsung…" autocomplete="off"></label></div>
    <p class="hint" id="tk-note" hidden></p>
    <label class="field" id="mk"><span>Market (for shares and ETFs)</span><select name="market"><option value="">None</option>${MARKETS.map((m) => `<option>${m}</option>`).join('')}</select></label>
    <div class="two"><label class="field"><span>Price Currency ${tipBtn('pricecur')}</span><select name="quote">${quoteOptions(pre.quote || 'USDT')}</select></label>
      <label class="field"><span>Price (Optional)</span><input name="price" inputmode="decimal" placeholder="e.g. 740"></label></div>
    <label class="field" id="cgf"><span>Live Price ID (CoinGecko, Optional) ${tipBtn('livepriceid')}</span><input name="cg" placeholder="e.g. bitget-token" autocomplete="off" autocapitalize="off"><small class="muted" id="cg-h">Looks the price up online on its own. Suggested from the ticker. Leave empty to set prices yourself.</small></label>
    <div class="two"><label class="field"><span>Amount You Hold Now</span><input name="amt" inputmode="decimal" placeholder="0"></label>
      <label class="field"><span>Decimals</span><input name="dec" inputmode="numeric" placeholder="auto"></label></div>
    <p class="hint">Creates its own balance, kept separate from PHP, JPY or USDT. Tickers on exchanges that are not listed (Tokyo, Korea, anywhere) can be added the same way. Without a price the value shows once you buy or sell it, or set a price later.</p>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Add asset</button></div></form>`, { title: 'Add an Asset' });
  pickAll(s.el, { quote: { title: 'Price Currency', addLabel: 'Add a new currency or coin', onAdd: async () => { const raw = (await promptDialog('New currency or coin code', '', { okLabel: 'Add', hint: 'Letters and numbers, for example THB, SGD, or a token such as ARB.' })) || ''; const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); if (c.length < 2) return; const sel = s.el.querySelector('select[name=quote]'); commit((d) => { ensureCurrency(d, c); const sg = suggestCg(c); if (sg) { d.settings.tickers = d.settings.tickers || {}; const o = d.settings.tickers[c] || {}; if (!o.cgId) d.settings.tickers[c] = { ...o, ticker: o.ticker || c, cgId: sg }; } }); if (![...sel.options].some((o) => o.value === c)) sel.add(new Option(`${c} · ${curName(c)}`, c)); sel.value = c; sel.dispatchEvent(new Event('change', { bubbles: true })); } }, wallet: { title: 'Trading Account', addLabel: 'Add a new trading account', onAdd: async () => { const nm = (await promptDialog('New trading account', '', { okLabel: 'Add', hint: 'For example: Launchpool, Savings, Copy trading' }))?.trim(); if (!nm) return; const sel = s.el.querySelector('select[name=wallet]'); if (![...sel.options].some((o) => o.value.toLowerCase() === nm.toLowerCase())) sel.add(new Option(nm, nm)); sel.value = [...sel.options].find((o) => o.value.toLowerCase() === nm.toLowerCase()).value; sel.dispatchEvent(new Event('change', { bubbles: true })); } } });
  const f = s.el.querySelector('#ic'), sync = () => { s.el.querySelector('#mk').hidden = f.type.value === 'crypto'; s.el.querySelector('#cgf').hidden = f.type.value !== 'crypto'; }; s.el.querySelectorAll('[data-plat]').forEach((b) => { b.onclick = () => { f.ex.value = b.dataset.plat; }; }); const np = s.el.querySelector('[data-newplat]'); if (np) np.onclick = async () => { const nm = await addPlatform(); if (nm) { f.ex.value = nm; const c = document.createElement('button'); c.type = 'button'; c.className = 'chip plat'; c.dataset.plat = nm; c.innerHTML = `<b>${esc(nm)}</b>`; c.onclick = () => { f.ex.value = nm; }; np.parentNode.appendChild(c); } }; f.type.onchange = sync; sync();
  s.el.querySelector('[data-x]').onclick = () => s.close();
  { // trading account explanation, coins already on this platform (one tap), shared details of a coin Sukli already knows, Live Price ID suggestion
    const symOf = () => f.coin.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10), db0 = () => get();
    const wal = () => { const h = s.el.querySelector('#wal-h'); if (h) h.textContent = WALLET_INFO[f.wallet.value] || 'One coin can sit in several trading accounts, each with its own balance.'; };
    const chips = () => { const el = s.el.querySelector('#tkchips'), p = f.ex.value.trim().toLowerCase(); if (!el) return; const have = [...new Set(db0().accounts.filter((a) => !a.deleted && p && (a.exchange || '').toLowerCase() === p && a.type !== 'card').map((a) => a.cur))].slice(0, 12);
      el.innerHTML = have.length ? `<p class="hint">Already on ${esc(f.ex.value.trim())}: tap a coin to add it to <b>${esc(f.wallet.value)}</b> too. It keeps its own balance there and shares its price.</p><div class="chips">${have.map((c) => `<button type="button" class="chip" data-tk="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''; };
    const known = () => { const sym = symOf(), tk = (db0().settings.tickers || {})[sym], note = s.el.querySelector('#tk-note'), cgh = s.el.querySelector('#cg-h');
      if (tk) { if (!f.name.value.trim() && tk.name) f.name.value = tk.name; if (tk.assetType && f.type.value !== tk.assetType && [...f.type.options].some((o) => o.value === tk.assetType)) { f.type.value = tk.assetType; f.type.dispatchEvent(new Event('change', { bubbles: true })); }
        if (tk.quote && [...f.quote.options].some((o) => o.value === tk.quote)) f.quote.value = tk.quote; if (tk.market) f.market.value = tk.market; if (tk.cgId && !f.cg.value.trim()) f.cg.value = tk.cgId; }
      const where = db0().accounts.filter((a) => !a.deleted && a.cur === sym && a.type !== 'card').map((a) => `${a.exchange || 'No platform'}${a.wallet && a.wallet !== 'Spot' ? ' ' + a.wallet : ''}`);
      if (note) { note.hidden = !where.length; note.textContent = where.length ? `${sym} is already set up (${[...new Set(where)].slice(0, 4).join(', ')}). Its name, price currency and live price ID are shared, so nothing is entered twice. This adds a separate ${sym} balance in the trading account you chose.` : ''; }
      const sg = suggestCg(sym); if (sg && (!f.cg.value.trim() || f.cg.dataset.auto === '1')) { f.cg.value = sg; f.cg.dataset.auto = '1'; if (cgh) cgh.textContent = `Suggested from the ticker: ${sg}. Change it only if the price looks wrong.`; }
      else if (!sg && f.cg.dataset.auto === '1') { f.cg.value = ''; f.cg.dataset.auto = ''; if (cgh) cgh.textContent = 'Looks the price up online on its own. Leave empty to set prices yourself.'; } };
    f.coin.addEventListener('input', known); f.cg.addEventListener('input', () => { f.cg.dataset.auto = ''; });
    f.wallet.addEventListener('change', () => { wal(); chips(); }); f.ex.addEventListener('input', chips); s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-tk]'); if (b) { f.coin.value = b.dataset.tk; known(); } if (e.target.closest('[data-plat]')) setTimeout(chips, 0); });
    wal(); chips();
  }
  f.onsubmit = async (e) => { e.preventDefault(); const exn0 = f.ex.value.trim(), raw = f.coin.value.trim().toUpperCase(), type = f.type.value, market = type === 'crypto' ? '' : f.market.value;
    let sym = raw.replace(/[^A-Z0-9]/g, ''); if (/^\d/.test(sym)) sym = ((market.match(/^[A-Z]+/) || ['X'])[0].slice(0, 3)) + sym; sym = sym.slice(0, 10);
    const amt = parseFloat(String(f.amt.value).replace(/,/g, '')) || 0, price = parseFloat(f.price.value) || 0, quote = f.quote.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'USD', dec = Math.min(12, Math.max(0, parseInt(f.dec.value, 10) || (type === 'crypto' ? 6 : 4)));
    let exn = canonPlatform(exn0);
    if (!exn || sym.length < 2) { toast('Enter the platform and a ticker.'); return; }
    const nr = nearPlatform(exn); if (nr && !(await confirmDialog(`Did you mean ${nr}? You typed ${exn}.`, `Yes, ${nr}`, false, `No, keep ${exn}`))) { /* keep what was typed */ } else if (nr) exn = nr;
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
    if (d.settings.lastPlat && d.settings.lastPlat.toLowerCase() === low) d.settings.lastPlat = name;
    if (d.settings.platforms) { const l2 = d.settings.platforms.filter((p) => p.toLowerCase() !== low && p.toLowerCase() !== name.toLowerCase()); d.settings.platforms = d.settings.platforms.some((p) => p.toLowerCase() === low || p.toLowerCase() === name.toLowerCase()) ? [...l2, name] : l2; } });
  toast(`${n} ${n === 1 ? 'account' : 'accounts'} moved to ${name}.`);
}
ACT['inv-rename'] = (el) => renamePlatform(el.dataset.ex);
ACT['inv-internal'] = async (el) => (await import('./internal.js')).openInternal({ platform: el.dataset.ex || '' });
ACT['inv-coin'] = (el) => addAsset({ platform: el.dataset.ex || '' });
ACT['inv-new'] = () => {
  const s = sheet(`<div class="btnrow col"><button class="btn wide" data-k="coin">Add an asset: crypto, stock, ETF, bond…</button><button class="btn wide ghost" data-k="plat">Add a platform or broker (no asset yet)</button><button class="btn wide ghost" data-k="acct">Add MP2 or another product (an account)</button></div>
    <p class="hint">Assets have a ticker and a platform. MP2 and similar are plain accounts shown in Investments.</p>`, { title: 'Add to Investments' });
  s.el.querySelector('[data-k=coin]').onclick = () => { s.close(); addAsset(); };
  s.el.querySelector('[data-k=plat]').onclick = () => { s.close(); addPlatform(); };
  s.el.querySelector('[data-k=acct]').onclick = () => { s.close(); openAccount(null, { type: 'invest', invtab: true }); };
};

// ---------- prices, history, performance, income, predictions ----------
export const KNOWN_CG = { BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple', DOGE: 'dogecoin', TON: 'the-open-network', TRX: 'tron', ADA: 'cardano', LTC: 'litecoin', MATIC: 'matic-network', USDT: 'tether', USDC: 'usd-coin', DAI: 'dai', FDUSD: 'first-digital-usd', BGB: 'bitget-token', MNT: 'mantle', OKB: 'okb', KCS: 'kucoin-shares', HYPE: 'hyperliquid', SUI: 'sui', AVAX: 'avalanche-2', DOT: 'polkadot', LINK: 'chainlink', NEAR: 'near', ARB: 'arbitrum', OP: 'optimism', SHIB: 'shiba-inu', UNI: 'uniswap', ATOM: 'cosmos', XLM: 'stellar', ETC: 'ethereum-classic', BCH: 'bitcoin-cash', FIL: 'filecoin', APT: 'aptos', PEPE: 'pepe', TIA: 'celestia', INJ: 'injective-protocol', SEI: 'sei-network', WLD: 'worldcoin-wld', XMR: 'monero', ALGO: 'algorand', VET: 'vechain', ICP: 'internet-computer', AAVE: 'aave', MKR: 'maker', GRT: 'the-graph', RENDER: 'render-token', WBTC: 'wrapped-bitcoin', STETH: 'staked-ether', PAXG: 'pax-gold' };
// the CoinGecko id for a ticker, when it is one Sukli knows (suggestion only; the person can change it)
export const suggestCg = (sym) => KNOWN_CG[String(sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '')] || '';
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
  return `<div class="platlist"><div class="chips"><button type="button" class="chip plat newplat" data-newplat="1"><b>+ New platform</b></button></div>${used.length ? `<small class="muted">You used</small><div class="chips">${used.map(chip).join('')}</div>` : ''}<small class="muted">Popular</small><div class="chips">${pop.map(chip).join('')}</div></div>`;
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
  return coll('i-fees', `Fees and Losses <small class="muted gsum">${money(fees + Math.abs(losses))}</small>`,
    `<ul class="calfacts"><li><span>Trading fees, all time</span><b class="cr">${money(fees)}</b></li><li><span>Trading fees, this year</span><b>${money(thisYr)}</b></li><li><span>Realized losses on sales</span><b class="cr">${money(Math.abs(losses))}</b></li></ul>
    <h3 class="subh">Latest Fees</h3><ul class="calfacts">${parts.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6).map((p) => `<li><span>${esc(p.date.slice(0, 10))} · ${esc(p.name)}</span><b>${money(p.v)}</b></li>`).join('') || '<li><span>No fees recorded</span><b></b></li>'}</ul>
    <p class="hint">Each fee is saved with its trade and also counted as an expense. They appear here, not as losses in Entries.</p>`, '');
}
function performanceCard(db, bal, book, items) {
  const rows = items.filter(isAsset).map((a) => { const p = book.pos.get(a.id), q = bal.get(a.id) || 0, v = val(db, a, q), cost = p && p.qty > 0 && p.cost > 0 ? p.cost : (a.costHome || 0); return { a, q, v, cost, own: !(p && p.qty > 0 && p.cost > 0) }; })
    .filter((r) => r.q > 0 && priced(db, r.a) && !['USD', 'USDT', 'USDC', 'DAI', 'FDUSD', HOME].includes(r.a.cur));   // cash-like balances have no gain to show
  if (!rows.length) return '';
  const known = rows.filter((r) => r.cost > 0), unk = rows.filter((r) => !(r.cost > 0)), tc = known.reduce((x, r) => x + r.cost, 0), tv = known.reduce((x, r) => x + r.v, 0), mx = Math.max(1, ...known.map((r) => Math.max(r.cost, r.v)));
  const nm = (a) => ((db.settings.tickers || {})[a.cur] || {}).ticker || a.cur;
  const bar = (r) => `<div class="perf"><div class="perfhead"><b>${esc(nm(r.a))}</b> <small class="muted">${esc(r.a.exchange || '')}</small><span class="${r.v >= r.cost ? 'cg' : 'cr'}">${r.v >= r.cost ? '+' : '−'}${money(Math.abs(r.v - r.cost))} (${((r.v - r.cost) / r.cost * 100).toFixed(2)}%)</span></div>
    <div class="perfbars"><i class="pb paid" style="width:${(r.cost / mx * 100).toFixed(2)}%"></i><small>paid ${money(r.cost)}${r.own ? ` (your figure) <button type="button" class="linkbtn" data-act="inv-cost" data-id="${r.a.id}">Change</button> <button type="button" class="linkbtn rmx" data-act="inv-cost-clear" data-id="${r.a.id}">Remove</button>` : ''}</small></div>
    <div class="perfbars"><i class="pb now ${r.v >= r.cost ? 'up' : 'down'}" style="width:${(r.v / mx * 100).toFixed(2)}%"></i><small>now ${money(r.v)}</small></div></div>`;
  return coll('i-perf', `Performance <small class="muted gsum">${tc > 0 ? `${tv >= tc ? '+' : '−'}${money(Math.abs(tv - tc))} (${((tv - tc) / tc * 100).toFixed(2)}%)` : ''}</small>`,
    `${known.sort((x, y) => y.v - x.v).map(bar).join('') || '<p class="hint">Buy through Buy / sell, or tell Sukli what you paid, to compare.</p>'}
    ${unk.length ? `<p class="hint">No known cost: ${unk.slice(0, 8).map((r) => `${esc((r.a.exchange ? r.a.exchange + ' ' : '') + nm(r.a))} <button type="button" class="linkbtn" data-act="inv-cost" data-id="${r.a.id}">I paid…</button>`).join(', ')}${unk.length > 8 ? ` and ${unk.length - 8} more` : ''}</p>` : ''}
    <p class="hint">Value uses today’s price: live for coins with a price feed, otherwise the price you last set or traded at (tap a ticker below to update it and see its history).</p>`, '');
}
// Per-token performance: one line per coin or stock across every platform; tap for the full breakdown
const tokName = (db, cur) => ((db.settings.tickers || {})[cur] || {}).ticker || cur;
const sgn = (v) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`, tcl = (v) => (v >= 0 ? 'cg' : 'cr');
function tokenCard(db, book, items) {
  const rows = tokenPerformance(db, book, items.filter(isAsset), HOME).filter((r) => !(r.cashLike && !r.earned && !r.income && !r.realized));
  if (!rows.length) return '';
  const tot = rows.reduce((q, r) => q + r.gain, 0);
  return coll('i-tok', `Per-Token Performance <small class="muted gsum">${sgn(tot)}</small>`, `<div class="rows plain">${rows.map((r) => `<button type="button" class="row acct" data-act="tok-open" data-cur="${esc(r.cur)}"><span class="rmain"><strong>${esc(tokName(db, r.cur))}</strong><small>${r.value > 0 ? `Holding ${money(r.value)}` : 'Sold out'}${r.platforms.length ? ` · ${esc(r.platforms.join(', '))}` : ''}</small></span><span class="ramt ${tcl(r.gain)}"><b>${sgn(r.gain)}</b><small>${r.pct == null ? 'cost not known' : `${r.pct >= 0 ? '+' : '−'}${Math.abs(r.pct).toFixed(2)}%`}</small></span></button>`).join('')}</div>
    <p class="hint">Return = profit on paper + profit from selling + what it earned (Earn interest and other income). Fees are shown inside the detail. Only units bought through Buy / sell, or a cost you typed, have a known cost.</p>`, '');
}
ACT['tok-open'] = (el) => {
  const db = get(), book = tradeBook(db.txs), r = tokenPerformance(db, book, live(db.accounts).filter(inInvest).filter(isAsset), HOME).find((x) => x.cur === el.dataset.cur); if (!r) return;
  const line = (k, v, c = '') => `<li><span>${k}</span><b class="${c}">${v}</b></li>`;
  sheet(`<ul class="calfacts">${line('Holding now', `${money(r.value)}${r.qty > 0 ? ` · ${r.qty.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${esc(r.cur)}` : ''}`)}
    ${line('Cost of what you still hold', r.cost > 0 ? money(r.cost) : 'not known')}
    ${line('Profit on paper (unrealized)', r.cost > 0 ? sgn(r.unreal) : 'not known', r.cost > 0 ? tcl(r.unreal) : '')}
    ${line('Profit from selling (realized)', sgn(r.realized), tcl(r.realized))}
    ${line('Earned (Earn interest)', sgn(r.earned), tcl(r.earned))}
    ${line('Other income (staking, airdrops…)', sgn(r.income), tcl(r.income))}
    ${line('Total return', `${sgn(r.gain)}${r.pct == null ? '' : ` (${r.pct >= 0 ? '+' : '−'}${Math.abs(r.pct).toFixed(2)}%)`}`, tcl(r.gain))}
    ${line('Trading fees paid', money(r.fees))}
    ${line('Buys and sells', String(r.trades))}
    ${r.first ? line('First trade', esc(r.first.slice(0, 10))) : ''}</ul>
    <p class="hint">Percent = total return divided by what was put in (cost of what you hold plus the cost of what you sold). Fees are not taken off twice: the fee on a sale is already inside the profit from selling.</p>`, { title: `${tokName(db, r.cur)} Performance` });
};
ACT['inv-cost'] = async (el) => {
  const a = get().accounts.find((x) => x.id === el.dataset.id); if (!a) return;
  const v = await promptDialog(`In total, how much did you pay for ${a.cur}? (in ${HOME})`, a.costHome ? String(a.costHome) : '', { type: 'number', hint: a.costHome ? 'Leave it empty to remove your figure.' : '' });
  if (v == null) return; const n = parseFloat(v); if (!(n > 0)) { if (a.costHome && String(v).trim() === '') ACT['inv-cost-clear'](el); return; } commit((d) => { const x = d.accounts.find((q) => q.id === a.id); x.costHome = n; stamp(x); });
};
ACT['inv-cost-clear'] = async (el) => {
  const a = get().accounts.find((x) => x.id === el.dataset.id); if (!a || !a.costHome) return;
  if (!(await confirmDialog(`Remove the figure you entered for ${a.cur} (${f2(a.costHome, HOME)})? Performance will show it as having no known cost until you enter one or buy through Buy / sell.`, 'Remove', true))) return;
  commit((d) => { const x = d.accounts.find((q) => q.id === a.id); if (x) { delete x.costHome; stamp(x); } }); toast('Removed.');
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
  return coll('i-inc', `Investment Income <small class="muted gsum">${money(list.reduce((q, t) => q + v(t), 0))}</small>`,
    `<ul class="calfacts"><li><span>This year</span><b class="cg">${money(list.filter((t) => t.date.startsWith(yr)).reduce((q, t) => q + v(t), 0))}</b></li>${[...by.entries()].map(([k, x]) => `<li><span>${esc(k)}</span><b>${money(x)}</b></li>`).join('')}</ul>
    <h3 class="subh">Latest</h3><ul class="calfacts">${list.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6).map((t) => `<li><span>${esc(t.date.slice(0, 10))} · ${esc(t.invIncome.type)} · ${esc(nm(t.invIncome.asset))}</span><b>${f2(t.amount, t.cur)}</b></li>`).join('')}</ul>`, '<button type="button" class="btn sm ghost" data-act="inv-income">+ Income</button>');
}
export function openIncome(pre = {}) {
  const db = get(), hold = db.accounts.filter((a) => !a.deleted && !a.archived && inInvest(a)), cash = db.accounts.filter((a) => !a.deleted && !a.archived && !isLiabilityType(a));
  if (!hold.length) { toast('Add an asset or an investment first.'); return; }
  const nm = (a) => esc(accLabel(a));
  const incCats = (db.categories || []).filter((c) => !c.deleted && (c.kind === 'income' || c.kind === 'both') && c.name);
  const s = sheet(`<form id="ii"><label class="field"><span>Income from</span><select name="asset">${hold.map((a) => `<option value="${a.id}" ${a.id === pre.asset ? 'selected' : ''}>${nm(a)}</option>`).join('')}</select></label>
    <label class="field"><span>Kind</span><select name="type">${kindOptions(db, incCats)}</select></label>
    <div class="two"><label class="field"><span id="ii-l">Amount received</span><input name="amt" inputmode="decimal" required></label><label class="field"><span>Date</span><input name="date" type="date" value="${today()}"></label></div>
    <label class="field"><span>Received as</span><select name="as"><option value="asset">More of the asset itself (units)</option>${cash.length ? '<option value="cash">Cash into an account</option>' : ''}</select></label>
    <label class="field" id="ii-c" hidden><span>Paid into</span><select name="cash"></select></label>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save</button></div></form>`, { title: 'Investment Income' });
  const f = s.el.querySelector('#ii');
  // "Cash into an account": accounts on the same platform as the asset first, then the others; an account can be added from the list
  const fillCash = () => { const a = db.accounts.find((x) => x.id === f.asset.value), p = a ? exchangeOf(a) : '', on = cash.filter((x) => p && exchangeOf(x) === p), off = cash.filter((x) => !(p && exchangeOf(x) === p)), o = (l) => l.map((x) => `<option value="${x.id}">${esc(x.name)} · ${esc(x.cur)}</option>`).join('');
    f.cash.innerHTML = (on.length ? `<optgroup label="On ${esc(p)}">${o(on)}</optgroup>` : '') + (off.length ? `<optgroup label="${on.length ? 'Other platforms and accounts' : 'Accounts'}">${o(off)}</optgroup>` : ''); };
  fillCash();
  enhanceSelect(f.asset, { title: 'Income From' }); enhanceSelect(f.type, { title: 'Kind', addLabel: 'Add a new kind', onAdd: async () => { const k = (await promptDialog('New kind of income', '', { okLabel: 'Add', hint: 'For example: Lending interest, Referral bonus, Cashback reward' }))?.trim(); if (!k) return; const known = [...INCOME_TYPES, ...(get().settings.incomeKinds || [])].find((x) => x.toLowerCase() === k.toLowerCase()); const name = known || k; if (!known) commit((d) => { d.settings.incomeKinds = [...(d.settings.incomeKinds || []), k]; }); f.type.innerHTML = kindOptions(get(), incCats, 'inv:' + name); f.type.value = 'inv:' + name; } }); enhanceSelect(f.as); enhanceSelect(f.cash, { title: 'Paid Into', onAdd: () => { const a = db.accounts.find((x) => x.id === f.asset.value); s.close(); openAccount(null, { exchange: a ? exchangeOf(a) : '' }); }, addLabel: 'Add a new account or platform' });
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
  return coll('i-pred', 'My Predictions <Small Class="muted Gsum">your Estimates</small>', `${list.length ? list.map((p) => { const act = actual(p.sym), gap = act && act.quote === p.quote ? (p.price - act.v) / act.v * 100 : null, a = db.accounts.find((x) => !x.deleted && x.cur === p.sym);
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
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save estimate</button></div></form>`, { title: 'Add a Prediction' });
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
    <ul class="calfacts">${h.length ? h.map((p, k) => ({ p, k })).reverse().slice(0, 30).map(({ p, k }, i, arr) => { const prev = arr[i + 1] && arr[i + 1].p, ch = prev ? (p.price - prev.price) / prev.price * 100 : null, odd = oddPrices(h).has(k); return `<li class="${odd ? 'oddp' : ''}"><span>${esc(p.date)}${p.ts && p.src !== 'live' ? ' ' + esc(new Date(p.ts).toTimeString().slice(0, 5)) : ''} <small class="muted">${p.src === 'live' ? 'daily close' : p.src === 'trade' ? 'trade' : 'you set'}${odd ? ' · <b class="cr">looks off</b>' : ''}</small></span><b>${fmt(p.price, p.quote || tk.quote)}${ch != null ? ` <small class="${ch >= 0 ? 'cg' : 'cr'}">${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(1)}%</small>` : ''} <button type="button" class="linkbtn rmx" data-hdel="${k}" aria-label="Delete this price">Delete</button></b></li>`; }).join('') : '<li><span>No history yet</span><b></b></li>'}</ul>
    <label class="field"><span>Group</span><select name="rg">${[...new Set([...RISK_GROUPS, ...Object.values(db.settings.tickers || {}).map((t) => t.riskGroup).filter(Boolean)])].map((g) => `<option ${g === (a ? riskOf(db, a) : tk.riskGroup) ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
    <div class="btnrow"><button type="button" class="btn ghost" data-pr>Set price</button><button type="button" class="btn ghost" data-rn>Rename</button><button type="button" class="btn ghost" data-pd>Add prediction</button><button type="button" class="btn" data-x>Close</button></div>`, { title: 'Price History' });
  const setGroup = (g) => commit((d) => { const t = (d.settings.tickers || {})[sym]; if (t) t.riskGroup = g; });
  pickAll(s.el, { rg: { title: 'Group', addLabel: 'Add a new group', onAdd: async () => { const g = (await promptDialog('New group', '', { okLabel: 'Add', hint: 'For example: Long-term, Speculative, Retirement' }))?.trim(); if (!g) return; const sel = s.el.querySelector('select[name=rg]'); if (![...sel.options].some((o) => o.value === g)) sel.add(new Option(g, g)); sel.value = g; setGroup(g); } } });
  s.el.querySelector('select[name=rg]').addEventListener('change', (e) => setGroup(e.target.value));
  s.el.querySelector('[data-x]').onclick = () => s.close();
  s.el.querySelector('[data-rn]').onclick = () => { s.close(); renameTicker(sym); };
  s.el.querySelector('[data-pr]').onclick = () => { s.close(); if (!tk.price && !tk.cgId) { /* ensure the ticker exists for hand pricing */ } ACT['inv-price']({ dataset: { sym } }); };
  s.el.querySelector('[data-pd]').onclick = () => { s.close(); openPredict({ sym }); };
  s.el.querySelectorAll('[data-hdel]').forEach((b) => { b.onclick = async () => {
    const k = +b.dataset.hdel, p = h[k]; if (!p) return;
    if (!(await confirmDialog(`Delete the price ${fmt(p.price, p.quote || tk.quote)} from ${p.date}? ${p.src === 'trade' ? 'It came from a trade; the trade itself is not changed. ' : ''}Values and the graph go back to the price before it.`, 'Delete', true))) return;
    commit((d) => { const t = (d.settings.tickers || {})[sym]; if (!t || !t.history) return; const i = t.history.findIndex((x) => x.ts === p.ts && x.price === p.price && x.date === p.date); if (i < 0) return; t.history.splice(i, 1);
      const last = t.history[t.history.length - 1]; if (!t.cgId) { if (last) { t.price = last.price; t.quote = last.quote || t.quote; t.priceDate = last.date; } else { t.price = 0; t.priceDate = ''; } } });
    toast('Price deleted.'); s.close(); ACT['inv-ticker']({ dataset: { sym } }); }; });
};
// prices far away from the ones around them (a typing slip such as an extra zero): indexes in the history array
function oddPrices(h) {
  const out = new Set(); if (h.length < 3) return out;
  h.forEach((p, i) => { const near = h.slice(Math.max(0, i - 3), i + 4).filter((_, j) => j + Math.max(0, i - 3) !== i).map((x) => x.price).sort((a, b) => a - b), med = near[Math.floor(near.length / 2)]; if (med > 0 && (p.price > med * 4 || p.price < med / 4)) out.add(i); });
  return out;
}

// One entry menu for investments, same order everywhere: Trade, Transfer, Expense, Income.
// From a platform or an asset the platform is already chosen; fees of trades are booked as expenses on their own.
export function invEntryMenu({ id = '', ex = '' } = {}) {
  const db = get(), a0 = db.accounts.find((x) => x.id === id), plat0 = ex || (a0 ? exchangeOf(a0) : '');
  const items = live(db.accounts).filter((x) => !x.archived && inInvest(x));
  // the middle + button arrives here without an account: the first thing offered is which account the entry is for
  const opts = items.map((x) => `<option value="${x.id}" ${a0 && a0.id === x.id ? 'selected' : ''}>${esc(accLabel(x))}</option>`).join('');
  const s = sheet(`${a0 || plat0 ? '' : `<label class="field"><span>Which account is it for?</span><select name="acc"><option value="">Not sure yet, choose later</option>${opts}</select></label>`}
    <div class="invopts">${[['trade', 'Trade', 'Buy, sell or convert; the fee is saved with it'], ['internal', 'Internal Transfer', 'Between wallets of the same platform (Spot, Earn, Futures, Margin). Free, no fee'], ['transfer', 'Transfer/Move', 'Between different platforms or accounts (Binance to Bybit, bank to exchange)'], ['expense', 'Expense', 'Buy goods, cashback, other costs'], ['income', 'Income', 'Yield, dividend, reward, or other income']].map(([k, l, h]) => `<button type="button" class="invopt ${k === 'trade' ? 'main' : ''}" data-k="${k}"><b>${l}</b><small>${h}</small></button>`).join('')}</div>`, { title: plat0 ? `Record activity on ${plat0}` : 'What do you want to record?' });
  pickAll(s.el, { acc: { title: 'Account', addLabel: 'Add a new asset', onAdd: () => { s.close(); addAsset({ onDone: (nid) => invEntryMenu({ id: nid }) }); } } });
  s.el.querySelectorAll('[data-k]').forEach((b) => { b.onclick = async () => { const k = b.dataset.k, sel = s.el.querySelector('select[name=acc]'), pick = sel ? sel.value : '';
    const a = a0 || db.accounts.find((x) => x.id === pick), plat = plat0 || (a ? exchangeOf(a) : '');
    const first = a || db.accounts.find((x) => !x.deleted && !x.archived && inInvest(x) && plat && exchangeOf(x) === plat); s.close();
    if (k === 'trade') return (await import('./trades.js')).openTrade({ asset: first && first.id, platform: plat || undefined });
    if (k === 'income') return openIncome({ asset: first && first.id });
    if (k === 'internal') return (await import('./internal.js')).openInternal({ asset: first && first.id, platform: plat || undefined });
    const { openEntry } = await import('./entry.js'); openEntry({ preset: k === 'transfer' ? { kind: 'transfer', acct: first ? first.id : '' } : { kind: 'expense', acct: first ? first.id : '' } }); }; });
}
ACT['inv-add'] = (el) => invEntryMenu({ id: el && el.dataset ? el.dataset.id : '', ex: el && el.dataset ? el.dataset.ex : '' });
