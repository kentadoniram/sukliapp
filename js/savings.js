// Savings: goals you save toward (a trip, a laptop, a house). Each goal has a target amount, a picture, an optional target date and
// short-term or long-term. Progress comes from ONE of two places, never both:
//   - a linked account (progress = that account's balance, in your home currency), or
//   - money you add or take out by hand (the goal keeps its own small list of deposits).
// Everything is in your home currency. A goal never moves money by itself and never changes your totals.
import { get, commit, stamp, balances, softDelete, fmt, HOME, uid, homeFx, nowStamp, groupColor } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { hdr, coll } from './screens.js';
import { button } from './components.js';
import { openDatePicker } from './datepicker.js';
import { picHtml, isImg } from './pictures.js';

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
  const linked = !!a, saved = linked ? (balances(db).get(a.id) || 0) * (homeFx(db, a.cur) || 1) : (g.log || []).reduce((s, x) => s + (x.amt || 0), 0) + (g.start || 0);
  const target = g.target || 0, left = Math.max(0, target - saved), pct = target > 0 ? Math.max(0, Math.min(100, (saved / target) * 100)) : 0, reached = target > 0 && saved >= target - 0.005;
  const out = { linked, acct: a, saved, target, left, pct, reached, perMonth: null, monthsLeft: null, late: false, pace: null, eta: null };
  if (g.due && !reached) {
    const days = dayNum(g.due) - dayNum(today);
    if (days < 0) out.late = true;
    else { out.monthsLeft = Math.max(1, Math.ceil(days / MONTH)); out.perMonth = left / out.monthsLeft; }
  }
  const since = g.created ? Math.max(1, dayNum(today) - dayNum(g.created)) : 0;
  if (!reached && since >= 14 && saved > 0) { out.pace = saved / (since / MONTH); out.eta = dayNum(today) + Math.ceil((left / out.pace) * MONTH); }   /* at your pace so far */
  return out;
}
export const termOf = (g) => (g.term === 'long' ? 'long' : 'short');
export function savingsTotals(db) {
  const gs = live(db.goals).filter((g) => !g.reachedAck), st = gs.map((g) => goalStats(db, g));
  return { n: gs.length, saved: st.reduce((s, x) => s + Math.min(x.saved, x.target), 0), target: st.reduce((s, x) => s + x.target, 0) };
}

// ---- the page ----
const card = (db, g) => {
  const s = goalStats(db, g), col = groupColor(g.name || 'x');
  const facts = [];
  if (g.due) facts.push(`<li><span>Target date</span><b>${niceDate(g.due)}${s.late ? ' (passed)' : ''}</b></li>`);
  if (s.perMonth != null) facts.push(`<li><span>To reach it on time</span><b>${money(s.perMonth)} a month</b></li>`);
  if (s.pace != null && s.eta) facts.push(`<li><span>At your pace so far</span><b>about ${monthYear(s.eta)}</b></li>`);
  facts.push(`<li><span>Still to save</span><b>${money(s.left)}</b></li>`);
  return `<div class="debtrow goalcard ${s.reached ? 'reached' : ''}" data-goal="${g.id}"><div class="dr-head"><div class="goalhead"><i class="badge" style="background:${col}">${picHtml(g.icon, autoIcon(g.name))}</i>
    <div><b>${esc(g.name)}</b><small class="muted">${termOf(g) === 'long' ? 'Long-term' : 'Short-term'}${s.linked ? ` · follows ${esc(s.acct.name)}` : ''}</small></div></div>
    ${button({ label: 'Edit', kind: 'link', act: 'goal-edit', attr: { 'data-id': g.id } })}</div>
    <div class="goalbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(s.pct)}"><i style="width:${s.pct.toFixed(1)}%"></i></div>
    <p class="goalnum"><b>${money(s.saved)}</b> of ${money(s.target)} · ${Math.round(s.pct)}%${s.reached ? ' · Reached!' : ''}</p>
    <ul class="calfacts">${facts.join('')}</ul>
    <div class="btnrow tight">${s.linked ? `<span class="hint">Progress follows the balance of ${esc(s.acct.name)}.</span>` : `<button type="button" class="btn sm" data-act="goal-add" data-id="${g.id}">Add Money</button><button type="button" class="btn sm ghost" data-act="goal-take" data-id="${g.id}">Take Out</button><button type="button" class="linkbtn" data-act="goal-hist" data-id="${g.id}">History</button>`}
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
    <label class="field"><span>What are you saving for?</span><input name="n" autocomplete="off" autocapitalize="words" value="${esc(g.name)}" placeholder="e.g. Japan Trip, Laptop, House" autofocus></label>
    ${old ? '' : `<div class="chips">${IDEAS.map(([n]) => `${button({ label: n, kind: 'chip', attr: { 'data-idea': n } })}`).join('')}</div>`}
    <div class="field"><span>Picture</span><button type="button" class="picbtn" id="g-pic" aria-label="Choose a picture for this goal"></button></div>
    <label class="field"><span>Target amount (${esc(HOME)})</span><input name="t" inputmode="decimal" autocomplete="off" value="${g.target ? g.target : ''}" placeholder="0.00"></label>
    <div class="field"><span>Short or long term</span><div class="chips" data-term><button type="button" class="chip" data-v="short">Short-term (within a year)</button><button type="button" class="chip" data-v="long">Long-term</button></div></div>
    <div class="field"><span>Target date (optional)</span><div class="btnrow tight"><button type="button" class="btn ghost sm" data-due></button><button type="button" class="btn ghost sm" data-nodue>No date</button></div></div>
    <label class="field"><span>Follow an account (optional)</span><select name="a"><option value="">No, I add money myself</option>${accts.map((a) => `<option value="${a.id}" ${g.acct === a.id ? 'selected' : ''}>${esc(a.name)} (${esc(a.cur)})</option>`).join('')}</select></label>
    <p class="hint">If you follow an account, progress is that account's balance. Otherwise you add and take out money by hand.</p>
    <label class="field" id="g-startrow"><span>Already saved (optional)</span><input name="s" inputmode="decimal" autocomplete="off" value="${g.start || ''}" placeholder="0.00"></label>
    ${old ? button({ label: 'Remove This Goal', kind: 'danger-link', attr: { 'data-del': true } }) : ''}
    <div class="btnrow">${button({ label: 'Cancel', kind: 'ghost', attr: { 'data-no': true } })}<button class="btn">Save</button></div></form>`, { title: old ? 'Edit Goal' : 'New Goal' });
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
    const rec = { ...g, name, target, acct: form.a.value || '', start: form.a.value ? 0 : num(form.s.value), icon: g.icon || '' };
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
    <label class="field"><span>Amount (${esc(HOME)})</span><input name="a" inputmode="decimal" autocomplete="off" placeholder="0.00" autofocus></label>
    <div class="field"><span>Date</span><button type="button" class="btn ghost sm" data-date></button></div>
    <label class="field"><span>Note (optional)</span><input name="n" autocomplete="off"></label>
    <div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn">${sign > 0 ? 'Add' : 'Take Out'}</button></div></form>`, { title: `${sign > 0 ? 'Add Money to' : 'Take Money from'} ${g.name}` });
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
  const rows = [...(g.log || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const s = sheet(`${g.start ? `<p class="hint">Already saved when you started: ${money(g.start)}</p>` : ''}${rows.length ? `<div class="rows plain">${rows.map((r) => `<div class="orow"><span class="rmain"><strong>${r.amt >= 0 ? '+' : '−'}${money(Math.abs(r.amt))}</strong><small>${niceDate(r.date)}${r.note ? ' · ' + esc(r.note) : ''}</small></span><button type="button" class="linkbtn danger" data-rm="${r.id}">Remove</button></div>`).join('')}</div>` : '<p class="empty">No money added yet.</p>'}`, { title: `${g.name}: History` });
  s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; commit((d) => { const x = d.goals.find((y) => y.id === g.id); if (x) { x.log = (x.log || []).filter((r) => r.id !== b.dataset.rm); stamp(x); } }); s.close(); toast('Removed.'); });
};
ACT['goal-done'] = (el) => { commit((d) => { const x = d.goals.find((y) => y.id === el.dataset.id); if (x) { x.reachedAck = true; stamp(x); } }); toast('Done. It moved to Done at the bottom.'); };
