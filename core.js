// Core data layer: one JSON database kept in IndexedDB, plus the money maths.
// Every record has an id and updatedAt so two phones can merge their copies.

const DB_NAME = 'sukli';
const STORE = 'kv';
const KEY = 'db';

export const uid = () =>
  (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const BASE = 'PHP';

export const CUR = {
  PHP: { sym: '₱', dec: 2 },
  JPY: { sym: '¥', dec: 0 },
  USD: { sym: '$', dec: 2 },
  USDT: { sym: '₮', dec: 2 },
  BTC: { sym: '₿', dec: 6 },
  EUR: { sym: '€', dec: 2 },
};

// "hide amounts" (the eye button): per device, kept in localStorage, never synced
export const priv = {
  on: (() => { try { return localStorage.getItem('sukli-hide') === '1'; } catch { return false; } })(),
  set(v) { this.on = !!v; try { localStorage.setItem('sukli-hide', this.on ? '1' : '0'); } catch { /* blocked */ } },
};

export function fmt(n, cur = BASE, opts = {}) {
  const c = CUR[cur] || { sym: cur + ' ', dec: 2 };
  if (priv.on && !opts.force) return c.sym + '•••••';
  const dec = opts.round ? 0 : c.dec;
  const abs = Math.abs(n || 0);
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const sign = n < 0 && abs >= Math.pow(10, -dec) / 2 ? '−' : (opts.sign && n > 0 ? '+' : '');
  return sign + c.sym + s;
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
      showHome: true, rates: {}, excludeGroups: ['Capital Loss/Distribution', 'Crypto Buy'], lastAcct: '',
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
  return state;
}
export const get = () => state;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

export function commit(mutator) {
  mutator(state);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeRaw(state), 150);
  subs.forEach((f) => f(state));
}
// saves without redrawing: for text boxes, where a redraw would steal focus from the next box
export function commitQuiet(mutator) {
  mutator(state);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeRaw(state), 150);
}
export async function flush() { clearTimeout(saveTimer); await writeRaw(state); }

export function replaceAll(next) {
  state = next;
  state.settings = { ...emptyDb().settings, ...state.settings };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeRaw(state), 150);
  subs.forEach((f) => f(state));
}

export const stamp = (rec) => { rec.updatedAt = Date.now(); return rec; };
export const live = (arr) => arr.filter((x) => !x.deleted);
export const accountMap = (db) => new Map(db.accounts.map((a) => [a.id, a]));
export const catMap = (db) => new Map(db.categories.map((c) => [c.id, c]));

// ---------- maths ----------
export function balances(db) {
  const b = new Map();
  for (const a of db.accounts) if (!a.deleted) b.set(a.id, a.open || 0);
  const add = (id, v) => { if (b.has(id)) b.set(id, b.get(id) + v); };
  for (const t of db.txs) {
    if (t.deleted) continue;
    if (t.kind === 'income') add(t.acct, t.amount);
    else if (t.kind === 'expense') add(t.acct, -t.amount);
    else if (t.kind === 'transfer') {
      add(t.acct, -t.amount);
      add(t.toAcct, t.toAmount != null ? t.toAmount : t.amount);
    }
  }
  return b;
}

export function sortedTxs(db) {
  return live(db.txs).slice().sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : (b.updatedAt || 0) - (a.updatedAt || 0));
}

// base-currency value of 1 unit of `cur`: manual rate, else the one used on the newest entry
export function rateFor(db, cur) {
  if (cur === db.settings.base) return 1;
  if (db.settings.rates && db.settings.rates[cur] > 0) return db.settings.rates[cur];
  let best = null;
  for (const t of db.txs) {
    if (t.deleted || t.cur !== cur || !(t.fx > 0)) continue;
    if (!best || t.date > best.date) best = t;
  }
  return best ? best.fx : 0;
}

const itemsMatch = (t) =>
  t.items && t.items.length && Math.abs(t.items.reduce((s, i) => s + (+i.amt || 0), 0) - t.amount) < 0.01;

export const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };

// every money movement of a month in base currency, split by item when a receipt was itemised
export function monthParts(db, ym) {
  const ex = new Set(db.settings.excludeGroups || []);
  const cats = catMap(db), out = [];
  for (const t of db.txs) {
    if (t.deleted || t.kind === 'transfer' || !t.date.startsWith(ym)) continue;
    const fx = t.fx || 1, split = itemsMatch(t);
    const parts = split ? t.items.map((i) => ({ cat: i.cat || t.cat, v: i.amt * fx, label: i.n || t.name }))
      : [{ cat: t.cat, v: t.amount * fx, label: t.name }];
    for (const p of parts) {
      const c = cats.get(p.cat), g = c ? c.group : 'Uncategorized';
      if (ex.has(g)) continue;
      out.push({ t, kind: t.kind, cat: p.cat, group: g, v: p.v, label: p.label || t.name || (c ? c.name : ''), split });
    }
  }
  return out;
}

export function monthStats(db, ym) {
  const ex = new Set(db.settings.excludeGroups || []);
  const cats = catMap(db);
  const out = { income: 0, spent: 0, byGroup: new Map(), byCat: new Map(), count: 0 };
  for (const t of db.txs) {
    if (t.deleted || t.kind === 'transfer' || !t.date.startsWith(ym)) continue;
    out.count++;
    const fx = t.fx || 1;
    const parts = itemsMatch(t)
      ? t.items.map((i) => ({ cat: i.cat || t.cat, v: i.amt * fx }))
      : [{ cat: t.cat, v: t.amount * fx }];
    for (const p of parts) {
      const c = cats.get(p.cat);
      const g = c ? c.group : 'Uncategorized';
      if (ex.has(g)) continue;
      if (t.kind === 'income') out.income += p.v;
      else {
        out.spent += p.v;
        out.byGroup.set(g, (out.byGroup.get(g) || 0) + p.v);
        const k = p.cat || 'none';
        out.byCat.set(k, (out.byCat.get(k) || 0) + p.v);
      }
    }
  }
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
    if (t.deleted || t.kind !== kind || t.date < cutoff || !t.name) continue;
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
  income: { Employer: ['Salary'], Earn: ['Interest'], Others: ['Other income'] },
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
