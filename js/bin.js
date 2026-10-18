// Recycle bin: deleted entries, accounts, categories and budgets stay recoverable for 30 days.
// "Delete forever" and the 30-day limit hide an item for good (a small marker stays so synced devices agree).
import { get, commit, commitQuiet, stamp, accountMap, catMap, fmt, dayLabel } from './core.js';
import { hdr } from './screens.js';
import { ACT, esc, toast, confirmDialog } from './ui.js';

const DAY = 864e5, KEEP_DAYS = 30;
const COLLS = ['txs', 'accounts', 'categories', 'budgets'];
const delAt = (r) => r.deletedAt || r.updatedAt || 0;
const daysLeft = (r) => Math.max(0, Math.ceil(KEEP_DAYS - (Date.now() - delAt(r)) / DAY));
const ago = (r) => { const d = Math.floor((Date.now() - delAt(r)) / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };

export function purgeOld(d) {
  let n = 0;
  for (const c of COLLS) for (const r of d[c]) if (r.deleted && !r.purged && Date.now() - delAt(r) > KEEP_DAYS * DAY) { r.purged = true; stamp(r); n++; }
  return n;
}
export const binCount = (db) => COLLS.reduce((n, c) => n + db[c].filter((r) => r.deleted && !r.purged).length, 0);

export function bin(db) {
  const am = accountMap(db), cm = catMap(db);
  const sections = [
    ['txs', 'Entries', (t) => `${esc(t.name || (t.kind === 'transfer' ? 'Transfer' : 'Entry'))} · ${fmt(t.amount, t.cur)}`, (t) => dayLabel(t.date)],
    ['accounts', 'Accounts', (a) => esc(a.name), (a) => a.cur],
    ['categories', 'Categories', (c) => esc(c.name), (c) => c.group],
    ['budgets', 'Budgets', (b) => esc(b.group), () => 'Budget'],
  ];
  const html = sections.map(([c, title, name, sub]) => {
    const list = db[c].filter((r) => r.deleted && !r.purged).sort((a, b) => delAt(b) - delAt(a));
    if (!list.length) return '';
    return `<section><h2>${title} <small class="muted">${list.length}</small></h2><div class="rows plain">${list.map((r) => `
      <div class="row binrow"><span class="rmain"><strong>${name(r)}</strong><small>${esc(sub(r))} · deleted ${ago(r)} · ${daysLeft(r)} days left to restore</small></span>
        <span class="btnrow tight"><button class="btn sm" data-act="bin-restore" data-c="${c}" data-id="${r.id}">Restore</button>
        <button class="btn sm ghost" data-act="bin-purge" data-c="${c}" data-id="${r.id}">Delete forever</button></span></div>`).join('')}</div></section>`;
  }).join('');
  const total = binCount(db);
  return `${hdr('Recycle bin')}<p class="hint">Deleted items wait here for ${KEEP_DAYS} days, then are removed for good. Restore anything you deleted by mistake.</p>
    ${total ? `<button class="btn ghost wide" data-act="bin-empty">Empty recycle bin (${total})</button>` : '<p class="empty">Nothing here. Deleted items will appear in this list.</p>'}${html}`;
}

const find = (d, c, id) => d[c].find((r) => r.id === id);
const revive = (r) => { if (r && r.deleted) { r.deleted = false; delete r.purged; stamp(r); } };

ACT['bin-restore'] = (el) => {
  let note = '';
  commit((d) => {
    const r = find(d, el.dataset.c, el.dataset.id); if (!r) return;
    revive(r);
    if (el.dataset.c === 'txs') {          // an entry needs its accounts and category to count again
      for (const id of [r.acct, r.toAcct]) { const a = find(d, 'accounts', id); if (a && a.deleted) { revive(a); note = ' Its account was restored too.'; } }
      for (const id of [r.cat, r.feeCat]) { const c = find(d, 'categories', id); if (c && c.deleted) { revive(c); note += ' Its category was restored too.'; } }
    }
  });
  toast('Restored.' + note, { ms: 6000 });
};
ACT['bin-purge'] = async (el) => {
  if (!(await confirmDialog('Delete this for good? It cannot be restored afterwards.', 'Delete forever', true))) return;
  commit((d) => { const r = find(d, el.dataset.c, el.dataset.id); if (r) { r.purged = true; stamp(r); } });
};
ACT['bin-empty'] = async () => {
  if (!(await confirmDialog('Delete everything in the recycle bin for good? This cannot be undone.', 'Empty bin', true))) return;
  commit((d) => { for (const c of COLLS) for (const r of d[c]) if (r.deleted && !r.purged) { r.purged = true; stamp(r); } });
};
export function runPurge() { commitQuiet((d) => { purgeOld(d); }); }
