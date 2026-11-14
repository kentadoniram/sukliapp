// Reimbursable expenses: money you spend for work (train and bus fares, meals, supplies) that your COMPANY pays back.
// Not the same as "Owed to You" (a person who owes you). Here the money was spent for the company.
// A flagged expense carries t.reimb = { co, st: 'pending' | 'paid', got, on, rid }. While it is pending it is not your spending (see reimbKeep in core.js);
// when the company pays, an income entry flagged reimbBack records the money coming in (it is not income) and the flagged expenses become 'paid'.
import { button } from './components.js';
import { get, commit, stamp, softDelete, fmt, HOME, uid, factorFor, homeFx, nowStamp, catMap } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { hdr, coll } from './screens.js';
import { openEntry } from './entry.js';
import { reimbKeep } from './reimbkeep.js';

const live = (l) => (l || []).filter((x) => !x.deleted);
const money = (n) => fmt(n, HOME);
const day = (s) => String(s).slice(0, 10);
const dayNum = (s) => { const [y, m, d] = day(s).split('-').map(Number); return Math.round(new Date(y, m - 1, d).getTime() / 864e5); };
const nice = (s) => { const [y, m, d] = day(s).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
export const DEFAULT_CO = 'My Company';
export { reimbKeep };

export const companies = (db) => { const set = new Map(); for (const t of live(db.txs)) if (t.reimb && t.reimb.co) set.set(t.reimb.co.toLowerCase(), t.reimb.co); for (const c of db.settings.reimbCos || []) set.set(String(c).toLowerCase(), c); return [...set.values()]; };
export const lastCompany = (db) => db.settings.lastReimbCo || companies(db)[0] || '';
export const rememberCompany = (d, co) => { if (!co) return; d.settings.lastReimbCo = co; const l = d.settings.reimbCos || []; if (!l.some((x) => x.toLowerCase() === co.toLowerCase())) d.settings.reimbCos = [...l, co]; };

// pending and paid lines, by company
export function reimbData(db) {
  const cm = catMap(db), today = dayNum(nowStamp()), by = new Map();
  for (const t of live(db.txs)) {
    if (t.kind !== 'expense' || !t.reimb) continue;
    const co = t.reimb.co || DEFAULT_CO; if (!by.has(co)) by.set(co, { co, pending: [], paid: [] });
    const home = t.amount * factorFor(db, t), c = cm.get(t.cat), row = { t, home, cat: c ? c.name : '', age: Math.max(0, today - dayNum(t.date)) };
    by.get(co)[t.reimb.st === 'paid' ? 'paid' : 'pending'].push(row);
  }
  const list = [...by.values()].map((g) => ({ ...g, pending: g.pending.sort((a, b) => String(a.t.date).localeCompare(String(b.t.date))), paid: g.paid.sort((a, b) => String(b.t.reimb.on || b.t.date).localeCompare(String(a.t.reimb.on || a.t.date))), total: g.pending.reduce((q, r) => q + r.home, 0) }));
  list.sort((a, b) => b.total - a.total || a.co.localeCompare(b.co));
  const all = list.flatMap((g) => g.pending);
  return { list, total: all.reduce((q, r) => q + r.home, 0), n: all.length, oldest: all.length ? Math.max(...all.map((r) => r.age)) : 0 };
}
export const pendingCount = (db) => reimbData(db).n;

// "¥1,200 + $5.00 ≈ ₱x": the amounts in the currencies they were spent in, then what they come to in the home currency
const origText = (rows) => { const m = new Map(); for (const x of rows) m.set(x.t.cur, (m.get(x.t.cur) || 0) + x.t.amount); return [...m.entries()].map(([c, a]) => fmt(a, c)).join(' + '); };
const totalText = (rows) => { const h = rows.reduce((q, x) => q + x.home, 0); return rows.some((x) => x.t.cur !== HOME) ? `${origText(rows)} <small class="muted">≈ ${money(h)}</small>` : money(h); };
const ageText = (n) => (n === 0 ? 'today' : `${n} day${n === 1 ? '' : 's'}`);
let SEL = new Set();   // ticked lines on the page

// ---------- the Home card ----------
export function reimbCard(db) {
  const r = reimbData(db); if (!r.n) return '';
  return `<section class="cardbox reimbcard" data-reimb-card><h3>Waiting for Reimbursement</h3>
    <div class="debtsum"><div class="dsrow"><span>Your company will pay back</span><b>${totalText(r.list.flatMap((g) => g.pending))}</b></div><div class="dsrow"><span>Entries · oldest</span><b>${r.n} · ${ageText(r.oldest)}</b></div></div>
    <p class="hint">Not counted as your spending while you wait.</p><div class="btnrow tight"><a class="btn sm" href="#/reimburse">Open</a></div></section>`;
}

// ---------- the page ----------
export function reimburse(db) {
  const r = reimbData(db);
  if (!r.list.length) return `<div class="debtpage reimbpage">${hdr('Reimbursement')}<section class="cardbox"><h3>Nothing to Be Reimbursed</h3>
    <p class="hint">Some spending your company pays back: train and bus fares, meals, supplies. When you add an expense (or read a Pasmo or Suica screenshot), turn on <b>Reimbursable</b>. It is kept here, and it is <b>not counted as your spending</b> until you decide what the company really paid.</p>
    <p class="hint">This is different from <a href="#/owed">Owed to You</a>, which is for a person who borrowed money from you.</p></section></div>`;
  const row = (x, group) => `<li class="rbrow"><label class="rbl"><input type="checkbox" data-rb="${x.t.id}" ${SEL.has(x.t.id) ? 'checked' : ''}><span class="rbt"><b>${esc(x.t.name || x.cat || 'Expense')}</b><small class="muted">${esc(nice(x.t.date))} · ${esc(x.cat || 'No category')} · ${ageText(x.age)}</small></span></label><span class="rbamt"><b>${fmt(x.t.amount, x.t.cur)}</b>${x.t.cur !== HOME ? `<small class="muted">≈ ${money(x.home)}</small>` : ''}${button({ label: 'Edit', kind: 'link', size: 'sm', act: 'reimb-edit', data: 'id', v: x.t.id })}</span></li>`;
  const paidRow = (x) => `<li class="rbrow done"><span class="rbt"><b>${esc(x.t.name || x.cat || 'Expense')}</b><small class="muted">${esc(nice(x.t.date))} · paid back ${esc(x.t.reimb.on ? nice(x.t.reimb.on) : '')}${(x.t.reimb.got || 0) + 0.004 < x.t.amount ? ` · the company paid ${fmt(x.t.reimb.got || 0, x.t.cur)} of ${fmt(x.t.amount, x.t.cur)}` : ''}</small></span>${button({ label: 'Undo', kind: 'link', size: 'sm', act: 'reimb-undo', data: 'id', v: x.t.id })}</li>`;
  const cards = r.list.map((g) => `<section class="cardbox" data-co="${esc(g.co)}"><h3>${esc(g.co)}</h3>
    ${g.pending.length ? `<div class="debtsum"><div class="dsrow"><span>Waiting</span><b>${totalText(g.pending)}</b></div><div class="dsrow"><span>Entries</span><b>${g.pending.length}</b></div></div>
      <ul class="rbl-list calfacts">${g.pending.map((x) => row(x)).join('')}</ul>
      <div class="btnrow tight">${button({ label: 'Mark Paid Back', kind: 'primary', size: 'sm', act: 'reimb-paid', data: 'co', v: g.co })}${button({ label: 'Copy the List', kind: 'secondary', size: 'sm', act: 'reimb-copy', data: 'co', v: g.co })}${button({ label: 'Tick All', kind: 'ghost', size: 'sm', act: 'reimb-all', data: 'co', v: g.co })}</div>
      <p class="hint">Tick the lines the company paid, then Mark Paid Back. With none ticked it applies to all of this company's waiting lines.</p>` : '<p class="hint">Nothing waiting for this company.</p>'}
    ${g.paid.length ? coll('rb-paid-' + g.co, `Paid Back (${g.paid.length})`, `<ul class="calfacts">${g.paid.slice(0, 40).map(paidRow).join('')}</ul>`) : ''}</section>`).join('');
  return `<div class="debtpage reimbpage">${hdr('Reimbursement')}
    <section class="cardbox"><h3>Waiting for Reimbursement</h3><div class="debtsum"><div class="dsrow"><span>Total the company owes you</span><b>${totalText(r.list.flatMap((g) => g.pending))}</b></div><div class="dsrow"><span>Entries</span><b>${r.n}</b></div><div class="dsrow"><span>Oldest</span><b>${r.n ? ageText(r.oldest) : '-'}</b></div></div>
      <p class="hint">This is money you spent for work. It is not counted as your spending while it waits, and it is separate from <a href="#/owed">Owed to You</a> (people who borrowed from you). When the company pays, Mark Paid Back records the money coming in; it is not income.</p></section>
    ${cards}</div>`;
}
const rowsOf = (co) => { const g = reimbData(get()).list.find((x) => x.co === co); return g ? g.pending : []; };
const picked = (co) => { const rows = rowsOf(co), tick = rows.filter((x) => SEL.has(x.t.id)); return tick.length ? tick : rows; };
document.addEventListener('change', (e) => { const c = e.target.closest && e.target.closest('input[data-rb]'); if (!c) return; if (c.checked) SEL.add(c.dataset.rb); else SEL.delete(c.dataset.rb); });
ACT['reimb-edit'] = (el) => openEntry({ id: el.dataset.id });
ACT['reimb-all'] = (el) => { for (const x of rowsOf(el.dataset.co)) SEL.add(x.t.id); window.dispatchEvent(new Event('sukli-render')); };
ACT['reimb-copy'] = async (el) => {
  const rows = picked(el.dataset.co), cm = catMap(get()), head = ['Date', 'Description', 'Category', 'Amount', 'Currency'].join('\t');
  const text = [head, ...rows.map((x) => [day(x.t.date), x.t.name || '', (cm.get(x.t.cat) || {}).name || '', x.t.amount, x.t.cur].join('\t'))].join('\n');
  try { await navigator.clipboard.writeText(text); toast(`Copied ${rows.length} line${rows.length === 1 ? '' : 's'}. Paste into your expense report.`); } catch { toast('Could not copy. Your browser blocked it.'); }
};
ACT['reimb-paid'] = (el) => {
  const co = el.dataset.co, rows = picked(co); if (!rows.length) return;
  const db = get(), claimed = rows.reduce((q, x) => q + x.home, 0), accts = live(db.accounts).filter((a) => !a.archived && !['card', 'loan', 'owed'].includes(a.type) && a.type !== 'crypto' && a.type !== 'invest'), first = accts.find((a) => a.id === rows[0].t.acct) || accts.find((a) => a.id === db.settings.lastAcct) || accts[0];
  if (!first) { toast('Add an account first.'); return; }
  const s = sheet(`<form novalidate><p class="hint"><b>${esc(co)}</b> · ${rows.length} line${rows.length === 1 ? '' : 's'} · claimed about <b>${esc(money(claimed))}</b>.</p>
    <label class="field"><span>Received into</span><select name="acct">${accts.map((a) => `<option value="${a.id}" ${a.id === first.id ? 'selected' : ''}>${esc(a.name)} (${esc(a.cur)})</option>`).join('')}</select></label>
    <label class="field"><span>Amount received <small class="muted" id="rb-cur"></small></span><input name="amt" inputmode="decimal" autocomplete="off" placeholder="0"></label>
    <p class="hint" id="rb-note"></p>
    <div class="btnrow">${button({ label: 'Cancel', kind: 'ghost', id: 'rb-no' })}${button({ label: 'Save', kind: 'primary', id: 'rb-ok' })}</div></form>`, { title: 'Mark Paid Back' });
  const f = s.el.querySelector('form'), acctOf = () => accts.find((a) => a.id === f.acct.value) || first;
  const sync = () => { const a = acctOf(), r = a.cur === HOME ? 1 : (homeFx(db, a.cur) || 1); s.el.querySelector('#rb-cur').textContent = `in ${a.cur}`; if (!f.amt.dataset.t) f.amt.value = String(Math.round((claimed / r) * 100) / 100); note(); };
  const note = () => { const a = acctOf(), r = a.cur === HOME ? 1 : (homeFx(db, a.cur) || 1), got = num(f.amt.value) * r; s.el.querySelector('#rb-note').textContent = got + 0.5 < claimed ? `The company paid less than you claimed. The missing ${money(claimed - got)} is counted as your own spending, shared over these lines.` : 'The full amount: none of these lines count as your spending.'; };
  f.acct.onchange = () => { f.amt.dataset.t = ''; sync(); }; f.amt.oninput = () => { f.amt.dataset.t = '1'; note(); }; sync();
  s.el.querySelector('#rb-no').onclick = () => s.close(); s.el.querySelector('#rb-ok').onclick = () => f.requestSubmit();
  f.onsubmit = (e) => {
    e.preventDefault(); const a = acctOf(), r = a.cur === HOME ? 1 : (homeFx(db, a.cur) || 1), amt = num(f.amt.value);
    if (!(amt >= 0)) { toast('Type the amount received.'); return; }
    const ratio = claimed > 0 ? Math.min(1, (amt * r) / claimed) : 1, rid = uid(), when = nowStamp(), ids = new Set(rows.map((x) => x.t.id));
    s.close();
    commit((d) => {
      for (const t of d.txs) if (ids.has(t.id) && t.reimb) { t.reimb = { ...t.reimb, st: 'paid', got: Math.round(t.amount * ratio * 100) / 100, on: when, rid }; stamp(t); }
      if (amt > 0) d.txs.push(stamp({ id: rid, kind: 'income', amount: amt, cur: a.cur, fx: a.cur === HOME ? 1 : r, date: when, name: `Reimbursed by ${co}`, autoName: false, cat: '', acct: a.id, notes: '', labels: '', items: [], counts: [], reimbBack: true, reimbFor: [...ids] }));
      d.settings.lastAcct = a.id;
    });
    for (const id of ids) SEL.delete(id);
    toast(ratio < 1 ? 'Saved. The part the company did not pay now counts as your spending.' : 'Saved. Paid back in full.');
  };
};
ACT['reimb-undo'] = async (el) => {
  const id = el.dataset.id, t = live(get().txs).find((x) => x.id === id); if (!t || !t.reimb) return;
  if (!(await confirmDialog('Put this back to waiting? The money you recorded as received for it is removed.', 'Put Back', false))) return;
  const rid = t.reimb.rid;
  commit((d) => {
    const x = d.txs.find((q) => q.id === id); if (x && x.reimb) { x.reimb = { co: x.reimb.co, st: 'pending' }; stamp(x); }
    const inc = d.txs.find((q) => q.id === rid && !q.deleted);
    if (inc && !d.txs.some((q) => !q.deleted && q.reimb && q.reimb.rid === rid)) softDelete(inc);
  });
  toast('Back to waiting.');
};
