// Name similarity as a weighted graph.
//   node  = a name you have used (cleaned with canon())
//   edge  = "these two may be the same place or item", with a weight from 0 to 1
//           you   1.00  you pressed "Same"
//           chain 0.95  a known chain or the same cleaned merchant ("Starbucks 渋谷" / "スターバックス")
//           text  <1    spelling and shared words (never 1, only you can make a match certain)
//   "Different" removes the edge for good.
// A new name is attached to the graph and the BEST path to every known name is searched. A path is as strong as the
// product of its edges, so it is a least-cost path problem with cost = -ln(weight) (Dijkstra). The path is the explanation.
import { canon, similarity } from './textnorm.js';
import { routeRelation } from './route.js';
import { norm as plain, merchantKey, isApart, nameRules, relStrength } from './merchants.js';

export const MIN_EDGE = 0.55;       // weaker links are not drawn
export const MIN_MATCH = 0.6;       // a whole path weaker than this is not used for prediction
const STOP = new Set(['the', 'and', 'of', 'shop', 'store', 'branch', 'cafe', 'restaurant', 'and', 'co', 'inc']);
const toks = (k) => k.split(' ').filter((t) => t.length >= 2 && !STOP.has(t));

export function textWeight(ka, kb) {
  const a = toks(ka), b = toks(kb);
  const common = a.filter((t) => b.includes(t)).length;
  const dice = a.length + b.length ? (2 * common) / (a.length + b.length) : 0;
  // one shared first word ("mang inasal") is a weak hint on its own: different shops share words
  return Math.min(0.9, Math.max(similarity(ka, kb), dice * 0.95));
}

export function buildGraph(db) {
  const nodes = new Map();       // key -> {key, name, n, cats}
  const catName = new Map((db.categories || []).map((c) => [c.id, c.name]));
  for (const t of db.txs) {
    if (t.deleted || !t.name || t.kind === 'transfer') continue;
    const k = canon(t.name); if (!k) continue;
    let e = nodes.get(k); if (!e) { e = { key: k, name: t.name.trim(), n: 0, cats: new Map() }; nodes.set(k, e); }
    e.n++; if (t.cat) e.cats.set(t.cat, (e.cats.get(t.cat) || 0) + 1);
  }
  for (const e of nodes.values()) { const top = [...e.cats.entries()].sort((a, b) => b[1] - a[1])[0]; e.cat = top ? catName.get(top[0]) || '' : ''; }
  const adj = new Map([...nodes.keys()].map((k) => [k, []]));
  const index = new Map();       // word -> node keys, so pairs are only compared when they share a word
  for (const k of nodes.keys()) for (const t of toks(k)) { if (!index.has(t)) index.set(t, []); index.get(t).push(k); }
  const R = nameRules();
  const link = (a, b, w, type) => {
    if (a === b) return;
    const ea = adj.get(a), old = ea.find((x) => x.to === b);
    if (old) { if (w > old.w) { old.w = w; old.type = type; adj.get(b).find((x) => x.to === a).w = w; adj.get(b).find((x) => x.to === a).type = type; } return; }
    ea.push({ to: b, w, type }); adj.get(b).push({ to: a, w, type });
  };
  const seen = new Set();
  for (const list of index.values()) {
    if (list.length > 60) continue;                      // a word like "cafe" shared by everything says nothing
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], id = a < b ? a + '|' + b : b + '|' + a;
      if (seen.has(id)) continue; seen.add(id);
      const na = nodes.get(a).name, nb = nodes.get(b).name;
      if (isApart(na, nb)) continue;
      const rr = routeRelation(na, nb);                    // trips: the way back is related, never the same; another route is another route
      if (rr === 'reverse') { link(a, b, 0.9, 'reverse'); continue; }
      if (rr === 'same') { link(a, b, 0.95, 'chain'); continue; }
      if (rr === 'other') continue;
      const w = textWeight(a, b); if (w >= MIN_EDGE) link(a, b, w, 'text');
    }
  }
  // pairs you called "related": drawn with the strength you gave, never used to copy a category
  for (const k of R.related || []) { const [pa, pb] = k.split('|'), a = canon(pa), b = canon(pb); if (nodes.has(a) && nodes.has(b)) link(a, b, relStrength(pa, pb) || 0.6, 'related'); }
  // chains and your own "Same" answers
  const byRule = new Map();
  for (const e of nodes.values()) {
    const p = plain(e.name), key = R.same[p] || R.same[plain(e.key)];
    const mk = merchantKey(e.name);
    const g = key || (mk && mk !== plain(e.name) ? mk : '');
    if (g) { if (!byRule.has(g)) byRule.set(g, []); byRule.get(g).push({ k: e.key, you: !!key }); }
  }
  for (const list of byRule.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (isApart(nodes.get(list[i].k).name, nodes.get(list[j].k).name)) continue;
    link(list[i].k, list[j].k, list[i].you && list[j].you ? 1 : 0.95, list[i].you && list[j].you ? 'you' : 'chain');
  }
  return { nodes, adj, index };
}

// best path from a name to every known name. Returns [{key, score, path:[{from,to,w,type}]}] strongest first.
export function matches(g, name, limit = 3) {
  const q = canon(name); if (!q) return [];
  const edges = [];                                       // the new name attached to the graph
  const cand = new Set();
  for (const t of toks(q)) for (const k of g.index.get(t) || []) cand.add(k);
  if (q.length >= 4) for (const k of g.nodes.keys()) if (Math.abs(k.length - q.length) <= Math.max(2, q.length * 0.3)) cand.add(k);
  for (const k of cand) {
    if (k === q) { edges.push({ to: k, w: 1, type: 'same' }); continue; }
    if (isApart(name, g.nodes.get(k).name)) continue;
    let w = textWeight(q, k), type = 'text';
    const rr = routeRelation(name, g.nodes.get(k).name);
    if (rr === 'other') continue;
    if (rr === 'reverse') { w = 0.9; type = 'reverse'; } else if (rr === 'same') { w = 0.95; type = 'chain'; }
    if (merchantKey(name) && merchantKey(name) === merchantKey(g.nodes.get(k).name)) { w = Math.max(w, 0.95); type = 'chain'; }
    const r = nameRules().same[plain(name)];                                   // a name you already linked
    if (r && (r === nameRules().same[plain(g.nodes.get(k).name)] || r === merchantKey(g.nodes.get(k).name))) { w = 1; type = 'you'; }
    if (w >= MIN_EDGE) edges.push({ to: k, w, type });
  }
  // Dijkstra on cost = -ln(weight); tiny graphs, so a simple array is fine
  const best = new Map(), todo = [];
  for (const e of edges) { const c = -Math.log(e.w); if (!best.has(e.to) || c < best.get(e.to).c) { best.set(e.to, { c, prev: null, e: { from: q, to: e.to, w: e.w, type: e.type } }); } }
  const done = new Set();
  for (;;) {
    let u = null;
    for (const [k, v] of best) if (!done.has(k) && (u === null || v.c < best.get(u).c)) u = k;
    if (u === null || Math.exp(-best.get(u).c) < MIN_MATCH) break;
    done.add(u);
    for (const x of g.adj.get(u) || []) {
      if (done.has(x.to) || x.type === 'related') continue;          // related = own category: not a way to a match
      const c = best.get(u).c - Math.log(x.w);
      if (!best.has(x.to) || c < best.get(x.to).c) best.set(x.to, { c, prev: u, e: { from: u, to: x.to, w: x.w, type: x.type } });
    }
  }
  const out = [];
  for (const [k, v] of best) {
    const score = Math.exp(-v.c); if (score < MIN_MATCH) continue;
    const path = []; for (let c = k; ; c = best.get(c).prev) { path.unshift(best.get(c).e); if (best.get(c).prev === null) break; }
    out.push({ key: k, name: g.nodes.get(k).name, n: g.nodes.get(k).n, cat: g.nodes.get(k).cat, score, path });
  }
  return out.sort((a, b) => b.score - a.score || b.n - a.n).slice(0, limit);
}

export const makeResolver = (g) => (name) => { const m = matches(g, name, 1)[0]; return m ? { key: m.key, score: m.score, path: m.path } : null; };

const WHY = { you: 'you said same', chain: 'same chain', text: 'similar spelling', same: 'same name', related: 'you said related', reverse: 'return trip: same stops, other direction' };
export const edgeText = (e) => `${Math.round(e.w * 100)}% ${WHY[e.type] || e.type}`;
// "mang inasal antipolo → mang inasal tagaytay (67% similar spelling) → mang inasal (100% you said same)"
export const explain = (m) => (m ? [m.path[0].from, ...m.path.map((e) => `${e.to} (${edgeText(e)})`)].join(' → ') : '');

// groups of names that belong together (strong links only): connected components
export function clusters(g, min = 0.8) {
  const seen = new Set(), out = [];
  for (const k of g.nodes.keys()) {
    if (seen.has(k)) continue;
    const comp = [], q = [k]; seen.add(k);
    while (q.length) { const u = q.pop(); comp.push(u); for (const x of g.adj.get(u)) if (x.w >= min && x.type !== 'reverse' && !seen.has(x.to)) { seen.add(x.to); q.push(x.to); } }
    if (comp.length > 1) out.push(comp.sort((a, b) => g.nodes.get(b).n - g.nodes.get(a).n));
  }
  return out.sort((a, b) => b.length - a.length);
}
// the part of the graph around one name, for drawing
export function neighbourhood(g, key, max = 9) {
  const first = [...(g.adj.get(key) || [])].sort((a, b) => b.w - a.w).slice(0, max - 1);
  const keys = [key, ...first.map((x) => x.to)], set = new Set(keys), edges = [];
  for (const a of keys) for (const x of g.adj.get(a) || []) if (set.has(x.to) && a < x.to) edges.push({ a, b: x.to, w: x.w, type: x.type });
  return { keys, edges };
}
