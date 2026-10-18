// Reading and writing CSV in the same column layout as a Bluecoins export.
import { uid, stamp, findOrAddCategory, accountMap, catMap, balances, BASE } from './core.js';

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

export function importBluecoins(db, text) {
  const rows = parseCSV(text);
  const head = (rows.shift() || []).map((s) => s.trim());
  const need = ['Type', 'Date', 'Name', 'Amount', 'Currency', 'Category Group', 'Category', 'Account'];
  const missing = need.filter((n) => !head.includes(n));
  if (missing.length) throw new Error('This file is missing columns: ' + missing.join(', ') + '. Export transactions as CSV from Bluecoins and try again.');
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const col = (r, n) => (ix[n] == null ? '' : (r[ix[n]] ?? '').trim());

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
    const rate = parseFloat(col(r, 'Exchange Rate'));
    // Bluecoins stores units of this currency per 1 unit of the home currency
    return rate > 0 ? 1 / rate : (cu === BASE ? 1 : 0);
  };

  const transfers = new Map();
  for (const r of rows) {
    const type = col(r, 'Type'), cu = col(r, 'Currency'), nm = col(r, 'Account');
    const amt = parseFloat(col(r, 'Amount'));
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
    const grp = col(r, 'Category Group') || 'Others';
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
    } else {
      const c = cats.get(t.cat);
      line(t.kind === 'income' ? 'Income' : 'Expense', t, t.kind === 'income' ? t.amount : -t.amount, t.cur, t.fx,
        c ? c.group : '', c ? c.name : '', a ? a.name : '', itemNote);
    }
  }
  return '﻿' + out.join('\r\n');
}
