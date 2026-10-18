// Recycle bin: review, restore or permanently delete accounts, expense groups, categories and entries.
import { get, commit, fmt, restoreRec, purgeRec, binItems, purgeExpired, catMap, accountMap } from './core.js';
import { esc, ic, ACT, toast, confirmDialog } from './ui.js';
import { hdr } from './screens.js';

const DAY = 864e5;
const when = (at) => { try { return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };
const left = (db, at) => {
  const d = db.settings.binDays;
  if (!(d > 0)) return { text: 'Kept until you delete it', soon: false };
  const n = Math.ceil((at + d * DAY - Date.now()) / DAY);
  return { text: n <= 0 ? 'Removed soon' : `${n} ${n === 1 ? 'day' : 'days'} left to restore`, soon: n <= 3 };
};

// accounts, groups and single categories/entries, newest first
export function binRows(db) {
  const items = binItems(db), rows = [], used = new Set();
  const cm = catMap(db), am = accountMap(db);
  const grp = new Map();
  for (const it of items) {
    if (it.kind === 'category' && it.r.delGroup) {
      const k = it.r.delGroup + '|' + it.at;
      if (!grp.has(k)) grp.set(k, []);
      grp.get(k).push(it);
    }
  }
  for (const [k, list] of grp) if (list.length) { list.forEach((x) => used.add(x.r.id)); rows.push({ type: 'Expense group', title: list[0].r.delGroup, sub: `${list.length} ${list.length === 1 ? 'category' : 'categories'}: ${list.slice(0, 4).map((x) => x.r.name).join(', ')}${list.length > 4 ? '…' : ''}`, at: list[0].at, ids: list.map((x) => [x.coll, x.r.id]) }); }
  for (const it of items) {
    if (used.has(it.r.id)) continue;
    const r = it.r;
    if (it.kind === 'tx') {
      const a = am.get(r.acct), c = cm.get(r.cat);
      rows.push({ type: r.kind === 'transfer' ? 'Transfer' : r.kind === 'income' ? 'Income' : 'Expense', title: r.name || (c ? c.name : 'Entry'), sub: `${fmt(r.amount, r.cur || (a && a.cur) || 'PHP')} · ${r.date.slice(0, 10)}${a ? ' · ' + a.name : ''}`, at: it.at, ids: [[it.coll, r.id]] });
    } else if (it.kind === 'account') rows.push({ type: 'Account', title: r.name, sub: `${r.cur} · its entries stay saved`, at: it.at, ids: [[it.coll, r.id]] });
    else if (it.kind === 'category') rows.push({ type: 'Category', title: r.name, sub: r.group || '', at: it.at, ids: [[it.coll, r.id]] });
    else rows.push({ type: 'Budget', title: r.group || 'Budget', sub: r.amount ? fmt(r.amount, 'PHP') : '', at: it.at, ids: [[it.coll, r.id]] });
  }
  return rows.sort((a, b) => b.at - a.at);
}

export function bin(db) {
  const rows = binRows(db), s = db.settings;
  const days = [7, 14, 30, 60, 90, 0];
  return `${hdr('Recycle bin')}
  <section class="card"><p class="hint">Deleted items wait here, so a slip is never final. Restore anything until its time runs out. After that it is removed for good (on every device).</p>
    <label class="field"><span>Keep deleted items for</span><select data-act-change="bin-days">${days.map((d) => `<option value="${d}" ${(+s.binDays || 0) === d ? 'selected' : ''}>${d ? d + ' days' : 'Until I delete them'}</option>`).join('')}</select></label></section>
  ${rows.length ? `<div class="binhead"><b>${rows.length} ${rows.length === 1 ? 'item' : 'items'}</b><button class="btn ghost danger sm" data-act="bin-empty">Empty bin</button></div>
  <ul class="binlist">${rows.map((r, i) => { const l = left(db, r.at); return `<li class="binrow"><div class="binmain"><span class="pill">${r.type}</span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small>
    <small class="${l.soon ? 'warnt' : 'muted'}">Deleted ${when(r.at)} · ${l.text}</small></div>
    <div class="binbtn"><button class="btn sm" data-act="bin-restore" data-i="${i}">Restore</button><button class="btn ghost danger sm" data-act="bin-purge" data-i="${i}">Delete forever</button></div></li>`; }).join('')}</ul>`
  : `<p class="empty">The recycle bin is empty.</p>`}`;
}

const cur = () => binRows(get());
ACT['bin-restore'] = (el) => {
  const row = cur()[+el.dataset.i]; if (!row) return;
  let extra = 0;
  commit((d) => {
    for (const [coll, id] of row.ids) {
      const r = d[coll].find((x) => x.id === id); if (!r) continue;
      restoreRec(r);
      // an entry needs its account and category back too
      if (coll === 'txs') for (const [c2, k] of [['accounts', r.acct], ['accounts', r.toAcct], ['categories', r.cat]]) { const o = k && d[c2].find((x) => x.id === k); if (o && o.deleted && !o.purged) { restoreRec(o); extra++; } }
    }
  });
  toast(extra ? `Restored, with ${extra} ${extra === 1 ? 'item' : 'items'} it depends on` : 'Restored');
};
ACT['bin-purge'] = async (el) => {
  const row = cur()[+el.dataset.i]; if (!row) return;
  if (!(await confirmDialog(`Delete “${row.title}” forever? This cannot be undone.`, 'Delete forever', true))) return;
  commit((d) => { for (const [coll, id] of row.ids) { const r = d[coll].find((x) => x.id === id); if (r) purgeRec(r); } });
  toast('Deleted forever');
};
ACT['bin-empty'] = async () => {
  const n = cur().length; if (!n) return;
  if (!(await confirmDialog(`Delete all ${n} items in the recycle bin forever? This cannot be undone.`, 'Empty bin', true))) return;
  commit((d) => { for (const it of binItems(d)) purgeRec(it.r); });
  toast('Recycle bin emptied');
};
document.addEventListener('change', (e) => {
  const t = e.target.closest && e.target.closest('[data-act-change="bin-days"]');
  if (t) commit((d) => { d.settings.binDays = +t.value; });
});
export function autoPurge() { const db = get(); if (db.settings.binDays > 0 && binItems(db).some((x) => x.at < Date.now() - db.settings.binDays * DAY)) commit((d) => { purgeExpired(d); }); }
