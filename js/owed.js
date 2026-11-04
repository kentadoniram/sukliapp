// Owed to you tab: people who owe you money (accounts of type "Money owed to me"), what is still owed, since when, and quick buttons.
// Plain facts only: it shows how long you have waited and never says someone will not pay. Writing off is your own choice.
import { get, commit, stamp, balances, softDelete, undoLast, fmt, HOME, uid, homeFx, homeRate, BASE, findOrAddCategory, nowStamp } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog, promptDialog } from './ui.js';
import { hdr, coll } from './screens.js';
import { openEntry } from './entry.js';
import { isOwed } from './finance.js';
import { openDatePicker } from './datepicker.js';

const live = (l) => l.filter((x) => !x.deleted);
const money = (n) => fmt(n, HOME);
const dayNum = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Math.round(new Date(y, m - 1, d).getTime() / 864e5); };
const niceDate = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
const todayStr = () => nowStamp().slice(0, 10);
const daysText = (n) => (n === 0 ? 'today' : `${n} day${n === 1 ? '' : 's'}`);

export function owedList(db) {
  const bal = balances(db), out = [], tdy = dayNum(todayStr());
  for (const a of live(db.accounts)) {
    if (a.archived || !isOwed(a)) continue;
    const owedCur = bal.get(a.id) || 0, fx = homeFx(db, a.cur) || 1;
    const lent = db.txs.filter((t) => !t.deleted && t.kind === 'transfer' && t.toAcct === a.id && !t.lentBack), back = db.txs.filter((t) => !t.deleted && t.kind === 'transfer' && t.acct === a.id && !t.lent);
    const since = lent.map((t) => String(t.date).slice(0, 10)).sort()[0] || '';
    out.push({ id: a.id, name: a.name, cur: a.cur, owedCur, rate: fx, owed: owedCur * fx, open: owedCur > 0.004, since, waited: since ? Math.max(0, tdy - dayNum(since)) : null,
      due: a.owedDue || '', dueIn: a.owedDue ? dayNum(a.owedDue) - tdy : null, backN: back.length, backSum: back.reduce((q, t) => q + t.amount, 0) * fx, lastBack: back.map((t) => String(t.date).slice(0, 10)).sort().pop() || '' });
  }
  return out.sort((x, y) => y.owed - x.owed || x.name.localeCompare(y.name));
}

export function owed(db) {
  const list = owedList(db), open = list.filter((p) => p.open), done = list.filter((p) => !p.open), total = open.reduce((q, p) => q + p.owed, 0);
  const add = '<button type="button" class="btn" data-act="owed-add">Add a person</button>';
  if (!list.length) return `<div class="debtpage owedpage">${hdr('Owed to You')}<section class="cardbox"><h3>Nobody Owes You Yet</h3><p class="hint">When you lend money to a friend or family member, record it with <b>Lent</b> in the add button (the round +). It is not counted as spending, and it shows here until they pay you back.</p><div class="btnrow left">${add}</div></section></div>`;
  const row = (p) => `<div class="debtrow"><div class="dr-head"><div><button type="button" class="linkbtn oname" data-act="owed-hist" data-id="${p.id}"><b>${esc(p.name)}</b> ›</button><small class="muted">${p.since ? `Waiting since ${niceDate(p.since)} (${daysText(p.waited)})` : 'No lending entry yet'}</small></div>${p.cur !== HOME ? `<div class="dr-owedbox"><b class="dr-owed">${fmt(p.owedCur, p.cur)}</b><small class="muted">≈ ${money(p.owed)}</small></div>` : `<b class="dr-owed">${money(p.owed)}</b>`}</div>
    <ul class="calfacts">${p.cur !== HOME ? `<li><span>Rate used (your settings)</span><b>1 ${esc(p.cur)} = ${fmt(p.rate, HOME)}</b></li>` : ''}${p.due ? `<li><span>Expected back by</span><b>${niceDate(p.due)}${p.dueIn >= 0 ? ` (${daysText(p.dueIn)})` : ''}</b>${p.dueIn < 0 ? ' <small class="muted">date has passed</small>' : ''}</li>` : ''}<li><span>Paid back so far</span>${p.backN ? `<b>${money(p.backSum)} in ${p.backN} payment${p.backN === 1 ? '' : 's'}</b>${p.lastBack ? ` <small class="muted">last ${niceDate(p.lastBack)}</small>` : ''}` : '<span class="muted">nothing yet</span>'}</li></ul>
    <div class="btnrow tight"><button type="button" class="btn sm" data-act="owed-back" data-id="${p.id}">They paid me back</button><button type="button" class="btn sm ghost" data-act="owed-more" data-id="${p.id}">Lend more</button><button type="button" class="btn sm ghost" data-act="owed-edit" data-id="${p.id}">Change</button></div></div>`;
  const settled = done.length ? coll('o-done', `Paid Back (${done.length})`, `<div class="rows plain">${done.map((p) => `<div class="orow"><span class="rmain"><button type="button" class="linkbtn oname" data-act="owed-hist" data-id="${p.id}"><strong>${esc(p.name)}</strong> ›</button><small>${p.backN ? `Paid back ${money(p.backSum)}` : 'Nothing owed'}</small></span><span class="obtns"><button type="button" class="btn sm ghost" data-act="owed-more" data-id="${p.id}">Lend again</button><button type="button" class="btn sm ghost" data-act="owed-edit" data-id="${p.id}">Change</button></span></div>`).join('')}</div>`) : '';
  return `<div class="debtpage owedpage">${hdr('Owed to You')}
    <section class="cardbox"><h3>What Others Owe You</h3><div class="debtsum"><div class="dsrow"><span>Total owed to you</span><b>${money(total)}</b></div><div class="dsrow"><span>People</span><b>${open.length}</b></div></div>
      <p class="hint">Money you lent is not counted as spending, and it is not part of your Spendable money until it is paid back. Tap a name to see the whole history.</p><div class="btnrow left">${add}<button type="button" class="btn ghost" data-act="owed-new">I lent money</button></div></section>
    ${open.length ? `<h2 class="subh">Who owes you (${open.length})</h2>${open.map(row).join('')}` : '<section class="cardbox"><p class="hint">Everyone has paid you back.</p></section>'}${settled}</div>`;
}

ACT['owed-back'] = (el) => openEntry({ preset: { kind: 'transfer', debt: true, flow: 'back', acct: el.dataset.id } });
ACT['owed-more'] = (el) => openEntry({ preset: { kind: 'transfer', debt: true, flow: 'lend', toAcct: el.dataset.id } });
ACT['owed-new'] = () => openEntry({ preset: { kind: 'transfer', debt: true, flow: 'lend' } });
ACT['owed-add'] = async () => {
  const n = (await promptDialog('Add a person', '', { okLabel: 'Add', hint: 'A name is enough, for example Ana or Kuya Ben.' }))?.trim(); if (!n) return;
  if (get().accounts.some((x) => !x.deleted && isOwed(x) && x.name.toLowerCase() === n.toLowerCase())) { toast('Already in your list.'); return; }
  commit((d) => { d.accounts.push(stamp({ id: uid(), name: n, cur: HOME, type: 'owed', open: 0, include: true, archived: false })); }); toast('Added. Tap “I lent money” when you lend.');
};
ACT['owed-edit'] = (el) => {
  const db = get(), a = db.accounts.find((x) => x.id === el.dataset.id); if (!a) return; let due = a.owedDue || '';
  const p = owedList(db).find((x) => x.id === a.id) || { owedCur: 0 };
  const s = sheet(`<form novalidate><label class="field"><span>Name</span><input name="n" autocomplete="off" value="${esc(a.name)}"></label>
    <div class="field"><span>Expected back by (optional)</span><div class="btnrow tight"><button type="button" class="btn ghost sm" data-due>${due ? esc(niceDate(due)) : 'Pick a date'}</button><button type="button" class="btn ghost sm" data-nodue ${due ? '' : 'hidden'}>Clear</button></div></div>
    <p class="hint">Only a reminder for you. Nothing is added to the account.</p>
    ${p.owedCur > 0.004 ? '<button type="button" class="linkbtn" data-off>Write off what is left (they will not pay it back)</button>' : ''}
    <button type="button" class="linkbtn danger" data-del>Remove This Person</button>
    <div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn">Save</button></div></form>`, { title: a.name });
  s.el.querySelector('[data-del]').onclick = () => { s.dispose(); ACT['owed-del']({ dataset: { id: a.id } }); };
  const q = (x) => s.el.querySelector(x), draw = () => { q('[data-due]').textContent = due ? niceDate(due) : 'Pick a date'; q('[data-nodue]').hidden = !due; };
  q('[data-no]').onclick = () => s.close();
  q('[data-due]').onclick = () => openDatePicker((due || todayStr()) + ' 00:00:00', (v) => { due = v.slice(0, 10); draw(); }, { time: false, title: 'Expected Back By' });
  q('[data-nodue]').onclick = () => { due = ''; draw(); };
  const off = q('[data-off]');
  if (off) off.onclick = async () => {
    s.dispose();
    if (!(await confirmDialog(`Write off ${fmt(p.owedCur, a.cur)} that ${a.name} owes you? It is recorded as money not paid back (a loss, kept out of your everyday spending), and what they owe goes to zero. You can still record a payment later with “Lend again” and “They paid me back” is not needed then.`, 'Write it off', true))) return;
    commit((d) => {
      const x = d.accounts.find((z) => z.id === a.id), now = nowStamp(), fx = a.cur === BASE ? 1 : a.cur === HOME ? homeRate(d, now) : (homeFx(d, a.cur) || 1) * homeRate(d, now);
      d.txs.push(stamp({ id: uid(), kind: 'expense', date: now, name: `Not paid back: ${a.name}`, amount: +p.owedCur.toFixed(6), cur: a.cur, fx, cat: findOrAddCategory(d, 'Capital Loss/Distribution', 'Money not paid back', 'expense').id, acct: a.id, toAcct: '', toAmount: null, fee: 0, notes: 'Written off', labels: '', items: [], flag: null, createdAt: Date.now() }));
      if (x) stamp(x);
    });
    toast('Written off.');
  };
  q('form').onsubmit = (e) => {
    e.preventDefault(); const nm = e.target.n.value.trim() || a.name; s.dispose();
    commit((d) => { const x = d.accounts.find((z) => z.id === a.id); if (!x) return; x.name = nm; if (due) x.owedDue = due; else delete x.owedDue; stamp(x); }); toast('Saved.');
  };
};

// the whole history with one person: every time you lent or paid for them, every payment back, write-offs, with a running balance and the details of each entry
export function historyOf(db, id) {
  const a = db.accounts.find((x) => x.id === id); if (!a) return null;
  const nameOf = (i) => { const x = db.accounts.find((q) => q.id === i); return x ? x.name : ''; };
  const rows = [];
  for (const t of db.txs) {
    if (t.deleted || (t.acct !== id && t.toAcct !== id)) continue;
    let delta = 0, kind = '', other = '';
    if (t.kind === 'transfer' && t.toAcct === id) { delta = t.toAmount != null ? t.toAmount : t.amount; kind = t.lentBack ? 'Paid back' : 'Lent'; other = nameOf(t.acct); }
    else if (t.kind === 'transfer' && t.acct === id) { delta = -t.amount; kind = t.lent ? 'Lent (reversed)' : 'Paid back'; other = nameOf(t.toAcct); }
    else if (t.kind === 'expense' && t.acct === id) { delta = -t.amount; kind = 'Written off'; }
    else if (t.kind === 'income' && t.acct === id) { delta = t.amount; kind = 'Added'; }
    else continue;
    const bill = t.splitId ? db.txs.find((x) => !x.deleted && x.splitId === t.splitId && x.id !== t.id && x.paidFor) : null;
    rows.push({ t, delta, kind, other, bill });
  }
  rows.sort((x, y) => (String(x.t.date) < String(y.t.date) ? -1 : String(x.t.date) > String(y.t.date) ? 1 : 0));
  let run = a.open || 0; for (const r of rows) { run += r.delta; r.after = run; }
  const lent = rows.filter((r) => r.delta > 0).reduce((q, r) => q + r.delta, 0), back = rows.filter((r) => r.kind === 'Paid back').reduce((q, r) => q - r.delta, 0), off = rows.filter((r) => r.kind === 'Written off').reduce((q, r) => q - r.delta, 0);
  return { a, rows, lent, back, off, owed: run };
}
// remove a person: hide them and keep every record, or delete them together with their records (after a clear warning)
ACT['owed-del'] = (el) => {
  const db = get(), a = db.accounts.find((x) => x.id === el.dataset.id && !x.deleted); if (!a) return;
  const recs = db.txs.filter((t) => !t.deleted && (t.acct === a.id || t.toAcct === a.id)), bal = balances(db).get(a.id) || 0, n = recs.length;
  const finish = (mode) => {
    const ids = new Set(recs.map((t) => t.id));
    commit((d) => { const x = d.accounts.find((z) => z.id === a.id);
      if (mode === 'all') { for (const t of d.txs) if (ids.has(t.id)) softDelete(t); softDelete(x); }
      else if (n) { x.archived = true; stamp(x); } else softDelete(x); });
    toast(mode === 'all' ? `Removed ${a.name} and ${n} ${n === 1 ? 'record' : 'records'}. You can undo this.` : n ? `${a.name} is hidden. Records are kept.` : `Removed ${a.name}.`, { ms: 7000, undo: () => undoLast() });
  };
  if (!n) { confirmDialog(`Remove ${a.name} from your list? There are no records with this person.`, 'Remove', true).then((y) => { if (y) finish('hide'); }); return; }
  const s = sheet(`<p class="confirm-text">${esc(a.name)} has ${n} ${n === 1 ? 'record' : 'records'}${bal > 0.004 ? ` and still owes ${fmt(bal, a.cur)}` : ''}.</p>
    <p class="hint"><b>Hide Person</b> takes them off the list and keeps every record, so your balances do not change. <b>Delete Person and Records</b> also deletes the ${n} ${n === 1 ? 'entry' : 'entries'} lent to or paid back by them, which changes your account balances (use it for test entries).</p>
    <div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button type="button" class="btn ghost" data-hide>Hide Person</button><button type="button" class="btn danger" data-all>Delete Person and Records</button></div>`, { title: `Remove ${a.name}?` });
  s.el.querySelector('[data-no]').onclick = () => s.close(); s.el.querySelector('[data-hide]').onclick = () => { s.close(); finish('hide'); }; s.el.querySelector('[data-all]').onclick = () => { s.close(); finish('all'); };
};
ACT['owed-hist'] = (el) => {
  const db = get(), h = historyOf(db, el.dataset.id); if (!h) return; const a = h.a, m = (n) => fmt(n, a.cur);
  const li = (r) => { const t = r.t, inn = r.delta > 0;
    const why = r.bill ? `Part of: ${esc(r.bill.name)} (bill ${fmt(r.bill.paidFor.total, r.bill.cur)}, your own part ${fmt(r.bill.amount, r.bill.cur)})` : (t.splitId ? 'Paid for them as part of a shared bill' : '');
    const det = [r.other ? `${inn && r.kind === 'Lent' ? 'From' : 'To/from'} ${esc(r.other)}` : '', why, t.notes ? esc(t.notes) : ''].filter(Boolean).join(' · ');
    return `<li class="ohr"><button type="button" class="ohbtn" data-act="edit" data-id="${t.id}"><span class="ohl"><b>${esc(r.kind)}</b><small>${esc(niceDate(t.date))}${t.name ? ' · ' + esc(t.name) : ''}</small>${det ? `<small>${det}</small>` : ''}</span><span class="ohr-r"><b class="${inn ? 'oh-up' : 'oh-down'}">${inn ? '+' : '-'}${m(Math.abs(r.delta))}</b><small>owed after: ${m(r.after)}</small></span></button></li>`; };
  sheet(`<ul class="calfacts"><li><span>Lent or paid for them</span><b>${m(h.lent)}</b></li><li><span>Paid back so far</span><b>${m(h.back)}</b></li>${h.off > 0.004 ? `<li><span>Written off</span><b>${m(h.off)}</b></li>` : ''}<li><span><b>Still owed</b></span><b>${m(h.owed)}</b></li>${a.cur !== HOME ? `<li><span>In ${HOME} (1 ${esc(a.cur)} = ${fmt(homeFx(db, a.cur) || 0, HOME)})</span><b>≈ ${fmt(h.owed * (homeFx(db, a.cur) || 0), HOME)}</b></li>` : ''}</ul>
    ${h.rows.length ? `<ul class="ohist">${h.rows.slice().reverse().map(li).join('')}</ul><p class="hint">Newest first. Tap a line to see or change that entry.</p>` : '<p class="empty">Nothing recorded with this person yet.</p>'}
    <div class="btnrow left"><button type="button" class="btn ghost sm danger" data-act="owed-del" data-id="${a.id}">Remove This Person</button></div>`, { title: `${a.name}: History` });
};
