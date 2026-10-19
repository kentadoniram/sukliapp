// Core data layer: one JSON database kept in IndexedDB, plus the money maths.
// Every record has an id and updatedAt so two phones can merge their copies.

const DB_NAME = 'sukli';
const STORE = 'kv';
const KEY = 'db';

export const uid = () =>
  (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// BASE is the "ledger" currency: every entry's fx is stored as ledger-per-unit, so history never changes.
// HOME is the currency the person wants to see totals in (Settings). It may differ from BASE.
export const BASE = 'PHP';
export let HOME = 'PHP';
export function syncHome() { HOME = (state && state.settings && state.settings.home) || BASE; return HOME; }

const CUR0 = {
  PHP: { sym: '₱', dec: 2 }, JPY: { sym: '¥', dec: 0 }, USD: { sym: '$', dec: 2 }, USDT: { sym: '₮', dec: 2 },
  BTC: { sym: '₿', dec: 6 }, EUR: { sym: '€', dec: 2 },
};
export const CRYPTO = ['USDT', 'USDC', 'DAI', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'TON', 'TRX', 'ADA', 'LTC', 'MATIC', 'FDUSD'];
function deriveCur(k) {
  if (CRYPTO.includes(k)) return { sym: k + ' ', dec: ['BTC', 'ETH'].includes(k) ? 6 : 2 };
  try {
    const nf = new Intl.NumberFormat('en-US', { style: 'currency', currency: k, currencyDisplay: 'narrowSymbol' });
    const part = nf.formatToParts(0).find((x) => x.type === 'currency');
    const sym = part && part.value !== k ? part.value : k + ' ';
    return { sym, dec: nf.resolvedOptions().maximumFractionDigits };
  } catch { return { sym: k + ' ', dec: 2 }; }
}
// reading any code (CUR.THB) works for every currency; Object.keys lists only those already read
export const CUR = new Proxy({ ...CUR0 }, {
  get(t, k) { if (typeof k === 'string' && !(k in t) && /^[A-Z][A-Z0-9]{1,9}$/.test(k)) t[k] = deriveCur(k); return t[k]; },
});
// coins and tokens (BBSOL, MNT as Mantle...) need more decimals than a fiat currency
export function applyCurDec(settings) { for (const [c, d] of Object.entries((settings && settings.curDec) || {})) CUR[c].dec = d; }
let ISO_SET;
export function ensureCurrency(db, code) {
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(code)) return false;
  if (!ISO_SET) { try { ISO_SET = new Set(Intl.supportedValuesOf('currency')); } catch { ISO_SET = new Set(); } }
  db.settings.curDec = db.settings.curDec || {};
  if (ISO_SET.has(code) || db.settings.curDec[code] || CUR[code].dec > 2) return false;
  db.settings.curDec[code] = 8; CUR[code].dec = 8; return true;
}
let allCache;
export function allCurrencies() {
  if (allCache) return allCache;
  let fiat = [];
  try { fiat = Intl.supportedValuesOf('currency'); } catch { fiat = ['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'HKD', 'IDR', 'INR', 'JPY', 'KRW', 'MYR', 'NZD', 'PHP', 'SGD', 'THB', 'TWD', 'USD', 'VND']; }
  allCache = [...new Set([...fiat, ...CRYPTO])].sort();
  return allCache;
}
export function curName(c) {
  const crypto = { USDT: 'Tether', USDC: 'USD Coin', DAI: 'Dai', BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', SOL: 'Solana', XRP: 'XRP', DOGE: 'Dogecoin', TON: 'Toncoin', TRX: 'TRON', ADA: 'Cardano', LTC: 'Litecoin', MATIC: 'Polygon', FDUSD: 'First Digital USD' };
  if (crypto[c]) return crypto[c];
  try { return new Intl.DisplayNames(['en'], { type: 'currency' }).of(c) || c; } catch { return c; }
}

// "hide amounts" (the eye button): per device, kept in localStorage, never synced
export const priv = {
  on: (() => { try { return localStorage.getItem('sukli-hide') === '1'; } catch { return false; } })(),
  style: (() => { try { return localStorage.getItem('sukli-hidestyle') === 'blur' ? 'blur' : 'dot'; } catch { return 'dot'; } })(),
  setStyle(v) { this.style = v === 'blur' ? 'blur' : 'dot'; try { localStorage.setItem('sukli-hidestyle', this.style); } catch { /* blocked */ } },
  set(v) { this.on = !!v; try { localStorage.setItem('sukli-hide', this.on ? '1' : '0'); } catch { /* blocked */ } },
};

export function fmt(n, cur = BASE, opts = {}) {
  const c = CUR[cur] || { sym: cur + ' ', dec: 2 };
  const hide = priv.on && !opts.force;
  if (hide && priv.style !== 'blur') return c.sym + '•••••';
  if (hide) return '\u2063' + fmt(n, cur, { ...opts, force: true }) + '\u2063';
  const dec = opts.round ? 0 : c.dec;
  const abs = Math.abs(n || 0);
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: Math.min(dec, 2), maximumFractionDigits: dec });   // coins keep up to 8 decimals, no trailing zeros past 2
  const sign = n < 0 && abs >= Math.pow(10, -dec) / 2 ? '−' : (opts.sign && n > 0 ? '+' : '');
  return sign + c.sym + s;
}

// short money for tight places (calendar cells): 1.2k, 85k, 1.3M
export function compact(n, cur = BASE) {
  const c = CUR[cur] || { sym: '' };
  if (priv.on && priv.style !== 'blur') return '•••';
  if (priv.on && !compact.inner) { compact.inner = true; const r = compact(n, cur); compact.inner = false; return '\u2063' + r + '\u2063'; }
  const a = Math.abs(n || 0);
  const t = a >= 1e6 ? (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M' : a >= 1e4 ? Math.round(a / 1e3) + 'k' : a >= 1e3 ? (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.round(a));
  return c.sym + t;
}

// ---------- palette for category badges (white text on each) ----------
const BADGE = ['#1D4E89', '#16774E', '#9A4A00', '#7B3FA0', '#A8261F', '#006D77',
  '#5A5A1E', '#8C2F5F', '#3D5A80', '#6B4F2A', '#2E6B2E', '#7A2E2E'];
export function groupColor(g) {
  let h = 0;
  for (const ch of String(g)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BADGE[h % BADGE.length];
}
export function groupLetter(g) {
  if (g === 'Transfer') return '⇄';
  if (g === 'Adjustments') return '±';
  const m = String(g).match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : '·';
}

// ---------- dates ----------
const p2 = (n) => String(n).padStart(2, '0');
export function nowStamp(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
export const toLocalInput = (s) => String(s).slice(0, 16).replace(' ', 'T');
export const fromLocalInput = (v) => (v.length === 16 ? v + ':00' : v).replace('T', ' ');
export const monthOf = (s) => String(s).slice(0, 7);
export const thisMonth = () => nowStamp().slice(0, 7);
export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}
export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
export function dayLabel(s) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ---------- store ----------
let state = null;
const subs = new Set();
let saveTimer = null;

export function emptyDb() {
  return {
    v: 1,
    settings: {
      base: BASE, deviceId: uid(), driveClientId: '', autoSync: false, lastSync: 0,
      showHome: true, remindDays: 3, home: BASE, liveRates: true, live: null, rates: {}, binDays: 30, excludeGroups: ['Capital Loss/Distribution', 'Crypto Buy'], lastAcct: '',
      cloud: { url: '', key: '', email: '', auto: true },
    },
    accounts: [], categories: [], txs: [], budgets: [],
  };
}

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function readRaw() {
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const q = db.transaction(STORE).objectStore(STORE).get(KEY);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  } catch (e) {
    try { return JSON.parse(localStorage.getItem('sukli-db') || 'null'); } catch { return null; }
  }
}
async function writeRaw(obj) {
  try {
    const db = await idb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(obj, KEY);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {
    try { localStorage.setItem('sukli-db', JSON.stringify(obj)); } catch { /* storage full or blocked */ }
  }
}

export async function load() {
  const raw = await readRaw();
  state = raw && raw.v ? raw : emptyDb();
  state.settings = { ...emptyDb().settings, ...state.settings };
  applyCurDec(state.settings);
  syncHome();
  return state;
}
export const get = () => state;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

export function commit(mutator) {
  mutator(state);
  syncHome();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeRaw(state), 150);
  subs.forEach((f) => f(state));
}
// saves without redrawing: for text boxes, where a redraw would steal focus from the next box
export function commitQuiet(mutator) {
  mutator(state);
  syncHome();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeRaw(state), 150);
}
export async function flush() { clearTimeout(saveTimer); await writeRaw(state); }

export function replaceAll(next) {
  state = next;
  state.settings = { ...emptyDb().settings, ...state.settings };
  applyCurDec(state.settings);
  syncHome();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeRaw(state), 150);
  subs.forEach((f) => f(state));
}

export const stamp = (rec) => { rec.updatedAt = Date.now(); return rec; };
export const live = (arr) => arr.filter((x) => !x.deleted);
export const accountMap = (db) => new Map(db.accounts.map((a) => [a.id, a]));
export const catMap = (db) => new Map(db.categories.map((c) => [c.id, c]));

// ---------- maths ----------
// a transfer may carry a fee, paid from the sender's side (extra on top) or taken out of what the receiver gets
export const feeOf = (t) => (t.kind === 'transfer' && t.fee > 0 ? t.fee : 0);
// how a transaction changes one account (own currency)
export function deltaFor(t, id) {
  if (t.kind === 'income') return t.acct === id ? t.amount : 0;
  if (t.kind === 'expense') return t.acct === id ? -t.amount : 0;
  let d = 0;
  if (t.acct === id) d -= t.amount + (t.feeBy === 'to' ? 0 : feeOf(t));
  if (t.toAcct === id) d += (t.toAmount != null ? t.toAmount : t.amount) - (t.feeBy === 'to' ? feeOf(t) : 0);
  return d;
}
export function balances(db, asOf) {
  const b = new Map();
  for (const a of db.accounts) if (!a.deleted) b.set(a.id, a.open || 0);
  const add = (id, v) => { if (b.has(id)) b.set(id, b.get(id) + v); };
  for (const t of db.txs) {
    if (t.deleted || (asOf && t.date > asOf)) continue;
    if (t.kind === 'income') add(t.acct, t.amount);
    else if (t.kind === 'expense') add(t.acct, -t.amount);
    else if (t.kind === 'transfer') { add(t.acct, deltaFor(t, t.acct)); add(t.toAcct, deltaFor(t, t.toAcct)); }
  }
  return b;
}

export function sortedTxs(db) {
  return live(db.txs).slice().sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : (b.updatedAt || 0) - (a.updatedAt || 0));
}

// ledger value of 1 unit of `cur`: your manual rate, else the live rate, else the one used on the newest entry
export function rateFor(db, cur) {
  if (cur === BASE) return 1;
  if (db.settings.rates && db.settings.rates[cur] > 0) return db.settings.rates[cur];
  const lv = liveRate(db, cur);
  if (lv > 0) return lv;
  return lastTxRate(db, cur);
}
export function liveRate(db, cur) {
  // a code you gave your own decimals (MNT as Mantle, BBSOL) is a token, not the bank currency of the same name
  if (db.settings.curDec && db.settings.curDec[cur] && !CRYPTO.includes(cur)) return 0;
  const l = db.settings.live;
  if (!l || !l.usd) return 0;
  const a = l.usd[BASE], b = l.usd[cur];
  return a > 0 && b > 0 ? a / b : 0;
}
export function lastTxRate(db, cur) {
  let best = null;
  for (const t of db.txs) {
    if (t.deleted || t.cur !== cur || !(t.fx > 0)) continue;
    if (!best || t.date > best.date) best = t;
  }
  return best ? best.fx : 0;
}
// the value of 1 HOME unit in ledger terms on a given day, taken from your own entries in that currency
// (so the rate you really used then is kept); falls back to today's rate
let hcache = { key: '', arr: [] };
export function homeRate(db, date) {
  if (HOME === BASE) return 1;
  const key = db.txs.length + ':' + HOME + ':' + db.txs.reduce((m, t) => (t.updatedAt > m ? t.updatedAt : m), 0);
  if (hcache.key !== key) {
    hcache = { key, arr: db.txs.filter((t) => !t.deleted && t.cur === HOME && t.fx > 0).map((t) => [t.date.slice(0, 10), t.fx]).sort((a, b) => (a[0] < b[0] ? -1 : 1)) };
  }
  const arr = hcache.arr, d = (date || '').slice(0, 10);
  if (!arr.length || !d) return rateFor(db, HOME) || 1;
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m][0] < d) lo = m + 1; else hi = m; }
  const c = [arr[lo], arr[lo - 1]].filter(Boolean).sort((x, y) => Math.abs(new Date(x[0]) - new Date(d)) - Math.abs(new Date(y[0]) - new Date(d)))[0];
  return c[1];
}
// value of one unit of `t.cur` in HOME terms, using the rate that was used when the entry was made
export function factorFor(db, t, cur = t.cur, fx = t.fx) {
  if (cur === HOME) return 1;
  return (fx > 0 ? fx : (rateFor(db, cur) || 1)) / homeRate(db, t.date);
}
// what one unit of an account currency is worth in HOME today
export const homeFx = (db, cur) => (cur === HOME ? 1 : (rateFor(db, cur) || 0) / (rateFor(db, HOME) || 1));

const itemsMatch = (t) =>
  t.items && t.items.length && Math.abs(t.items.reduce((s, i) => s + (+i.amt || 0), 0) - t.amount) < 0.01;

export const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };

// every money movement of a month in base currency, split by item when a receipt was itemised
export function monthParts(db, ym) { return partsOf(db, (t) => t.date.startsWith(ym)); }
// the same, for any date range (YYYY-MM-DD, inclusive)
export function partsBetween(db, from, to) { return partsOf(db, (t) => { const d = t.date.slice(0, 10); return d >= from && d <= to; }); }
export function partsOf(db, inRange) {
  const ex = new Set(db.settings.excludeGroups || []);
  const cats = catMap(db), out = [];
  const amap = accountMap(db);
  for (const t of db.txs) {
    if (t.deleted || t.reval || !inRange(t)) continue;
    if (t.kind === 'transfer') {          // only its fee counts as spending
      if (feeOf(t) && t.feeCat) {
        const c = cats.get(t.feeCat), g = c ? c.group : 'Uncategorized';
        if (!ex.has(g)) {
          const feeCur = t.feeCur || (t.feeBy === 'to' ? (amap.get(t.toAcct) || {}).cur : t.cur) || t.cur;
          out.push({ t, kind: 'expense', cat: t.feeCat, group: g, v: feeOf(t) * factorFor(db, t, feeCur, t.feeFx || t.fx), label: (t.name || 'Transfer') + ' fee', split: false, fee: true, acct: t.feeBy === 'to' ? t.toAcct : t.acct });
        }
      }
      continue;
    }
    const f = factorFor(db, t), split = itemsMatch(t);
    const parts = split ? t.items.map((i) => ({ cat: i.cat || t.cat, v: i.amt * f, label: i.n || t.name }))
      : [{ cat: t.cat, v: t.amount * f, label: t.name }];
    for (const p of parts) {
      const c = cats.get(p.cat), g = c ? c.group : 'Uncategorized';
      if (ex.has(g)) continue;
      out.push({ t, kind: t.kind, cat: p.cat, group: g, v: p.v, label: p.label || t.name || (c ? c.name : ''), split, acct: t.acct });
    }
  }
  return out;
}

// per day of a month: outflow, inflow (both honour "left out" groups) and transfers, all in base currency
export function dayTotals(db, ym) {
  const days = new Map();
  const d = (n) => { if (!days.has(n)) days.set(n, { out: 0, inc: 0, tr: 0, n: 0 }); return days.get(n); };
  for (const p of monthParts(db, ym)) { const x = d(+p.t.date.slice(8, 10)); if (p.kind === 'income') x.inc += p.v; else x.out += p.v; }
  for (const t of db.txs) {
    if (t.deleted || !t.date.startsWith(ym)) continue;
    const x = d(+t.date.slice(8, 10)); x.n++;
    if (t.kind === 'transfer') x.tr += t.amount * factorFor(db, t);
  }
  return days;
}

export function monthStats(db, ym) {
  const out = { income: 0, spent: 0, byGroup: new Map(), byCat: new Map(), count: 0 };
  const seen = new Set();
  for (const p of monthParts(db, ym)) {
    seen.add(p.t.id);
    if (p.kind === 'income') out.income += p.v;
    else {
      out.spent += p.v;
      out.byGroup.set(p.group, (out.byGroup.get(p.group) || 0) + p.v);
      const k = p.cat || 'none';
      out.byCat.set(k, (out.byCat.get(k) || 0) + p.v);
    }
  }
  out.count = seen.size;
  return out;
}

export function monthsPresent(db) {
  const s = new Set(live(db.txs).map((t) => monthOf(t.date)));
  s.add(thisMonth());
  return [...s].sort();
}

export function latestMonth(db) {
  let m = '';
  for (const t of db.txs) if (!t.deleted && t.date > m) m = t.date;
  return m ? m.slice(0, 7) : thisMonth();
}

export function freqNames(db, days = 90, n = 8, kind = 'expense') {
  const cutoff = nowStamp(new Date(Date.now() - days * 864e5));
  const m = new Map();
  for (const t of db.txs) {
    if (t.deleted || t.auto || t.reval || t.kind !== kind || t.date < cutoff || !t.name) continue;
    const k = t.name.trim();
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
}

export function reviewCount(db) {
  return db.txs.reduce((n, t) => n + (!t.deleted && t.flag === 'review' ? 1 : 0), 0);
}

// ---------- categories ----------
export function findOrAddCategory(db, group, name, kind) {
  let c = db.categories.find((x) => !x.deleted && x.group === group && x.name === name && (x.kind === kind || x.kind === 'both'));
  if (!c) {
    c = stamp({ id: uid(), group, name, kind });
    db.categories.push(c);
  }
  return c;
}

export const DEFAULT_CATS = {
  expense: {
    'Food & Drinks': ['Groceries', 'Dining out', 'Coffee', 'Snacks', 'Breakfast'],
    Transportation: ['Bus', 'Train', 'IC card top-up', 'Taxi', 'Fuel'],
    Household: ['Supplies', 'Laundry', 'Rent'],
    Utilities: ['Electricity', 'Water', 'Internet', 'Phone'],
    Personal: ['Clothing', 'Toiletries', 'Haircut', 'Health'],
    Entertainment: ['Subscriptions', 'Hobbies', 'Going out'],
    Travel: ['Trips', 'Hiking'],
    'Family Support': ['Allowance'],
    Others: ['Uncategorized'],
  },
  income: { Employer: ['Salary'], Earn: ['Interest', 'Crypto earned'], Others: ['Other income'] },
};

export function seedCategories(db) {
  for (const kind of ['expense', 'income']) {
    for (const [g, names] of Object.entries(DEFAULT_CATS[kind])) {
      for (const n of names) findOrAddCategory(db, g, n, kind);
    }
  }
}

export function adjustmentCategory(db) {
  let c = db.categories.find((x) => !x.deleted && x.group === 'Adjustments');
  if (!c) { c = stamp({ id: uid(), group: 'Adjustments', name: 'Balance correction', kind: 'both' }); db.categories.push(c); }
  return c;
}

// ---------- merging two copies (used by Google Drive sync) ----------
export function mergeDbs(a, b) {
  const out = { ...a, settings: { ...a.settings } };
  for (const k of ['accounts', 'categories', 'txs', 'budgets']) {
    const m = new Map();
    for (const r of [...(a[k] || []), ...(b[k] || [])]) {
      const prev = m.get(r.id);
      if (!prev || (r.updatedAt || 0) > (prev.updatedAt || 0)) m.set(r.id, r);
    }
    out[k] = [...m.values()];
  }
  return out;
}

// ---------- recycle bin helpers ----------
export function softDelete(rec, at = Date.now()) { rec.deleted = true; rec.deletedAt = at; rec.updatedAt = Date.now(); return rec; }
export function restoreRec(rec) { rec.deleted = false; delete rec.deletedAt; rec.updatedAt = Date.now(); return rec; }
// permanent delete keeps a small tombstone so a synced copy on another device cannot bring it back
export function purgeRec(rec) { for (const k of Object.keys(rec)) if (!['id', 'updatedAt'].includes(k)) delete rec[k]; rec.deleted = true; rec.purged = true; rec.updatedAt = Date.now(); }
export function binItems(db) {
  const out = [];
  for (const [coll, kind] of [['txs', 'tx'], ['accounts', 'account'], ['categories', 'category'], ['budgets', 'budget']]) {
    for (const r of db[coll]) if (r.deleted && !r.purged) out.push({ coll, kind, r, at: r.deletedAt || r.updatedAt || 0 });
  }
  return out.sort((a, b) => b.at - a.at);
}
export function purgeExpired(db) {
  const days = db.settings.binDays;
  if (!(days > 0)) return 0;
  const cut = Date.now() - days * 864e5; let n = 0;
  for (const it of binItems(db)) if (it.at < cut) { purgeRec(it.r); n++; }
  return n;
}
