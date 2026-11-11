// Trips and events (Advanced): what Sukli has learned about the times your spending left daily life (js/habits.js).
// Everything here is a suggestion with the reason shown. Yes / No teaches Sukli: it never changes an entry, a category or a budget.
import { button } from './components.js';
import { get, commit, fmt, HOME, homeFx, nowStamp } from './core.js';
import { ACT, esc, toast, promptDialog, sheet } from './ui.js';
import { hdr } from './screens.js';
import { placesOf, farKm, distKm, locOn, here, permState } from './loc.js';
import { analyzeHabits, habitRows, WEIGHTS } from './habits.js';

const money = (n) => fmt(n, HOME, { round: true });
const niceDate = (s) => new Date(String(s).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const WHY = { 'you tagged it': 'you tagged it', 'other currency than home': 'spent in another currency', 'travel spending': 'a flight, hotel or similar', 'mostly new places': 'mostly new places', 'far above a usual day': 'a much bigger day than usual', 'arrival in the new home currency': 'arriving in your new home', 'far from home': 'far from home or work' };
const CLUE = { 'you tagged it': 'tag', 'other currency than home': 'cur', 'travel spending': 'travel', 'mostly new places': 'novel', 'far above a usual day': 'high', 'far from home': 'far' };

// what Sukli has learned about how much each clue counts: Yes nudges it up, No nudges it down (kept between 0.4x and 1.6x of the start)
export const learnedWeights = (db) => {
  const w = { ...WEIGHTS }, adj = (db.settings && db.settings.habitW) || {};
  for (const k of Object.keys(w)) w[k] = WEIGHTS[k] * Math.min(1.6, Math.max(0.4, adj[k] || 1));
  return w;
};
// what the person decided by hand: per entry, and per shop name (first word) so that Sukli learns from names
export const brandOf = (name) => { const w = String(name || '').toLowerCase().split(/[\s・,\-/]+/)[0] || ''; return w.length >= 3 ? w : ''; };
export const pickOf = (db, tx) => { const st = db.settings || {}; return (st.tripPick || {})[tx.id] || ((tx.kind === 'expense' && brandOf(tx.name)) ? (st.tripShop || {})[brandOf(tx.name)] : '') || ''; };
export function tripReport(db) {
  const notes = (db.settings && db.settings.tripNotes) || {}, txm = new Map((db.txs || []).map((t) => [t.id, t]));
  const rows = habitRows(db, homeFx).filter((r) => pickOf(db, txm.get(r.id) || r) !== 'out');   // "not a trip" entries are left out of the maths
  const pl = placesOf(db), res = analyzeHabits(rows, { weights: learnedWeights(db), farKm: (loc) => farKm(pl, loc) });
  const trips = res.trips.filter((t) => !(notes[t.from] && notes[t.from].s === 'no')).map((t) => ({ ...t, note: notes[t.from] || null }));
  // "part of this trip" entries the person added by hand (also transfers): their whole amount joins the trip cost
  for (const t of trips) {
    t.forced = []; t.usual = t.usual || [];
    for (const x of db.txs || []) {
      if (x.deleted || x.trade || pickOf(db, x) !== 'in' || String(x.date).slice(0, 10) < t.from || String(x.date).slice(0, 10) > t.to) continue;
      t.usual = t.usual.filter((id) => id !== x.id);
      if (t.entries.includes(x.id)) continue;
      const amt = x.amount * (homeFx(db, x.cur) || x.fx || 1);
      t.entries.push(x.id); t.forced.push(x.id); t.trueCost += amt; t.onTrip += amt;
    }
  }
  // a "booking" from a shop you pay every month (an e-SIM plan, say) is a subscription, not a trip to come
  const months = new Map(); for (const x of db.txs || []) { if (x.deleted || x.kind !== 'expense') continue; const b = brandOf(x.name); if (!b) continue; if (!months.has(b)) months.set(b, new Set()); months.get(b).add(String(x.date).slice(0, 7)); }
  const monthly = (p) => { const b = brandOf(p.name); return b && months.has(b) && months.get(b).size >= 3; };
  const active = new Set(rows.map((r) => String(r.date).slice(0, 10))).size;
  return { res, trips, rejected: res.trips.length - trips.length, learning: active < 21 || rows.length < 40, planned: res.planned.filter((p) => p.amount >= 1000 && !monthly(p)) };
}
// entries that belong to a trip or event (flights and hotels paid ahead, spending on the trip above what a usual day costs). Cached until the entries change.
let tripCache = { key: '', ids: new Set() };
export function tripEntryIds(db) {
  const key = `${(db.txs || []).length}|${Math.max(0, ...(db.txs || []).map((t) => t.updatedAt || 0))}|${JSON.stringify((db.settings || {}).tripNotes || {})}|${JSON.stringify((db.settings || {}).tripPick || {}).length}`;
  if (tripCache.key === key) return tripCache.ids;
  const ids = new Set(); try { for (const t of tripReport(db).trips) { const usual = new Set(t.usual || []); for (const id of t.entries) if (!usual.has(id)) ids.add(id); } } catch { /* no trips */ }
  tripCache = { key, ids }; return ids;
}
// Daily needs: what an ordinary day costs, from the last 90 days with trips, events and fixed bills (same amount again and again, such as rent) left out
export function dailyNeeds(db, days = 90) {
  const ex = (db.txs || []).filter((t) => !t.deleted && t.kind === 'expense' && !t.trade && !t.tradeOf);
  if (!ex.length) return { perDay: 0, perMonth: 0, days: 0, left: 0 };
  const last = ex.reduce((m, t) => (String(t.date).slice(0, 10) > m ? String(t.date).slice(0, 10) : m), ''), from = new Date(new Date(last + 'T12:00:00').getTime() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const inR = ex.filter((t) => String(t.date).slice(0, 10) >= from), trip = tripEntryIds(db), by = new Map();
  for (const t of ex) { if (!by.has(t.cat)) by.set(t.cat, []); by.get(t.cat).push(t.amount * (homeFx(db, t.cur) || t.fx || 1)); }
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)] || 0; };
  const fixed = new Set([...by].filter(([, a]) => a.length >= 3 && a.filter((v) => Math.abs(v - med(a)) <= 0.05 * med(a)).length >= a.length * 0.8).map(([k]) => k));
  let sum = 0, left = 0; for (const t of inR) { const v = t.amount * (homeFx(db, t.cur) || t.fx || 1); if (trip.has(t.id) || fixed.has(t.cat)) left += v; else sum += v; }
  const n = Math.min(days, Math.max(1, Math.round((new Date(last + 'T12:00:00') - new Date(from + 'T12:00:00')) / 864e5) + 1));
  return { perDay: sum / n, perMonth: sum / n * 30, days: n, left };
}
// Home card: what an ordinary day costs (last 90 days, trips and fixed bills left out) next to this month so far
export function usualCard(db) {
  let u, m; try { u = dailyNeeds(db); } catch { return ''; }
  if (!(u.perDay > 0) || u.days < 14) return '';
  const day = parseInt(nowStamp().slice(8, 10), 10); try { m = day >= 5 ? dailyNeeds(db, day) : null; } catch { m = null; }
  const diff = m && m.perDay > 0 ? (m.perDay - u.perDay) / u.perDay : null;
  const word = diff == null ? '' : Math.abs(diff) < 0.1 ? 'About the same as usual.' : diff > 0 ? `${Math.round(diff * 100)}% above your usual.` : `${Math.round(-diff * 100)}% below your usual.`;
  return `<section class="card usualcard"><h2>Your Usual Spending</h2><ul class="calfacts"><li><span>An ordinary day</span><b>${money(u.perDay)}</b></li><li><span>An ordinary month</span><b>${money(u.perMonth)}</b></li>${m && m.perDay > 0 ? `<li><span>This month so far, per day</span><b>${money(m.perDay)}</b></li>` : ''}</ul>
    <p class="hint">${word} Worked out from your last ${u.days} days. Trips, events and fixed bills such as rent are left out (${money(u.left)}). It is a guide, not a limit.</p></section>`;
}
// Home card: the newest trip or event Sukli found (or the one you named), with what it cost and a way into the full page.
// When Location is on and your phone already allows it, a line says if you are far from home right now (a clue only: it never starts a trip by itself).
export function latestTripCard(db) {
  let r; try { r = tripReport(db); } catch { return ''; }
  const t = r.trips.slice().sort((a, b) => (a.from < b.from ? 1 : -1))[0];
  if (!t) return '';
  const ntr = r.trips.length, cats = t.byCat.filter((c) => c.expected != null && c.extra >= 1).sort((a, b) => b.extra - a.extra).slice(0, 2);
  return `<section class="card tripcard homeTrip"><div class="sgtop"><b>${esc(title(t))}</b><span>${money(t.trueCost)}</span></div>
    <small>${niceDate(t.from)}${t.days > 1 ? ' to ' + niceDate(t.to) : ''} · ${t.days} day${t.days === 1 ? '' : 's'} · latest trip or event</small>
    <ul class="calfacts">${t.prepaid > 0 ? `<li><span>Paid ahead</span><b>${money(t.prepaid)}</b></li>` : ''}<li><span>Spent during it</span><b>${money(t.onTrip)}</b></li>${cats.map((c) => `<li><span>${esc(c.name)} above usual</span><b>+${money(c.extra)}</b></li>`).join('')}</ul>
    <p class="hint awaynow" data-away hidden></p>
    <div class="btnrow"><a class="btn sm ghost" href="#/trips">${ntr > 1 ? `All ${ntr} trips and events` : 'Open trip details'}</a></div></section>`;
}
// fills the "far from home now" line after Home is drawn; asks nothing: it stays silent unless Location is on and already allowed
export async function awayCheck() {
  const els = [...document.querySelectorAll('[data-away]')]; if (!els.length) return;
  const db = get(); if (!locOn(db) || (await permState()) !== 'granted') return;
  const home = placesOf(db).home; if (!home) return;
  const p = await here(4000); if (!p) return;
  const km = distKm(p, home); if (km < 30) return;
  for (const el of els) if (el.isConnected) { el.hidden = false; el.textContent = `You seem to be about ${Math.round(km)} km from home right now. Entries you save here carry that clue, so Sukli can tell a trip from a normal day.`; }
}
const title = (t) => (t.note && t.note.name) || (t.tags.length ? t.tags.join(' / ') : 'Trip or event');

function card(t) {
  const cats = t.byCat.filter((c) => c.expected != null && Math.abs(c.extra) >= 1).slice(0, 4), reasons = [...new Set(t.why.map((w) => WHY[w]).filter(Boolean))];
  const asked = t.note && t.note.s === 'yes';
  return `<article class="card tripcard" data-from="${t.from}"><div class="sgtop"><b>${esc(title(t))}</b><span>${money(t.trueCost)}</span></div>
    <small><button type="button" class="linkbtn tripdates" data-act="trip-days" data-from="${t.from}">${niceDate(t.from)}${t.days > 1 ? ' to ' + niceDate(t.to) : ''}</button> · ${t.days} day${t.days === 1 ? '' : 's'} · ${asked ? 'you confirmed this' : 'Sukli thinks: ' + esc(reasons.join(', ') || 'looks different from daily life')}</small>
    <ul class="calfacts">
      ${t.prepaid > 0 ? `<li><span>Paid ahead (flights, hotel)</span><b>${money(t.prepaid)}</b></li>` : ''}
      <li><span>Spent during it</span><b>${money(t.onTrip)}</b></li>
      ${cats.map((c) => `<li><span>${esc(c.name)}: usual about ${money(c.expected)}</span><b>${c.extra >= 0 ? '+' : '-'}${money(Math.abs(c.extra))}</b></li>`).join('')}
    </ul>
    <p class="hint">Cost of the ${t.tags.length ? 'event' : 'trip'}: what you paid ahead, plus what everyday spending went above your usual, plus things you do not usually buy. What you would have eaten anyway stays in daily life.</p>
    <div class="btnrow">${asked ? '' : `<button type="button" class="btn sm" data-act="trip-yes" data-from="${t.from}">Yes, that is right</button>`}<button type="button" class="btn sm ghost" data-act="trip-name" data-from="${t.from}">Name it</button><button type="button" class="btn sm ghost" data-act="trip-no" data-from="${t.from}">Not a trip</button></div></article>`;
}

export function trips(db) {
  const r = tripReport(db), yr = nowStamp().slice(0, 4), thisYear = r.trips.filter((t) => t.from.startsWith(yr));
  let body = '';
  { const dn = dailyNeeds(db); if (dn.perDay > 0) body += `<section class="card"><h2>Daily Needs</h2><ul class="calfacts"><li><span>An ordinary day</span><b>${money(dn.perDay)}</b></li><li><span>About a month of ordinary days</span><b>${money(dn.perMonth)}</b></li></ul><p class="hint">From the last ${dn.days} days. Trips, events and fixed bills (such as rent) are left out (${money(dn.left)} in that time). The Debts plan uses this as your usual spending.</p></section>`; }
  if (r.learning) body += `<section class="card"><p class="hint"><b>Still learning.</b> Sukli needs about three weeks of entries to know what a usual day looks like for you. Until then, anything it shows here is a guess.</p></section>`;
  if (!r.trips.length) body += `<section class="card"><h2>How It Works</h2><p>Just add your entries as usual: the shop, the amount, the date, and a tag like <i>Vacation</i> or <i>Birthday</i> if you want. Sukli learns what a normal day costs you, then notices days that are different: another currency, a flight or hotel, lots of new places, or a tag you added.</p><p>It then shows what a trip cost and how much was <b>extra</b> compared with a usual day. Nothing is changed in your entries.</p></section>`;
  else {
    body += `<section class="card"><p class="hint">${thisYear.length} trip${thisYear.length === 1 ? '' : 's'} or event${thisYear.length === 1 ? '' : 's'} so far this year, ${money(thisYear.reduce((s, t) => s + t.trueCost, 0))} in total.</p></section>`;
    body += r.trips.slice().sort((a, b) => (a.from < b.from ? 1 : -1)).map(card).join('');
  }
  if (r.planned.length) body += `<section class="card"><h2>Paid For, Trip Not Yet</h2><p class="hint">Flights, hotels and similar you have paid for. They join the trip when it happens.</p><ul class="calfacts">${r.planned.map((p) => `<li><span>${esc(p.name)} · ${niceDate(p.date)}</span><b>${money(p.amount)}</b></li>`).join('')}</ul></section>`;
  if (r.rejected) body += `<section class="card"><p class="hint">${r.rejected} suggestion${r.rejected === 1 ? '' : 's'} you said were not trips are hidden. ${button({ label: 'Show them again', kind: 'link', act: 'trip-reset' })}</p></section>`;
  return `${hdr('Trips and Events')}<main class="page" id="trippage">${body}</main>`;
}

function teach(from, yes) {
  const db = get(), t = tripReport(db).res.trips.find((x) => x.from === from);
  commit((d) => {
    const n = { ...(d.settings.tripNotes || {}) }; n[from] = { ...(n[from] || {}), s: yes ? 'yes' : 'no' }; d.settings.tripNotes = n;
    if (t) { const w = { ...(d.settings.habitW || {}) }; for (const why of new Set(t.why)) { const k = CLUE[why]; if (k) w[k] = Math.min(1.6, Math.max(0.4, (w[k] || 1) * (yes ? 1.05 : 0.9))); } d.settings.habitW = w; }
  });
}
// the entries behind a trip card: which ones Sukli counted as the trip, which were paid ahead, and which are normal payments. The person can overrule each one.
let daySheet = null;
function dayBody(from) {
  const db = get(), t = tripReport(db).trips.find((x) => x.from === from); if (!t) return '<p class="empty">This trip is no longer listed.</p>';
  const inTrip = new Set(t.entries), ahead = new Set(t.bookings), usual = new Set(t.usual || []), cats = new Map((db.categories || []).map((c) => [c.id, c.name]));
  const d10 = (x) => String(x.date).slice(0, 10);
  const rows = (db.txs || []).filter((x) => !x.deleted && !x.trade && ((x.kind === 'expense' && (ahead.has(x.id) || (d10(x) >= t.from && d10(x) <= t.to))) || (x.kind === 'transfer' && d10(x) >= t.from && d10(x) <= t.to)))
    .sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1));
  const kind = (x) => (ahead.has(x.id) ? ['Paid ahead', 'ahead'] : (inTrip.has(x.id) && !usual.has(x.id) && pickOf(db, x) !== 'out') ? [pickOf(db, x) === 'in' ? 'Trip (you chose)' : 'Trip', 'trip'] : usual.has(x.id) ? ['Normal payment (usual shop)', 'normal'] : x.kind === 'transfer' ? ['Transfer, not counted', 'normal'] : [pickOf(db, x) === 'out' ? 'Normal (you chose)' : 'Normal payment', 'normal']);
  const n = (k) => rows.filter((x) => kind(x)[1] === k).length;
  return `<p class="hint">${n('trip')} counted as the trip, ${n('ahead')} paid ahead, ${n('normal')} normal. You decide: tap the button on any row. Sukli remembers the shop name, so similar shops follow your choice.</p>
    <ul class="tripdays">${rows.map((x) => { const [lab, k] = kind(x), isTrip = k !== 'normal'; return `<li class="tdr ${k}"><span><b>${esc(x.name || cats.get(x.cat) || 'Entry')}</b><small>${niceDate(x.date)} · ${esc(x.kind === 'transfer' ? 'Transfer' : cats.get(x.cat) || '')}</small></span><span class="tdr-r"><b>${fmt(x.amount, x.cur, { round: true })}</b><em class="tdtag ${k}">${lab}</em><button type="button" class="linkbtn" data-act="trip-pick" data-id="${x.id}" data-from="${t.from}" data-v="${isTrip ? 'out' : 'in'}">${isTrip ? 'Not part of the trip' : 'Part of the trip'}</button></span></li>`; }).join('') || '<li class="empty">No entries in these dates.</li>'}</ul>`;
}
function dayList(from) {
  const t = tripReport(get()).trips.find((x) => x.from === from); if (!t) return;
  daySheet = sheet(dayBody(from), { title: title(t) + ' · ' + niceDate(t.from) + (t.days > 1 ? ' to ' + niceDate(t.to) : ''), onClose: () => { daySheet = null; } });
}
Object.assign(ACT, {
  'trip-pick': (el) => {
    const id = el.dataset.id, v = el.dataset.v, from = el.dataset.from, x = get().txs.find((q) => q.id === id); if (!x) return;
    commit((d) => {
      const pk = { ...(d.settings.tripPick || {}) }; pk[id] = v; d.settings.tripPick = pk;
      const b = x.kind === 'expense' ? brandOf(x.name) : ''; if (b) { const sh = { ...(d.settings.tripShop || {}) }; sh[b] = v; d.settings.tripShop = sh; }
    });
    if (daySheet) daySheet.el.innerHTML = dayBody(from);
    window.dispatchEvent(new Event('sukli-render'));
  },
  'trip-days': (el) => dayList(el.dataset.from),
  'trip-yes': (el) => { teach(el.dataset.from, true); toast('Thanks, Sukli will remember.'); window.dispatchEvent(new Event('sukli-render')); },
  'trip-no': (el) => { teach(el.dataset.from, false); toast('Hidden. Sukli will be less eager next time.'); window.dispatchEvent(new Event('sukli-render')); },
  'trip-name': async (el) => {
    const from = el.dataset.from, cur = ((get().settings.tripNotes || {})[from] || {}).name || '';
    const nm = await promptDialog('Name this trip or event', cur, { okLabel: 'Save', hint: 'For example: Okinawa trip, Mom birthday' }); if (nm == null) return;
    commit((d) => { const n = { ...(d.settings.tripNotes || {}) }; n[from] = { ...(n[from] || {}), s: (n[from] && n[from].s) || 'yes', name: nm.trim().slice(0, 40) }; d.settings.tripNotes = n; });
    window.dispatchEvent(new Event('sukli-render'));
  },
  'trip-reset': () => { commit((d) => { const n = { ...(d.settings.tripNotes || {}) }; for (const k of Object.keys(n)) if (n[k].s === 'no') delete n[k]; d.settings.tripNotes = n; }); window.dispatchEvent(new Event('sukli-render')); },
});
