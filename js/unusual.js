// Unusual-spending engine (15.37). Plain statistics on YOUR OWN entries, no network and no AI. Four kinds of finding:
//   big      one entry far above what its category usually costs (modified z-score from the median and MAD, at least 5 earlier entries)
//   month    a category this month far above its own usual month (the month in progress is only judged by what is already spent)
//   dup      the same shop and amount twice within a day (a possible double charge)
//   newshop  a first-time shop with an amount well above a usual entry in that category
// Trips, events and fixed bills are left out. "Looks fine" on a finding hides that one for good (settings.unusualOk).
import { get, commit, nowStamp, monthParts, shiftMonth, thisMonth, daysInMonth, fmt, HOME } from './core.js';
import { tripEntryIds } from './trips.js';
import { ACT, esc } from './ui.js';
import { button } from './components.js';

const med = (a) => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : 0; };
const mad = (a, m) => med(a.map((x) => Math.abs(x - m)));
const mz = (v, a) => { const m = med(a), d = mad(a, m); return d > 0 ? 0.6745 * (v - m) / d : (v > m * 2 ? 99 : 0); };   // modified z-score; 3.5 is the usual cut
const money = (n) => fmt(n, HOME, { round: true });
const day = (t) => String(t.date).slice(0, 10);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]+/g, ' ').trim();

export function unusualFindings(db, today = nowStamp().slice(0, 10)) {
  const ym = today.slice(0, 7), ok = new Set((db.settings || {}).unusualOk || []), out = [];
  let trip = new Set(); try { trip = tripEntryIds(db); } catch { /* no trips */ }
  const cm = new Map((db.categories || []).map((c) => [c.id, c]));
  // history: every earlier month's expense parts, by category
  const hist = new Map(), seenShop = new Map();
  for (let i = 1; i <= 6; i++) for (const q of monthParts(db, shiftMonth(ym, -i))) if (q.kind === 'expense' && q.cat && !q.split && !trip.has(q.t.id)) { if (!hist.has(q.cat)) hist.set(q.cat, []); hist.get(q.cat).push(q.v); }
  for (const t of db.txs || []) if (!t.deleted && t.kind === 'expense' && t.date.slice(0, 7) < ym) seenShop.set(norm(t.name), (seenShop.get(norm(t.name)) || 0) + 1);
  const cur = monthParts(db, ym).filter((q) => q.kind === 'expense' && !q.split && !trip.has(q.t.id));
  const cut = new Date(new Date(today + 'T12:00:00').getTime() - 14 * 864e5).toISOString().slice(0, 10);
  for (const q of cur) {
    if (day(q.t) < cut) continue;                                   // only what is recent
    const h = hist.get(q.cat); if (!h || h.length < 5) continue;
    const m = med(h), z = mz(q.v, h);
    if (z >= 3.5 && q.v >= m * 2 && q.v >= 1000) out.push({ id: `big:${q.t.id}`, kind: 'big', tx: q.t.id, score: z, text: `${q.t.name || 'An entry'} (${money(q.v)}) is well above what ${(cm.get(q.cat) || {}).name || 'this category'} usually costs (about ${money(m)}).` });
    else if (!seenShop.get(norm(q.t.name)) && norm(q.t.name) && q.v >= m * 2.5 && q.v >= 1500) out.push({ id: `new:${q.t.id}`, kind: 'newshop', tx: q.t.id, score: 2, text: `First time at ${q.t.name}: ${money(q.v)}, more than a usual ${(cm.get(q.cat) || {}).name || 'entry'} (about ${money(m)}).` });
  }
  // a category far above its own usual month; in a month in progress only what is already spent counts
  const per = new Map(); for (let i = 1; i <= 6; i++) { const by = new Map(); for (const q of monthParts(db, shiftMonth(ym, -i))) if (q.kind === 'expense' && q.cat && !trip.has(q.t.id)) by.set(q.cat, (by.get(q.cat) || 0) + q.v); for (const [c, v] of by) { if (!per.has(c)) per.set(c, []); per.get(c).push(v); } }
  const now = new Map(); for (const q of cur) now.set(q.cat, (now.get(q.cat) || 0) + q.v);
  for (const [c, v] of now) {
    const h = per.get(c); if (!h || h.length < 3) continue;
    const m = med(h), z = mz(v, h);
    if (z >= 3.5 && v >= m * 1.6 && v - m >= 3000) out.push({ id: `month:${c}:${ym}`, kind: 'month', cat: c, score: z, text: `${(cm.get(c) || {}).name || 'A category'} is already ${money(v)} this month, usually about ${money(m)} for a whole month.` });
  }
  // the same shop and amount twice within a day
  const rec = (db.txs || []).filter((t) => !t.deleted && t.kind === 'expense' && !t.trade && !t.tradeOf && day(t) >= cut && t.amount > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (let i = 0; i < rec.length; i++) for (let j = i + 1; j < rec.length; j++) {
    const a = rec[i], b = rec[j]; if (new Date(b.date.replace(' ', 'T')) - new Date(a.date.replace(' ', 'T')) > 864e5) break;
    if (a.cur === b.cur && a.amount === b.amount && norm(a.name) && norm(a.name) === norm(b.name) && a.amount >= 500) out.push({ id: `dup:${a.id}:${b.id}`, kind: 'dup', tx: b.id, score: 3, text: `${b.name} ${fmt(b.amount, b.cur)} appears twice within a day. A double charge, or two real purchases?` });
  }
  return out.filter((x) => !ok.has(x.id)).sort((a, b) => b.score - a.score).slice(0, 4);
}
export function unusualCard(db) {
  let l; try { l = unusualFindings(db); } catch { return ''; }
  if (!l.length) return '';
  return `<section class="card unusualcard"><h2>Unusual Spending</h2><ul class="ins">${l.map((x) => `<li class="warn"><span>${esc(x.text)}</span> ${x.tx ? button({ label: 'Open', kind: 'link', act: 'unusual-open', data: 'id', v: x.tx }) : ''}${button({ label: 'Looks fine', kind: 'link', act: 'unusual-ok', data: 'id', v: x.id })}</li>`).join('')}</ul>
    <p class="hint">Found by comparing with your own earlier entries (nothing leaves your phone). Trips, events and fixed bills are left out.</p></section>`;
}
ACT['unusual-ok'] = (el) => { const id = el.dataset.id; commit((d) => { const a = new Set(d.settings.unusualOk || []); a.add(id); d.settings.unusualOk = [...a].slice(-300); }); };
ACT['unusual-open'] = async (el) => { const m = await import('./entryview.js'); m.openEntryView(el.dataset.id); };
