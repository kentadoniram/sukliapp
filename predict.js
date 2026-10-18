// A small, self-made category predictor. It learns from your own history and runs on the phone.
//   1. exact name lookup (bus routes, pandesal, rent ...)
//   2. naive Bayes over character trigrams + amount size for names it has not seen
// Nothing leaves the device and nothing is downloaded.

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export const TUNE = { ctxWeight: 1, amountWeight: 1, temp: 3 };

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

export function buildModel(txs, kindFilter = 'expense', cats = []) {
  const byName = new Map();
  const classes = new Map(); // cat -> {n, feats:Map, total}
  const vocab = new Set();
  let total = 0;
  const sorted = txs.filter((t) => !t.deleted && t.kind === kindFilter && t.cat && t.name)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const t of sorted) {
    const k = norm(t.name);
    let e = byName.get(k);
    if (!e) { e = { n: 0, cats: new Map(), accts: new Map(), amts: [], last: t.date, name: t.name.trim() }; byName.set(k, e); }
    e.n++;
    e.last = t.date;
    e.cats.set(t.cat, (e.cats.get(t.cat) || 0) + 1);
    e.accts.set(t.acct, (e.accts.get(t.acct) || 0) + 1);
    e.amts.push(t.amount);
    if (e.amts.length > 7) e.amts.shift();
    let c = classes.get(t.cat);
    if (!c) { c = { n: 0, feats: new Map(), total: 0 }; classes.set(t.cat, c); }
    c.n++; total++;
    for (const f of features(t.name, t.amount, ctxOf(t))) {
      c.feats.set(f, (c.feats.get(f) || 0) + 1);
      c.total++;
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
  return { byName, classes, vocab: vocab.size, total, kw };
}

const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export function lookup(model, name) {
  const e = model.byName.get(norm(name));
  if (!e) return null;
  return { cat: top(e.cats), acct: top(e.accts), amount: median(e.amts), n: e.n };
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

  const e = model.byName.get(norm(name));
  const mix = new Map(nb);
  let exact = false;
  if (e) {
    exact = true;
    const w = e.n / (e.n + 1.5);
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
  return { cats, conf: cats[0] ? cats[0].p : 0, exact, keyword: hit.size > 0 };
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

// names that match what has been typed, most-used first
export function suggest(model, text, n = 5) {
  const q = norm(text);
  if (!q || !model) return [];
  const out = [];
  for (const [k, e] of model.byName) {
    const i = k.indexOf(q);
    if (i < 0) continue;
    out.push({ name: e.name, n: e.n, score: (i === 0 ? 1000 : 0) + e.n });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}
