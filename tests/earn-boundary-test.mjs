// Earn hour boundaries: a subscribe never earns the hour in progress (even at 20:00:00.000 or 20:00:00.001), and an unsubscribe
// inside an hour (20:59) takes that whole hour away; only a full hour pays. Hour paid at T covers T-1h to T.
import './nodeenv.mjs';
import { earnStartOf, principalAt, DEFAULT, H } from '../js/earn.js';
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const at = (h, m = 0, s = 0, ms = 0) => Date.UTC(2026, 10, 15, h, m, s, ms);   // the clock is UTC+0 here; the rule does not depend on the zone
const c = { ...DEFAULT };
const sub = (t) => { const start = earnStartOf(t, c, 0); return { id: 's', amt: 100, sub: t, start, first: start + c.firstLagH * H }; };
const red = (t) => ({ id: 'r', amt: 100, at: t });
const earns = (s, r, T) => principalAt(null, null, T, [s], r ? [r] : []) > 0;   // does the hour that ends at T pay?
// subscribing
for (const [label, t] of [['20:00:00.000', at(20)], ['20:00:00.001', at(20, 0, 0, 1)], ['20:30', at(20, 30)], ['20:59:59.999', at(20, 59, 59, 999)]]) {
  const s = sub(t);
  ok(s.start === at(21) && s.first === at(22), `subscribe ${label}: earning starts 21:00, first payout 22:00`);
  ok(!earns(s, null, at(21)), `subscribe ${label}: the hour 20:00-21:00 does not pay`);
  ok(earns(s, null, at(22)), `subscribe ${label}: the hour 21:00-22:00 pays`);
}
{ const s = sub(at(19, 59, 59, 999)); ok(s.start === at(20) && earns(s, null, at(21)) && !earns(s, null, at(20)), 'subscribe 19:59:59.999: the 20:00-21:00 hour is the first one that pays'); }
// unsubscribing (money subscribed earlier, so it is earning)
const s0 = sub(at(10, 15));
ok(earns(s0, red(at(20, 59)), at(20)), 'unsubscribe 20:59: the hour 19:00-20:00 still paid');
ok(!earns(s0, red(at(20, 59)), at(21)), 'unsubscribe 20:59: the hour 20:00-21:00 does not pay (not a full hour)');
ok(!earns(s0, red(at(20, 59, 59, 999)), at(21)), 'unsubscribe 20:59:59.999: still no pay for 20:00-21:00');
ok(earns(s0, red(at(21)), at(21)), 'unsubscribe exactly 21:00:00.000: the full hour 20:00-21:00 pays');
ok(!earns(s0, red(at(21)), at(22)), 'unsubscribe exactly 21:00:00.000: nothing after it');
ok(earns(s0, red(at(21, 0, 0, 1)), at(21)) && !earns(s0, red(at(21, 0, 0, 1)), at(22)), 'unsubscribe 21:00:00.001: 20:00-21:00 was a full hour so it pays; 21:00-22:00 does not');
console.log(bad ? 'FAILED ' + bad : 'all passed'); process.exit(bad ? 1 : 0);
