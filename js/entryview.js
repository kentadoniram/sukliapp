// Tapping an entry in a list opens it here first, to read only. Nothing can change by accident: Edit and Delete are separate buttons.
import { get, commit, stamp, softDelete, fmt, HOME, homePer } from './core.js';
import { esc, ACT, sheet, toast, confirmDialog } from './ui.js';
import { splitOf, openSplit, deleteWithMates } from './splitbill.js';
import { button } from './components.js';

const KIND = { expense: 'Spending', income: 'Income', transfer: 'Transfer' };
const pretty = (d) => { const s = String(d || ''), dt = new Date(s.slice(0, 10) + 'T12:00:00'); return isNaN(dt) ? s : dt.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) + (s.length > 10 ? ' · ' + s.slice(11, 16) : ''); };

export function entryFacts(db, t) {
  const A = new Map(db.accounts.map((a) => [a.id, a])), cat = (db.categories || []).find((c) => c.id === t.cat), a = A.get(t.acct), b = A.get(t.toAcct);
  const rows = [];
  const add = (k, v) => { if (v !== undefined && v !== null && String(v) !== '') rows.push([k, v]); };
  const kind = t.lent ? 'Lent (money owed to you)' : t.trade ? 'Trade' : KIND[t.kind] || t.kind;
  add('Kind', kind); add('Date', pretty(t.date));
  if (t.kind === 'transfer') { add('From', a ? a.name : ''); add('To', b ? b.name : ''); if (b && t.toAmount != null && b.cur !== t.cur) add('Received', fmt(t.toAmount, b.cur)); }
  else add('Account', a ? a.name : '');
  if (cat) add('Category', `${cat.name}${cat.group ? ' · ' + cat.group : ''}`);
  if (t.cur && t.cur !== HOME && t.fx) add('Rate used', `1 ${t.cur} = ${+homePer(db, t).toFixed(4)} ${HOME} (the rate saved with this entry)`);
  if (t.fee > 0) add('Fee', fmt(t.fee, t.feeCur || t.cur));
  if (t.merchant) add('Shop', t.merchant + (t.branch ? ' · ' + t.branch : ''));
  if (t.from || t.to) add('Trip', `${t.from || '?'} → ${t.to || '?'}`);
  if (t.place) add('Place', t.place); else if (t.loc) add('Place', `about ${(+t.loc.la).toFixed(2)}, ${(+t.loc.lo).toFixed(2)}`);
  if (t.labels) add('Tags', String(t.labels).split(',').map((x) => '#' + x.trim()).filter((x) => x.length > 1).join(' '));
  if (t.paidFor) add('Shared bill', `whole bill ${fmt(t.paidFor.total, t.cur)}${t.paidFor.who ? ' · paid for ' + t.paidFor.who : ''}`);
  if (t.cashback) add('Cashback', 'yes (its own income entry)');
  if (t.flag === 'review') add('Needs a check', 'yes');
  add('Notes', t.notes);
  return { rows, items: (t.items || []).filter((i) => i.n || i.amt), counts: t.counts || [] };
}

// one line of the shared-bill summary: the amount in the bill's currency and, below it, the same amount in HOME at the rate saved with the bill
const billLine = (who, amt, g, hp) => `<li><span>${esc(who)}</span><b>${esc(fmt(amt, g.cur))}${g.cur !== HOME && hp > 0 ? `<small class="homeeq">≈ ${esc(fmt(amt * hp, HOME))}</small>` : ''}</b></li>`;
export function openEntryView(id) {
  const db = get(), t = db.txs.find((x) => x.id === id); if (!t) return false;
  const g = splitOf(db, id), hp = homePer(db, t), f = entryFacts(db, t), mineAmt = g ? Math.max(0, Math.round((g.total - g.people.reduce((q, x) => q + x.amt, 0)) * 100) / 100) : 0, big = `${t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : ''}${fmt(t.amount, t.cur)}`;
  const s = sheet(`<div class="evw"><div class="evtop"><h3>${esc(t.name || 'Untitled')}</h3><b class="ramt ${t.kind}">${esc(big)}</b></div>
    <ul class="calfacts">${f.rows.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>
    ${f.items.length ? `<h4>Items</h4><ul class="calfacts">${f.items.map((i) => `<li><span>${esc(i.n || 'Item')}${i.q > 1 ? ` × ${i.q}` : ''}</span><b>${esc(fmt(i.amt, t.cur))}</b></li>`).join('')}</ul>` : ''}
    ${g ? `<h4>Part of a Shared Bill</h4><ul class="calfacts">${billLine('Whole bill', g.total, g, hp)}${g.mine || mineAmt > 0.004 ? billLine('You', mineAmt, g, hp) : ''}${g.people.map((p) => billLine(p.who, p.amt, g, hp)).join('')}</ul>
      <p class="hint">This entry is one share of a single bill. Editing or deleting it changes the whole bill, all ${g.people.length + (g.mine ? 1 : 0)} entries together.</p>` : '<p class="hint">Read only. Tap Edit to change this entry.</p>'}
    <div class="btnrow"><button type="button" class="btn danger ghost" data-ev="del">${g ? 'Delete Whole Bill' : 'Delete'}</button>${button({ html: `${g ? 'Edit Whole Bill' : 'Edit'}`, kind: 'primary', attr: { 'data-ev': 'edit' } })}</div></div>`, { title: 'Entry', wide: true });
  s.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ev]'); if (!b) return;
    if (b.dataset.ev === 'edit') { s.close(); ACT['edit-now']({ dataset: { id } }); return; }
    if (b.dataset.ev === 'del') {
      if (!(await confirmDialog(g ? `Delete the whole shared bill (${g.people.length + (g.mine ? 1 : 0)} entries)? It moves to the recycle bin.` : 'Move this entry to the recycle bin?', 'Delete', true))) return;
      deleteWithMates([id]); s.close();
    }
  });
  return true;
}
