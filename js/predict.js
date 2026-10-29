// A small, self-made category predictor. It learns from your own history and runs on the phone.
//   1. exact name lookup (bus routes, pandesal, rent ...)
//   2. naive Bayes over character trigrams + amount size for names it has not seen
// Nothing leaves the device and nothing is downloaded.

import { canon, nearest } from './textnorm.js';
const norm = canon;   // width, kana, case, branch labels and receipt codes are cleaned away

// the known name closest to a typo or variant ("starbuck" for "starbucks"); remembered per model
function fuzzy(model, name) {
  const k = norm(name);
  if (!model.fz) model.fz = new Map();
  if (model.fz.has(k)) return model.fz.get(k);
  let e = null;
  const v = model.resolve && model.resolve(name);          // the similarity graph first: it knows what you linked and its path explains the match
  if (v && model.byName.get(v.key)) e = { e: model.byName.get(v.key), score: v.score, via: v };
  if (!e) { const r = nearest(k, model.byName.keys()); e = r ? { e: model.byName.get(r.key), score: r.score } : null; }
  if (model.fz.size > 200) model.fz.clear();
  model.fz.set(k, e);
  return e;
}

export const TUNE = { ctxWeight: 1, amountWeight: 1, temp: 3 };
export const CORRECTED_WEIGHT = 3;

function features(name, amount, ctx = {}) {
  const n = ' ' + norm(name) + ' ';
  const f = [];
  for (let i = 0; i < n.length - 2; i++) f.push('c:' + n.slice(i, i + 3));
  for (const w of n.split(' ')) if (w.length > 1) f.push('w:' + w);
  for (let k = 0; k < TUNE.amountWeight; k++) if (amount > 0) f.push('a:' + Math.round(Math.log2(amount)));
  for (let k = 0; k < TUNE.ctxWeight; k++) {
    if (ctx.acct) f.push('ac:' + ctx.acct);
    if (ctx.cur) f.push('cu:' + ctx.cur);
    if (ctx.hour != null) f.push('h:' + Math.floor(ctx.hour / 4));
  }
  return f;
}
const ctxOf = (t) => ({ acct: t.acct, cur: t.cur, hour: parseInt(String(t.date).slice(11, 13), 10) });

export function buildModel(txs, kindFilter = 'expense', cats = [], resolve = null) {
  const byName = new Map();
  const classes = new Map(); // cat -> {n, feats:Map, total}
  const vocab = new Set();
  let total = 0;
  const sorted = txs.filter((t) => !t.deleted && !t.auto && !t.reval && t.kind === kindFilter && t.cat && t.name)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const t of sorted) {
    const k = norm(t.name);
    let e = byName.get(k);
    if (!e) { e = { n: 0, cats: new Map(), accts: new Map(), curs: new Map(), amts: [], last: t.date, name: t.name.trim() }; byName.set(k, e); }
    const wt = t.corrected ? CORRECTED_WEIGHT : 1;   // a category you fixed by hand teaches the model more than a guess you accepted
    e.n++;
    e.last = t.date;
    e.cats.set(t.cat, (e.cats.get(t.cat) || 0) + wt);
    e.accts.set(t.acct, (e.accts.get(t.acct) || 0) + 1);
    e.curs.set(t.cur, (e.curs.get(t.cur) || 0) + 1);
    e.amts.push(t.amount);
    if (e.amts.length > 7) e.amts.shift();
    let c = classes.get(t.cat);
    if (!c) { c = { n: 0, feats: new Map(), total: 0 }; classes.set(t.cat, c); }
    c.n += wt; total += wt;
    for (const f of features(t.name, t.amount, ctxOf(t))) {
      c.feats.set(f, (c.feats.get(f) || 0) + wt);
      c.total += wt;
      vocab.add(f);
    }
  }
  // keywords typed when a category was created: a new category is predictable before it has any history
  const kw = [];
  for (const c of cats) {
    if (c.deleted || !c.keywords || !(c.kind === kindFilter || c.kind === 'both')) continue;
    const words = String(c.keywords).split(/[,\n]/).map(norm).filter((w) => w.length >= 2);
    if (words.length) kw.push({ id: c.id, words });
  }
  return { byName, classes, vocab: vocab.size, total, kw, resolve };
}

const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export function lookup(model, name) {
  let e = model.byName.get(norm(name)), fz = false, via = null, fscore = 0.85;
  if (!e) { const f = fuzzy(model, name); if (f) { e = f.e; fz = true; via = f.via || null; fscore = Math.min(0.95, f.score); } }
  if (!e) return null;
  return { cat: top(e.cats), acct: top(e.accts), amount: median(e.amts), n: e.n, fuzzy: fz, via };
}

// returns {cats:[{id,p}], conf, exact}
export function predict(model, name, amount = 0, ctx = {}) {
  if (!model || !norm(name)) return { cats: [], conf: 0, exact: false };
  if (!model.total) return keywordOnly(model, name);
  const nb = new Map();
  const fs = features(name, amount, ctx);
  const alpha = 0.3;
  let best = -Infinity;
  const raw = [];
  for (const [cat, c] of model.classes) {
    let s = Math.log((c.n + 1) / (model.total + model.classes.size));
    for (const f of fs) s += Math.log(((c.feats.get(f) || 0) + alpha) / (c.total + alpha * model.vocab));
    raw.push([cat, s / TUNE.temp]);
    if (s / TUNE.temp > best) best = s / TUNE.temp;
  }
  let z = 0;
  for (const r of raw) { r[1] = Math.exp(r[1] - best); z += r[1]; }
  for (const [cat, v] of raw) nb.set(cat, v / z);

  let e = model.byName.get(norm(name)), fz = false, via = null, fscore = 0.85;
  if (!e) { const f = fuzzy(model, name); if (f) { e = f.e; fz = true; via = f.via || null; fscore = Math.min(0.95, f.score); } }
  const mix = new Map(nb);
  let exact = false;
  if (e) {
    exact = !fz;
    const w = (e.n / (e.n + 1.5)) * (fz ? fscore : 1);
    const cs = [...e.cats.values()].reduce((a, b) => a + b, 0);
    for (const [cat] of mix) mix.set(cat, (1 - w) * (nb.get(cat) || 0) + w * ((e.cats.get(cat) || 0) / cs));
  }
  // a keyword hit counts as strong evidence, unless the name has been seen before and always went elsewhere
  const hit = keywordHit(model, name);
  if (hit.size) {
    const w = exact ? 0.35 : 0.85;
    const share = w / hit.size;
    for (const [id, v] of [...mix]) mix.set(id, v * (1 - w));
    for (const [id] of hit) mix.set(id, (mix.get(id) || 0) + share);
  }
  const cats = [...mix.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, p]) => ({ id, p }));
  return { cats, conf: cats[0] ? cats[0].p : 0, exact, fuzzy: fz, via, keyword: hit.size > 0 };
}

function keywordHit(model, name) {
  const n = ' ' + norm(name) + ' ', hit = new Map();
  for (const k of model.kw || []) for (const w of k.words) if (n.includes(w.length < 4 ? ' ' + w + ' ' : w)) { hit.set(k.id, w); break; }
  return hit;
}
function keywordOnly(model, name) {
  const hit = keywordHit(model, name);
  if (!hit.size) return { cats: [], conf: 0, exact: false };
  const p = 0.85 / hit.size;
  const cats = [...hit.keys()].map((id) => ({ id, p }));
  return { cats, conf: p, exact: false, keyword: true };
}

// names that match what has been typed. Word-starts first, then recent and frequent ones.
// Each suggestion carries the account it is usually paid from.
export function suggest(model, text, n = 5) {
  const q = norm(text);
  if (!q || !model) return [];
  const now = Date.now(), out = [];
  for (const [k, e] of model.byName) {
    const i = k.indexOf(q);
    if (i < 0) continue;
    const wordStart = i === 0 || k[i - 1] === ' ';
    if (!wordStart && q.length < 3) continue;
    const t = Date.parse(String(e.last || '').replace(' ', 'T'));
    const days = isFinite(t) ? Math.max(0, (now - t) / 864e5) : 365;
    const score = (i === 0 ? 1000 : wordStart ? 600 : 0) + 300 * Math.exp(-days / 30) + 40 * Math.log2(1 + e.n);
    out.push({ name: e.name, n: e.n, score, acct: top(e.accts), last: e.last });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}

// Category guesses for text that may be only a few letters long (each keystroke re-runs this).
// Sources: recent names that start like the text (their usual category), category names, keywords, group names.
export function catCandidates(model, cats, text, kind, n = 6) {
  const q = String(text || '').trim().toLowerCase();
  if (!q) return [];
  const toks = q.split(/[^a-z0-9぀-ヿ一-鿿]+/).filter(Boolean);
  const hit = new Map();
  const bump = (id, v, why) => { const o = hit.get(id) || { id, s: 0, best: 0, why }; o.s += v; if (v > o.best) { o.best = v; o.why = why; } hit.set(id, o); };
  for (const s of suggest(model, text, 6)) {
    const lk = lookup(model, s.name);
    if (lk && lk.cat) bump(lk.cat, 8 + Math.min(12, s.score / 40), `like “${s.name}”`);
  }
  for (const c of cats) {
    if (c.deleted || !(c.kind === kind || c.kind === 'both')) continue;
    const nm = c.name.toLowerCase(), gp = c.group.toLowerCase();
    const kws = String(c.keywords || '').toLowerCase().split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
    for (const t of toks) {
      if (nm.split(/[^a-z0-9]+/).some((w) => w && w.startsWith(t))) bump(c.id, 12, 'name matches');
      else if (gp.split(/[^a-z0-9]+/).some((w) => w && w.startsWith(t))) bump(c.id, 5, 'group matches');
      if (kws.some((k) => k.startsWith(t) || (k.length >= 3 && t.startsWith(k)))) bump(c.id, 9, 'keyword');
    }
  }
  return [...hit.values()].sort((a, b) => b.s - a.s).slice(0, n);
}

// "Looks like": names whose usual amount is close to the typed amount (in the same currency)
export function byAmount(model, amount, cur, n = 6) {
  if (!model || !(amount > 0)) return [];
  const now = Date.now(), out = [];
  for (const e of model.byName.values()) {
    if (cur && top(e.curs) !== cur) continue;
    const m = median(e.amts); if (!(m > 0)) continue;
    const d = Math.abs(Math.log(amount / m));
    const exact = e.amts.some((x) => Math.abs(x - amount) < 0.005);
    if (d > 0.16 && !exact) continue;
    const t = Date.parse(String(e.last || '').replace(' ', 'T')), days = isFinite(t) ? Math.max(0, (now - t) / 864e5) : 365;
    const score = (exact ? 150 : 0) + (1 - Math.min(1, d / 0.16)) * 100 + 40 * Math.log2(1 + e.n) + 60 * Math.exp(-days / 30);
    out.push({ name: e.name, n: e.n, score, acct: top(e.accts), cat: top(e.cats), amount: m, exact });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}
export function recentNames(model, n = 6) {
  return [...model.byName.values()].sort((a, b) => (a.last < b.last ? 1 : -1)).slice(0, n).map((e) => ({ name: e.name, n: e.n, acct: top(e.accts), cat: top(e.cats), amount: median(e.amts) }));
}
