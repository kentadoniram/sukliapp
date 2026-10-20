// Category for each receipt item. Order: what you chose before for this item, then a word list (Japanese and English)
// matched to categories you already have, otherwise no guess (the item then follows the receipt's category). Nothing is created for you.
import { norm } from './merchants.js';
import { similarity } from './textnorm.js';

// concept: [words, category names to look for in your own list, best first]
const CONCEPTS = [
  ['personal', /シャンプー|リンス|コンディショナー|トリートメント|ボディソープ|石鹸|せっけん|洗顔|化粧|クリーム|ローション|カミソリ|整髪|制汗|デオドラント|ナプキン|マスク|shampoo|conditioner|soap|lotion|razor|deodorant|body wash|facial/i, ['personal care', 'toiletr', 'facial wash', 'personal', 'household supplies']],
  ['dental', /歯磨|歯ブラシ|マウスウォッシュ|デンタル|toothpaste|toothbrush/i, ['dental', 'personal care', 'toiletr', 'household supplies']],
  ['medicine', /薬|ビタミン|サプリ|絆創膏|目薬|のど|ばんそうこう|vitamin|medicine|bandage/i, ['medicine', 'health', 'personal care']],
  ['cleaning', /洗剤|柔軟剤|漂白|ティッシュ|トイレット|ゴミ袋|ごみ袋|スポンジ|ラップ|アルミ|キッチンペーパー|電池|食器|detergent|tissue|toilet paper|trash bag|sponge/i, ['household supplies', 'house items', 'household']],
  ['drinks', /水|茶|コーヒー|珈琲|ボス|ジュース|コーラ|サイダー|炭酸|ビール|酒|ワイン|ハイボール|チューハイ|牛乳|豆乳|ミネラル|ドリンク|サントリー|アサヒ|キリン|water|juice|soda|cola|beer|wine|tea|coffee|milk|drink/i, ['drinks', 'beverage', 'grocery']],
  ['snack', /菓子|チョコ|スナック|クッキー|ポテト|アイス|ガム|飴|あめ|ケーキ|プリン|せんべい|煎餅|グミ|ビスケット|snack|chocolate|candy|cookie|ice cream|chips/i, ['snack', 'grocery']],
  ['meat', /牛|豚|鶏|とり肉|肉|ハム|ベーコン|ソーセージ|焼豚|チキン|ひき肉|ステーキ|ミンチ|beef|pork|chicken|meat|ham|bacon|sausage/i, ['grocery', 'home meals', 'food']],
  ['fish', /魚|鮭|さけ|サーモン|刺身|さば|鯖|ツナ|えび|海老|エビ|いか|たこ|貝|tuna|salmon|fish|shrimp/i, ['grocery', 'home meals', 'food']],
  ['produce', /野菜|果物|トマト|キャベツ|りんご|リンゴ|バナナ|レタス|じゃがいも|玉ねぎ|ほうれん|きゅうり|にんじん|人参|みかん|いちご|ぶどう|ねぎ|もやし|vegetable|fruit|tomato|apple|banana|onion|potato/i, ['fruits & vegetables', 'fruits', 'grocery']],
  ['meal', /弁当|おにぎり|サンド|寿司|すし|丼|惣菜|フライ|メンチ|コロッケ|唐揚|からあげ|カツ|サラダ|うどん|そば|ラーメン|パスタ|カレー|餃子|bento|sandwich|sushi|salad|noodle|curry/i, ['home meals', 'grocery', 'lunch']],
  ['staple', /米|卵|たまご|豆腐|納豆|パン|ヨーグルト|チーズ|バター|醤油|味噌|油|砂糖|塩|調味|小麦粉|ケチャップ|マヨ|だし|rice|egg|tofu|bread|yogurt|cheese|butter|sauce|flour|sugar/i, ['grocery', 'home meals']],
];
const find = (cats, pats) => { for (const p of pats) { const c = cats.find((x) => x.name.toLowerCase().includes(p)); if (c) return c; } return null; };

export function itemCatIndex(db) {
  const rows = new Map();                                                 // item name -> { catId -> count }
  const add = (n, c, w = 1) => { const k = norm(n); if (!k || !c) return; const m = rows.get(k) || new Map(); m.set(c, (m.get(c) || 0) + w); rows.set(k, m); };
  for (const t of db.txs) if (!t.deleted && t.items) for (const i of t.items) if (i.n && i.cat) add(i.n, i.cat);
  for (const [k, c] of Object.entries(db.settings.itemCats || {})) add(k, c, 5);      // corrections made in the scanner count more
  return rows;
}
export function guessItemCat(db, name, index = itemCatIndex(db)) {
  const cats = db.categories.filter((c) => !c.deleted && c.kind === 'expense'), n = String(name || '').trim();
  if (n.length < 2) return null;
  const k = norm(n);
  let m = index.get(k), how = 'you categorised this item before';
  if (!m) { let best = 0, bk = null; for (const [kk] of index) { const s = similarity(k, kk); if (s > best) { best = s; bk = kk; } } if (best >= 0.85) { m = index.get(bk); how = 'like an item you categorised before'; } }
  if (m) { const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; if (cats.some((c) => c.id === top[0])) return { cat: top[0], conf: Math.min(0.95, 0.7 + 0.05 * top[1]), how }; }
  for (const [concept, re, names] of CONCEPTS) {
    if (!re.test(n.normalize('NFKC'))) continue;
    const c = find(cats, names); if (c) return { cat: c.id, conf: 0.6, how: `looks like ${concept}` };
  }
  return null;
}
// remember a correction made in the scanner
export function learnItemCat(d, name, catId) { const k = norm(name); if (!k || !catId) return; d.settings.itemCats = { ...(d.settings.itemCats || {}), [k]: catId }; }
