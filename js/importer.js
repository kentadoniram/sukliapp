// Reading and writing CSV in the same column layout as a Bluecoins export.
import { ensureCurrency, uid, stamp, findOrAddCategory, accountMap, catMap, balances, BASE } from './core.js';

export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

export function guessAccountType(name) {
  const n = name.toLowerCase();
  if (/loan|receivable|reimburse/.test(n)) return 'loan';
  if (/bybit|bitget|okx|binance|kucoin|mexc|gate\.io|\bmnt\b|phantom|bgb|bbsol|rlusd|coins\.ph pro/.test(n)) return 'crypto';
  if (/credit card|visa|cash advance|mastercard|amex|maya credit|lazada pay|\bcredit\b/.test(n)) return 'card';
  if (/gcash|maya|shopee ?pay|coins\.ph|paypay|suica|pasmo|paypal/.test(n)) return 'ewallet';
  if (/wallet|cash|currency/.test(n)) return 'cash';
  if (/bdo|cimb|maribank|bank|bpi|landbank|seabank|gotyme|mp2/.test(n)) return 'bank';
  return 'other';
}
export const SPENDABLE_TYPES = new Set(['cash', 'bank', 'ewallet', 'card']);

// Bluecoins has renamed columns between versions, so columns are matched by meaning, not by exact title.
const ALIASES = {
  Type: ['type', 'transactiontype', 'kind'],
  Date: ['date', 'datetime', 'transactiondate', 'time'],
  Name: ['name', 'itemorpayee', 'payee', 'item', 'title', 'description', 'merchant'],
  Amount: ['amount', 'transactionamount', 'value'],
  Currency: ['currency', 'currencycode', 'cur'],
  'Exchange Rate': ['exchangerate', 'rate', 'fxrate'],
  'Category Group': ['categorygroup', 'parentcategory', 'group', 'categorygroupname', 'parent', 'maincategory', 'categoryparent'],
  Category: ['category', 'childcategory', 'categoryname', 'subcategory'],
  Account: ['account', 'accountname', 'wallet'],
  Notes: ['notes', 'note', 'memo', 'remarks'],
  Labels: ['labels', 'label', 'tags', 'tag'],
};
const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function normDate(v) {
  const t = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(t)) return t.replace('T', ' ').padEnd(19, ':00').slice(0, 19);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t + ' 12:00:00';
  let m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);   // day/month or month/day: day first only if it cannot be a month
  if (m) {
    let [, x, y, yr, h = '12', mi = '00', se = '00', ap] = m; x = +x; y = +y; h = +h;
    const [mo, d] = x > 12 ? [y, x] : [x, y];
    if (ap) { if (/pm/i.test(ap) && h < 12) h += 12; if (/am/i.test(ap) && h === 12) h = 0; }
    const p = (n) => String(n).padStart(2, '0');
    return `${yr}-${p(mo)}-${p(d)} ${p(h)}:${mi}:${se}`;
  }
  const dt = new Date(t);
  if (!isNaN(dt)) { const p = (n) => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`; }
  return t;
}
const num = (v) => parseFloat(String(v ?? '').replace(/[,\s]/g, '').replace(/[₱¥$€]/g, ''));

const CUR_DEFAULT = () => BASE;
function typeName(v) {
  const t = squash(v);
  if (t === 'expense' || t === 'expenses' || t === 'debit' || t === 'spent') return 'Expense';
  if (t === 'income' || t === 'credit' || t === 'earned') return 'Income';
  if (t === 'transfer' || t === 'transfers' || t === 'transferin' || t === 'transferout') return 'Transfer';
  if (t === 'startingbalance' || t === 'openingbalance' || t === 'initialbalance') return 'Starting Balance';
  return String(v || '').trim();
}
export function importBluecoins(db, text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const count = (ch) => (firstLine.match(new RegExp(ch === '\t' ? '\t' : '\\' + ch, 'g')) || []).length;
  const delim = count(';') > count(',') && count(';') > 0 ? ';' : (count('\t') > count(',') ? '\t' : ',');
  const rows = parseCSV(delim === ',' ? text : text.split(/\r?\n/).map((l) => { const out = []; let f = '', q = false; for (const c of l) { if (c === '"') q = !q; else if (c === delim && !q) { out.push(f); f = ''; } else f += c; } out.push(f); return out.map((x) => '"' + x.replace(/"/g, '""') + '"').join(','); }).join('\n'));
  const rawHead = (rows.shift() || []).map((s) => s.trim());
  const used = new Set(), ix = {};
  for (const [canon, names] of Object.entries(ALIASES)) {
    const exact = rawHead.findIndex((h, i) => !used.has(i) && h === canon);
    const i = exact >= 0 ? exact : rawHead.findIndex((h, j) => !used.has(j) && names.includes(squash(h)));
    if (i >= 0) { ix[canon] = i; used.add(i); }
  }
  const need = ['Type', 'Date', 'Amount', 'Account'];
  const missing = need.filter((n) => ix[n] == null);
  if (missing.length) throw new Error(`This file is missing: ${missing.join(', ')}. Columns found: ${rawHead.join(', ') || '(none)'}. Export transactions as CSV from Bluecoins and try again.`);
  const base = (CUR_DEFAULT());
  const col = (r, n) => {
    if (ix[n] == null) return n === 'Currency' ? base : '';
    const v = (r[ix[n]] ?? '').trim();
    if (n === 'Date') return normDate(v);
    if (n === 'Currency') return (v || base).toUpperCase();
    if (n === 'Type') return typeName(v);
    return v;
  };

  for (const r of rows) ensureCurrency(db, col(r, 'Currency'));   // coins Bluecoins could not hold keep their decimals
  // account names that appear in more than one currency get the currency in their label
  const curs = new Map();
  for (const a of db.accounts) { if (!curs.has(a.baseName || a.name)) curs.set(a.baseName || a.name, new Set()); curs.get(a.baseName || a.name).add(a.cur); }
  for (const r of rows) {
    const nm = col(r, 'Account'), cu = col(r, 'Currency');
    if (!nm) continue;
    if (!curs.has(nm)) curs.set(nm, new Set());
    curs.get(nm).add(cu);
  }
  const label = (nm, cu) => (curs.get(nm).size > 1 ? `${nm} (${cu})` : nm);

  const stats = { added: 0, skipped: 0, accounts: 0, categories: 0 };
  const catsBefore = db.categories.length;
  const newAcct = new Set();
  const accts = new Map(db.accounts.filter((a) => !a.deleted).map((a) => [a.name + '|' + a.cur, a]));
  const ensureAcct = (nm, cu) => {
    const lab = label(nm, cu);
    let a = accts.get(lab + '|' + cu) || accts.get(nm + '|' + cu);
    if (!a) {
      const type = guessAccountType(nm);
      a = stamp({ id: uid(), name: lab, baseName: nm, cur: cu, type, open: 0, include: SPENDABLE_TYPES.has(type), archived: false, guessed: true });
      db.accounts.push(a);
      accts.set(lab + '|' + cu, a);
      newAcct.add(a.id);
      stats.accounts++;
    }
    return a;
  };

  const seen = new Map();
  const have = new Set(db.txs.filter((t) => t.src).map((t) => t.src));
  const claim = (key) => {
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    const k = key + '#' + n;
    if (have.has(k)) return null;
    have.add(k);
    return k;
  };
  const fxOf = (r, cu) => {
    const rate = num(col(r, 'Exchange Rate'));
    // Bluecoins stores units of this currency per 1 unit of the home currency
    return rate > 0 ? 1 / rate : (cu === BASE ? 1 : 0);
  };

  const transfers = new Map();
  for (const r of rows) {
    const type = col(r, 'Type'), cu = col(r, 'Currency'), nm = col(r, 'Account');
    const amt = num(col(r, 'Amount'));
    if (!type || !nm || !isFinite(amt)) continue;
    const a = ensureAcct(nm, cu);
    if (type === 'Starting Balance') {
      if (newAcct.has(a.id)) a.open = (a.open || 0) + amt;
      continue;
    }
    if (type === 'Transfer') {
      const key = col(r, 'Date') + '|' + col(r, 'Name');
      if (!transfers.has(key)) transfers.set(key, []);
      transfers.get(key).push({ r, a, amt, cu });
      continue;
    }
    if (type !== 'Expense' && type !== 'Income') continue;
    const kind = type.toLowerCase();
    const src = claim([type, col(r, 'Date'), col(r, 'Name'), amt, a.name].join('|'));
    if (!src) { stats.skipped++; continue; }
    const grp = col(r, 'Category Group') || (ix['Category Group'] == null && col(r, 'Category') ? col(r, 'Category') : 'Others');
    const cat = findOrAddCategory(db, grp, col(r, 'Category') || 'Uncategorized', kind);
    db.txs.push(stamp({
      id: uid(), kind, date: col(r, 'Date'), name: col(r, 'Name'), amount: Math.abs(amt), cur: cu,
      fx: fxOf(r, cu), cat: cat.id, acct: a.id, notes: col(r, 'Notes'), labels: col(r, 'Labels'), src,
    }));
    stats.added++;
  }

  for (const [key, list] of transfers) {
    const outs = list.filter((x) => x.amt < 0), ins = list.filter((x) => x.amt >= 0);
    while (outs.length && ins.length) {
      const o = outs.shift(), i = ins.shift();
      const src = claim(['T', key, o.amt, o.a.name, i.a.name].join('|'));
      if (!src) { stats.skipped++; continue; }
      db.txs.push(stamp({
        id: uid(), kind: 'transfer', date: col(o.r, 'Date'), name: col(o.r, 'Name'),
        amount: Math.abs(o.amt), cur: o.cu, fx: fxOf(o.r, o.cu), acct: o.a.id,
        toAcct: i.a.id, toAmount: i.amt, notes: col(o.r, 'Notes'), src,
      }));
      stats.added++;
    }
    // a lone half of a transfer is kept as plain income/expense so balances still add up
    for (const x of [...outs, ...ins]) {
      const kind = x.amt < 0 ? 'expense' : 'income';
      const src = claim(['T1', key, x.amt, x.a.name].join('|'));
      if (!src) { stats.skipped++; continue; }
      const cat = findOrAddCategory(db, 'Adjustments', 'Balance correction', 'both');
      db.txs.push(stamp({
        id: uid(), kind, date: col(x.r, 'Date'), name: col(x.r, 'Name'), amount: Math.abs(x.amt), cur: x.cu,
        fx: fxOf(x.r, x.cu), cat: cat.id, acct: x.a.id, notes: 'Unpaired transfer from import', src,
      }));
      stats.added++;
    }
  }
  // a bank/cash/wallet that ends up well below zero is more likely a loan or money owed than spendable money
  const bal = balances(db);
  for (const a of db.accounts) {
    if (newAcct.has(a.id) && ['bank', 'cash', 'ewallet'].includes(a.type) && (bal.get(a.id) || 0) < -500) { a.type = 'loan'; a.include = false; }
  }
  stats.categories = db.categories.length - catsBefore;
  return stats;
}

const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';

export function exportCSV(db) {
  const accts = accountMap(db), cats = catMap(db);
  const head = ['Type', 'Date', 'Set Time', 'Name', 'Amount', 'Currency', 'Exchange Rate', 'Category Group', 'Category', 'Account', 'Notes', 'Grouping', 'Labels', 'Status'];
  const out = [head.map(q).join(',')];
  const line = (type, t, amt, cur, fx, group, cat, acct, notes) =>
    out.push([type, t.date, t.date.slice(11, 16), t.name, amt.toFixed(2), cur, fx > 0 ? (1 / fx).toString() : '1.0',
      group, cat, acct, notes, '', t.labels || '', 'None'].map(q).join(','));
  for (const a of db.accounts) {
    if (a.deleted || !a.open) continue;
    line('Starting Balance', { date: '2000-01-01 00:00:00', name: '', labels: '' }, a.open, a.cur, 0, '', '', a.name, '');
  }
  for (const t of db.txs.filter((x) => !x.deleted).sort((x, y) => (x.date < y.date ? 1 : -1))) {
    const a = accts.get(t.acct);
    const itemNote = t.items && t.items.length
      ? [t.notes, 'Items: ' + t.items.map((i) => `${i.n} ${i.amt}`).join('; ')].filter(Boolean).join(' | ')
      : (t.notes || '');
    if (t.kind === 'transfer') {
      const b = accts.get(t.toAcct);
      line('Transfer', t, -t.amount, t.cur, t.fx, 'Transfer', 'Transfer', a ? a.name : '', itemNote);
      line('Transfer', t, t.toAmount ?? t.amount, b ? b.cur : t.cur, t.fx, 'Transfer', 'Transfer', b ? b.name : '', itemNote);
      if (t.fee > 0) {                 // the fee leaves as its own expense row, on the account that paid it
        const fc = cats.get(t.feeCat), pa = t.feeBy === 'to' ? b : a;
        line('Expense', t, -t.fee, pa ? pa.cur : t.cur, t.feeFx || t.fx, fc ? fc.group : '', fc ? fc.name : '', pa ? pa.name : '', 'Transfer fee');
      }
    } else {
      const c = cats.get(t.cat);
      line(t.kind === 'income' ? 'Income' : 'Expense', t, t.kind === 'income' ? t.amount : -t.amount, t.cur, t.fx,
        c ? c.group : '', c ? c.name : '', a ? a.name : '', itemNote);
    }
  }
  return '﻿' + out.join('\r\n');
}
