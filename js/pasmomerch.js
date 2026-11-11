// Pasmo / Suica purchases: quick category groups, and the merchant and branch worked out from the place the card shows.
// Only suggestions: a category, merchant or branch you choose is never changed, and what you confirm is remembered for next time.
import { merchantKey, norm } from './merchants.js';
import { merchantList } from './merchantpick.js';
import { branchesOf } from './merchantset.js';

const live = (l) => (l || []).filter((x) => !x.deleted);
// the groups people use a transit card for, most used first
export const PASMO_GROUPS = [
  { id: 'conv', label: 'Convenience Stores', main: /convenien|konbini|conbini|コンビニ/i, cat: /convenien|konbini|conbini|grocer|supermarket|daily|コンビニ/i, place: /7[- ]?eleven|seven[- ]?eleven|セブン|family ?mart|ファミリーマート|ファミマ|lawson|ローソン|ministop|ミニストップ|newdays|ニューデイズ|poplar|ポプラ|daily ?yamazaki|デイリーヤマザキ|コンビニ|kiosk|キヨスク/i },
  { id: 'food', label: 'Food and Beverages', main: /food|dining|restaurant|cafe|coffee|meal/i, cat: /food|drink|beverage|dining|restaurant|cafe|coffee|meal|snack|bakery|lunch|breakfast|dinner/i, place: /starbucks|スタバ|スターバックス|doutor|ドトール|tully|タリーズ|mcdonald|マクド|mister ?donut|ミスド|yoshinoya|吉野家|sukiya|すき家|matsuya|松屋|cafe|coffee|カフェ|珈琲|bakery|パン|ベーカリー|soba|そば|蕎麦|udon|うどん|ramen|ラーメン|食堂|restaurant|レストラン|bento|弁当/i },
  { id: 'transport', label: 'Transportation', main: /train|transport/i, cat: /train|transport|bus|taxi|fare|commute|rail|metro/i, place: /bus|バス|taxi|タクシー|jr\b|metro|メトロ|railway|電鉄|鉄道|ticket|切符|定期|charge machine/i },
  { id: 'shop', label: 'Shopping and Retail', main: /shop|retail/i, cat: /shop|retail|cloth|household|daily needs|drugstore|pharmacy|book|gift|stationery/i, place: /uniqlo|ユニクロ|daiso|ダイソー|muji|無印|don ?quijote|ドン・キホーテ|drug|ドラッグ|matsumoto|マツモト|tsutaya|蔦屋|book|書店|ブック|loft|ロフト|lumine|ルミネ|atre|アトレ|mall|百貨店|department/i },
  { id: 'vend', label: 'Vending Machines', main: /vending/i, cat: /vending|drink|beverage|snack/i, place: /vending|自販機|自動販売機|jihanki|ベンディング|coca|コカ|suntory|サントリー|asahi|アサヒ|kirin|キリン|itoen|伊藤園|ジャパンビバレッジ|dydo|ダイドー|machine/i },
  { id: 'fun', label: 'Entertainment and Leisure', main: /entertain|leisure/i, cat: /entertain|leisure|fun|hobby|game|movie|cinema|music|sport|amusement/i, place: /game|ゲーム|cinema|映画|karaoke|カラオケ|bowling|ボウリング|museum|博物館|美術館|arcade|ゲーセン|gacha|ガチャ|park|パーク|onsen|温泉|toho|109/i },
];
const catsOf = (db) => live(db.categories).filter((c) => c.kind === 'expense' && !c.archived);
// the user's own categories that belong to a group (by category name or its group name), in the order the app already lists them
export function groupCats(db, gid) {
  const g = PASMO_GROUPS.find((x) => x.id === gid); if (!g) return [];
  const list = catsOf(db).filter((c) => g.cat.test(c.name) || (c.group && g.cat.test(c.group))), rank = (c) => (g.main.test(c.name) ? 0 : g.main.test(c.group || '') ? 1 : 2);
  return list.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map((x) => x.c);   // a category named for the group comes first
}
// which group a place most likely belongs to ('' when nothing says)
export function guessGroup(db, place) {
  const t = String(place || '');
  for (const g of PASMO_GROUPS) if (g.place.test(t)) return g.id;
  return '';
}
const pk = (place) => norm(place);
// categories to show first for one purchase: what you chose for this place before, then what this chain usually is, then the group's categories
export function bestCats(db, place, limit = 6) {
  const out = [], seen = new Set(), cats = catsOf(db), by = new Map(cats.map((c) => [c.id, c]));
  const add = (id) => { if (id && by.has(id) && !seen.has(id) && out.length < limit) { seen.add(id); out.push(by.get(id)); } };
  const mem = (db.settings.walletCats || {})[place]; add(mem);
  const key = merchantKey(place), counts = new Map();
  for (const t of live(db.txs)) if (t.kind === 'expense' && t.cat && t.name && /^Purchase: /.test(t.name) && merchantKey(t.name.replace(/^Purchase: /, '')) === key) counts.set(t.cat, (counts.get(t.cat) || 0) + 1);
  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([id]) => add(id));
  const g = guessGroup(db, place); if (g) groupCats(db, g).forEach((c) => add(c.id));
  return out;
}

// the pretty name of a known chain, else the name you already use for the merchant, else ''
const PRETTY = { '7-eleven': '7-Eleven', familymart: 'FamilyMart', lawson: 'Lawson', starbucks: 'Starbucks', "mcdonald's": "McDonald's", 'mister donut': 'Mister Donut', saizeriya: 'Saizeriya', yoshinoya: 'Yoshinoya', sukiya: 'Sukiya', matsuya: 'Matsuya', gusto: 'Gusto', uniqlo: 'Uniqlo', daiso: 'Daiso' };
const CHAIN_WORDS = /(?:7[- ]?)?eleven|seven[- ]?eleven|セブン[- ]?イレブン|セブン|family ?mart|ファミリーマート|ファミマ|lawson|ローソン|starbucks|スターバックス|スタバ|mcdonald'?s?|マクドナルド|マクド|mister ?donut|ミスタードーナツ|ミスド|saizeriya|サイゼリヤ|サイゼ|yoshinoya|吉野家|sukiya|すき家|matsuya|松屋|gusto|ガスト|uniqlo|ユニクロ|daiso|ダイソー/i;

// merchant and branch for a place text from the card. Order: what you confirmed for this exact place, then a chain name in the text (the rest of the text is the branch),
// then a merchant you already use. A branch you already have is matched by name first; the place text is never replaced by "used last time".
export function guessMerchantBranch(db, place) {
  const raw = String(place || '').replace(/^Purchase:\s*/i, '').trim(); if (!raw) return null;
  const mem = (db.settings.walletBranch || {})[pk(raw)];
  if (mem && (mem.merchant || mem.branch)) return { merchant: mem.merchant || '', branch: mem.branch || '', why: 'you confirmed this place before' };
  const key = merchantKey(raw), known = merchantList(db);
  let merchant = '', rest = raw;
  if (CHAIN_WORDS.test(raw)) {
    const m = raw.match(CHAIN_WORDS); rest = raw.replace(CHAIN_WORDS, ' ').replace(/[-‐‑–—・,/()（）]+/g, ' ').replace(/\s+/g, ' ').trim();
    const mk = /eleven|セブン/i.test(m[0]) ? '7-eleven' : merchantKey(m[0]), hit = known.find((x) => merchantKey(x.name) === mk || norm(x.name) === norm(mk));
    merchant = hit ? hit.name : (PRETTY[mk] || (mk ? mk.replace(/(^|\s)(\S)/g, (a, b, c) => b + c.toUpperCase()) : ''));
  } else {
    const hit = known.find((x) => norm(x.name).length >= 3 && norm(raw).includes(norm(x.name)));
    if (hit) { merchant = hit.name; rest = raw.replace(new RegExp(hit.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ').replace(/\s+/g, ' ').trim(); }
  }
  if (!merchant) return null;
  const have = branchesOf(db, merchant), nr = norm(rest);
  let branch = '', why = '';
  if (nr) {
    const hit = have.find((b) => norm(b.name) === nr) || have.find((b) => nr.length >= 2 && (norm(b.name).includes(nr) || nr.includes(norm(b.name))));
    if (hit) { branch = hit.name; why = 'matches a branch you already have'; }
    else { branch = rest; why = 'from the place on the card'; }
  }
  return { merchant, branch, why: branch ? why : 'chain name in the place', key };
}
// remember what was confirmed: the place text maps to the merchant and branch next time
export function rememberPlace(d, place, merchant, branch) {
  const raw = String(place || '').trim(); if (!raw || (!merchant && !branch)) return;
  d.settings.walletBranch = { ...(d.settings.walletBranch || {}), [pk(raw)]: { merchant: merchant || '', branch: branch || '' } };
}
