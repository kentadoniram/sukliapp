import { parseRoute } from './route.js';
// One shop, many spellings: "STARBUCKS TOKYO", "スターバックス" and "Starbucks 渋谷" become one merchant.
// Known chains are matched by name in English or Japanese; everything else drops branch words, digits and place names.
const CHAINS = [
  ['starbucks', /starbucks|スターバックス|スタバ/], ['7-eleven', /7[- ]?eleven|seven[- ]?eleven|セブン[- ]?イレブン|セブン(?!ス)/], ['familymart', /family ?mart|ファミリーマート|ファミマ/],
  ['lawson', /lawson|ローソン/], ["mcdonald's", /mcdonald|マクドナルド|マクド|マック/], ['mister donut', /mister ?donut|ミスタードーナツ|ミスド/], ['jollibee', /jollibee|ジョリビー/],
  ['saizeriya', /saizeriya|サイゼリヤ|サイゼ/], ['yoshinoya', /yoshinoya|吉野家/], ['sukiya', /sukiya|すき家/], ['matsuya', /matsuya|松屋/], ['gusto', /gusto|ガスト/],
  ['uniqlo', /uniqlo|ユニクロ/], ['daiso', /daiso|ダイソー/], ['amazon', /amazon|アマゾン/], ['netflix', /netflix|ネットフリックス/], ['spotify', /spotify|スポティファイ/],
  ['tokyo metro', /tokyo ?metro|東京メトロ/], ['pasmo', /pasmo|パスモ/], ['suica', /suica|スイカ/], ['grab', /\bgrab\b/], ['lazada', /lazada/], ['shopee', /shopee/], ['seven bank', /セブン銀行|seven bank/],
];
const PLACES = /\b(tokyo|shibuya|shinjuku|ikebukuro|ginza|akihabara|ueno|yokohama|osaka|makati|bgc|manila|branch|store|shop|station|st|ave)\b|東京|渋谷|新宿|池袋|銀座|秋葉原|上野|横浜|大阪|駅前?|支店|店/g;
// what you have taught the app: names that mean the same thing, and pairs that must stay apart ("tennis" vs "tennis socks")
let RULES = { same: {}, apart: [], related: [], relw: {} };
export const setNameRules = (r) => { RULES = { same: {}, apart: [], related: [], relw: {}, ...(r || {}) }; };
export const nameRules = () => RULES;
export const norm = (name) => String(name || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const pairKey = (a, b) => [norm(a), norm(b)].sort().join('|');
export const isApart = (a, b) => RULES.apart.includes(pairKey(a, b));
export const isRelated = (a, b) => (RULES.related || []).includes(pairKey(a, b));
export const relStrength = (a, b) => (isRelated(a, b) ? ((RULES.relw || {})[pairKey(a, b)] ?? 0.6) : 0);   // how close you said they are, 0 to 1
export const pairId = pairKey;   // same family, but its own thing and its own category
export function merchantKey(name) {
  let s = norm(name);
  if (!s) return '';
  if (RULES.same[s]) return RULES.same[s];
  for (const [key, re] of CHAINS) if (re.test(s)) return key;
  s = s.replace(PLACES, ' ').replace(/[#\d()\[\]*_\-\/.,:;'"’]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s || String(name).toLowerCase().trim();   // branch words and digits are gone; different shops stay different
}
export function sameMerchant(a, b) { const x = merchantKey(a), y = merchantKey(b); return !!x && x === y; }

// Names already in your history that look like a new one but are not yet decided: "starbucks antipolo" vs "starbucks tagaytay",
// or "tennis socks" vs "tennis". Never merged automatically: you decide.
export function similarNames(db, name, limit = 2) {
  const n = norm(name); if (n.length < 3) return [];
  const known = new Map(), cm = new Map((db.categories || []).map((c) => [c.id, c.name]));
  for (const t of db.txs) { if (t.deleted || !t.name) continue; const k = norm(t.name), e = known.get(k) || { name: t.name.trim(), n: 0, cats: new Map() }; e.n++; e.cats.set(t.cat, (e.cats.get(t.cat) || 0) + 1); known.set(k, e); }
  if (known.has(n)) return [];                                                        // an exact old name needs no question
  const toks = n.split(' '), out = [];
  for (const [k, e] of known) {
    if (k === n || isApart(n, k) || isRelated(n, k) || merchantKey(n) === merchantKey(k)) continue;
    if (parseRoute(n) && parseRoute(k)) continue;                                      // two trips are decided by their stops, not asked about
    const kt = k.split(' '), same1 = kt[0] === toks[0] && toks[0].length >= 3;
    const extends1 = n.startsWith(k + ' ') || k.startsWith(n + ' ');
    if (!(same1 && (toks.length > 1 || kt.length > 1)) && !extends1) continue;
    if (k.startsWith(n) && !k.startsWith(n + ' ')) continue;                          // still typing a longer version of the same word
    const top = [...e.cats.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({ name: e.name, key: k, count: e.n, category: top ? cm.get(top[0]) || '' : '', score: (extends1 ? 2 : 1) * e.n });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
// every undecided pair in your history, for the review screen
export function similarPairs(db, max = 12) {
  const names = new Map(); for (const t of db.txs) if (!t.deleted && t.name) { const k = norm(t.name); names.set(k, (names.get(k) || 0) + 1); }
  const keys = [...names.keys()], seen = new Set(), out = [];
  for (const a of keys) for (const b of keys) {
    if (a >= b) continue; const at = a.split(' '), bt = b.split(' ');
    if (!(at[0] === bt[0] && at[0].length >= 3 && (at.length > 1 || bt.length > 1))) continue;
    if (isApart(a, b) || isRelated(a, b) || merchantKey(a) === merchantKey(b) || seen.has(a + b) || (parseRoute(a) && parseRoute(b))) continue;
    seen.add(a + b); out.push({ a, b, score: names.get(a) + names.get(b) });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, max);
}

export function learnSame(d, a, b) {                  // d = db inside commit
  const r = d.settings.nameRules = { same: {}, apart: [], ...(d.settings.nameRules || {}) };
  const target = merchantKey(b) || norm(b), na = norm(a);
  r.same = { ...r.same, [na]: target, [norm(b)]: target };
  r.apart = r.apart.filter((k) => k !== pairKey(a, b)); r.related = (r.related || []).filter((k) => k !== pairKey(a, b)); setNameRules(r);
}
export function learnApart(d, a, b) {
  const r = d.settings.nameRules = { same: {}, apart: [], ...(d.settings.nameRules || {}) };
  const same = { ...r.same }; if (same[norm(a)] === (same[norm(b)] || merchantKey(b))) delete same[norm(a)];
  r.same = same; r.related = (r.related || []).filter((k) => k !== pairKey(a, b)); if (!r.apart.includes(pairKey(a, b))) r.apart = [...r.apart, pairKey(a, b)]; setNameRules(r);
}
export function forget(d, kind, v) {
  const r = d.settings.nameRules = { same: {}, apart: [], ...(d.settings.nameRules || {}) };
  if (kind === 'same') { const s = { ...r.same }; delete s[v]; r.same = s; } else if (kind === 'related') { r.related = (r.related || []).filter((k) => k !== v); const w = { ...(r.relw || {}) }; delete w[v]; r.relw = w; } else r.apart = r.apart.filter((k) => k !== v);
  setNameRules(r);
}

export function learnRelated(d, a, b, w = 0.6) {
  const r = d.settings.nameRules = { same: {}, apart: [], related: [], relw: {}, ...(d.settings.nameRules || {}) };
  const same = { ...r.same }; if (same[norm(a)] === (same[norm(b)] || merchantKey(b))) delete same[norm(a)];
  r.same = same; r.apart = r.apart.filter((k) => k !== pairKey(a, b));
  if (!(r.related || []).includes(pairKey(a, b))) r.related = [...(r.related || []), pairKey(a, b)];
  r.relw = { ...(r.relw || {}), [pairKey(a, b)]: Math.max(0.1, Math.min(0.95, w)) }; setNameRules(r);
}
