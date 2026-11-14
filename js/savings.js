// Savings: goals you save toward (a trip, a laptop, a house). Each goal has a target amount, a picture, an optional target date and
// short-term or long-term. Progress comes from ONE of two places, never both:
//   - a linked account (progress = that account's balance, in your home currency), or
//   - money you add or take out by hand (the goal keeps its own small list of deposits).
// Everything is in your home currency. A goal never moves money by itself and never changes your totals.
import { get, commit, stamp, balances, softDelete, fmt, HOME, uid, homeFx, nowStamp, groupColor, factorFor } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { hdr, coll } from './screens.js';
import { button, textField, selectField } from './components.js';
import { openDatePicker } from './datepicker.js';
import { picHtml, isImg } from './pictures.js';
import { goalOutlook, goalReminders } from './goalcheck.js';
import { goalTxTotal, goalTxs } from './goaltx.js';

const live = (l) => (l || []).filter((x) => !x.deleted);
const money = (n) => fmt(n, HOME);
const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };
const todayStr = () => nowStamp().slice(0, 10);
const dayNum = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Math.round(new Date(y, m - 1, d).getTime() / 864e5); };
const niceDate = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
const monthYear = (dn) => new Date(dn * 864e5 + 12 * 36e5).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const MONTH = 30.4375;

export const GOAL_ICONS = ['plane', 'laptop', 'house', 'shield', 'gift', 'car', 'bike', 'phone', 'camera', 'book', 'heart', 'star'];
export const IDEAS = [['Travel Fund', 'plane'], ['Laptop', 'laptop'], ['House', 'house'], ['Emergency Fund', 'shield'], ['Gift', 'gift'], ['Gadget', 'phone'], ['Wedding', 'heart'], ['Leisure', 'star']];
const autoIcon = (name) => { const t = String(name || '').toLowerCase(); for (const [re, k] of [[/travel|trip|japan|flight|vacation|holiday|tour/, 'plane'], [/laptop|computer|pc\b|macbook/, 'laptop'], [/house|home|condo|lot\b|rent/, 'house'], [/emergency|rainy|safety/, 'shield'], [/gift|birthday|christmas/, 'gift'], [/car\b|motor|vehicle/, 'car'], [/bike|bicycle/, 'bike'], [/phone|iphone|gadget|tablet|ipad/, 'phone'], [/camera/, 'camera'], [/study|school|course|book/, 'book'], [/wedding|date|anniversary/, 'heart']]) if (re.test(t)) return k; return 'star'; };

// ---- the numbers (pure, so tests can check them) ----
export function goalStats(db, g, today = todayStr()) {
  const a = g.acct ? live(db.accounts).find((x) => x.id === g.acct) : null;
  const gc = goalCur(db, g), gr = gc === HOME ? 1 : homeFx(db, gc);   // the goal's own currency and what one unit of it is worth in home currency
  const linked = !!a, saved = linked ? (balances(db).get(a.id) || 0) * (homeFx(db, a.cur) || 1) / gr : (g.log || []).reduce((s, x) => s + (x.amt || 0), 0) + (g.start || 0) + goalTxTotal(db, g.id) / gr;
  const target = g.target || 0, left = Math.max(0, target - saved), pct = target > 0 ? Math.max(0, Math.min(100, (saved / target) * 100)) : 0, reached = target > 0 && saved >= target - 0.005;
  const out = { cur: gc, rate: gr, linked, acct: a, saved, target, left, pct, reached, perMonth: null, monthsLeft: null, late: false, pace: null, eta: null };
  if (g.due && !reached) {
    const days = dayNum(g.due) - dayNum(today);
    if (days < 0) out.late = true;
    else { out.monthsLeft = Math.max(1, Math.ceil(days / MONTH)); out.perMonth = left / out.monthsLeft; }
  }
  const since = g.created ? Math.max(1, dayNum(today) - dayNum(g.created)) : 0;
  if (!reached && since >= 14 && saved > 0) { out.pace = saved / (since / MONTH); out.eta = dayNum(today) + Math.ceil((left / out.pace) * MONTH); }   /* at your pace so far */
  return out;
}
// a goal can be saved in another currency (a trip fund in USD). It falls back to the home currency when there is no rate for it.
export const goalCur = (db, g) => (g.cur && g.cur !== HOME && homeFx(db, g.cur) > 0 ? g.cur : HOME);
export const termOf = (g) => (g.term === 'long' ? 'long' : 'short');
export function savingsTotals(db) {
  const gs = live(db.goals).filter((g) => !g.reachedAck), st = gs.map((g) => goalStats(db, g));
  return { n: gs.length, saved: st.reduce((s, x) => s + Math.min(x.saved, x.target) * x.rate, 0), target: st.reduce((s, x) => s + x.target * x.rate, 0) };
}

// ---- the page ----
const card = (db, g) => {
  const s = goalStats(db, g), M = (n) => fmt(n, s.cur), col = groupColor(g.name || 'x');
  const facts = [];
  if (g.due) facts.push(`<li><span>Target date</span><b>${niceDate(g.due)}${s.late ? ' (passed)' : ''}</b></li>`);
  if (s.perMonth != null) facts.push(`<li><span>To reach it on time</span><b>${M(s.perMonth)} a month</b></li>`);
  if (s.pace != null && s.eta) facts.push(`<li><span>At your pace so far</span><b>about ${monthYear(s.eta)}</b></li>`);
  facts.push(`<li><span>Still to save</span><b>${M(s.left)}</b></li>`);
  const o = goalOutlook(db, g), tone = { ontrack: 'ok', early: 'info', behind: 'warn', risk: 'bad', late: 'bad' }[o.level];
  const head = { ontrack: 'On track', early: 'Too early to tell', behind: 'Behind, but you can catch up', risk: 'Not realistic yet', late: 'Target date passed' }[o.level];
  const check = tone ? `<div class="goalcheck ${tone}" role="status"><b>${head}</b>${o.lines.map((l) => `<small>${esc(l)}</small>`).join('')}${o.needed != null && o.level !== 'late' ? `<small class="muted">Plan: ${M(o.needed)} a month · Actually saved: ${o.actual == null ? 'not enough history yet' : `${M(Math.max(0, o.actual))} a month`}</small>` : ''}</div>` : '';
  return `<div class="debtrow goalcard ${s.reached ? 'reached' : ''}" data-goal="${g.id}"><div class="dr-head"><div class="goalhead"><i class="badge" style="background:${col}">${picHtml(g.icon, autoIcon(g.name))}</i>
    <div><b>${esc(g.name)}</b><small class="muted">${termOf(g) === 'long' ? 'Long-term' : 'Short-term'}${s.linked ? ` · follows ${esc(s.acct.name)}` : ''}</small></div></div>
    ${button({ label: 'Edit', kind: 'link', act: 'goal-edit', attr: { 'data-id': g.id } })}</div>
    <div class="goalbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(s.pct)}"><i style="width:${s.pct.toFixed(1)}%"></i></div>
    <p class="goalnum"><b>${M(s.saved)}</b> of ${M(s.target)} · ${Math.round(s.pct)}%${s.reached ? ' · Reached!' : ''}</p>
    <ul class="calfacts">${facts.join('')}</ul>
    ${check}
    <div class="btnrow tight">${s.linked ? `<span class="hint">Progress follows the balance of ${esc(s.acct.name)}.</span>` : `${button({ label: 'Add Money', kind: 'primary', size: 'sm', act: 'goal-add', attr: { 'data-id': g.id } })}${button({ label: 'Take Out', kind: 'ghost', size: 'sm', act: 'goal-take', attr: { 'data-id': g.id } })}${button({ label: 'History', kind: 'link', act: 'goal-hist', attr: { 'data-id': g.id } })}`}
      ${s.reached ? `${button({ label: 'Mark as Done', kind: 'ghost', size: 'sm', act: 'goal-done', attr: { 'data-id': g.id } })}` : ''}</div></div>`;
};
export function savings(db) {
  const all = live(db.goals), open = all.filter((g) => !g.reachedAck), done = all.filter((g) => g.reachedAck);
  const add = button({ label: 'Add a Goal', kind: 'primary', act: 'goal-new' });
  if (!all.length) return `<div class="debtpage savingspage">${hdr('Savings')}<section class="cardbox"><h3>Save Toward Something</h3><p class="hint">A goal is something you are saving for: a trip, a laptop, a house, an emergency fund. Set a target amount, then watch your progress. You can follow an account's balance or add money by hand. A goal never moves money by itself.</p><div class="btnrow left">${add}</div>
    <p class="hint">Ideas:</p><div class="chips">${IDEAS.map(([n]) => `${button({ label: n, kind: 'chip', act: 'goal-new', attr: { 'data-name': n } })}`).join('')}</div></section></div>`;
  const t = savingsTotals(db), short = open.filter((g) => termOf(g) === 'short'), long = open.filter((g) => termOf(g) === 'long');
  const sec = (title, l) => (l.length ? `<h2 class="subh">${title} (${l.length})</h2>${l.map((g) => card(db, g)).join('')}` : '');
  return `<div class="debtpage savingspage">${hdr('Savings')}
    <section class="cardbox"><h3>All Goals</h3><div class="debtsum"><div class="dsrow"><span>Saved so far</span><b>${money(t.saved)}</b></div><div class="dsrow"><span>Total target</span><b>${money(t.target)}</b></div><div class="dsrow"><span>Goals</span><b>${t.n}</b></div></div>
      <div class="goalbar"><i style="width:${t.target > 0 ? Math.min(100, (t.saved / t.target) * 100).toFixed(1) : 0}%"></i></div>
      <div class="btnrow left">${add}</div></section>
    ${sec('Short-Term Goals', short)}${sec('Long-Term Goals', long)}
    ${done.length ? coll('g-done', `Done (${done.length})`, `<div class="rows plain">${done.map((g) => `<div class="orow done"><span class="rmain"><strong>${esc(g.name)}</strong><small>${money(g.target)} reached</small></span>${button({ label: 'Edit', kind: 'link', act: 'goal-edit', attr: { 'data-id': g.id } })}</div>`).join('')}</div>`) : ''}</div>`;
}

// currencies a goal can use: home, the currencies of your accounts that have a rate, and the one already on the goal
const goalCurs = (db, g) => [...new Set([HOME, ...(g.cur ? [g.cur] : []), ...live(db.accounts).filter((a) => !a.archived && homeFx(db, a.cur) > 0).map((a) => a.cur)])];
// ---- add or edit a goal ----
function openGoal(id, name = '') {
  const db = get(), old = id ? live(db.goals).find((x) => x.id === id) : null;
  const g = old ? { ...old } : { id: uid(), name, target: 0, term: 'short', due: '', icon: '', acct: '', start: 0, created: todayStr(), log: [] };
  const used = new Set(live(db.goals).filter((x) => x.id !== g.id && x.acct).map((x) => x.acct));
  const accts = live(db.accounts).filter((a) => !a.archived && !used.has(a.id) && a.type !== 'owed');
  const draw = () => {
    q('[data-due]').textContent = g.due ? niceDate(g.due) : 'Pick a date'; q('[data-nodue]').hidden = !g.due;
    q('[data-term]').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === termOf(g)));
    q('#g-pic').innerHTML = `<i class="badge sm" style="background:${groupColor(g.name || 'x')}">${picHtml(g.icon, autoIcon(g.name))}</i><span>${g.icon ? (isImg(g.icon) ? 'Your own image' : 'Chosen picture') : 'Automatic'} · tap to change</span>`;
    q('#g-startrow').hidden = !!g.acct;
  };
  const s = sheet(`<form novalidate>
    ${textField({ label: 'What are you saving for?', name: 'n', value: g.name, placeholder: 'e.g. Japan Trip, Laptop, House', attr: { 'autocapitalize': 'words', 'autofocus': true } })}
    ${old ? '' : `<div class="chips">${IDEAS.map(([n]) => `${button({ label: n, kind: 'chip', attr: { 'data-idea': n } })}`).join('')}</div>`}
    <div class="field"><span>Picture</span>${button({ label: ``, kind: 'plain', cls: 'picbtn', id: 'g-pic', aria: 'Choose a picture for this goal' })}</div>
    ${selectField({ label: 'Currency of this goal', id: 'g-cur', name: 'c', value: g.cur || HOME, options: goalCurs(db, g).map((c) => ({ value: c, label: c === HOME ? `${c} (home currency)` : c })) })}
    <label class="field"><span>Target amount</span><input name="t" inputmode="decimal" autocomplete="off" value="${g.target ? g.target : ''}" placeholder="0.00"></label>
    <div class="field"><span>Short or long term</span><div class="chips" data-term>${button({ label: 'Short-term (within a year)', kind: 'chip', v: 'short' })}${button({ label: 'Long-term', kind: 'chip', v: 'long' })}</div></div>
    <div class="field"><span>Target date (optional)</span><div class="btnrow tight">${button({ label: ``, kind: 'ghost', size: 'sm', attr: { 'data-due': true } })}${button({ label: 'No date', kind: 'ghost', size: 'sm', attr: { 'data-nodue': true } })}</div></div>
    <label class="field"><span>Follow an account (optional)</span><select name="a"><option value="">No, I add money myself</option>${accts.map((a) => `<option value="${a.id}" ${g.acct === a.id ? 'selected' : ''}>${esc(a.name)} (${esc(a.cur)})</option>`).join('')}</select></label>
    <p class="hint">If you follow an account, progress is that account's balance. Otherwise you add and take out money by hand.</p>
    <label class="field" id="g-startrow"><span>Already saved (optional)</span><input name="s" inputmode="decimal" autocomplete="off" value="${g.start || ''}" placeholder="0.00"></label>
    ${old ? button({ label: 'Remove This Goal', kind: 'danger-link', attr: { 'data-del': true } }) : ''}
    <div class="btnrow">${button({ label: 'Cancel', kind: 'ghost', attr: { 'data-no': true } })}${button({ label: 'Save', kind: 'primary', submit: true })}</div></form>`, { title: old ? 'Edit Goal' : 'New Goal' });
  const q = (sel) => s.el.querySelector(sel), form = q('form');
  draw();
  s.el.addEventListener('click', async (e) => {
    const idea = e.target.closest('[data-idea]'); if (idea) { form.n.value = idea.dataset.idea; g.name = form.n.value; if (!g.icon) draw(); return; }
    const tm = e.target.closest('[data-term] button'); if (tm) { g.term = tm.dataset.v; draw(); return; }
    if (e.target.closest('[data-due]')) { openDatePicker((g.due || todayStr()) + ' 00:00:00', (v) => { g.due = v.slice(0, 10); if (dayNum(g.due) - dayNum(todayStr()) > 366) g.term = 'long'; draw(); }, { time: false, title: 'Target Date' }); return; }
    if (e.target.closest('[data-nodue]')) { g.due = ''; draw(); return; }
    if (e.target.closest('#g-pic')) { const { openIconLibrary } = await import('./entry.js'); openIconLibrary(isImg(g.icon) ? '' : g.icon, (v) => { g.icon = v; draw(); }, { own: true, title: 'Goal Pictures', hint: 'Pick a picture for this goal.', auto: 'Automatic (from the name)' }); return; }
    if (e.target.closest('[data-no]')) { s.close(); return; }
    if (e.target.closest('[data-del]')) { if (await confirmDialog('Remove this goal? Your accounts and entries are not touched. You can bring it back from the Recycle Bin.', 'Remove', true)) { commit((d) => { const x = d.goals.find((y) => y.id === g.id); if (x) softDelete(x); }); s.close(); toast('Goal removed.'); } }
  });
  form.n.addEventListener('input', () => { g.name = form.n.value; if (!g.icon) draw(); });
  form.a.addEventListener('change', () => { g.acct = form.a.value; draw(); });
  form.onsubmit = (e) => {
    e.preventDefault(); const name = form.n.value.trim(), target = num(form.t.value);
    if (!name) { toast('Give the goal a name.'); form.n.focus(); return; }
    if (!(target > 0)) { toast('Enter a target amount above zero.'); form.t.focus(); return; }
    const rec = { ...g, name, target, cur: form.c.value && form.c.value !== HOME ? form.c.value : '', acct: form.a.value || '', start: form.a.value ? 0 : num(form.s.value), icon: g.icon || '' };
    if (rec.reachedAck && !goalStats({ ...get(), goals: [rec] }, rec).reached) rec.reachedAck = false;   /* a higher target brings a done goal back */
    commit((d) => { const i = d.goals.findIndex((x) => x.id === rec.id); if (i >= 0) d.goals[i] = stamp({ ...d.goals[i], ...rec }); else d.goals.push(stamp(rec)); });
    s.close(); toast(old ? 'Goal saved.' : 'Goal added.');
  };
}
ACT['goal-new'] = (el) => openGoal('', el && el.dataset ? el.dataset.name || '' : '');
ACT['goal-edit'] = (el) => openGoal(el.dataset.id);

// ---- add or take out money by hand ----
function openMoney(id, sign) {
  const g = live(get().goals).find((x) => x.id === id); if (!g) return; let date = todayStr();
  const s = sheet(`<form novalidate><p class="hint">${sign > 0 ? 'Money you put aside for this goal.' : 'Money you took out of this goal.'} This only changes the goal's progress. It does not move money between your accounts.</p>
    <label class="field"><span>Amount (${esc(goalCur(get(), g))})</span><input name="a" inputmode="decimal" autocomplete="off" placeholder="0.00" autofocus></label>
    <div class="field"><span>Date</span>${button({ label: ``, kind: 'ghost', size: 'sm', attr: { 'data-date': true } })}</div>
    ${textField({ label: 'Note (optional)', name: 'n' })}
    <div class="btnrow">${button({ label: 'Cancel', kind: 'ghost', attr: { 'data-no': true } })}${button({ html: `${sign > 0 ? 'Add' : 'Take Out'}`, kind: 'primary', submit: true })}</div></form>`, { title: `${sign > 0 ? 'Add Money to' : 'Take Money from'} ${g.name}` });
  const form = s.el.querySelector('form'), dateBtn = s.el.querySelector('[data-date]'), draw = () => { dateBtn.textContent = niceDate(date); }; draw();
  dateBtn.onclick = () => openDatePicker(date + ' 00:00:00', (v) => { date = v.slice(0, 10); draw(); }, { time: false, title: 'Date' });
  s.el.querySelector('[data-no]').onclick = () => s.close();
  form.onsubmit = (e) => {
    e.preventDefault(); const a = num(form.a.value); if (!(a > 0)) { toast('Enter an amount above zero.'); return; }
    commit((d) => { const x = d.goals.find((y) => y.id === id); if (!x) return; x.log = [...(x.log || []), { id: uid(), date, amt: sign * a, note: form.n.value.trim() }]; stamp(x); });
    s.close(); toast(sign > 0 ? 'Added.' : 'Taken out.');
  };
}
ACT['goal-add'] = (el) => openMoney(el.dataset.id, 1);
ACT['goal-take'] = (el) => openMoney(el.dataset.id, -1);
ACT['goal-hist'] = (el) => {
  const g = live(get().goals).find((x) => x.id === el.dataset.id); if (!g) return;
  const txRows = goalTxs(get(), g.id).map((t) => ({ id: 'tx:' + t.id, date: String(t.date).slice(0, 10), amt: t.amount * factorFor(get(), t) / (goalStats(get(), g).rate || 1), note: `Transfer: ${t.name || 'to goal'}`, fromTx: true }));
  const rows = [...(g.log || []), ...txRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  const s = sheet(`${g.start ? `<p class="hint">Already saved when you started: ${money(g.start)}</p>` : ''}${rows.length ? `<div class="rows plain">${rows.map((r) => `<div class="orow"><span class="rmain"><strong>${r.amt >= 0 ? '+' : '−'}${fmt(Math.abs(r.amt), goalCur(get(), g))}</strong><small>${niceDate(r.date)}${r.note ? ' · ' + esc(r.note) : ''}</small></span>${r.fromTx ? '<small class="muted">from a Transfer entry</small>' : button({ label: 'Remove', kind: 'danger-link', attr: { 'data-rm': r.id } })}</div>`).join('')}</div>` : '<p class="empty">No money added yet.</p>'}`, { title: `${g.name}: History` });
  s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; commit((d) => { const x = d.goals.find((y) => y.id === g.id); if (x) { x.log = (x.log || []).filter((r) => r.id !== b.dataset.rm); stamp(x); } }); s.close(); toast('Removed.'); });
};
ACT['goal-done'] = (el) => { commit((d) => { const x = d.goals.find((y) => y.id === el.dataset.id); if (x) { x.reachedAck = true; stamp(x); } }); toast('Done. It moved to Done at the bottom.'); };

// Home reminder: only goals that are really behind (see goalcheck.js); "Not now" hides one goal for a week
export function goalBanner(db) {
  const list = goalReminders(db).slice(0, 2); if (!list.length) return '';
  return `<section class="remind" aria-label="Savings goal reminders">${list.map(({ g, o }) => `<div class="rem ${o.level === 'behind' ? 'high' : 'urgent'}"><a class="remlink" href="#/savings"><span><strong>${esc(g.name)}: ${o.level === 'late' ? 'target date passed' : o.level === 'risk' ? 'may not reach the target' : 'falling behind'}</strong><small>${esc(o.lines[0] || '')}</small></span></a>${button({ label: 'Not now', kind: 'link', act: 'goal-snooze', attr: { 'data-id': g.id } })}</div>`).join('')}</section>`;
}
ACT['goal-snooze'] = (el) => { const d = new Date(); d.setDate(d.getDate() + 7); const until = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; commit((x) => { x.settings.goalSnooze = { ...(x.settings.goalSnooze || {}), [el.dataset.id]: until }; }); toast('Okay, I will remind you again in a week.'); };

// Home card (15.37): what you have put aside, with your closest goals
export function savingsCard(db) {
  const open = live(db.goals).filter((g) => !g.reachedAck); if (!open.length) return '';
  const t = savingsTotals(db), rows = open.map((g) => ({ g, s: goalStats(db, g) })).sort((a, b) => (a.g.due || '9999') < (b.g.due || '9999') ? -1 : (a.g.due || '9999') > (b.g.due || '9999') ? 1 : b.s.pct - a.s.pct).slice(0, 3);
  return `<section class="card savingshome"><div class="sgtop"><b>Savings</b><span>${money(t.saved)}</span></div>
    <small class="muted">of ${money(t.target)} across ${t.n} goal${t.n === 1 ? '' : 's'}</small>
    <div class="goalbar"><i style="width:${t.target > 0 ? Math.min(100, t.saved / t.target * 100).toFixed(1) : 0}%"></i></div>
    <ul class="calfacts">${rows.map(({ g, s }) => `<li><span>${esc(g.name)}${g.due ? `<small> by ${niceDate(g.due)}</small>` : ''}</span><b>${Math.round(s.pct)}%${s.perMonth != null ? ` <small class="muted">${money(s.perMonth)}/mo</small>` : ''}</b></li>`).join('')}</ul>
    <div class="btnrow"><a class="btn sm ghost" href="#/savings">All goals</a></div></section>`;
}
