// Sukli's own CSV: one row per account and one row per entry, with the columns Sukli needs (posted date, billing period, tags, fee details,
// trip, items, statement day, platform...). Anything else an entry or account carries travels in the last column ("Extra (JSON)"), so a file
// read back into Sukli gives the same entries. Bluecoins does not read this file; the plain "Export CSV" is still there for that.
import { uid, stamp, findOrAddCategory, accountMap, catMap, accLabel } from './core.js';
import { parseCSV, guessAccountType } from './importer.js';
import { periodFor, postedDay } from './finance.js';

export const SUKLI_HEAD = ['Record', 'Id', 'Name', 'Date', 'Time', 'Kind', 'Amount', 'Currency', 'Rate', 'Category Group', 'Category', 'Account', 'Account Id',
  'To Account', 'To Account Id', 'To Amount', 'To Rate', 'Fee', 'Fee Currency', 'Fee Paid By', 'Fee Category', 'Posted Date', 'Billing Period',
  'Notes', 'Tags', 'Merchant', 'Trip From', 'Trip To', 'Items', 'Review Flag', 'Opening Balance', 'Opening Date', 'Statement Day', 'Due Day', 'Credit Limit',
  'Platform', 'Wallet', 'Interest APY', 'Market', 'In Totals', 'Archived', 'Updated', 'Extra (JSON)'];
const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
const ACC_KNOWN = ['id', 'name', 'type', 'cur', 'open', 'openDate', 'include', 'archived', 'stmtDay', 'dueDay', 'limit', 'exchange', 'wallet', 'apy', 'market', 'updatedAt', 'deleted'];
const TX_KNOWN = ['id', 'kind', 'date', 'name', 'amount', 'cur', 'fx', 'cat', 'acct', 'toAcct', 'toAmount', 'toFx', 'fee', 'feeBy', 'feeCat', 'feeFx', 'feeCur',
  'notes', 'labels', 'merchant', 'posted', 'from', 'to', 'items', 'flag', 'updatedAt', 'deleted', 'rev'];
const rest = (o, known) => { const e = {}; for (const [k, v] of Object.entries(o)) if (!known.includes(k) && v !== undefined && v !== '' && v !== null) e[k] = v; return Object.keys(e).length ? JSON.stringify(e) : ''; };
const itemsOut = (l) => (l || []).map((i) => `${String(i.n).replace(/[;|]/g, ',')}|${i.amt}|${i.cat || ''}`).join(';');
const itemsIn = (s) => String(s || '').split(';').filter(Boolean).map((x) => { const [n, amt, cat] = x.split('|'); return { n, amt: parseFloat(amt) || 0, cat: cat || '' }; });
const yn = (b) => (b ? 'yes' : 'no');

export function exportSukliCSV(db) {
  const accts = accountMap(db), cats = catMap(db), out = [SUKLI_HEAD.map(q).join(',')], blank = () => Object.fromEntries(SUKLI_HEAD.map((h) => [h, '']));
  const push = (r) => out.push(SUKLI_HEAD.map((h) => q(r[h])).join(','));
  for (const a of db.accounts.filter((x) => !x.deleted)) push({ ...blank(), Record: 'Account', Id: a.id, Name: a.name, Kind: a.type, Currency: a.cur, 'Opening Balance': a.open || 0,
    'Opening Date': a.openDate || '', 'Statement Day': a.stmtDay || '', 'Due Day': a.dueDay || '', 'Credit Limit': a.limit || '', Platform: a.exchange || '', Wallet: a.wallet || '',
    'Interest APY': a.apy || '', Market: a.market || '', 'In Totals': yn(a.include !== false), Archived: yn(a.archived), Updated: a.updatedAt || '', 'Extra (JSON)': rest(a, ACC_KNOWN) });
  for (const t of db.txs.filter((x) => !x.deleted).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))) {
    const a = accts.get(t.acct), b = accts.get(t.toAcct), c = cats.get(t.cat), fc = cats.get(t.feeCat);
    const per = a && a.type === 'card' && a.stmtDay > 0 && t.kind !== 'transfer' ? periodFor(a, postedDay(t)) : null;
    push({ ...blank(), Record: 'Entry', Id: t.id, Name: t.name, Date: t.date.slice(0, 10), Time: t.date.slice(11, 19), Kind: t.kind, Amount: t.amount, Currency: t.cur, Rate: t.fx ?? '',
      'Category Group': c ? c.group : '', Category: c ? c.name : '', Account: a ? a.name : '', 'Account Id': t.acct, 'To Account': b ? b.name : '', 'To Account Id': t.toAcct || '',
      'To Amount': t.toAmount ?? '', 'To Rate': t.toFx ?? '', Fee: t.fee || '', 'Fee Currency': t.feeCur || '', 'Fee Paid By': t.fee ? (t.feeBy || 'from') : '', 'Fee Category': fc ? fc.name : '',
      'Posted Date': t.posted || '', 'Billing Period': per ? `${per.from}..${per.to}` : '', Notes: t.notes || '', Tags: t.labels || '', Merchant: t.merchant || '', 'Trip From': t.from || '', 'Trip To': t.to || '',
      Items: itemsOut(t.items), 'Review Flag': t.flag || '', Updated: t.updatedAt || '', 'Extra (JSON)': rest(t, TX_KNOWN) });
  }
  return '﻿' + out.join('\r\n');
}

export const isSukliCsv = (text) => { const h = String(text).replace(/^﻿/, '').split(/\r?\n/, 1)[0] || ''; return h.startsWith('"Record"') || h.startsWith('Record,') ? h.includes('Extra (JSON)') : false; };

export function importSukliCSV(db, text) {
  const rows = parseCSV(text), head = rows.shift().map((s) => s.trim()), ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const g = (r, n) => (ix[n] == null ? '' : String(r[ix[n]] ?? '').trim()), n = (v) => { const x = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(x) ? x : undefined; };
  const stats = { added: 0, skipped: 0, accounts: 0, categories: 0, openingFilled: 0, noOpening: 0 }, catsBefore = db.categories.length, idMap = new Map();
  const live = () => db.accounts.filter((a) => !a.deleted);
  const ensureAcct = (id, name, cur, row) => {
    if (id && idMap.has(id)) return idMap.get(id);
    let a = (id && live().find((x) => x.id === id)) || live().find((x) => x.name === name && x.cur === cur) || live().find((x) => x.name === name);
    if (!a) { a = stamp({ id: id && !db.accounts.some((x) => x.id === id) ? id : uid(), name, baseName: name, cur, type: guessAccountType(name), open: 0, include: true, archived: false, guessed: true }); db.accounts.push(a); stats.accounts++; }
    if (id) idMap.set(id, a); return a;
  };
  for (const r of rows.filter((x) => g(x, 'Record') === 'Account')) {
    const before = db.accounts.length, a = ensureAcct(g(r, 'Id'), g(r, 'Name'), g(r, 'Currency'), r);
    if (db.accounts.length > before) {                                // new account: fill in everything the file knows; existing accounts are never changed
      Object.assign(a, { type: g(r, 'Kind') || a.type, guessed: false, open: n(g(r, 'Opening Balance')) || 0, include: g(r, 'In Totals') !== 'no', archived: g(r, 'Archived') === 'yes' });
      const od = g(r, 'Opening Date'); if (od) a.openDate = od;
      for (const [k, h, num] of [['stmtDay', 'Statement Day', 1], ['dueDay', 'Due Day', 1], ['limit', 'Credit Limit', 1], ['apy', 'Interest APY', 1], ['exchange', 'Platform', 0], ['wallet', 'Wallet', 0], ['market', 'Market', 0]]) { const v = g(r, h); if (v) a[k] = num ? n(v) : v; }
      try { Object.assign(a, JSON.parse(g(r, 'Extra (JSON)') || '{}')); } catch { /* damaged extra column: ignore */ }
    }
  }
  const have = new Set(db.txs.map((t) => t.id));
  for (const r of rows.filter((x) => g(x, 'Record') === 'Entry')) {
    const id = g(r, 'Id') || uid(); if (have.has(id)) { stats.skipped++; continue; }
    const kind = g(r, 'Kind').toLowerCase(); if (!['expense', 'income', 'transfer'].includes(kind)) { stats.skipped++; continue; }
    const cur = g(r, 'Currency'), a = ensureAcct(g(r, 'Account Id'), g(r, 'Account'), cur, r);
    const t = { id, kind, date: `${g(r, 'Date')} ${g(r, 'Time') || '12:00:00'}`.trim(), name: g(r, 'Name'), amount: n(g(r, 'Amount')) || 0, cur, fx: n(g(r, 'Rate')) ?? 1, acct: a.id, notes: g(r, 'Notes'), labels: g(r, 'Tags') };
    if (kind !== 'transfer') { const cat = g(r, 'Category'); if (cat) t.cat = findOrAddCategory(db, g(r, 'Category Group'), cat, kind).id; }
    else { const b = ensureAcct(g(r, 'To Account Id'), g(r, 'To Account'), cur, r); t.toAcct = b.id; const ta = n(g(r, 'To Amount')); if (ta != null) t.toAmount = ta; const tf = n(g(r, 'To Rate')); if (tf != null) t.toFx = tf; }
    const fee = n(g(r, 'Fee')); if (fee > 0) { t.fee = fee; t.feeBy = g(r, 'Fee Paid By') || 'from'; if (g(r, 'Fee Currency')) t.feeCur = g(r, 'Fee Currency'); const fc = g(r, 'Fee Category'); if (fc) t.feeCat = findOrAddCategory(db, 'Fees', fc, 'expense').id; }
    if (g(r, 'Posted Date')) t.posted = g(r, 'Posted Date');
    if (g(r, 'Merchant')) t.merchant = g(r, 'Merchant');
    if (g(r, 'Trip From')) t.from = g(r, 'Trip From'); if (g(r, 'Trip To')) t.to = g(r, 'Trip To');
    if (g(r, 'Items')) t.items = itemsIn(g(r, 'Items')); if (g(r, 'Review Flag')) t.flag = g(r, 'Review Flag');
    try { Object.assign(t, JSON.parse(g(r, 'Extra (JSON)') || '{}')); } catch { /* ignore */ }
    db.txs.push(stamp(t)); have.add(id); stats.added++;
  }
  stats.categories = db.categories.length - catsBefore;
  return stats;
}
