// Trips and events (Advanced): what Sukli has learned about the times your spending left daily life (js/habits.js).
// Everything here is a suggestion with the reason shown. Yes / No teaches Sukli: it never changes an entry, a category or a budget.
import { get, commit, fmt, HOME, homeFx, nowStamp } from './core.js';
import { ACT, esc, toast, promptDialog } from './ui.js';
import { hdr } from './screens.js';
import { analyzeHabits, habitRows, WEIGHTS } from './habits.js';

const money = (n) => fmt(n, HOME, { round: true });
const niceDate = (s) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const WHY = { 'you tagged it': 'you tagged it', 'other currency than home': 'spent in another currency', 'travel spending': 'a flight, hotel or similar', 'mostly new places': 'mostly new places', 'far above a usual day': 'a much bigger day than usual', 'arrival in the new home currency': 'arriving in your new home' };
const CLUE = { 'you tagged it': 'tag', 'other currency than home': 'cur', 'travel spending': 'travel', 'mostly new places': 'novel', 'far above a usual day': 'high' };

// what Sukli has learned about how much each clue counts: Yes nudges it up, No nudges it down (kept between 0.4x and 1.6x of the start)
export const learnedWeights = (db) => {
  const w = { ...WEIGHTS }, adj = (db.settings && db.settings.habitW) || {};
  for (const k of Object.keys(w)) w[k] = WEIGHTS[k] * Math.min(1.6, Math.max(0.4, adj[k] || 1));
  return w;
};
export function tripReport(db) {
  const notes = (db.settings && db.settings.tripNotes) || {}, rows = habitRows(db, homeFx);
  const res = analyzeHabits(rows, { weights: learnedWeights(db) });
  const trips = res.trips.filter((t) => !(notes[t.from] && notes[t.from].s === 'no')).map((t) => ({ ...t, note: notes[t.from] || null }));
  const active = new Set(rows.map((r) => String(r.date).slice(0, 10))).size;
  return { res, trips, rejected: res.trips.length - trips.length, learning: active < 21 || rows.length < 40, planned: res.planned.filter((p) => p.amount >= 1000) };
}
const title = (t) => (t.note && t.note.name) || (t.tags.length ? t.tags.join(' / ') : 'Trip or event');

function card(t) {
  const cats = t.byCat.filter((c) => c.expected != null && Math.abs(c.extra) >= 1).slice(0, 4), reasons = [...new Set(t.why.map((w) => WHY[w]).filter(Boolean))];
  const asked = t.note && t.note.s === 'yes';
  return `<article class="card tripcard" data-from="${t.from}"><div class="sgtop"><b>${esc(title(t))}</b><span>${money(t.trueCost)}</span></div>
    <small>${niceDate(t.from)}${t.days > 1 ? ' to ' + niceDate(t.to) : ''} · ${t.days} day${t.days === 1 ? '' : 's'} · ${asked ? 'you confirmed this' : 'Sukli thinks: ' + esc(reasons.join(', ') || 'looks different from daily life')}</small>
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
  if (r.learning) body += `<section class="card"><p class="hint"><b>Still learning.</b> Sukli needs about three weeks of entries to know what a usual day looks like for you. Until then, anything it shows here is a guess.</p></section>`;
  if (!r.trips.length) body += `<section class="card"><h2>How it works</h2><p>Just add your entries as usual: the shop, the amount, the date, and a tag like <i>Vacation</i> or <i>Birthday</i> if you want. Sukli learns what a normal day costs you, then notices days that are different: another currency, a flight or hotel, lots of new places, or a tag you added.</p><p>It then shows what a trip cost and how much was <b>extra</b> compared with a usual day. Nothing is changed in your entries.</p></section>`;
  else {
    body += `<section class="card"><p class="hint">${thisYear.length} trip${thisYear.length === 1 ? '' : 's'} or event${thisYear.length === 1 ? '' : 's'} so far this year, ${money(thisYear.reduce((s, t) => s + t.trueCost, 0))} in total.</p></section>`;
    body += r.trips.slice().sort((a, b) => (a.from < b.from ? 1 : -1)).map(card).join('');
  }
  if (r.planned.length) body += `<section class="card"><h2>Paid for, trip not yet</h2><p class="hint">Flights, hotels and similar you have paid for. They join the trip when it happens.</p><ul class="calfacts">${r.planned.map((p) => `<li><span>${esc(p.name)} · ${niceDate(p.date)}</span><b>${money(p.amount)}</b></li>`).join('')}</ul></section>`;
  if (r.rejected) body += `<section class="card"><p class="hint">${r.rejected} suggestion${r.rejected === 1 ? '' : 's'} you said were not trips are hidden. <button type="button" class="linkbtn" data-act="trip-reset">Show them again</button></p></section>`;
  return `${hdr('Trips and events')}<main class="page" id="trippage">${body}</main>`;
}

function teach(from, yes) {
  const db = get(), t = tripReport(db).res.trips.find((x) => x.from === from);
  commit((d) => {
    const n = { ...(d.settings.tripNotes || {}) }; n[from] = { ...(n[from] || {}), s: yes ? 'yes' : 'no' }; d.settings.tripNotes = n;
    if (t) { const w = { ...(d.settings.habitW || {}) }; for (const why of new Set(t.why)) { const k = CLUE[why]; if (k) w[k] = Math.min(1.6, Math.max(0.4, (w[k] || 1) * (yes ? 1.05 : 0.9))); } d.settings.habitW = w; }
  });
}
Object.assign(ACT, {
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
