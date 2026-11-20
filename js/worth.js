// Worth Knowing: a small local analyst. It looks for things in your own entries that are easy to miss, scores them, remembers what it
// already told you, and speaks up only when something real stands out. Everything runs on this device; nothing is sent anywhere.
//
// Each finder returns at most one insight, or nothing when the data cannot support it:
//   { key, sig, topic, kind, tone, title, evidence[], matters, action, impact, conf, rel }
//   kind: 'fact' (counted from your entries) | 'estimate' (counted, then reasoned from) | 'projection' (looks forward, can be wrong)
//   impact, conf, rel: 0 to 1 (how much it could matter, how sure the numbers are, how personal it is). They decide the ranking.
import { monthParts, partsBetween, shiftMonth, catMap, fmt, HOME, homeFx, balances, live, nowStamp } from './core.js';
import { median } from './stats.js';
import { classOf } from './budgetsetup.js';
import { detectRecurring } from './finance.js';
import { goalStats } from './savings.js';
import { usualLeftover } from './goalcheck.js';
import { merchantKey } from './merchants.js';

const sum = (a) => a.reduce((s, x) => s + x, 0), mean = (a) => (a.length ? sum(a) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)); };
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const dayN = (d) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5);
const isoOf = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const money = (n) => fmt(n, HOME, { round: true });
const pctS = (x) => `${Math.round(x * 100)}%`;
const wknd = (d) => { const w = new Date(dayN(d) * 864e5).getUTCDay(); return w === 0 || w === 6; };

// ---------- the numbers every finder shares (worked out once per run) ----------
function prepare(db, today) {
  const ym = today.slice(0, 7), cm = catMap(db), months = [];
  for (let i = 1; i <= 12; i++) {
    const m = shiftMonth(ym, -i), parts = monthParts(db, m), exp = parts.filter((p) => p.kind === 'expense'), inc = parts.filter((p) => p.kind === 'income');
    if (!exp.length && !inc.length) { if (months.length) break; continue; }
    const by = new Map(), cls = { need: 0, want: 0, luxury: 0 };
    for (const p of exp) { by.set(p.group, (by.get(p.group) || 0) + p.v); cls[classOf(cm.get(p.cat))] += p.v; }
    months.push({ m, spent: sum(exp.map((p) => p.v)), income: sum(inc.map((p) => p.v)), by, cls, exp, inc });
  }
  months.reverse();   // oldest first; only whole months, the one in progress is left out
  const from = isoOf(dayN(today) - 90), win = partsBetween(db, from, today).filter((p) => p.kind === 'expense');
  const bal = balances(db); let liquid = 0, invest = 0; const holds = [];
  for (const a of live(db.accounts)) {
    if (a.archived || a.include === false) continue; const v = (bal.get(a.id) || 0) * (homeFx(db, a.cur) || 0);
    if (['cash', 'bank', 'ewallet', 'ic'].includes(a.type)) { if (v > 0) liquid += v; }
    else if (a.type === 'crypto' || a.type === 'invest' || a.invtab) { if (v > 0) { invest += v; holds.push({ a, v }); } }
  }
  return { db, today, ym, cm, months, win, liquid, invest, holds, last: months[months.length - 1] };
}
const VAGUE = /^(others?|uncategori[sz]ed|misc\w*|adjustments?|unknown)$/i;
const mk = (o) => ({ evidence: [], action: '', tone: 'note', kind: 'fact', rel: 0.7, ...o });

// ---------- finders ----------

// 1. small weekday purchases against whole weekends
function smallWeekday(X) {
  const w = X.win; if (w.length < 40) return null;
  const small = median(w.map((p) => p.v));
  let sw = 0, n = 0, we = 0; const by = new Map();
  for (const p of w) { const d = p.t.date.slice(0, 10); if (wknd(d)) we += p.v; else if (p.v <= small) { sw += p.v; n++; const k = merchantKey(p.t.name || '') || (p.t.name || '').toLowerCase(); if (k) by.set(k, { name: p.t.name, v: (by.get(k) || { v: 0 }).v + p.v }); } }
  const all = sum(w.map((p) => p.v)); if (!(we > 0) || sw < we * 1.15 || sw / all < 0.2 || n < 25) return null;
  const top = [...by.values()].sort((a, b) => b.v - a.v).slice(0, 2).filter((x) => x.v > sw * 0.08);
  return mk({ key: 'smallweekday', sig: 'smallweekday', topic: 'habit', kind: 'fact', tone: 'warn', rel: 0.9, conf: clamp(n / 80, 0.5, 0.95), impact: clamp(sw / all + 0.2),
    title: `Your everyday weekday purchases add up to more than your weekends: ${money(sw)} against ${money(we)}.`,
    evidence: [`${n} weekday purchases of ${money(small)} or less in the last 90 days came to ${money(sw)} (${pctS(sw / all)} of all spending).`, `Everything you spent on Saturdays and Sundays in the same period was ${money(we)}.`, ...(top.length ? [`Most of it goes to ${top.map((t) => `“${t.name}”`).join(' and ')}.`] : [])],
    matters: 'Each one is too small to notice, so this kind of spending rarely gets questioned, while weekends feel expensive because they are one-off events.',
    action: top.length ? `If you want a lever, start with ${top[0].name}: a fixed weekly amount for it is easier to hold than deciding each time.` : 'A weekly allowance for small purchases makes them visible without tracking each one.' });
}

// 2. spending fell but the mix moved (or rose for one clear reason)
function mixShift(X) {
  const M = X.months; if (M.length < 4) return null;
  const cur = M[M.length - 1], base = M.slice(-4, -1), bs = mean(base.map((m) => m.spent)); if (!(bs > 0) || !(cur.spent > 0)) return null;
  const d = (k) => cur.cls[k] - mean(base.map((m) => m.cls[k])), disc = d('want') + d('luxury'), need = d('need'), total = cur.spent - bs;
  const dr = (x) => x / bs;
  if (total < 0 && dr(total) <= -0.06 && disc > 0 && dr(disc) >= 0.05 && need < 0)
    return mk({ key: 'mixshift', sig: 'mixshift:down:' + cur.m, topic: 'habit', tone: 'warn', rel: 0.95, conf: 0.85, impact: clamp(dr(disc) * 4 + 0.3),
      title: `You spent less overall last month, but your discretionary spending went up. The saving came from essentials.`,
      evidence: [`Total spending ${money(cur.spent)} against a usual ${money(bs)} (${pctS(Math.abs(dr(total)))} lower).`, `Wants and luxuries rose ${money(disc)} above their usual, while needs fell ${money(-need)}.`],
      matters: 'A drop in needs is usually a quiet month (fewer bills, less commuting), not a change in habits. The part you actually choose moved the other way.',
      action: 'Treat last month as a lucky month rather than a new baseline: the lower total is unlikely to repeat unless the discretionary part also comes down.' });
  const sh = (m) => (m.cls.want + m.cls.luxury) / Math.max(1, m.spent), now = sh(cur), was = mean(base.map(sh));
  if (now - was >= 0.08 && Math.abs(dr(total)) < 0.06)
    return mk({ key: 'mixshift', sig: 'mixshift:flat:' + cur.m, topic: 'habit', tone: 'note', rel: 0.85, conf: 0.8, impact: clamp((now - was) * 3 + 0.2),
      title: `Your total spending barely moved last month, but more of it went on things you choose: ${pctS(now)} against ${pctS(was)} before.`,
      evidence: [`Wants and luxuries were ${money(cur.cls.want + cur.cls.luxury)} of ${money(cur.spent)}.`, `Over the three months before, they averaged ${pctS(was)} of spending.`],
      matters: 'A steady total hides a change of mix. The part that is easiest to adjust has grown while bills stayed put.', action: 'Look at which flexible group grew most in Spending by Group.' });
  return null;
}

// 3. how long the cash would last
function resilience(X) {
  const M = X.months.slice(-3); if (M.length < 3 || !(X.liquid > 0)) return null;
  const mo = median(M.map((m) => m.spent)), needs = median(M.map((m) => m.cls.need)); if (!(mo > 0)) return null;
  const runs = X.liquid / mo, runN = needs > 0 ? X.liquid / needs : null;
  const due = detectRecurring(X.db, X.today).filter((r) => r.next >= X.today && dayN(r.next) - dayN(X.today) <= 14), dueSum = sum(due.map((r) => r.amount));
  const tone = runs >= 6 ? 'good' : runs >= 3 ? 'note' : 'warn';
  return mk({ key: 'resilience', sig: 'resilience:' + Math.floor(runs), topic: 'safety', kind: 'estimate', tone, rel: 1, conf: 0.8, impact: runs < 3 ? 0.95 : runs < 6 ? 0.7 : 0.45,
    title: `Your cash and bank accounts would cover about ${runs.toFixed(1)} months of your usual spending with no income.`,
    evidence: [`${money(X.liquid)} in cash, banks and e-wallets, against ${money(mo)} a month (median of the last 3 whole months).`, ...(runN ? [`Bills and other essentials alone are ${money(needs)} a month, which would stretch it to ${runN.toFixed(1)} months.`] : []), ...(dueSum > 0 ? [`${due.length} regular payment${due.length > 1 ? 's' : ''} totalling ${money(dueSum)} fall${due.length > 1 ? '' : 's'} due in the next two weeks.`] : [])],
    matters: 'This is the number that decides how much a lost job, a late payment or a big bill can hurt. It is an estimate: it assumes spending stays at its recent level.',
    action: runs < 3 ? 'Three months is the usual first target. Adding a goal for it makes progress visible.' : runs < 6 ? `Reaching six months would take about ${money(mo * 6 - X.liquid)} more.` : 'You are past the usual cushion, so extra cash could be put to work without leaving you thin.' });
}

// 4. income went up, saving did not
function savingsRate(X) {
  const M = X.months.slice(-6); if (M.length < 6 || M.some((m) => !(m.income > 0))) return null;
  const a = M.slice(0, 3), b = M.slice(3), ia = mean(a.map((m) => m.income)), ib = mean(b.map((m) => m.income));
  const sr = (g) => (sum(g.map((m) => m.income)) - sum(g.map((m) => m.spent))) / sum(g.map((m) => m.income)), ra = sr(a), rb = sr(b), gain = ib / ia - 1;
  if (gain >= 0.08 && rb - ra <= 0.03)
    return mk({ key: 'savingsrate', sig: 'savingsrate:up:' + b[2].m, topic: 'flow', kind: 'estimate', tone: 'warn', rel: 0.95, conf: 0.8, impact: clamp(gain * 3 + 0.3),
      title: `Your income rose ${pctS(gain)} over the last three months, but the share you keep is ${pctS(ra)} before and ${pctS(rb)} now.`,
      evidence: [`Income averaged ${money(ia)} a month, now ${money(ib)}.`, `Spending went from ${money(mean(a.map((m) => m.spent)))} to ${money(mean(b.map((m) => m.spent)))} a month: about ${pctS(Math.min(1, (mean(b.map((m) => m.spent)) - mean(a.map((m) => m.spent))) / (ib - ia)))} of the extra income was spent.`],
      matters: 'When spending rises with every raise, a higher income does not build a bigger cushion. It is common and rarely noticed.',
      action: `Deciding in advance where part of the extra ${money(ib - ia)} goes (a transfer on payday) keeps it from being absorbed.` });
  if (rb - ra >= 0.08 && gain < 0.05)
    return mk({ key: 'savingsrate', sig: 'savingsrate:better:' + b[2].m, topic: 'flow', tone: 'good', rel: 0.9, conf: 0.8, impact: clamp((rb - ra) * 3 + 0.2),
      title: `You now keep ${pctS(rb)} of what comes in, up from ${pctS(ra)}, without earning more.`,
      evidence: [`Income is flat (${money(ia)} to ${money(ib)} a month).`, `Spending fell from ${money(mean(a.map((m) => m.spent)))} to ${money(mean(b.map((m) => m.spent)))} a month.`],
      matters: 'This improvement came from spending, so it is yours to keep, not from a one-off payment.', action: 'Moving the difference into savings on payday locks it in before it is spent.' });
  return null;
}

// 5. what a small cut would do to a goal
function goalCost(X) {
  const gs = live(X.db.goals || []).filter((g) => !g.reachedAck && g.target > 0); if (!gs.length || X.months.length < 3) return null;
  const last3 = X.months.slice(-3), flex = new Map();
  for (const m of last3) for (const p of m.exp) { if (classOf(X.cm.get(p.cat)) === 'need') continue; flex.set(p.group, (flex.get(p.group) || 0) + p.v / 3); }
  const top = [...flex.entries()].sort((a, b) => b[1] - a[1])[0]; if (!top || top[1] < 1) return null;
  const cut = top[1] * 0.2; let best = null;
  for (const g of gs) {
    const s = goalStats(X.db, g, X.today); if (s.reached || !(s.left > 0)) continue;
    const pace = s.pace != null ? s.pace * s.rate : (usualLeftover(X.db, X.today).perMonth || 0); if (!(pace > 0)) continue;
    const left = s.left * s.rate, now = left / pace, then = left / (pace + cut), gain = now - then;
    if (gain >= 0.5 && (!best || gain > best.gain)) best = { g, left, now, then, gain, pace, due: g.due };
  }
  if (!best) return null; const mo = Math.round(best.gain * 2) / 2;
  return mk({ key: 'goalcost', sig: 'goalcost:' + best.g.id + ':' + top[0], topic: 'goal', kind: 'projection', tone: 'note', rel: 1, conf: 0.6, impact: clamp(best.gain / 6 + 0.3),
    title: `Trimming ${top[0]} by 20% would bring “${best.g.name}” about ${mo === 1 ? 'a month' : mo + ' months'} closer.`,
    evidence: [`${top[0]} is your largest flexible group at about ${money(top[1])} a month (last 3 months).`, `20% of that is ${money(cut)} a month. ${money(best.left)} is still needed and you are adding about ${money(best.pace)} a month.`, `At that pace, ${best.now.toFixed(1)} months; with the cut, ${best.then.toFixed(1)}.`],
    matters: 'This is a projection: it assumes both your pace and the cut hold. It shows which trade-off actually moves the date, not what you must do.',
    action: best.due ? `Your goal date is ${best.due}.` : 'Setting a goal date would show whether this pace is enough.' });
}

// 6. regular payments: how much of the month is already spoken for, and any that crept up
function committed(X) {
  const rec = detectRecurring(X.db, X.today); if (rec.length < 3) return null; const M = X.months.slice(-3); if (M.length < 3) return null;
  const tot = sum(rec.map((r) => r.monthly)), inc = mean(M.map((m) => m.income)), sp = mean(M.map((m) => m.spent));
  const rose = [];
  for (const r of rec) {
    const amts = []; for (const p of partsBetween(X.db, isoOf(dayN(X.today) - 800), X.today)) if (p.kind === 'expense' && p.t.name && merchantKey(p.t.name) === r.key) amts.push({ d: p.t.date.slice(0, 10), v: p.v });
    amts.sort((a, b) => (a.d < b.d ? -1 : 1)); if (amts.length < 4) continue;
    const old = median(amts.slice(0, -2).map((x) => x.v)), l1 = amts[amts.length - 1].v, l2 = amts[amts.length - 2].v;
    if (old > 0 && Math.abs(l1 - l2) / old < 0.02 && l1 / old >= 1.06) rose.push({ r, old, now: l1, since: amts.find((x) => Math.abs(x.v - l1) / old < 0.02 && x.v > old * 1.04) });
  }
  rose.sort((a, b) => (b.now - b.old) * b.r.monthly / b.r.amount - (a.now - a.old) * a.r.monthly / a.r.amount);
  if (rose[0]) { const x = rose[0], yr = (x.now - x.old) * (x.r.monthly / x.r.amount) * 12;
    return mk({ key: 'committed', sig: 'committed:rise:' + x.r.key + ':' + Math.round(x.now), topic: 'bills', tone: 'warn', rel: 0.95, conf: 0.9, impact: clamp(yr / Math.max(1, sp * 12) * 12 + 0.2),
      title: `“${x.r.name}” now costs ${money(x.now)} ${x.r.every === 'monthly' ? 'a month' : x.r.every}, up from ${money(x.old)}.`,
      evidence: [`The last two payments were both ${money(x.now)}; before that it was around ${money(x.old)}.`, `That is about ${money(yr)} more over a year.`],
      matters: 'Price rises on regular payments are announced quietly and then repeat every period, so they are easy to miss.', action: 'Worth checking whether the plan is still the one you want, or whether a cheaper one exists.' }); }
  if (inc > 0 && tot / inc >= 0.2)
    return mk({ key: 'committed', sig: 'committed:share:' + Math.floor(tot / inc * 20), topic: 'bills', kind: 'estimate', tone: 'note', rel: 0.9, conf: 0.7, impact: clamp(tot / inc + 0.1),
      title: `About ${pctS(tot / inc)} of your income is already committed to regular payments before the month starts.`,
      evidence: [`${rec.length} repeating payments add up to roughly ${money(tot)} a month (found from their timing and amounts).`, `Largest: ${rec.slice(0, 3).map((r) => `${r.name} ${money(r.monthly)}`).join(', ')}.`],
      matters: 'These do not feel like choices month to month, which is why they matter: cutting one saves every month, unlike a one-off.', action: 'Look at the list once a year; the ones you no longer use are the cheapest savings.' });
  return null;
}

// 7. a group that moved to a new level and stayed there (not a one-off)
function levelShift(X) {
  const M = X.months.slice(-6); if (M.length < 6) return null; const groups = new Set(); for (const m of M) for (const g of m.by.keys()) groups.add(g);
  const tot = mean(M.map((m) => m.spent)); let best = null;
  for (const g of groups) {
    if (VAGUE.test(g)) continue;
    const v = M.map((m) => m.by.get(g) || 0), a = v.slice(0, 3), b = v.slice(3), ma = mean(a), mb = mean(b), s = Math.max(sd(a), ma * 0.05), d = mb - ma;
    if (Math.abs(d) < tot * 0.03 || Math.abs(d) < ma * 0.2) continue;
    const persist = d > 0 ? Math.min(...b) > ma + s * 0.5 : Math.max(...b) < ma - s * 0.5; if (!persist || Math.abs(d) < s * 1.5) continue;
    if (!best || Math.abs(d) > Math.abs(best.d)) best = { g, d, ma, mb, v };
  }
  if (!best) return null; const up = best.d > 0;
  return mk({ key: 'levelshift', sig: 'levelshift:' + best.g + ':' + (up ? 'up' : 'down'), topic: 'trend', grp: best.g, tone: up ? 'warn' : 'good', rel: 0.95, conf: 0.8, impact: clamp(Math.abs(best.d) / tot * 5 + 0.2),
    title: up ? `${best.g} has settled at a higher level: about ${money(best.d)} a month more than before.` : `${best.g} has settled lower: about ${money(-best.d)} a month less than before.`,
    evidence: [`The last three months: ${best.v.slice(3).map(money).join(', ')}. The three before: ${best.v.slice(0, 3).map(money).join(', ')}.`, `All three recent months sit ${up ? 'above' : 'below'} everything in the earlier stretch, so this is a new level, not a bad month.`],
    matters: up ? `At this level it adds about ${money(best.d * 12)} over a year.` : `That frees about ${money(-best.d * 12)} over a year, if it holds.`,
    action: up ? 'Decide whether it is the new normal (then update your budget) or something to bring back.' : 'Moving the freed amount to savings now keeps it from being absorbed elsewhere.' });
}

// 8. more visits or bigger tickets?
function visitsVsTicket(X) {
  const M = X.months.slice(-6); if (M.length < 6) return null; let best = null;
  const dec = (ms, g) => { const days = new Set(); let v = 0; for (const m of ms) for (const p of m.exp) if (p.group === g) { days.add(p.t.date.slice(0, 10)); v += p.v; } return { v, days: days.size }; };
  const groups = new Set(); for (const m of M) for (const g of m.by.keys()) groups.add(g);
  for (const g of groups) {
    if (VAGUE.test(g)) continue;
    const a = dec(M.slice(0, 3), g), b = dec(M.slice(3), g); if (a.days < 12 || b.days < 12 || a.v < 1) continue;
    const dv = b.v / a.v - 1, dn = b.days / a.days - 1, dt = (b.v / b.days) / (a.v / a.days) - 1; if (Math.abs(dv) < 0.18 || Math.abs(b.v - a.v) < mean(M.map((m) => m.spent)) * 0.025) continue;
    const kind = Math.abs(dn) >= Math.abs(dt) * 2 ? 'visits' : Math.abs(dt) >= Math.abs(dn) * 2 ? 'ticket' : null; if (!kind) continue;
    if (!best || Math.abs(b.v - a.v) > Math.abs(best.dv$)) best = { g, a, b, dv, dn, dt, kind, dv$: b.v - a.v };
  }
  if (!best) return null; const { g, a, b, dv, dn, dt, kind } = best, up = dv > 0;
  return mk({ key: 'visits', sig: `visits:${g}:${kind}:${up ? 'up' : 'down'}`, topic: 'trend', grp: g, kind: 'fact', tone: up ? 'warn' : 'good', rel: 0.85, conf: 0.75, impact: clamp(Math.abs(best.dv$) / mean(M.map((m) => m.spent)) * 5 + 0.2),
    title: kind === 'visits' ? `${g} ${up ? 'rose' : 'fell'} ${pctS(Math.abs(dv))} because of ${up ? 'more' : 'fewer'} days with a purchase, not because each one costs ${up ? 'more' : 'less'}.` : `${g} ${up ? 'rose' : 'fell'} ${pctS(Math.abs(dv))} because each purchase ${up ? 'costs more' : 'costs less'}, not because you buy more often.`,
    evidence: [`Days with a purchase: ${a.days} then ${b.days} (${dn >= 0 ? '+' : ''}${pctS(dn)}).`, `Average spent on those days: ${money(a.v / a.days)} then ${money(b.v / b.days)} (${dt >= 0 ? '+' : ''}${pctS(dt)}).`],
    matters: kind === 'visits' ? (up ? 'A habit that grows by frequency is about routine and convenience, so cheaper prices rarely help. A rule about how often does.' : 'Fewer occasions is a change of routine, which tends to last longer than cutting the price of each one.') : (up ? 'When the ticket grows, what changed is the choice at the moment of buying (what you pick, where you go), not the routine.' : 'Smaller tickets mean you changed what you pick or where you go, while the routine stayed. That is the kind of change that is easy to keep.'),
    action: up ? (kind === 'visits' ? 'A weekly limit on how many times may do more than a limit on the amount.' : 'Comparing what you buy now with what you bought before shows what changed.') : 'If the lower level is on purpose, it is worth keeping the same limit next month so it becomes the new usual.' });
}

// 9. a few discretionary purchases carry the quarter
function bigFew(X) {
  const w = X.win.filter((p) => classOf(X.cm.get(p.cat)) !== 'need'); if (w.length < 40) return null;
  const all = sum(w.map((p) => p.v)), s = [...w].sort((a, b) => b.v - a.v); let acc = 0, n = 0; while (n < s.length && acc < all * 0.4) acc += s[n++].v;
  if (n / w.length > 0.08 || n < 2) return null;
  return mk({ key: 'bigfew', sig: 'bigfew:' + X.ym, topic: 'habit', tone: 'note', rel: 0.85, conf: 0.8, impact: clamp(0.35 + (1 - n / w.length) * 0.3),
    title: `${n} purchases out of ${w.length} make up 40% of everything you chose to spend on in the last 90 days.`,
    evidence: [`Together ${money(acc)} of ${money(all)} on wants and luxuries. The largest: ${s.slice(0, 3).map((p) => `${p.label || p.t.name || 'entry'} ${money(p.v)}`).join(', ')}.`],
    matters: 'Your month is decided by a handful of large choices, not by the daily ones. Trimming small things has little effect compared with deciding about the big ones.', action: 'A pause rule for purchases above a set amount (sleep on it for a day) works on exactly these.' });
}

// 10. the week after payday
function payday(X) {
  const M = X.months.slice(-6); if (M.length < 5) return null; const rows = [];
  for (const m of M) {
    const big = [...m.inc].sort((a, b) => b.v - a.v)[0]; if (!big || big.v < m.income * 0.5) continue;
    const d0 = dayN(big.t.date.slice(0, 10)), disc = m.exp.filter((p) => classOf(X.cm.get(p.cat)) !== 'need'), tot = sum(disc.map((p) => p.v)); if (tot <= 0) continue;
    rows.push(sum(disc.filter((p) => { const k = dayN(p.t.date.slice(0, 10)) - d0; return k >= 0 && k < 7; }).map((p) => p.v)) / tot);
  }
  if (rows.length < 4) return null; const f = median(rows); if (f < 0.4 || rows.filter((x) => x >= 0.35).length < rows.length - 1) return null;
  return mk({ key: 'payday', sig: 'payday', topic: 'flow', tone: 'note', rel: 0.9, conf: clamp(rows.length / 6, 0.6, 0.9), impact: 0.6,
    title: `${pctS(f)} of your discretionary spending happens in the 7 days after your main pay arrives.`,
    evidence: [`Over ${rows.length} months, the first week after the largest income entry held a median of ${pctS(f)} of that month’s wants and luxuries. An even spread would be about 23%.`],
    matters: 'The money feels most available right after payday, so that is when the least thought goes into it. Later in the month you are left with what is left.',
    action: 'Moving savings out the same day pay arrives (before the first week) changes what feels available.' });
}

// 11. income that moves around
function incomeSwing(X) {
  const M = X.months.slice(-6); if (M.length < 6 || M.some((m) => !(m.income > 0))) return null; const inc = M.map((m) => m.income), mu = mean(inc), cv = sd(inc) / mu, low = Math.min(...inc), sp = mean(M.map((m) => m.spent));
  if (cv < 0.25) return null;
  return mk({ key: 'incomeswing', sig: 'incomeswing', topic: 'safety', kind: 'fact', tone: 'warn', rel: 0.9, conf: 0.8, impact: clamp(cv + 0.3),
    title: `Your income swings a lot: your weakest month brought in ${money(low)}, a typical month ${money(median(inc))}.`,
    evidence: [`Last ${M.length} months: ${inc.map(money).join(', ')}.`, low < sp ? `The weakest month was ${money(sp - low)} below what you normally spend.` : `Even the weakest month covered your usual spending of ${money(sp)}.`],
    matters: 'With uneven income, the average hides the months that hurt. What counts is how long you can cover a low month.', action: low < sp ? `Keeping about ${money((sp - low) * 2)} aside would cover two weak months like that.` : 'Your spending sits below your weakest month, which is a good place to be.' });
}

// 12. all eggs in one basket
function concentration(X) {
  if (X.invest < 1 || X.invest / Math.max(1, X.invest + X.liquid) < 0.2) return null; const top = [...X.holds].sort((a, b) => b.v - a.v)[0]; if (!top) return null;
  const by = new Map(); for (const h of X.holds) by.set(h.a.cur, (by.get(h.a.cur) || 0) + h.v); const c = [...by.entries()].sort((a, b) => b[1] - a[1])[0], share = c[1] / X.invest;
  if (share < 0.6 || by.size < 2 && X.holds.length < 2) return null;
  return mk({ key: 'concentration', sig: 'concentration:' + c[0] + ':' + Math.floor(share * 10), topic: 'invest', kind: 'fact', tone: 'note', rel: 0.8, conf: 0.9, impact: clamp(share * 0.7),
    title: `${pctS(share)} of your investments sit in one asset: ${c[0]}.`, evidence: [`${money(c[1])} of ${money(X.invest)} invested, across ${X.holds.length} account${X.holds.length > 1 ? 's' : ''}.`, `Investments are ${pctS(X.invest / (X.invest + X.liquid))} of cash plus investments.`],
    matters: 'One asset moving 30% moves your whole portfolio about as much. This is an observation of how it is spread, not a view on the asset.', action: 'Deciding in advance how large a share any single asset may reach makes it easier to act calmly later.' });
}

const FINDERS = [smallWeekday, mixShift, resilience, savingsRate, goalCost, committed, levelShift, visitsVsTicket, bigFew, payday, incomeSwing, concentration];
export const COOLDOWN_DAYS = 21;

// ---------- the analyst: find, score, remember ----------
export function worthCandidates(db, today = nowStamp().slice(0, 10)) {
  const X = prepare(db, today), out = [];
  if (X.months.length < 3 || sum(X.months.map((m) => m.exp.length)) < 6) return { items: [], enough: false, months: X.months.length };
  for (const f of FINDERS) { try { const r = f(X); if (r && r.sig) out.push(r); } catch { /* one finder failing never hides the others */ } }
  return { items: out, enough: true, months: X.months.length };
}
const logOf = (db) => (db.settings && db.settings.worthLog) || {};
export const scoreOf = (it, log, today) => { const seen = log[it.sig], fam = log['~' + it.key];
  const novelty = !seen ? 1 : 0.35, stale = fam && fam.last !== today ? 0.05 : 0;
  return 0.35 * it.impact + 0.25 * it.rel + 0.25 * it.conf + 0.15 * novelty - stale; };
// pick what to show: what was shown today stays (so the card does not shuffle), the rest by score, same topic at most twice
export function chooseWorth(cands, log, today, n = 3) {
  const ok = cands.filter((it) => { const s = log[it.sig], f = log['~' + it.key]; if (s && s.off) return false; if (s && s.last === today) return true;
    if (f && f.last !== today && dayN(today) - dayN(f.last) < COOLDOWN_DAYS && !(it.impact >= 0.8 && !s)) return false; return true; });
  const sticky = ok.filter((it) => (log[it.sig] || {}).last === today), rest = ok.filter((it) => !sticky.includes(it)).sort((a, b) => scoreOf(b, log, today) - scoreOf(a, log, today));
  const out = [], per = new Map(), grps = new Set();
  for (const it of [...sticky, ...rest]) { if (out.length >= n) break; if (it.grp && grps.has(it.grp)) continue; if (it.grp) grps.add(it.grp); if ((per.get(it.topic) || 0) >= 2 && !sticky.includes(it)) continue; per.set(it.topic, (per.get(it.topic) || 0) + 1); out.push(it); }
  return out;
}
export function worthInsights(db, today = nowStamp().slice(0, 10), n = 3) {
  const c = worthCandidates(db, today); if (!c.enough) return { items: [], enough: false, months: c.months };
  return { items: chooseWorth(c.items, logOf(db), today, n), enough: true, months: c.months };
}
// write down what was shown (once per day per item) and what the person dismissed
export function noteShown(log, items, today) { let changed = false;
  for (const it of items) { const s = log[it.sig] || (log[it.sig] = { first: today, last: '', n: 0 }); if (s.last !== today) { s.last = today; s.n++; changed = true; } const f = log['~' + it.key] || (log['~' + it.key] = { last: '' }); if (f.last !== today) { f.last = today; changed = true; } }
  return changed; }
export const dismiss = (log, sig, today) => { const s = log[sig] || (log[sig] = { first: today, last: today, n: 1 }); s.off = true; };
