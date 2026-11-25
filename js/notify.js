// Notification bell (v16.29): one list of everything that needs you. Nothing here is stored as a "message": every item is worked out from your data each time,
// so a budget alert or a debt reminder stays on the bell for as long as it is true and leaves only when you deal with it (pay, raise the budget, reach the goal).
// Opening the bell only marks items as seen (the "New" tag); it never removes an open item. Items do not expire and cannot be snoozed.
import { get, commitQuiet, live, fmt, HOME, nowStamp, reviewCount } from './core.js';
import { esc, sheet, ic, ACT, toast } from './ui.js';
import { button } from './components.js';
import { budgetAlerts } from './budgetsetup.js';
import { cardReminders } from './finance.js';
import { debtList } from './debts.js';
import { owedList } from './owed.js';
import { goalOutlook } from './goalcheck.js';
import { billDues, safeToSpend } from './safe.js';
import { glanceUnread, showGlance } from './glance.js';

const M = (n, cur = HOME) => fmt(n, cur, { round: cur === HOME });
const niceDate = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
const dayN = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const when = (days, overdue) => (overdue || days < 0 ? 'is overdue' : days === 0 ? 'is due today' : days === 1 ? 'is due tomorrow' : `is due in ${days} days`);

// kind -> label and icon (label is always written, so colour is never the only signal)
export const KINDS = { budget: ['Budget', 'pie'], debt: ['Debt', 'flow'], card: ['Card', 'wallet'], owed: ['Owed to you', 'swap'], goal: ['Savings goal', 'goal'], bill: ['Bill', 'calendar'], safe: ['Safe to Spend', 'calc'], review: ['Check', 'list'] };
// urgency: 0 overdue, 1 over budget or due within a day, 2 due soon, 3 warning, 5 for your information
export function notifications(db, today = nowStamp().slice(0, 10)) {
  const win = db.settings.remindDays || 3, out = [], add = (x) => out.push({ tone: 'info', urgency: 5, ...x });
  const guard = (fn) => { try { fn(); } catch { /* one source failing must never hide the others */ } };
  guard(() => { for (const x of budgetAlerts(db)) {
    if (x.kind === 'cat' || x.kind === 'group') add({ id: 'budget:' + x.key, kind: 'budget', tone: x.tone === 'over' ? 'over' : x.tone === 'warn' ? 'warn' : 'info', urgency: x.over ? 1 : x.tone === 'info' ? 5 : 3, title: `${x.label} ${x.over ? 'is over budget' : 'is near its budget'}`, text: x.text, fn: 'nf-budget', attr: { 'data-g': x.group || '' }, goLabel: 'View budget' });
    else if (x.text) add({ id: 'budget:' + (x.key || 'needs'), kind: 'budget', tone: 'info', urgency: 5, title: 'Daily needs', text: x.text, go: '#/budget', goLabel: 'View budget' });
  } });
  guard(() => { for (const r of cardReminders(db, win)) {
    const due = r.due && r.dueAmount > 0.005 && r.days <= win;
    if (due) add({ id: `card:${r.a.id}:${r.due}`, kind: 'card', tone: r.overdue ? 'over' : 'due', urgency: r.overdue ? 0 : r.days <= 1 ? 1 : 2, title: `${r.a.name} ${when(r.days, r.overdue)}`, text: `Pay ${M(r.dueAmount, r.a.cur)}${r.dueAmount < r.owed - 0.005 ? ` (total owed ${M(r.owed, r.a.cur)})` : ''}. Due ${niceDate(r.due)}.`, fn: 'card-pay', attr: { 'data-id': r.a.id }, goLabel: 'Pay card' });
    else add({ id: 'cardhigh:' + r.a.id, kind: 'card', tone: 'warn', urgency: 3, title: `${r.a.name} is ${r.used}% of its limit`, text: `Owed ${M(r.owed, r.a.cur)} of ${M(r.limit, r.a.cur)}.`, go: '#/accounts', goLabel: 'Open accounts' });
  } });
  guard(() => { for (const d of debtList(db)) {
    if (d.type === 'card' || !d.due || !(d.overdue || d.days <= win)) continue;
    add({ id: `debt:${d.id}:${d.due}`, kind: 'debt', tone: d.overdue ? 'over' : 'due', urgency: d.overdue ? 0 : d.days <= 1 ? 1 : 2, title: `${d.name} payment ${when(d.days, d.overdue)}`, text: `Pay about ${M(d.min)}. You owe ${M(d.owed)} in total. Due ${niceDate(d.due)}.`, go: '#/debts', goLabel: 'Open debts' });
  } });
  guard(() => { for (const p of owedList(db)) {
    if (!p.open || !p.due || p.dueIn > win) continue; const over = p.dueIn < 0;
    add({ id: `owed:${p.id}:${p.due}`, kind: 'owed', tone: over ? 'over' : 'due', urgency: over ? 0 : p.dueIn <= 1 ? 1 : 2, title: `${p.person} ${over ? 'has not paid you back' : 'should pay you back ' + (p.dueIn === 0 ? 'today' : p.dueIn === 1 ? 'tomorrow' : 'in ' + p.dueIn + ' days')}`, text: `${M(p.owedCur, p.cur)} lent. Due ${niceDate(p.due)}.`, go: '#/owed', goLabel: 'Open owed' });
  } });
  guard(() => { const rank = { late: 0, risk: 1, behind: 2 };
    for (const g of live(db.goals || [])) { if (g.reachedAck) continue; const o = goalOutlook(db, g, today); if (!(o.level in rank)) continue;
      add({ id: `goal:${g.id}:${o.level}`, kind: 'goal', tone: o.level === 'late' ? 'over' : 'warn', urgency: rank[o.level] + 1, title: `${g.name} is ${o.level === 'late' ? 'past its date' : o.level === 'risk' ? 'at risk' : 'behind'}`, text: (o.lines && o.lines[0]) || 'Check the goal.', go: '#/savings', goLabel: 'Open savings' }); } });
  guard(() => { for (const b of db.settings.bills || []) { const x = billDues(b, today, win)[0]; if (!x) continue; const days = dayN(x.due) - dayN(today);
    add({ id: `bill:${b.id}:${x.due}`, kind: 'bill', tone: x.overdue ? 'over' : 'due', urgency: x.overdue ? 0 : days <= 1 ? 1 : 2, title: `${b.name} ${when(days, x.overdue)}`, text: `${M(x.amount)}. Due ${niceDate(x.due)}.`, fn: 'bills-open', goLabel: 'Open bills' }); } });
  guard(() => { const s = safeToSpend(db); if (s.committed > 0.5 && s.safe < 0) add({ id: 'safe', kind: 'safe', tone: 'over', urgency: 1, title: 'Safe to Spend is below zero', text: `You hold ${M(s.money)} but ${M(s.committed)} is already owed, so ${M(-s.safe)} is missing.`, fn: 'safe-info', goLabel: 'See why' }); });
  guard(() => { const n = reviewCount(db); if (n) add({ id: 'review', kind: 'review', title: `${n} ${n === 1 ? 'entry needs' : 'entries need'} a quick check`, text: 'Confirm the guessed category or amount.', go: '#/review', goLabel: 'Review' }); });
  return out.sort((a, b) => a.urgency - b.urgency || (a.title < b.title ? -1 : 1));
}
const seenOf = (db) => (db.settings.notifSeen || {});
export const isNew = (db, n) => !seenOf(db)[n.id];
// what the bell shows: every open item plus unread Quick Glance insights
export function bellCount(db) { const l = notifications(db), g = glanceUnread(db).length; return { open: l.length, fresh: l.filter((n) => isNew(db, n)).length, glance: g, total: l.length + g, urgent: l.some((n) => n.urgency <= 1) }; }
const bellInner = (c) => `${ic('bell')}${c.total ? `<i class="bdot ${c.urgent ? 'urgent' : ''}" aria-hidden="true">${c.total > 9 ? '9+' : c.total}</i>` : ''}`;
const bellAria = (c) => (c.total ? `Notifications, ${c.open} open${c.fresh ? `, ${c.fresh} new` : ''}${c.glance ? `, ${c.glance} insights unread` : ''}` : 'Notifications, nothing open');
export function bellBtn(db) { const c = bellCount(db); return button({ html: bellInner(c), kind: 'plain', cls: `iconbtn bellbtn ${c.urgent ? 'urgent' : ''}`, act: 'notifbell', aria: bellAria(c) }); }
export function refreshBell() { const db = get(); if (!db) return; const c = bellCount(db); document.querySelectorAll('[data-act="notifbell"]').forEach((b) => { b.innerHTML = bellInner(c); b.setAttribute('aria-label', bellAria(c)); b.classList.toggle('urgent', c.urgent); }); }
document.addEventListener('sukli-bell', refreshBell);

const item = (db, n) => { const [lab, icon] = KINDS[n.kind];
  return `<article class="nf nf-${n.kind} ${n.tone}${isNew(db, n) ? ' new' : ''}" aria-label="${esc(lab)}: ${esc(n.title)}">
    <i class="nf-ic">${ic(icon)}</i>
    <div class="nf-b"><div class="nf-top"><span class="nf-kind">${esc(lab)}</span>${n.urgency === 0 ? '<span class="nf-st">Overdue</span>' : n.tone === 'over' ? '<span class="nf-st">Needs action</span>' : ''}${isNew(db, n) ? '<span class="nf-new">New</span>' : ''}</div>
      <h4>${esc(n.title)}</h4><p>${esc(n.text)}</p>
      <div class="btnrow tight">${button({ label: n.goLabel || 'Open', kind: n.tone === 'over' || n.tone === 'due' ? 'primary' : 'ghost', size: 'sm', act: 'nf-do', attr: { 'data-nf-go': n.go || '', 'data-nf-fn': n.fn || '', ...(n.attr || {}) } })}</div></div></article>`; };
let cur = null;
// the Budget group can be folded so the rest of the sheet (and Quick Glance) is reachable without scrolling; the fold is remembered on this device only
const BKEY = 'sukli-nf-budget-closed';
const budgetClosed = () => { try { return localStorage.getItem(BKEY) === '1'; } catch { return false; } };
const setBudgetClosed = (v) => { try { localStorage.setItem(BKEY, v ? '1' : '0'); } catch { /* the fold is a convenience only */ } };
const glanceRow = (g) => `<div class="nf nf-glance"><i class="nf-ic">${ic('spark')}</i><div class="nf-b"><div class="nf-top"><span class="nf-kind">Insight</span></div><h4>Quick Glance</h4><p>${g ? `${g} insight${g === 1 ? '' : 's'} you have not read yet.` : 'Everything has been read. You can read them again.'}</p><div class="btnrow tight">${button({ label: g ? 'Read insights' : 'Show again', kind: 'ghost', size: 'sm', act: 'nf-glance' })}</div></div></div>`;
function budgetGroup(db, items) {
  const closed = budgetClosed(), over = items.filter((n) => n.tone === 'over').length, fresh = items.filter((n) => isNew(db, n)).length;
  const sum = `${items.length} alert${items.length === 1 ? '' : 's'}${over ? `, ${over} over` : ''}${fresh ? `, ${fresh} new` : ''}`;
  return `<section class="nfgroup nf-budget-group${closed ? ' closed' : ''}">${button({ html: `<span class="nf-kind">Budget</span><span class="nfgsum">${esc(sum)}</span>${ic('chev')}`, kind: 'plain', cls: 'nfghead', act: 'nf-bgrp', attr: { 'aria-expanded': String(!closed), 'aria-controls': 'nf-budget-body' } })}
    <div class="nflist" id="nf-budget-body"${closed ? ' hidden' : ''}>${items.map((n) => item(db, n)).join('')}</div></section>`;
}
export function openBell() {
  const db = get(), list = notifications(db), g = glanceUnread(db).length, fresh = list.filter((n) => isNew(db, n)).length;
  const head = list.length ? `<p class="hint">${list.length} open${fresh ? `, ${fresh} new` : ''}. These stay here until you deal with them: pay, raise the budget or reach the goal. Reading or folding them does not remove them.</p>` : '<p class="empty">Nothing needs your attention right now.</p>';
  if (cur) { try { cur.close(); } catch { /* already closed */ } }
  const bud = list.filter((n) => n.kind === 'budget'), rest = list.filter((n) => n.kind !== 'budget');
  cur = sheet(`${head}${glanceRow(g)}${bud.length ? budgetGroup(db, bud) : ''}<div class="nflist">${rest.map((n) => item(db, n)).join('')}</div>`, { title: 'Notifications', cls: 'nfsheet' });
  // mark what is on the list as seen (only the "New" tag changes, never the list); forget ids that are no longer open
  try { const seen = {}; for (const n of list) seen[n.id] = 1; commitQuiet((d) => { d.settings.notifSeen = seen; }); } catch { /* the tag is cosmetic */ }
  refreshBell();
}
ACT['nf-bgrp'] = (el) => { const grp = el.closest('.nfgroup'), body = grp && grp.querySelector('.nflist'); if (!body) return; const close = !body.hidden; body.hidden = close; grp.classList.toggle('closed', close); el.setAttribute('aria-expanded', String(!close)); setBudgetClosed(close); };
ACT.notifbell = () => openBell();
ACT['nf-glance'] = () => { if (cur) cur.close(); cur = null; if (!showGlance({ reopen: true })) toast('Nothing to show yet. Add a few more entries and check back.'); refreshBell(); };
ACT['nf-do'] = (el) => { const go = el.dataset.nfGo, fn = el.dataset.nfFn; if (cur) cur.close(); cur = null; if (fn && ACT[fn]) ACT[fn](el); else if (go) location.hash = go; };
