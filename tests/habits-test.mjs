// Habit learning: daily life vs trips/events/moves, trip extra over the daily baseline. Synthetic life plus (optional) the real CSV.
import { analyzeHabits, habitRows } from '../js/habits.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const r = rng(5), iso = (n) => new Date(Date.UTC(2026, 0, 1) + n * 864e5).toISOString().slice(0, 10);
let id = 0; const E = (day, name, cat, amount, cur = 'PHP', extra = {}) => ({ id: 'e' + id++, date: iso(day) + ' 12:00:00', amount, cur, cat, catName: cat, group: extra.group || '', name, labels: extra.labels || '' });
const rows = [];
// 120 days of daily life: food 2 times a day at the usual shops, a bus, rent every 30 days, a USD subscription every 30 days
const shops = ['Jollibee', 'Mini Stop', 'Palengke', 'Carinderia', '7-eleven'];
for (let d = 0; d < 120; d++) {
  rows.push(E(d, shops[Math.floor(r() * 5)], 'Food', 100 + Math.round(r() * 60))); rows.push(E(d, shops[Math.floor(r() * 5)], 'Food', 90 + Math.round(r() * 60))); rows.push(E(d, 'Bus', 'Transport', 30 + Math.round(r() * 10)));
  if (d % 30 === 0) { rows.push(E(d, 'Landlord', 'Rent', 6000)); rows.push(E(d, 'Netflix', 'Subscription', 450, 'USD')); }
}
// a trip, days 60 to 63 (4 days), in JPY, new places, food costs much more; the hotel and flight were booked 20 days before
rows.push(E(40, 'Skyline Airlines', 'Plane tickets', 9000, 'PHP')); rows.push(E(41, 'Hotel Sakura', 'Accommodation', 8000, 'PHP'));
for (let d = 60; d < 64; d++) { rows.push(E(d, 'Ramen Ichi ' + d, 'Food', 420, 'JPY')); rows.push(E(d, 'Cafe Nara ' + d, 'Food', 380, 'JPY')); rows.push(E(d, 'Metro ' + d, 'Transport', 90, 'JPY')); }
const A = analyzeHabits(rows);
ok(A.regimes.length === 1 && A.regimes[0].cur === 'PHP', 'a 4-day trip abroad is not a move: home stays PHP');
const t = A.trips.find((x) => x.from >= iso(58) && x.to <= iso(65));
ok(!!t && t.from >= iso(59) && t.from <= iso(60) && t.to >= iso(63) && t.to <= iso(64), 'the trip is found at the right dates (' + (t ? t.from + ' to ' + t.to : 'none') + ')');
ok(t && t.why.some((w) => /currency/.test(w)), 'and it says why: other currency than home');
ok(t && t.bookings.length === 2, 'the flight and hotel booked weeks earlier are attached to the trip');
ok(A.trips.length === 1, 'daily life is not flagged: exactly one trip found (' + A.trips.length + ')');
ok(!A.days.filter((d) => d.d < 55).some((d) => d.out), 'the monthly USD subscription and rent never look like a trip');
// the extra over daily life: food on the trip 4 days x (420+380) = 3200; usual per day is about 2 x 130 = 260
const food = t && t.byCat.find((c) => c.name === 'Food');
ok(food && food.extra > 1800 && food.extra < 2600, 'trip food cost about ' + (food ? Math.round(food.actual) : '?') + ', usual rate about ' + (food ? Math.round(food.expected) : '?') + ', extra about ' + (food ? Math.round(food.extra) : '?'));
ok(t && !t.byCat.find((c) => c.name === 'Rent') , 'rent is not part of the trip');
ok(t && t.byCat.filter((c) => c.expected != null).every((c) => ['Food', 'Transport'].includes(c.name)), 'only daily-life categories are compared with the baseline');

// a tag you typed makes that day an event even without other clues, and any tag word counts
const rows2 = rows.filter((x) => x.cur !== 'JPY' && !/Skyline|Hotel/.test(x.name)); rows2.push(E(90, 'Chowking', 'Food', 700, 'PHP', { labels: 'Birthday' })); rows2.push(E(90, 'Jollibee', 'Food', 650, 'PHP', { labels: 'Birthday' }));
const B = analyzeHabits(rows2); ok(B.trips.some((x) => x.from === iso(90) && x.tags.includes('Birthday')), 'a Birthday tag marks that day as an event');

// a move: JPY for 40 days in a row at the end becomes the new home, those days are not a trip
const rows3 = rows.filter((x) => x.cur !== 'JPY' && !/Skyline|Hotel/.test(x.name)); for (let d = 121; d < 165; d++) { rows3.push(E(d, 'Lawson ' + (d % 4), 'Food', 600, 'JPY')); rows3.push(E(d, 'Station ' + (d % 3), 'Transport', 200, 'JPY')); }
const C = analyzeHabits(rows3);
ok(C.regimes.length === 2 && C.regimes[1].cur === 'JPY' && C.regimes[1].from >= iso(120) && C.regimes[1].from <= iso(125), 'moving: 3+ weeks in JPY makes JPY the new home (from ' + (C.regimes[1] && C.regimes[1].from) + ')');
ok(!C.days.some((d) => d.d >= 135 + 0 && d.date >= iso(135) && d.out), 'days well after the move are daily life, not a trip');
const jpFood = C.baseline['JPY|Food']; ok(jpFood && jpFood.entry === 600, 'the baseline restarts in the new currency (JPY food 600 per entry)');


// a trip booked months ago: the flight is paid 150 days earlier, the food happens on the trip
{
  const R = rows.filter((x) => x.cur !== 'JPY' && !/Skyline|Hotel/.test(x.name)); R.push(E(2, 'Skyline Airlines', 'Plane tickets', 12000, 'PHP'));
  for (let d = 100; d < 103; d++) { R.push(E(d, 'Hike Lunch ' + d, 'Food', 650, 'PHP', { labels: 'Hike' })); R.push(E(d, 'Trail Cafe ' + d, 'Food', 500, 'PHP', { labels: 'Hike' })); }
  const H = analyzeHabits(R), th = H.trips.find((x) => x.tags.includes('Hike'));
  ok(!!th && th.bookings.length === 1 && Math.abs(th.prepaid - 12000) < 1, 'a flight paid 150 days before is attached to the trip as prepaid (' + (th && Math.round(th.prepaid)) + ')');
  ok(!H.days.filter((d) => d.d >= 1 && d.d <= 3).some((d) => d.out) || H.trips.every((x) => x.from >= iso(99)), 'the booking day itself is not a trip day');
  const food = th.byCat.find((c) => c.name === 'Food'); ok(food && food.extra > 2500, 'food on the hike days costs more than usual: extra about ' + (food && Math.round(food.extra)));
  ok(Math.abs(th.trueCost - (th.prepaid + Math.max(0, th.extra) + (th.onTrip - th.compared))) < 1e-6 && th.trueCost > th.prepaid, 'true cost = prepaid + extra over daily + anything without a baseline');
  const F = analyzeHabits(R.filter((x) => !/Hike|Trail/.test(x.name))); ok(F.planned.length === 1 && F.planned[0].name === 'Skyline Airlines', 'a booking with no trip yet waits as planned');
}
// arrival in a new country is part of the move, not a trip
{
  const R = rows.filter((x) => x.cur !== 'JPY' && !/Skyline|Hotel/.test(x.name) && x.date < iso(112));       // from day 112 the person is in Japan and stops logging pesos
  for (let d = 112; d < 118; d++) { R.push(E(d, 'Konbini ' + d, 'Food', 500, 'JPY')); R.push(E(d, 'Ramen ' + d, 'Food', 900, 'JPY')); }
  for (let d = 118; d < 121; d++) R.push(E(d, 'Jollibee', 'Food', 120, 'PHP'));
  for (let d = 121; d < 165; d++) { R.push(E(d, 'Lawson ' + (d % 4), 'Food', 600, 'JPY')); R.push(E(d, 'Station ' + (d % 3), 'Transport', 200, 'JPY')); }
  const M = analyzeHabits(R); ok(M.regimes.length === 2 && M.regimes[1].from <= iso(113), 'the new home starts at the first days there (' + (M.regimes[1] && M.regimes[1].from) + ')');
  ok(!M.trips.some((x) => x.from >= iso(110) && x.from <= iso(120)), 'the arrival days are not called a trip');
}

ok(analyzeHabits([]).trips.length === 0 && analyzeHabits(null).trips.length === 0, 'no entries: nothing found');
const few = analyzeHabits(rows.slice(0, 6)); ok(Array.isArray(few.trips), 'very few entries do not break it');

// the real file, when given: your own Vacation tag dates should fall inside found windows, and not every other day is a trip
const csv = process.argv[2];
if (csv) {
  const fs = await import('fs'), { importBluecoins } = await import('../js/importer.js'), { emptyDb, homeFx } = await import('../js/core.js');
  const db = emptyDb(); importBluecoins(db, fs.readFileSync(csv, 'utf8'));
  const R = habitRows(db, homeFx), real = analyzeHabits(R), tagged = [...new Set(R.filter((x) => /vacation/i.test(x.labels)).map((x) => x.date.slice(0, 10)))];
  const inside = tagged.filter((d) => real.trips.some((tr) => d >= tr.from && d <= tr.to || tr.entries.some((e) => (R.find((x) => x.id === e) || {}).date.slice(0, 10) === d)));
  ok(tagged.length === 0 || inside.length / tagged.length >= 0.9, 'real data: ' + inside.length + ' of ' + tagged.length + ' days you tagged Vacation sit inside a found trip');
  ok(real.days.filter((d) => d.out).length < real.days.length * 0.2, 'real data: under 20% of days flagged (' + real.days.filter((d) => d.out).length + ' of ' + real.days.length + ')');
  const jp = real.regimes.find((x) => x.cur === 'JPY'); ok(jp && jp.from <= '2026-07-03', 'real data: the move to Japan is found, home from ' + (jp && jp.from));
  ok(!real.trips.some((x) => x.from <= '2026-07-06' && x.to >= '2026-07-01'), 'real data: 1 to 6 July is the move, not a trip');
}
process.exit(bad ? 1 : 0);
