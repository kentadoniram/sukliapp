// Spending by group: a rough "how much did I spend on drinks / snacks / toiletries" without item names or prices.
// On an entry (Advanced mode) you count items per group: 3 drinks, 2 snacks. With many such receipts the app works out about what
// each group costs (js/catsolve.js) and shows an "about" amount with a range. It never changes a saved total, a budget or a category.
import { button } from './components.js';
import { get, commit, fmt, HOME, homeFx, nowStamp, shiftMonth } from './core.js';
import { ACT, esc, ic, toast, confirmDialog } from './ui.js';
import { hdr, ui } from './screens.js';
import { openEntry } from './entry.js';
import { estimateSpending, DEFAULT_CATS } from './catsolve.js';
import { parseQty } from './itemsolve.js';
import { canon } from './textnorm.js';
import { tripEntryIds } from './trips.js';

const live = (l) => l.filter((x) => !x.deleted);
const money = (n) => fmt(n, HOME, { round: true });
const today = () => nowStamp().slice(0, 10);
const UNIT_WORD = { pc: 'each', kg: 'per kg' };

// the groups: { name: { price: usual price guess in yen, unit: 'pc' | 'kg' } }. Split by PRICE LEVEL (drinks and ready meals apart), not by type of food.
export function groupsOf(db) {
  const g = db.settings && db.settings.spendGroups, out = {};
  if (g && Object.keys(g).length) Object.assign(out, g);
  else for (const [k, v] of Object.entries(DEFAULT_CATS)) out[k] = { price: v, unit: k === 'meat and fish' ? 'kg' : 'pc' };
  for (const t of db.txs || []) if (!t.deleted) for (const c of t.counts || []) if (!out[c.g]) out[c.g] = { price: 300, unit: 'pc' };   // a group used on an entry always exists, even after a restore
  return out;
}
export const unitOf = (db, g) => (groupsOf(db)[g] || {}).unit || 'pc';
export function addGroup(name, unit) {
  const nm = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 30).toLowerCase(); if (!nm) return '';
  commit((d) => { const g = { ...groupsOf(d) }; if (!g[nm]) g[nm] = { price: 300, unit: unit === 'kg' ? 'kg' : 'pc' }; d.settings.spendGroups = g; });
  return nm;
}
// the lines to save on an entry: [{ g, n }] with n exact (0.35 stays 0.35). Returns { lines } or { error }.
export function countLines(db, rows) {
  const lines = [];
  for (const r of rows || []) {
    if (!r.g && !String(r.n || '').trim()) continue;
    if (!r.g) return { error: 'Choose a group for each count, or remove the row.' };
    const q = parseQty(r.n, unitOf(db, r.g));
    if (!q.ok) return { error: `${r.g}: ${q.error}` };
    lines.push({ g: r.g, n: q.qty });
  }
  return { lines };
}

// ---- the estimate for a period ----
export function rangeOf(key) {
  const t = today(), ym = t.slice(0, 7), y = +t.slice(0, 4);
  if (key === 'last') return { from: shiftMonth(ym, -1) + '-01', to: shiftMonth(ym, -1) + '-31', label: 'last month' };
  if (key === '3m') return { from: shiftMonth(ym, -2) + '-01', to: t, label: 'the last 3 months' };
  if (key === 'year') return { from: y + '-01-01', to: t, label: 'this year' };
  if (key === 'all') return { from: '0000-01-01', to: '9999-12-31', label: 'all time' };
  return { from: ym + '-01', to: ym + '-31', label: 'this month' };
}
export function spendReport(db, key = 'month') {
  const rg = rangeOf(key), guess = {};
  for (const [k, v] of Object.entries(groupsOf(db))) guess[k] = v.price;
  const purchases = [], inRange = new Set(); let spentAll = 0, onTrips = 0; const tripIds = (() => { try { return tripEntryIds(db); } catch { return new Set(); } })();
  for (const t of live(db.txs)) {
    if (t.kind !== 'expense') continue;
    const fx = homeFx(db, t.cur) || 1, d = String(t.date).slice(0, 10), inR = d >= rg.from && d <= rg.to;
    if (inR) { spentAll += t.amount * fx; if (tripIds.has(t.id)) onTrips += t.amount * fx; }
    if (!(t.counts && t.counts.length)) continue;
    purchases.push({ id: t.id, date: d, shop: t.merchant || canon(t.name), total: t.amount * fx, lines: t.counts.map((c) => ({ cat: c.g, n: c.n })) });
    if (inR) inRange.add(t.id);
  }
  const res = estimateSpending(purchases, { cats: guess, seed: 7, boot: 80, report: (r) => inRange.has(r.id) });
  return { res, range: rg, spentAll, onTrips, counted: inRange.size, countedAll: purchases.length };
}

const QUALITY = { good: 'fairly sure', rough: 'rough', 'very rough': 'very rough', guess: 'starting guess only' };
const RANGES = [['month', 'This month'], ['last', 'Last month'], ['3m', '3 months'], ['year', 'This year'], ['all', 'All']];

export function spend(db) {
  const key = ui.spendRange || 'month', { res, range, spentAll, onTrips, counted, countedAll } = spendReport(db, key), groups = groupsOf(db);
  const chips = `<div class="chips" role="group" aria-label="Period">${RANGES.map(([k, l]) => `<button type="button" class="chip ${key === k ? 'on' : ''}" data-act="spend-range" data-k="${k}" aria-pressed="${key === k}">${l}</button>`).join('')}</div>`;
  let body;
  if (!countedAll) {
    body = `<section class="card"><h2>How It Works</h2>
      <p>When you add an expense, tap <b>Count by group</b> and say how many drinks, snacks and so on you bought. No names and no prices needed.</p>
      <p>After about 10 receipts Sukli can say roughly how much you spend on each group. It is always a rough "about", never exact.</p>
      <div class="btnrow">${button({ label: 'Add an entry', kind: 'primary', act: 'spend-add' })}</div></section>`;
  } else {
    const rows = Object.entries(res.spend).filter(([, v]) => v.amount > 0.5).sort((a, b) => b[1].amount - a[1].amount), top = rows.length ? rows[0][1].amount : 1;
    const share = spentAll > 0 ? Math.round(res.total / spentAll * 100) : 0;
    body = `<section class="card"><p class="hint">${counted ? `${counted} receipt${counted === 1 ? '' : 's'} with counts in ${range.label}, ${money(res.total)}${spentAll > 0 ? ` (${share}% of your spending then)` : ''}.` : `No receipts with counts in ${range.label}.`}
      ${onTrips > 0.5 ? ` Of all your spending then, ${money(onTrips)} was on trips or events.` : ''}
      ${counted && counted < 8 ? ' Only a few receipts so far, so treat these as rough.' : ''}</p>
      ${rows.map(([g, v]) => { const p = res.prices[g], u = UNIT_WORD[(groups[g] || {}).unit || 'pc'];
        return `<div class="sgrow"><div class="sgtop"><b>${esc(g)}</b><span>about ${money(v.amount)}</span></div>
          <div class="sgbar" aria-hidden="true"><i style="width:${Math.max(3, Math.round(v.amount / top * 100))}%"></i></div>
          <small>${money(v.low)} to ${money(v.high)} · about ${money(p.price)} ${u} · ${p.receipts} receipt${p.receipts === 1 ? '' : 's'} · ${QUALITY[p.quality] || ''}</small></div>`; }).join('') || '<p class="hint">Nothing in this period yet.</p>'}
      ${res.hints.length ? `<p class="hint">${esc(res.hints[0])}</p>` : ''}
      <p class="hint">These are estimates. They never change your saved totals or budgets.</p></section>`;
  }
  const used = new Set(live(db.txs).flatMap((t) => (t.counts || []).map((c) => c.g)));
  const mine = Object.keys(groups);
  body += `<section class="card"><h2>Groups</h2><p class="hint">Make groups by price level, for example drinks and ready meals apart, because that is what lets Sukli tell them apart.</p>
    <div class="chips">${mine.map((g) => `<span class="chip">${esc(g)}${groups[g].unit === 'kg' ? ' (kg)' : ''}${used.has(g) ? '' : ` <button type="button" class="iconbtn" data-act="spend-del" data-g="${esc(g)}" aria-label="Remove ${esc(g)}">${ic('x')}</button>`}</span>`).join('')}</div></section>`;
  return `${hdr('Spending by Group')}<main class="page" id="spendpage">${chips}${body}</main>`;
}

Object.assign(ACT, {
  'spend-range': (el) => { ui.spendRange = el.dataset.k; window.dispatchEvent(new Event('sukli-render')); },
  'spend-add': () => openEntry(),
  'spend-del': async (el) => {
    const g = el.dataset.g; if (!(await confirmDialog(`Remove the group "${g}"? Entries are not affected.`, 'Remove', true))) return;
    commit((d) => { const all = { ...groupsOf(d) }; delete all[g]; d.settings.spendGroups = all; });
    toast('Group removed.'); window.dispatchEvent(new Event('sukli-render'));
  },
});

// ---- "What was it?" typed as a list: "coke, 2 bread, soap" means ONE receipt made of these things ----
// pieces: [{ n: name, k: how many }] (k from "2 bread" or "bread x2"); null when it does not look like a list
export function splitParts(text) {
  const raw = String(text || '').split(/[,，、]/).map((x) => x.trim()).filter(Boolean);
  if (raw.length < 2 || raw.length > 20 || raw.some((x) => x.length > 40)) return null;
  const parts = raw.map((x) => {
    let m = x.match(/^(\d+(?:\.\d+)?)\s*(?:x|×|pcs?)?\s+(.+)$/i); if (m) return { n: m[2].trim(), k: +m[1] };
    m = x.match(/^(.+?)\s*(?:x|×|\*)\s*(\d+)$/i); if (m) return { n: m[1].trim(), k: +m[2] };
    return { n: x, k: 1 };
  });
  return parts.every((x) => x.n && /[A-Za-z\u3040-\u30ff\u4e00-\u9fff]/.test(x.n)) ? parts : null;
}
// a rough first guess of the group, by words and only among the groups the person has; '' when unsure (the person chooses)
const WORDS = [
  ['drinks', /tea|coffee|coke|cola|pepsi|soda|juice|water|pocari|aquarius|beer|chuhai|latte|drink|ポカリ|お茶|コーヒー|水|ジュース|ビール|炭酸/i],
  ['snacks', /chip|choco|candy|gum|cookie|biscuit|snack|gummy|pocky|cracker|ice cream|onigiri|rice ball|お菓子|チョコ|ガム|アイス|おにぎり|クッキー/i],
  ['ready meals', /bento|sandwich|burger|sushi|ramen|noodle|pasta|pizza|salad|meal|karaage|弁当|サンド|カップ麺|寿司|惣菜|パスタ/i],
  ['produce', /vegetable|fruit|apple|banana|tomato|onion|potato|cabbage|lettuce|carrot|野菜|果物|りんご|バナナ|トマト/i],
  ['meat and fish', /meat|chicken|pork|beef|fish|salmon|shrimp|肉|魚|鶏|豚|牛/i],
  ['toiletries', /soap|shampoo|toothpaste|conditioner|razor|lotion|deodorant|シャンプー|歯磨|石鹸|ボディ/i],
  ['household', /detergent|trash bag|sponge|battery|foil|plastic wrap|tissue|toilet paper|洗剤|ゴミ袋|スポンジ|電池|ティッシュ/i],
  ['groceries', /bread|egg|rice|milk|tofu|natto|flour|sugar|salt|oil|sauce|butter|cheese|yogurt|パン|卵|米|牛乳|豆腐|納豆|調味料/i],
];
export function guessGroup(db, piece) {
  const have = Object.keys(groupsOf(db)), sing = (x) => x.replace(/s$/, '');
  for (const [g, re] of WORDS) if (re.test(piece)) { const hit = have.find((h) => h === g || sing(h) === sing(g)); if (hit) return hit; }
  return '';
}
// pieces -> the rows of Count by group: the same group adds up; a weight group is left for the person to weigh
export function countsFromParts(db, parts) {
  const rows = [];
  for (const p of parts) {
    const g = guessGroup(db, p.n), row = g && rows.find((r) => r.g === g && unitOf(db, g) !== 'kg');
    if (row) row.n = String(+row.n + p.k); else rows.push({ g, n: g && unitOf(db, g) === 'kg' ? '' : String(p.k) });
  }
  return rows;
}

