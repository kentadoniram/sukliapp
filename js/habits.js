// Habit learning: what is "daily life" for this user, and when is spending outside it (a trip, an event, a move)?
// Pure maths, no screens. The user only enters merchant/name, amount, date and (optionally) a tag. Everything else is learned:
//   1. HOME BASE: the currency you normally spend in. A different currency for a few days is "away"; the same new currency for
//      3+ weeks is a move, and it becomes the new home (so moving from the Philippines to Japan is not a never-ending trip).
//   2. BASELINE per category: what a usual entry and a usual day cost in daily life (medians, so one big dinner does not distort it).
//   3. OUTSIDE-DAILY-LIFE days, from several clues added up (never one rule alone):
//        your own tags (any tag you use is treated as a context word), a different currency, travel bookings/categories,
//        shops you never used before, and a day far above your usual.
//   4. TRIP / EVENT windows from those days, with what they cost and the EXTRA over your daily baseline
//        ("food on the trip 18,000; at your usual rate 9,500; extra 8,500").
// Everything explains itself (`why`) and is a suggestion: nothing here changes a saved entry.
import { reimbKeep } from './reimbkeep.js';

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mad = (a) => { const m = median(a); return median(a.map((v) => Math.abs(v - m))); };
const dayNum = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const dayStr = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const TRAVELISH = /travel|flight|airline|airfare|plane|hotel|accommodation|lodging|hostel|visa|klook|booking|agoda|airbnb|e-?sim|passport|luggage/i;
export const WEIGHTS = { tag: 2.5, cur: 2.0, travel: 1.2, novel: 1.0, high: 0.6, far: 1.0 };
const THRESHOLD = 1.5, MOVE_DAYS = 21;

// rows: [{ id, date, amount (home currency), cur, cat, group, catName, name, labels }]  expenses only
export function analyzeHabits(rows, opts = {}) {
  const W = { ...WEIGHTS, ...(opts.weights || {}) }, thr = opts.threshold ?? THRESHOLD, moveDays = opts.moveDays ?? MOVE_DAYS;
  const ex = (rows || []).filter((r) => r && r.amount > 0 && r.date).map((r) => ({ ...r, d: dayNum(r.date), shop: String(r.name || '').toLowerCase().replace(/\s+/g, ' ').trim() })).sort((a, b) => a.d - b.d);
  if (!ex.length) return { regimes: [], days: [], trips: [], moves: [], planned: [], baseline: {}, notes: ['No expenses yet.'] };
  const byDay = new Map(); for (const r of ex) { if (!byDay.has(r.d)) byDay.set(r.d, []); byDay.get(r.d).push(r); }
  const dayList = [...byDay.keys()].sort((a, b) => a - b);
  const domCur = (es, prefer) => { const c = {}; for (const e of es) c[e.cur] = (c[e.cur] || 0) + 1; const best = Object.entries(c).sort((a, b) => b[1] - a[1]); return best.length > 1 && best[0][1] === best[1][1] && c[prefer] === best[0][1] ? prefer : best[0][0]; };

  // 1. regimes: the home currency over time. A foreign stretch of 3+ weeks that is still going (or lasts that long) is a move.
  let home = domCur(byDay.get(dayList[0]), ''), regimes = [{ cur: home, from: dayList[0] }], run = null;
  for (const d of dayList) {
    const dc = domCur(byDay.get(d), home);
    if (dc !== home) { if (!run) run = { cur: dc, start: d, last: d, n: 0 }; if (run.cur === dc) { run.last = d; run.n++; } else run = { cur: dc, start: d, last: d, n: 1 }; }
    else if (run && d - run.last > 2 && run.cur !== dc) run = null;                // back home for a couple of days: it was a trip
    if (run && run.last - run.start >= moveDays - 1 && run.n >= 5) {
      const early = dayList.find((x) => x >= run.start - 30 && x < run.start && domCur(byDay.get(x), home) === run.cur);   // the first days there (arrival) belong to the move
      home = run.cur; regimes.push({ cur: home, from: early ?? run.start }); run = null;
    }
  }
  const regimeAt = (d) => { let c = regimes[0].cur; for (const r of regimes) if (d >= r.from) c = r.cur; return c; };

  // 2. baseline: per regime and category, the usual entry and the usual day, learned only from days that look like daily life
  const habitual = new Set(), seen = new Map();
  for (const r of ex) { const k = r.shop; if (!seen.has(k)) seen.set(k, new Set()); seen.get(k).add(r.d); }
  const brandOf = (shop) => { const w = String(shop || '').split(/[\s・,\-/]+/)[0] || ''; return w.length >= 3 ? w : ''; };
  const brandDays = new Map(); for (const r of ex) { const b = brandOf(r.shop); if (!b) continue; if (!brandDays.has(b)) brandDays.set(b, new Set()); brandDays.get(b).add(r.d); }
  const usualBrand = (shop) => { const b = brandOf(shop); return !!b && (brandDays.get(b) || new Set()).size >= 6; };   // "Life Tsukagoshi" counts as "Life" when you shop at Life often
  for (const [k, ds] of seen) if (ds.size >= 3 || usualBrand(k)) habitual.add(k);                    // a shop you use often is part of daily life, wherever it is
  const firstSeen = new Map(); for (const r of ex) if (!firstSeen.has(r.shop)) firstSeen.set(r.shop, r.d);

  // learn which categories are part of everyday life: used on many different days (food, transport, groceries).
  // Those never count as a trip clue, whatever their name or group says (your "Travel > Food Expenses" is daily life if you use it daily).
  const activeDays = dayList.length, catDays = new Map();
  for (const r of ex) { const k = r.catName || r.cat; if (!catDays.has(k)) catDays.set(k, new Set()); catDays.get(k).add(r.d); }
  const gapOf = (k) => { const ds = [...(catDays.get(k) || [])].sort((a, b) => a - b); return ds.length > 1 ? median(ds.slice(1).map((x, i) => x - ds[i])) : 999; };
  const dailyCat = (k) => (catDays.get(k) ? catDays.get(k).size : 0) / activeDays >= (opts.dailyShare ?? 0.06) && gapOf(k) <= (opts.dailyGap ?? 4);   // used often AND regularly close together; a monthly allowance is not daily life
  const fixedCat = new Map();                                                         // same amount again and again (rent, allowance): not "daily spending"
  { const by = new Map(); for (const r of ex) { const k = r.catName || r.cat; if (!by.has(k)) by.set(k, []); by.get(k).push(r.amount); }
    for (const [k, a] of by) fixedCat.set(k, a.length >= 3 && mad(a) / (median(a) || 1) < 0.05); }
  const travelClue = (e) => !dailyCat(e.catName || e.cat) && TRAVELISH.test(`${e.catName || ''} ${e.name || ''}`);

  // 3. clues per day
  const tagWords = new Set(); for (const r of ex) for (const t of String(r.labels || '').split(/[,;#]/).map((x) => x.trim().toLowerCase()).filter(Boolean)) tagWords.add(t);
  const days = [];
  const living = (e) => dailyCat(e.catName || e.cat) && !fixedCat.get(e.catName || e.cat);   // food, transport...: not rent, not investing, not one-off buys
  const dayTotals = []; for (const d of dayList) dayTotals.push(byDay.get(d).filter(living).reduce((s, e) => s + e.amount, 0));
  const dMed = median(dayTotals), dMad = Math.max(mad(dayTotals), dMed * 0.25, 1);
  for (const d of dayList) {
    const es = byDay.get(d), n = es.length, rc = regimeAt(d), total = dayTotals[dayList.indexOf(d)];   // total = everyday spending of the day
    const cs = es.filter((e) => !travelClue(e) && !fixedCat.get(e.catName || e.cat)), foreign = cs.length ? cs.filter((e) => e.cur !== rc && !habitual.has(e.shop)).length / cs.length : 0;   // paying a flight or an allowance in another currency does not mean you are there
    const tagged = es.some((e) => String(e.labels || '').trim());
    const travel = es.some(travelClue);
    const novel = es.filter((e) => firstSeen.get(e.shop) === d && !habitual.has(e.shop)).length / n;
    const z = Math.max(0, Math.min(1, ((total - dMed) / dMad) / 6));
    const settling = regimes.some((rg, i) => i > 0 && d >= rg.from && d < rg.from + 14);       // first two weeks in a new home: every shop is new
    const farD = Math.max(0, ...es.filter((e) => e.loc && !habitual.has(e.shop)).map((e) => (opts.farKm ? opts.farKm(e.loc) : null) ?? 0));   // how far from home or work, only for places that are not your usual shops
    const far = farD >= 60 ? 1 : farD >= 25 ? 0.6 : farD >= 12 ? 0.2 : 0;                                  // a mall nearby is 0; far alone never flags a day, it needs a second clue
    const parts = { tag: tagged ? 1 : 0, cur: foreign, travel: travel ? 1 : 0, novel: settling ? 0 : (n >= 2 ? novel : novel * 0.5), high: settling ? 0 : z, far };
    const score = Object.entries(parts).reduce((s, [k, v]) => s + W[k] * v, 0);
    const why = []; if (parts.tag) why.push('you tagged it'); if (foreign >= 0.5) why.push('other currency than home'); if (parts.travel) why.push('travel spending'); if (novel >= 0.6 && n >= 2) why.push('mostly new places'); if (z >= 0.5) why.push('far above a usual day'); if (far >= 0.6) why.push('far from home');
    days.push({ d, date: dayStr(d), score, out: score >= thr, why, total, n });
  }
  // fill small holes: a quiet day between two outside days (or a day with no entries) belongs to the same trip
  const isOut = new Map(days.map((x) => [x.d, x.out])), win = [];
  let cur = null;
  for (const x of days) {
    if (!x.out) continue;
    if (cur && x.d - cur.to <= 3) { cur.to = x.d; cur.why.push(...x.why); cur.n++; } else { cur = { from: x.d, to: x.d, why: [...x.why], n: 1 }; win.push(cur); }
  }
  // 4. trips: windows with 2+ outside days, or one outside day that holds travel/tag evidence. Bookings (flights, hotels) made up to 8 months before join the next trip.
  // a window that is only the day you PAID for a flight or hotel (little everyday spending around it) is a booking, not a trip: it waits for its trip
  const bookingOnly = (w) => { const es = ex.filter((e) => e.d >= w.from && e.d <= w.to), bk = es.filter(travelClue), rest = es.filter((e) => !travelClue(e) && living(e));
    return bk.length > 0 && rest.reduce((a, e) => a + e.amount, 0) <= 0.5 * bk.reduce((a, e) => a + e.amount, 0); };
  const keep = win.filter((w) => w.n >= 2 || w.why.some((y) => y === 'you tagged it')).filter((w) => !bookingOnly(w));
  const dayScore = new Map(days.map((x) => [x.d, x]));
  const trips = keep.map((w, i) => {
    const entries = ex.filter((e) => e.d >= w.from && e.d <= w.to && !fixedCat.get(e.catName || e.cat));   // rent and other fixed payments are not part of a trip
    const bookings = ex.filter((e) => e.d < w.from && w.from - e.d <= (opts.bookAhead ?? 240) && travelClue(e) && !keep.some((o) => e.d >= o.from && e.d <= o.to) && !keep.some((o) => o.from > e.d && o.from < w.from));   // booked ahead: belongs to the next trip
    const all = [...bookings, ...entries];
    const tags = [...new Set(all.flatMap((e) => String(e.labels || '').split(/[,;#]/).map((x) => x.trim()).filter(Boolean)))];
    const reasons = [...new Set(w.why)];
    const usual = all.filter((e) => !bookings.includes(e) && dailyCat(e.catName || e.cat) && habitual.has(e.shop)).map((e) => e.id);   // everyday food or transport at a shop you use all the time: normal payments, not trip spending
    return { usual, id: 't' + (i + 1), from: dayStr(w.from), to: dayStr(w.to), days: w.to - w.from + 1, tags, why: reasons, entries: all.map((e) => e.id), bookings: bookings.map((e) => e.id), total: all.reduce((s, e) => s + e.amount, 0), _all: all };
  });

  // baseline from days that are not inside any trip: usual entry price and usual daily total per category
  const inTrip = (d) => keep.some((w) => d >= w.from - 0 && d <= w.to);
  const base = new Map();
  for (const r of ex) { if (inTrip(r.d)) continue; if (r.cur !== regimeAt(r.d)) continue; const k = `${regimeAt(r.d)}|${r.catName || r.cat}`; if (!base.has(k)) base.set(k, { entry: [], day: new Map() }); const b = base.get(k); b.entry.push(r.amount); b.day.set(r.d, (b.day.get(r.d) || 0) + r.amount); }
  const baseline = {}; for (const [k, b] of base) baseline[k] = { entry: median(b.entry), day: median([...b.day.values()]), n: b.entry.length, days: b.day.size };

  // premium: what the trip cost versus the same things in daily life. Only categories with enough history (5+ daily entries) are compared.
  for (const t of trips) {
    const rc = regimeAt(dayNum(t.from)), cats = new Map();
    for (const e of t._all) { const k = e.catName || e.cat; if (!cats.has(k)) cats.set(k, { name: k, actual: 0, n: 0, days: new Set() }); const c = cats.get(k); c.actual += e.amount; c.n++; c.days.add(e.d); }
    let extra = 0, compared = 0, expectedAll = 0;
    t.byCat = [...cats.values()].map((c) => {
      const b = baseline[`${rc}|${c.name}`], comparable = b && b.n >= 5 && dailyCat(c.name) && !fixedCat.get(c.name);
      // a daily-life category (food, transport): compare day against day when it recurs, per entry otherwise
      const expected = comparable ? Math.max(b.entry * c.n, b.day * c.days.size) : null;
      const row = { name: c.name, actual: c.actual, entries: c.n, expected, extra: expected != null ? c.actual - expected : null };
      if (expected != null) { extra += c.actual - expected; compared += c.actual; expectedAll += expected; }
      return row;
    }).sort((a, b) => b.actual - a.actual);
    t.living = compared; t.compared = compared; t.expected = expectedAll; t.extra = extra; delete t._all;     // only daily-life categories are compared: food, transport and the like
  }
  // what a trip really cost: bookings paid ahead (whole amount) + what daily-life categories cost ABOVE the usual rate + anything with no baseline (whole amount).
  // Food you would have eaten anyway stays in daily needs at its usual level; only the surplus belongs to the trip.
  for (const t of trips) {
    const book = new Set(t.bookings), onTrip = t.entries.filter((id) => !book.has(id)).map((id) => ex.find((e) => e.id === id)).filter(Boolean);
    t.prepaid = t.bookings.reduce((a, id) => a + ((ex.find((e) => e.id === id) || {}).amount || 0), 0);
    t.onTrip = onTrip.reduce((a, e) => a + e.amount, 0);
    t.trueCost = t.prepaid + Math.max(0, t.extra) + (t.onTrip - t.compared);
    const cc = {}; for (const e of onTrip) cc[e.cur] = (cc[e.cur] || 0) + 1; t.cur = Object.entries(cc).sort((a, b) => b[1] - a[1]).map((x) => x[0])[0] || '';
  }
  // arriving in a new country is part of the move, not a trip: a window in the new currency shortly before the new home begins
  const moves = [];
  for (const rg of regimes.slice(1)) {                                                // only the FIRST stretch in the new currency (the arrival); a window you tagged is always yours
    const cand = trips.filter((t) => t.cur === rg.cur && !t.tags.length && dayNum(t.from) < rg.from && rg.from - dayNum(t.from) <= 60).sort((x, y) => (x.from < y.from ? -1 : 1))[0];
    if (cand) { cand.kind = 'move'; cand.why = ['arrival in the new home currency', ...cand.why.filter((w) => w !== 'other currency than home')]; moves.push(cand); trips.splice(trips.indexOf(cand), 1); }
  }
  for (const t of trips) t.kind = 'trip';
  // travel bookings that belong to no trip yet: a trip you have paid for but not taken (or not entered)
  const attached = new Set(trips.flatMap((t) => t.bookings).concat(moves.flatMap((t) => t.bookings)));
  const planned = ex.filter((e) => travelClue(e) && !attached.has(e.id) && !keep.some((w) => e.d >= w.from && e.d <= w.to)).map((e) => ({ id: e.id, date: dayStr(e.d), name: e.name, amount: e.amount }));
  return { regimes: regimes.map((r) => ({ cur: r.cur, from: dayStr(r.from) })), days, trips, moves, planned, baseline, notes: [] };
}

// rows from the database (expenses only, amounts in the home currency)
export function habitRows(db, homeFx) {
  const cm = new Map((db.categories || []).map((c) => [c.id, c]));
  return (db.txs || []).filter((t) => !t.deleted && t.kind === 'expense').map((t) => { const c = cm.get(t.cat) || {}; return { id: t.id, date: t.date, amount: t.amount * reimbKeep(t) * (homeFx ? homeFx(db, t.cur) || 1 : t.fx || 1), cur: t.cur, cat: t.cat, group: c.group || '', catName: c.name || '', name: t.name, labels: t.labels || '', loc: t.loc || null }; });
}
