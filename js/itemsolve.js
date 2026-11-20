// Item price solver. Pure maths, no screens.
// You list what you bought (item, quantity) and the total. Every purchase is one equation:
//     sum( quantity x unit price x (1 + tax rate) ) = total paid        (within the receipt's rounding)
// A purchase on its own cannot be solved; with more purchases from the SAME shop, prices fall out.
// Every item gets a plain status: solved, narrowed (a range) or unknown. Nothing is ever invented from one equation.
//
// Which items share one price (the "unknown")?
//   1. Same item, different spelling or width: joined automatically (itemKey). A different SIZE is a different item.
//   2. Different items that cost the same at this shop (Pocari Sweat / Aquarius): only when the user says so (opts.same).
//      The solver can suggest it (sameCandidates) but never joins them by itself.
//   3. Merely similar items (egg sandwich / burger): never joined. They can only get a rough, labelled range (typicalFor).
import { canon, similarity } from './textnorm.js';

export const DEFAULT_RATES = { food: 0.08, other: 0.10 };

// ---------- quantities: exact, never rounded ----------
// pieces: whole numbers only. kg / g / L / ml: real decimals, up to 3 places, "." or ",".
export const UNITS = { pc: { weight: false, base: 1 }, kg: { weight: true, base: 1 }, g: { weight: true, base: 0.001 }, L: { weight: true, base: 1 }, ml: { weight: true, base: 0.001 } };
export function parseQty(text, unit = 'pc') {
  const u = UNITS[unit]; if (!u) return { ok: false, error: 'Unknown unit.' };
  let s = String(text ?? '').normalize('NFKC').trim().replace(/\s+/g, '');
  if (!s) return { ok: false, error: 'Type how many.' };
  if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');          // 1,200 is twelve hundred
  else s = s.replace(',', '.');                                       // 0,35 is 0.35
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: 'Use numbers only, like 2 or 0.35.' };
  const [w, f = ''] = s.split('.');
  if (!u.weight && f) return { ok: false, error: 'Pieces must be whole numbers. Use kg, g, L or ml for a decimal.' };
  if (f.length > 3) return { ok: false, error: 'At most 3 decimal places.' };
  const exact = parseInt(w, 10) * 1000 + (u.weight && f ? parseInt(f.padEnd(3, '0'), 10) : 0);   // thousandths as a whole number: 0.35 is exactly 350
  if (!(exact > 0)) return { ok: false, error: 'The amount must be more than zero.' };
  return { ok: true, milli: exact, text: u.weight ? (exact / 1000).toString() : String(exact / 1000), qty: exact / 1000 };
}

// ---------- item identity ----------
// size words stay part of the identity: "pocari 500ml" and "pocari 1l" are two items with two prices
const SIZE = /(\d+(?:\.\d+)?)\s*(kg|g|ml|l|個|本|枚|入|袋|パック|pk|pcs|pc)/gi;
export const sizeOf = (c) => [...String(c).matchAll(SIZE)].map((m) => m[1] + m[2].toLowerCase()).sort().join(',');
// returns the key for `name`, joining spelling variants to keys already in `known` (a Map key -> true). Pure about the Map: caller adds.
export function itemKey(name, known = new Map(), same = {}) {
  const c = canon(name); if (!c) return '';
  const mapped = same[c] != null ? canon(same[c]) : c;                // user said: same price as another item
  if (known.has(mapped)) return mapped;
  const sz = sizeOf(mapped);
  for (const k of known.keys()) if (sizeOf(k) === sz && similarity(mapped, k) >= 0.88) return k;
  return mapped;
}

// ---------- a small exact-enough simplex: minimise c.x with A x <= b, x >= 0 ----------
const EPS = 1e-9;
function simplex(c, A, b) {
  const n = c.length, m = A.length;
  const neg = b.map((v) => v < 0), na = neg.filter(Boolean).length, N = n + m + na;
  const T = [], basis = []; let ai = 0;
  for (let i = 0; i < m; i++) {
    const row = new Array(N + 1).fill(0), s = neg[i] ? -1 : 1;
    for (let j = 0; j < n; j++) row[j] = s * A[i][j];
    row[n + i] = s; row[N] = s * b[i];
    if (neg[i]) { row[n + m + ai] = 1; basis.push(n + m + ai); ai++; } else basis.push(n + i);
    T.push(row);
  }
  const run = (cost, maxCol) => {
    const r = new Array(N + 1).fill(0);                                // reduced costs, kept up to date at every pivot
    for (let j = 0; j < N; j++) r[j] = cost[j];
    for (let i = 0; i < m; i++) { const cb = cost[basis[i]]; if (cb) for (let j = 0; j <= N; j++) r[j] -= cb * T[i][j]; }
    for (let it = 0; it < 20000; it++) {
      let enter = -1, best = -1e-9;
      for (let j = 0; j < maxCol; j++) if (r[j] < best) { best = r[j]; enter = j; if (it > 400) break; }   // steepest first; first-found (Bland) if it drags on
      if (enter < 0) return 'ok';
      let leave = -1, bq = Infinity;
      for (let i = 0; i < m; i++) if (T[i][enter] > 1e-9) { const q = T[i][N] / T[i][enter]; if (q < bq - 1e-12 || (Math.abs(q - bq) <= 1e-12 && basis[i] < basis[leave])) { bq = q; leave = i; } }
      if (leave < 0) return 'unbounded';
      const piv = T[leave][enter], L = T[leave]; for (let j = 0; j <= N; j++) L[j] /= piv;
      for (let i = 0; i < m; i++) if (i !== leave) { const f = T[i][enter]; if (f !== 0) { const Ti = T[i]; for (let j = 0; j <= N; j++) Ti[j] -= f * L[j]; } }
      const f = r[enter]; if (f !== 0) for (let j = 0; j <= N; j++) r[j] -= f * L[j];
      basis[leave] = enter;
    }
    return 'ok';
  };
  if (na) {
    const c1 = new Array(N).fill(0); for (let k = n + m; k < N; k++) c1[k] = 1;
    run(c1, N);
    let w = 0; for (let i = 0; i < m; i++) w += c1[basis[i]] * T[i][N];
    if (w > 1e-6) return { status: 'infeasible' };
    for (let i = 0; i < m; i++) if (basis[i] >= n + m) {              // a leftover artificial at zero: swap it out if possible
      for (let j = 0; j < n + m; j++) if (Math.abs(T[i][j]) > 1e-7) {
        const p = T[i][j]; for (let k = 0; k <= N; k++) T[i][k] /= p;
        for (let r = 0; r < m; r++) if (r !== i) { const f = T[r][j]; if (Math.abs(f) > 0) for (let k = 0; k <= N; k++) T[r][k] -= f * T[i][k]; }
        basis[i] = j; break;
      }
    }
  }
  const c2 = new Array(N).fill(0); for (let j = 0; j < n; j++) c2[j] = c[j];
  if (run(c2, n + m) === 'unbounded') return { status: 'unbounded' };
  const x = new Array(n).fill(0); for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][N];
  return { status: 'ok', x, value: c.reduce((s, v, j) => s + v * x[j], 0) };
}

// ---------- the solver ----------
// purchases: [{ id, date, total, items: [{ name, qty | milli, unit, tax, line? }] }]   (one shop)
//   tax: 'food' | 'other' | a number like 0.08.  line: the price paid for that line (from a scanned receipt), if known.
// opts: { rates, rounding ('any' default | 'floor' | 'round' | 'ceil': how the shop rounds the tax), step (1 for yen, 0.01 for pesos), whole (prices are whole numbers; default true when step is 1),
//         typed: { name: { price, incl } }, same: { name: otherName } }
// returns { items: [{ key, names, unit, rate, status, price, low, high, lowIncl, highIncl, evidence }], used, dropped, notes }
export function solveShop(purchases, opts = {}) {
  const rates = { ...DEFAULT_RATES, ...(opts.rates || {}) }, step = opts.step ?? 1, whole = opts.whole ?? step === 1;
  const same = {}; for (const [k, v] of Object.entries(opts.same || {})) same[canon(k)] = v;
  const known = new Map(), meta = new Map();
  const rateOf = (t) => (typeof t === 'number' ? t : t === 'food' ? rates.food : rates.other);
  const eqs = [];
  // Each taxed group rounds its tax once, so the total can sit up to one step off the exact figure (how far depends on how the shop rounds).
  //   lo = how far the total may be BELOW the exact figure, hi = how far ABOVE. Unknown rounding: both ways.
  const mode = opts.rounding || 'any';
  const slack = (g) => { const u = step * g; return mode === 'floor' ? { lo: u, hi: 0 } : mode === 'ceil' ? { lo: 0, hi: u } : mode === 'round' ? { lo: u / 2, hi: u / 2 } : { lo: u, hi: u }; };
  for (const p of purchases || []) {
    const terms = new Map(); let ok = true;
    for (const it of p.items || []) {
      const key = itemKey(it.name, known, same); if (!key) { ok = false; break; }
      known.set(key, true);
      const u = UNITS[it.unit || 'pc'] || UNITS.pc, q = (it.milli != null ? it.milli / 1000 : +it.qty) * u.base, r = rateOf(it.tax);
      if (!(q > 0)) { ok = false; break; }
      const m = meta.get(key) || { key, names: [], unit: u.weight ? (it.unit === 'g' ? 'kg' : it.unit === 'ml' ? 'L' : it.unit) : 'pc', rate: r, weight: u.weight, n: 0 };
      if (!m.names.includes(it.name)) m.names.push(it.name); m.n++; meta.set(key, m);
      terms.set(key, (terms.get(key) || 0) + q * (1 + r));
      p._rates = p._rates || new Set(); p._rates.add(r);
      if (it.line != null) eqs.push({ id: p.id + ':' + key, date: p.date, line: true, terms: new Map([[key, q * (1 + r)]]), total: +it.line, ...slack(r > 0 ? 1 : 0) });
    }
    if (!ok || !(p.total > 0)) continue;
    const groups = [...(p._rates || [])].filter((r) => r > 0).length; delete p._rates;   // only a taxed group has a rounding step
    eqs.push({ id: p.id, date: p.date, terms, total: +p.total, ...slack(groups) });
  }
  const keys = [...meta.keys()], idx = new Map(keys.map((k, i) => [k, i])), n = keys.length;
  const notes = [], dropped = [];
  const out = () => keys.map((k) => ({ key: k, names: meta.get(k).names, unit: meta.get(k).unit, rate: meta.get(k).rate, status: 'unknown', price: null, low: 0, high: Infinity, lowIncl: 0, highIncl: Infinity, evidence: 0 }));
  if (!n) return { items: [], used: [], dropped, notes };

  const rowOf = (terms) => { const r = new Array(n).fill(0); for (const [k, v] of terms) r[idx.get(k)] = v; return r; };
  const rowsOf = (e) => [{ a: rowOf(e.terms), b: e.total + e.lo }, { a: rowOf(e.terms).map((v) => -v), b: -(e.total - e.hi) }];
  // what you typed yourself is always trusted
  const fixed = [];
  for (const [nm, v] of Object.entries(opts.typed || {})) {
    const key = itemKey(nm, known, same); if (!idx.has(key) || !(v && v.price >= 0)) continue;
    const m = meta.get(key), px = v.incl ? v.price / (1 + m.rate) : v.price, a = new Array(n).fill(0); a[idx.get(key)] = 1;
    fixed.push({ a, b: px + 1e-6 }, { a: a.map((q) => -q), b: -(px - 1e-6) });
  }
  const feasible = (rows) => simplex(new Array(n).fill(0), rows.map((r) => r.a), rows.map((r) => r.b)).status === 'ok';
  // newest purchase first: an older purchase that disagrees (the shop changed a price) is left out
  const order = [...eqs].sort((a, b) => (String(a.date) < String(b.date) ? 1 : String(a.date) > String(b.date) ? -1 : 0));
  let rows = [...fixed]; const used = [];
  const all = [...fixed, ...order.flatMap(rowsOf)];
  if (feasible(all)) { rows = all; for (const e of order) used.push(e.id); }      // the usual case: everything agrees, one check
  else for (const e of order) {
    const next = [...rows, ...rowsOf(e)];
    if (feasible(next)) { rows = next; used.push(e.id); } else dropped.push(e.id);
  }
  if (dropped.length) notes.push('A price may have changed: ' + dropped.length + ' older purchase' + (dropped.length > 1 ? 's' : '') + ' did not fit the newer ones and were left out.');

  const res = out();
  const bounds = () => {
    for (let k = 0; k < n; k++) {
      const c = new Array(n).fill(0); c[k] = 1;
      const lo = simplex(c, rows.map((r) => r.a), rows.map((r) => r.b));
      const hi = simplex(c.map((v) => -v), rows.map((r) => r.a), rows.map((r) => r.b));
      res[k].low = lo.status === 'ok' ? Math.max(0, lo.value) : 0;
      res[k].high = hi.status === 'ok' ? -hi.value : Infinity;
    }
  };
  bounds();
  if (whole) {                                                         // shelf prices in pieces are whole numbers: tighten, repeat
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;
      for (let k = 0; k < n; k++) {
        if (meta.get(keys[k]).weight) continue;
        const lo = Math.ceil(res[k].low - 1e-6), hi = Number.isFinite(res[k].high) ? Math.floor(res[k].high + 1e-6) : Infinity;
        if (lo > hi) continue;                                         // no whole number fits: keep the plain range
        const a = new Array(n).fill(0); a[k] = 1;
        if (lo > res[k].low + 1e-6) { rows = [...rows, { a: a.map((q) => -q), b: -lo }]; changed = true; }
        if (hi < res[k].high - 1e-6) { rows = [...rows, { a, b: hi }]; changed = true; }
      }
      if (!changed || !feasible(rows)) break;
      bounds();
    }
  }
  const evid = new Map(); for (const e of eqs) if (used.includes(e.id) && !e.line) for (const k of e.terms.keys()) evid.set(k, (evid.get(k) || 0) + 1);
  for (let k = 0; k < n; k++) {
    const r = res[k], m = meta.get(keys[k]);
    r.evidence = evid.get(keys[k]) || 0;
    if (Number.isFinite(r.high) && r.high - r.low < (whole && !m.weight ? 0.5 : 0.01 * Math.max(1, r.high))) { r.status = 'solved'; r.price = whole && !m.weight ? Math.round((r.low + r.high) / 2) : +((r.low + r.high) / 2).toFixed(2); }
    else if (Number.isFinite(r.high)) r.status = 'narrowed';
    r.lowIncl = r.low * (1 + m.rate); r.highIncl = r.high * (1 + m.rate);
    if (r.price != null) r.priceIncl = +(r.price * (1 + m.rate)).toFixed(2);
  }
  return { items: res, used, dropped, notes };
}

// ---------- relatedness helpers (suggestions only: they never change a result) ----------
// Two solved items with the very same price at this shop and in the same category: "same price as?" The user decides.
export function sameCandidates(result, catOf = () => '') {
  const solved = result.items.filter((i) => i.status === 'solved' && i.unit === 'pc'), out = [];
  for (let a = 0; a < solved.length; a++) for (let b = a + 1; b < solved.length; b++) {
    const x = solved[a], y = solved[b]; if (x.price !== y.price) continue;
    const cx = catOf(x), cy = catOf(y); if (!cx || cx !== cy) continue;
    out.push([x.key, y.key, x.price]);
  }
  return out;
}
// A rough range for an item nobody has priced yet, from SOLVED items in the same category at this shop. Always labelled "about".
export function typicalFor(result, key, catOf) {
  const me = result.items.find((i) => i.key === key); if (!me || me.status === 'solved') return null;
  const c = catOf(me); if (!c) return null;
  const sib = result.items.filter((i) => i.key !== key && i.status === 'solved' && i.unit === me.unit && catOf(i) === c);
  if (!sib.length) return null;
  const ps = sib.map((i) => i.price).sort((a, b) => a - b);
  return { low: ps[0], high: ps[ps.length - 1], from: sib.map((i) => i.key), about: true };
}
