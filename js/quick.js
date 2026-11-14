// Quick Question card (15.37): ONE short Yes / No question on Home that teaches Sukli something about your own data.
//   need    "Is Groceries a need (something you must pay for)?"  Yes/No sets the category as need or want (used by Budget alerts)
//   bill    "Rent about ¥80,000 came 3 months in a row. Is it a monthly bill?"  Yes adds it to Bills (counted in Safe to Spend)
// "Not now" hides the question for a week. Answers are kept in your settings; nothing leaves your phone.
import { get, commit, uid, stamp, nowStamp, monthParts, thisMonth, shiftMonth, fmt, HOME, factorFor } from './core.js';
import { ACT, esc } from './ui.js';
import { button } from './components.js';
import { CLASSES } from './budgetsetup.js';

const money = (n) => fmt(n, HOME, { round: true });
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]+/g, ' ').trim();
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

function needQuestion(db) {
  const ym = thisMonth(), spent = new Map();
  for (let i = 0; i <= 2; i++) for (const p of monthParts(db, shiftMonth(ym, -i))) if (p.kind === 'expense' && p.cat) spent.set(p.cat, (spent.get(p.cat) || 0) + p.v);
  const c = (db.categories || []).filter((x) => !x.deleted && !x.need && spent.get(x.id) > 0 && x.group !== 'Adjustments').sort((a, b) => spent.get(b.id) - spent.get(a.id))[0];
  return c ? { id: `need:${c.id}`, text: `Is ${c.name} a need, something you must pay for?`, hint: `You spent ${money(spent.get(c.id))} on it lately. A need gets a gentler message when the budget is full.`, yes: { act: 'quick-need', v: c.id + '|need' }, no: { act: 'quick-need', v: c.id + '|want' } } : null;
}
function billQuestion(db) {
  const have = new Set(((db.settings || {}).bills || []).map((b) => norm(b.name))), by = new Map();
  for (const t of db.txs || []) { if (t.deleted || t.kind !== 'expense' || t.trade || t.tradeOf) continue; const k = norm(t.name); if (!k || have.has(k)) continue; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
  const ym = thisMonth(); let best = null;
  for (const [k, l] of by) {
    const ms = [...new Set(l.map((t) => t.date.slice(0, 7)))].sort(); if (ms.length < 3) continue;
    const last3 = [shiftMonth(ym, -1), shiftMonth(ym, -2), shiftMonth(ym, -3)]; if (!last3.every((m) => ms.includes(m)) && !([ym, shiftMonth(ym, -1), shiftMonth(ym, -2)].every((m) => ms.includes(m)))) continue;
    const v = l.slice(-3).map((t) => t.amount * factorFor(db, t)), mid = v.slice().sort((a, b) => a - b)[1];
    if (!(mid >= 500) || v.some((x) => Math.abs(x - mid) > mid * 0.1)) continue;
    if (!best || mid > best.amt) best = { k, name: l[l.length - 1].name, amt: mid, last: l[l.length - 1] };
  }
  return best ? { id: `bill:${best.k}`, text: `${best.name} came about ${money(best.amt)} three months in a row. Is it a monthly bill?`, hint: 'Yes adds it to Bills, so Safe to Spend keeps it aside.', yes: { act: 'quick-bill', v: best.k }, no: { act: 'quick-no', v: `bill:${best.k}` } } : null;
}
export function quickQuestion(db) {
  const snooze = (db.settings || {}).quickSnooze || {}, today = nowStamp().slice(0, 10), done = new Set((db.settings || {}).quickDone || []);
  for (const q of [billQuestion(db), needQuestion(db)]) if (q && !done.has(q.id) && (snooze[q.id] || '') <= today) return q;
  return null;
}
export function quickCard(db) {
  const q = quickQuestion(db); if (!q) return '';
  return `<section class="card quickcard"><h2>Quick Question</h2><p class="qtext"><b>${esc(q.text)}</b></p><p class="hint">${esc(q.hint)}</p>
    <div class="btnrow">${button({ label: 'Yes', kind: 'primary', size: 'sm', act: q.yes.act, data: 'v', v: q.yes.v })}${button({ label: 'No', kind: 'ghost', size: 'sm', act: q.no.act, data: 'v', v: q.no.v })}${button({ label: 'Not now', kind: 'link', act: 'quick-snooze', data: 'v', v: q.id })}</div></section>`;
}
const finish = (d, id) => { d.settings.quickDone = [...new Set([...(d.settings.quickDone || []), id])].slice(-300); };
ACT['quick-need'] = (el) => { const [id, cls] = el.dataset.v.split('|'); if (!CLASSES[cls]) return; commit((d) => { const c = d.categories.find((x) => x.id === id); if (c) { c.need = cls; stamp(c); } finish(d, `need:${id}`); }); };
ACT['quick-no'] = (el) => commit((d) => finish(d, el.dataset.v));
ACT['quick-snooze'] = (el) => commit((d) => { d.settings.quickSnooze = { ...(d.settings.quickSnooze || {}), [el.dataset.v]: addDays(7) }; });
ACT['quick-bill'] = (el) => {
  const q = billQuestion(get()); if (!q || q.id !== `bill:${el.dataset.v}`) return;
  const b = (() => { const db = get(); let r = null; for (const t of db.txs) if (!t.deleted && norm(t.name) === el.dataset.v) r = t; return r; })(); if (!b) return;
  const d0 = new Date(Date.now()); const day = Math.min(28, +b.date.slice(8, 10)); let y = d0.getFullYear(), m = d0.getMonth() + 1; let due = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`; if (due < nowStamp().slice(0, 10)) { m++; if (m > 12) { m = 1; y++; } due = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
  commit((d) => { (d.settings.bills = d.settings.bills || []).push({ id: uid(), name: b.name, amount: Math.round(b.amount * factorFor(get(), b)), due, every: 'month', left: 0 }); finish(d, `bill:${el.dataset.v}`); });
};
