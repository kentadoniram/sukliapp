// Quick Glance: one short, useful thing when you open the app, so you do not have to dig for it.
// Each finder returns a small card: a headline, one line of context, optional tiny chart, and where to go for more. Nothing leaves this device.
import { get, commitQuiet, monthParts, partsBetween, shiftMonth, fmt, HOME, live, balances, nowStamp, dayLabel } from './core.js';
import { median } from './stats.js';
import { esc, sheet, ic } from './ui.js';
import { button } from './components.js';
import { pace, totals } from './insights.js';
import { budgetStatus } from './budgetsetup.js';
import { goalStats } from './savings.js';
import { cardBilling, accountHistory } from './finance.js';
import { worthInsights } from './worth.js';

export const TOPICS = { spending: 'Spending', bills: 'Bills and cards', invest: 'Investments', goals: 'Budgets and goals', trends: 'Trends' };
const TOPIC_ICON = { spending: 'pie', bills: 'calendar', invest: 'chart', goals: 'goal', trends: 'flow' };
export const DEFAULTS = { on: true, freq: 'daily', charts: true, topics: { spending: true, bills: true, invest: true, goals: true, trends: true }, mute: {}, log: {}, last: '' };
export const cfg = (db) => { const g = (db.settings || {}).glance || {}; return { ...DEFAULTS, ...g, topics: { ...DEFAULTS.topics, ...(g.topics || {}) }, mute: g.mute || {}, log: g.log || {} }; };

const sum = (a) => a.reduce((s, x) => s + x, 0);
const money = (n) => fmt(n, HOME, { round: true });
const dayN = (d) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5);
const isoOf = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const pct = (x) => `${Math.round(Math.abs(x) * 100)}%`;
const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]);
const niceDate = (iso) => new Date(dayN(iso) * 864e5).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const mk = (o) => ({ tone: 'note', urgency: 0.2, weight: 1, chart: null, go: '', goLabel: '', sub: '', ...o });

// ---------- tiny charts: plain SVG that follows the theme ----------
const W = 280, H = 56;
const barsSvg = (vals, { hi = -1 } = {}) => { const mx = Math.max(...vals.map(Math.abs), 1), n = vals.length, bw = W / n, neg = vals.some((v) => v < 0), base = neg ? H / 2 : H - 2;
  return `<svg class="gchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chart">${neg ? `<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="gaxis"/>` : ''}${vals.map((v, i) => { const h = Math.max(1.5, Math.abs(v) / mx * (neg ? H / 2 - 3 : H - 6)); return `<rect x="${(i * bw + 1).toFixed(1)}" y="${(v < 0 ? base : base - h).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" class="${i === hi ? 'gbar hi' : 'gbar'}${v < 0 ? ' neg' : ''}"/>`; }).join('')}</svg>`; };
const linesSvg = (a, b, dim) => { const mx = Math.max(...a, ...b, 1), x = (i) => (i / Math.max(1, dim - 1)) * (W - 4) + 2, y = (v) => H - 3 - (v / mx) * (H - 8);
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  return `<svg class="gchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="This month against your usual line"><path d="${path(b)}" class="gline usual"/><path d="${path(a)}" class="gline now"/></svg>`; };
const progressSvg = (p) => `<svg class="gchart slim" viewBox="0 0 ${W} 14" role="img" aria-label="${Math.round(p)} percent"><rect x="0" y="3" width="${W}" height="8" rx="4" class="gtrack"/><rect x="0" y="3" width="${Math.max(6, Math.min(W, W * p / 100)).toFixed(1)}" height="8" rx="4" class="${p >= 100 ? 'gfill over' : p >= 80 ? 'gfill warn' : 'gfill'}"/></svg>`;
const twoBars = (usual, now) => barsSvg([usual, now], { hi: 1 });

// ---------- the finders ----------
function avg30(db, today) {
  const from = isoOf(dayN(today) - 29), prevFrom = isoOf(dayN(today) - 59), cur = partsBetween(db, from, today).filter((p) => p.kind === 'expense'), pre = partsBetween(db, prevFrom, isoOf(dayN(today) - 30)).filter((p) => p.kind === 'expense');
  if (cur.length < 10) return null; const tot = sum(cur.map((p) => p.v)), avg = tot / 30, ptot = sum(pre.map((p) => p.v));
  const days = Array.from({ length: 30 }, (_, i) => 0); for (const p of cur) days[dayN(p.t.date.slice(0, 10)) - dayN(from)] += p.v;
  const ch = pre.length >= 10 && ptot > 0 ? (tot - ptot) / ptot : null;
  return mk({ id: 'avg30', topic: 'spending', headline: `You are averaging ${money(avg)} a day over the last 30 days.`, sub: ch != null && Math.abs(ch) >= 0.05 ? `That is ${pct(ch)} ${ch > 0 ? 'more' : 'less'} than the 30 days before (${money(ptot / 30)} a day).` : `About the same as the 30 days before.`, chart: barsSvg(days, { hi: 29 }), go: '#/spend', goLabel: 'See where it goes', urgency: ch != null && ch > 0.15 ? 0.5 : 0.2 });
}
function cardDue(db, today) {
  const bal = balances(db), out = [];
  for (const a of live(db.accounts)) { if (a.type !== 'card' || a.archived || !(a.dueDay > 0)) continue; let b; try { b = cardBilling(db, a, bal.get(a.id) || 0, today); } catch { continue; }
    if (!b.due || b.days == null || b.days > 10 || !(b.dueAmount > 0) && !b.overdue) continue;
    const pays = live(db.txs).filter((t) => t.kind === 'transfer' && t.toAcct === a.id).map((t) => +t.date.slice(8, 10)).slice(-6);
    const usual = pays.length >= 3 ? Math.round(median(pays)) : null, dd = +b.due.slice(8, 10);
    const when = b.days < 0 ? `${-b.days} day${b.days === -1 ? '' : 's'} overdue` : b.days === 0 ? 'due today' : `due in ${b.days} day${b.days === 1 ? '' : 's'} (${niceDate(b.due)})`;
    out.push(mk({ id: 'card:' + a.id + ':' + b.due, topic: 'bills', tone: b.days <= 1 ? 'warn' : 'note', urgency: b.days < 0 ? 1 : 1 - b.days / 12 + 0.3, weight: 2, headline: `Your ${a.name} bill of ${money(b.dueAmount || b.owed)} is ${when}.`,
      sub: usual ? (usual < dd ? `You usually pay around the ${ord(usual)}, ${dd - usual} day${dd - usual === 1 ? '' : 's'} before it is due.` : usual > dd ? `You usually pay around the ${ord(usual)}, which is after the ${ord(dd)} due day.` : `You usually pay on the due day itself.`) : (b.limit ? `${b.used}% of your limit is used.` : ''), go: '#/accounts', goLabel: 'Open accounts' })); }
  return out.sort((a, b) => b.urgency - a.urgency)[0] || null;
}
function negativeHolding(db, today) {
  const bal = balances(db); let best = null;
  for (const a of live(db.accounts)) { if (!(a.type === 'crypto' || a.type === 'invest' || a.invtab) || a.archived) continue; if (!((bal.get(a.id) || 0) < -1e-9)) continue;
    const h = accountHistory(db, a.id); let since = null; for (const r of h) { if (r.bal < -1e-9) since = r.t.date.slice(0, 10); else break; } if (!since) continue;
    const days = dayN(today) - dayN(since); if (days >= 3 && (!best || days > best.days)) best = { a, days }; }
  if (!best) return null; const nm = best.a.exchange ? `${best.a.cur} on ${best.a.exchange}${best.a.wallet ? ` (${best.a.wallet})` : ''}` : best.a.name;
  return mk({ id: 'neg:' + best.a.id, topic: 'invest', tone: 'warn', urgency: 0.85, weight: 2, headline: `Your ${nm} balance has been below zero for ${best.days} days.`, sub: 'A holding cannot be below zero, so a buy, deposit or transfer is probably missing.', go: '#/invest', goLabel: 'Open Investments' });
}
function netExtreme(db, today) {
  const ym = today.slice(0, 7), rows = []; for (let i = 12; i >= 1; i--) { const m = shiftMonth(ym, -i), e = totals(db, m).total, n = totals(db, m, 'income').total; if (e || n) rows.push({ m, net: n - e }); }
  if (rows.length < 6) return null; const last = rows[rows.length - 1], nets = rows.map((r) => r.net), lo = Math.min(...nets), hi = Math.max(...nets);
  const low = last.net === lo, high = last.net === hi && last.net > 0; if (!low && !high) return null;
  return mk({ id: 'net:' + (low ? 'low' : 'high') + ':' + last.m, topic: 'trends', tone: low ? 'warn' : 'good', urgency: 0.55, weight: 1.5, headline: `Last month's net (${money(last.net)}) was the ${low ? 'lowest' : 'highest'} of the last ${rows.length} months.`, sub: `Net is what came in minus what went out. The ${low ? 'highest' : 'lowest'} was ${money(low ? hi : lo)}.`, chart: barsSvg(nets, { hi: nets.length - 1 }), go: '#/cashflow', goLabel: 'See cash flow' });
}
function paceLine(db, today) {
  const ym = today.slice(0, 7), p = pace(db, ym); if (!p.live || p.day < 5 || !(p.usual > 0) || p.cur.length < p.day || monthParts(db, ym).filter((x) => x.kind === 'expense').length < 3) return null;
  const exp = p.usual / p.dim * p.day, diff = (p.spent - exp) / exp; if (Math.abs(diff) < 0.08) return null; const above = diff > 0;
  return mk({ id: 'pace:' + (above ? 'above' : 'below') + ':' + ym, topic: 'spending', tone: above ? 'warn' : 'good', urgency: above ? 0.6 : 0.3, weight: 1.5, headline: `You are ${above ? 'above' : 'below'} your usual line this month: ${money(p.spent)} so far, against ${money(exp)} by this day.`, sub: above ? `At this pace the month ends near ${money(p.projected)}; your usual month is ${money(p.usual)}.` : `If it holds, the month ends near ${money(p.projected)} against a usual ${money(p.usual)}.`,
    chart: linesSvg(p.cur.slice(0, p.day), Array.from({ length: p.dim }, (_, i) => p.usual / p.dim * (i + 1)), p.dim), go: '#/home', goLabel: 'See the pace chart' });
}
function groupMove(db, today) {
  const ym = today.slice(0, 7), d = +today.slice(8, 10); if (d < 7) return null; const upto = (m) => { const by = new Map(); for (const p of monthParts(db, m)) if (p.kind === 'expense' && +p.t.date.slice(8, 10) <= d) by.set(p.group, (by.get(p.group) || 0) + p.v); return by; };
  const cur = upto(ym), bases = [1, 2, 3].map((i) => upto(shiftMonth(ym, -i))).filter((b) => b.size), tot = sum([...cur.values()]); if (bases.length < 2) return null; let best = null;
  for (const [g, v] of cur) { if (/^(others?|uncategori[sz]ed|adjustments?)$/i.test(g)) continue; const base = sum(bases.map((b) => b.get(g) || 0)) / bases.length; if (base < 1 || Math.abs(v - base) < tot * 0.03) continue; const ch = (v - base) / base; if (Math.abs(ch) >= 0.15 && (!best || Math.abs(v - base) > Math.abs(best.v - best.base))) best = { g, v, base, ch }; }
  if (!best) return null; const up = best.ch > 0;
  return mk({ id: 'group:' + best.g + ':' + (up ? 'up' : 'down') + ':' + ym, topic: 'spending', tone: up ? 'warn' : 'good', urgency: up ? 0.55 : 0.3, weight: 1.5, headline: `${best.g} is ${up ? 'up' : 'down'} ${pct(best.ch)} so far this month.`, sub: `${money(best.v)} by day ${d}, against ${money(best.base)} by the same day in the last ${bases.length} months.`, chart: twoBars(best.base, best.v), go: '#/spend', goLabel: 'See spending by group' });
}
function budgetNear(db, today) {
  const ym = today.slice(0, 7), s = budgetStatus(db, ym).filter((x) => x.pct >= 75).sort((a, b) => b.pct - a.pct)[0]; if (!s) return null;
  const dim = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate(), left = dim - +today.slice(8, 10), over = s.pct >= 100;
  return mk({ id: 'budget:' + s.key + ':' + ym + ':' + (over ? 'over' : 'near'), topic: 'goals', tone: over ? 'warn' : 'note', urgency: over ? 0.9 : 0.6 + (s.pct - 75) / 100, weight: 2, headline: over ? `${s.label} is over its budget: ${money(s.spent)} of ${money(s.budget)}.` : `${s.label} has used ${Math.round(s.pct)}% of its budget with ${left} day${left === 1 ? '' : 's'} left.`, sub: over ? `That is ${money(s.spent - s.budget)} over.` : `${money(s.budget - s.spent)} left of ${money(s.budget)}.`, chart: progressSvg(Math.min(100, s.pct)), go: '#/budget', goLabel: 'Open budgets' });
}
function goalNear(db, today) {
  let best = null; for (const g of live(db.goals || [])) { if (g.reachedAck || !(g.target > 0)) continue; const s = goalStats(db, g, today); if (s.reached || s.pct < 10) continue; if (!best || s.pct > best.s.pct) best = { g, s }; }
  if (!best) return null; const { g, s } = best, eta = s.eta ? niceDate(isoOf(s.eta)) : null;
  return mk({ id: 'goal:' + g.id + ':' + Math.floor(s.pct / 10), topic: 'goals', tone: 'good', urgency: 0.35 + s.pct / 300, weight: 1, headline: `“${g.name}” is ${Math.round(s.pct)}% funded.`, sub: eta ? `At your pace so far it is reached around ${eta}${g.due ? ` (your date: ${niceDate(g.due)})` : ''}.` : `${fmt(s.left * s.rate, HOME, { round: true })} to go.`, chart: progressSvg(s.pct), go: '#/savings', goLabel: 'Open goals' });
}
function bigWeek(db, today) {
  const w = partsBetween(db, isoOf(dayN(today) - 6), today).filter((p) => p.kind === 'expense'); if (w.length < 5) return null; const top = [...w].sort((a, b) => b.v - a.v)[0], tot = sum(w.map((p) => p.v));
  if (top.v < tot * 0.25) return null; return mk({ id: 'bigweek:' + (top.t.id || top.t.date), topic: 'spending', urgency: 0.15, weight: 0.8, headline: `Your biggest purchase this week was ${money(top.v)}${top.t.name ? ` (${top.t.name})` : ''}.`, sub: `It is ${pct(top.v / tot)} of the ${money(tot)} you spent in the last 7 days.`, go: '#/ledger', goLabel: 'See entries' });
}
function fromWorth(db, today) {
  let r; try { r = worthInsights(db, today, 3); } catch { return null; } const it = r.items[0]; if (!it) return null;
  return mk({ id: 'worth:' + it.sig, topic: 'trends', tone: it.tone, urgency: 0.4, weight: 1.2, headline: it.title, sub: it.evidence[0] || '', go: '#/home', goLabel: 'Worth Knowing on Home' });
}
const FINDERS = [avg30, cardDue, negativeHolding, netExtreme, paceLine, groupMove, budgetNear, goalNear, bigWeek, fromWorth];
export const kindOf = (id) => id.split(':')[0];
export const KIND_LABEL = { avg30: 'Daily average', card: 'Card bills', neg: 'Negative holdings', net: 'Best or worst month', pace: 'Pace this month', group: 'Category movement', budget: 'Budget warnings', goal: 'Goal progress', bigweek: 'Biggest purchase', worth: 'Worth Knowing' };

export function glanceCandidates(db, today = nowStamp().slice(0, 10)) {
  if (!live(db.txs).length) return []; const out = [];
  for (const f of FINDERS) { try { const r = f(db, today); if (r) out.push(r); } catch { /* one finder failing never hides the others */ } }
  return out;
}
// what may be shown now, in the order to try: a weighted draw (urgent things weigh more), not the same topic twice in a row if avoidable
export function pickGlances(cands, c, today, rng = Math.random, n = 4) {
  const ok = cands.filter((x) => c.topics[x.topic] !== false && !c.mute[kindOf(x.id)] && !(c.log[x.id] && dayN(today) - dayN(c.log[x.id]) < 3));
  const pool = [...ok], out = []; let lastTopic = c.lastTopic || '';
  while (pool.length && out.length < n) {
    const alt = pool.filter((x) => x.topic !== lastTopic), from = alt.length ? alt : pool, ws = from.map((x) => x.weight * (1 + x.urgency * 3) * (c.log[x.id] ? 0.5 : 1)), tot = sum(ws);
    let r = rng() * tot, i = 0; while (i < from.length - 1 && (r -= ws[i]) > 0) i++; const pick = from[i]; out.push(pick); pool.splice(pool.indexOf(pick), 1); lastTopic = pick.topic;
  }
  return out;
}

// ---------- the window ----------
const wantNow = (db, c, today) => { if (!c.on || !live(db.txs).length) return false; if (c.freq === 'open') { try { return !sessionStorage.getItem('sukli-glance'); } catch { return true; } } return c.last !== today; };
const cardHtml = (g, i, n, c) => `<div class="glance ${g.tone}">
  <div class="gtop"><span class="gtopic">${ic(TOPIC_ICON[g.topic] || 'spark')} ${esc(TOPICS[g.topic])}</span><span class="gcount muted">${i + 1} of ${n}</span></div>
  <p class="ghead">${esc(g.headline)}</p>${g.sub ? `<p class="gsub">${esc(g.sub)}</p>` : ''}${c.charts && g.chart ? g.chart : ''}
  <div class="btnrow">${button({ label: 'Got it', kind: 'primary', attr: { 'data-g': 'done' } })}${n > 1 ? button({ label: 'Another one', kind: 'ghost', attr: { 'data-g': 'next' } }) : ''}${g.go ? button({ label: g.goLabel || 'Open', kind: 'ghost', attr: { 'data-g': 'go', 'data-to': g.go } }) : ''}</div>
  <div class="gfoot">${button({ label: `Stop showing: ${esc(KIND_LABEL[kindOf(g.id)] || 'this kind')}`, kind: 'link', attr: { 'data-g': 'mute', 'data-k': kindOf(g.id) } })}${button({ label: 'Quick Glance settings', kind: 'link', attr: { 'data-g': 'set' } })}</div></div>`;
// Items not read yet: what the automatic Quick Glance would still offer (topics you left on, not stopped, not already shown in the last 3 days). The bell counts these; reading an item (it is marked when it appears) takes it off the count.
export function glanceUnread(db, today = nowStamp().slice(0, 10)) {
  if (!db) return []; const c = cfg(db);
  return glanceCandidates(db, today).filter((x) => c.topics[x.topic] !== false && !c.mute[kindOf(x.id)] && !(c.log[x.id] && dayN(today) - dayN(c.log[x.id]) < 3));
}
// the bell on Home: a button with a small count badge while anything is unread
export function bellBtn(db) {
  const n = glanceUnread(db).length;
  return button({ html: `${ic('bell')}${n ? `<i class="bdot" aria-hidden="true">${n > 9 ? '9+' : n}</i>` : ''}`, kind: 'plain', cls: 'iconbtn bellbtn', act: 'glancebell', aria: n ? `Quick Glance, ${n} unread` : 'Quick Glance, all read' }).replace('class="', `class="${n ? 'ringing ' : ''}`);
}
export function refreshBell() {
  const db = get(); if (!db) return; const n = glanceUnread(db).length;
  document.querySelectorAll('[data-act="glancebell"]').forEach((b) => { b.innerHTML = `${ic('bell')}${n ? `<i class="bdot" aria-hidden="true">${n > 9 ? '9+' : n}</i>` : ''}`; b.setAttribute('aria-label', n ? `Quick Glance, ${n} unread` : 'Quick Glance, all read'); b.classList.toggle('ringing', n > 0); });
}
export function showGlance({ force = false, reopen = false, rng = Math.random, today = nowStamp().slice(0, 10) } = {}) {
  const db = get(); if (!db) return false; const c = cfg(db); if (!force && !reopen && !wantNow(db, c, today)) return false;
  if (!force && !reopen && navigator.webdriver && !window.__sukliGlance) return false;   // automated browsers (tests) stay undisturbed unless they opt in
  if (document.querySelector('.scrim') || document.querySelector('.welcome') || document.querySelector('#setup')) return false;
  // the bell reopens what is still unread; when everything has been read it shows them all again (so a closed Quick Glance can always be brought back)
  const cands = glanceCandidates(db, today);
  let list = reopen ? pickGlances(cands, c, today, rng, 12) : pickGlances(cands, force ? { ...c, log: {} } : c, today, rng);
  if (reopen && !list.length) list = pickGlances(cands, { ...c, log: {} }, today, rng, 12);
  if (!list.length) return false;
  let i = 0; const s = sheet('<div id="glancebox"></div>', { title: 'Quick glance', cls: 'glancesheet' }), root = s.el || document.querySelector('.glancesheet') || document.body, box = () => document.getElementById('glancebox');
  const mark = () => { const g = list[i]; try { commitQuiet((d) => { const x = (d.settings.glance = { ...DEFAULTS, ...(d.settings.glance || {}) }); x.log = { ...(x.log || {}), [g.id]: today }; x.last = today; x.lastTopic = g.topic; }); } catch { /* history is a convenience */ } };
  const draw = () => { box().innerHTML = cardHtml(list[i], i, list.length, cfg(get())); mark(); refreshBell(); };
  try { if (c.freq === 'open') sessionStorage.setItem('sukli-glance', '1'); } catch { /* fine */ }
  draw();
  const q = document.querySelector('.glancesheet') || root;
  q.addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; const k = b.dataset.g;
    if (k === 'next') { i = (i + 1) % list.length; draw(); }
    else if (k === 'done') s.close();
    else if (k === 'go') { s.close(); location.hash = b.dataset.to; }
    else if (k === 'mute') { commitQuiet((d) => { const x = (d.settings.glance = { ...DEFAULTS, ...(d.settings.glance || {}) }); x.mute = { ...(x.mute || {}), [b.dataset.k]: true }; }); s.close(); }
    else if (k === 'set') { s.close(); location.hash = '#/settings'; setTimeout(() => { const el = document.getElementById('glance'); if (el) { const d = el.closest('details'); if (d) d.open = true; el.scrollIntoView({ block: 'start' }); } }, 400); } });
  return true;
}
export function glanceOnOpen() { setTimeout(() => { try { showGlance(); } catch { /* never block the app */ } }, 1200); }
