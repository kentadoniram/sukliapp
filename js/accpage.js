// Accounts page (grouped and sorted), account detail with history, net worth, interest and credit-card details.
import { pickAll } from './picker.js';
import { openDateOf, openDates, WALLETS, walletOf } from './core.js';
import { tipBtn, calcHtml, bindCalc, COMP_LABEL, rateAt, hasRate } from './interest.js';
import { exchangeOf, canonPlatform, nearPlatform, platformNames } from './invest.js';
import { softDelete, subscribe } from './core.js';
import {
  get, commit, uid, stamp, nowStamp, rateFor, fmt, BASE, HOME, homeFx, allCurrencies, curName, CUR, balances, catMap, accountMap, live, groupColor, groupLetter,
  adjustmentCategory, shiftMonth, thisMonth, monthLabel, monthParts, deltaFor, dayLabel,
} from './core.js';
import { transferHints } from './finance.js';
import { lockInfo, interestPreview, promoStatus, rateHistory, debtPreview, hasDebtInt, accountHistory, netWorth, cardInfo, cardReminders, cardIcs, isLiability, setLiab, today, postInterest, postDebtInterest, interestTaxPct, retaxInterest } from './finance.js';
import { esc, ic, ACT, sheet, toast, download, confirmDialog, promptDialog } from './ui.js';
import { applyHide } from './appearance.js';
import { money, eq, hdr, coll, ui, tradeKids, effectLine } from './screens.js';
import { openEntry } from './entry.js';
import { loanBox } from './loans.js';
import { favCurs, openCurrencyPicker, flagOf } from './curpicker.js';
import { openDatePicker } from './datepicker.js';

// where each kind of account shows up, in plain words (used by the Change type shortcut)
export const typeWhere = { cash: 'Cash and bank. Counted in Spendable now.', bank: 'Cash and bank. Counted in Spendable now.', ewallet: 'Cash and bank. Counted in Spendable now.', card: 'Credit cards, under what you owe. Not spendable.', crypto: 'Investments tab, with prices and gains.', invest: 'Investments tab, with prices and gains.', asset: 'Property and other assets.', loan: 'Loans and money owed, under what you owe.', other: 'Other. Not counted in Spendable now.' };
const SPEND = ['cash', 'bank', 'ewallet'], INVT = ['crypto', 'invest'];
// quick way to say what an account is, without opening the whole edit form (for example a bank account that is really a crypto exchange)
export function openReclass(id) {
  const a0 = get().accounts.find((x) => x.id === id); if (!a0) return;
  const s = sheet(`<p class="hint">What is <b>${esc(a0.name)}</b>? Its balance and entries stay exactly as they are. Only where it shows up changes.</p>
    <div class="invopts">${Object.entries(typeNames).map(([k, l]) => `<button type="button" class="invopt ${a0.type === k ? 'main' : ''}" data-t="${k}"><b>${esc(l)}${a0.type === k ? ' (now)' : ''}</b><small>${esc(typeWhere[k] || '')}</small></button>`).join('')}</div>`, { title: 'Change account type' });
  s.el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { const t = b.dataset.t; s.close(); if (t === a0.type) return;
    const before = { type: a0.type, include: a0.include, invtab: a0.invtab, guessed: a0.guessed, apy: a0.apy };
    commit((d) => { const x = d.accounts.find((q) => q.id === id); if (!x) return; const was = x.type; x.type = t; x.guessed = false; x.include = SPEND.includes(t);
      x.invtab = INVT.includes(t) ? true : (INVT.includes(was) ? false : !!x.invtab); if (isLiability({ type: t })) x.apy = 0; stamp(x); });
    toast(`${a0.name} is now ${typeNames[t]}. ${typeWhere[t]}`, { undo: () => commit((d) => { const x = d.accounts.find((q) => q.id === id); if (x) { Object.assign(x, before); stamp(x); } }) }); }; });
}
export const typeNames = { cash: 'Cash', bank: 'Bank', ewallet: 'E-wallet / card balance', card: 'Credit card', crypto: 'Crypto', invest: 'Investment', asset: 'Asset (property, vehicle…)', loan: 'Loan or money owed', other: 'Other' };
const DEFAULT_TYPES = { ...typeNames };
// account types you can rename and add to (Settings, Account types). Custom ones count as an asset or a liability.
export function applyTypes(st = {}) {
  for (const k of Object.keys(typeNames)) delete typeNames[k];
  Object.assign(typeNames, DEFAULT_TYPES);
  const custom = st.customTypes || {}, labels = st.typeLabels || {};
  for (const k of Object.keys(DEFAULT_TYPES)) if (labels[k]) typeNames[k] = labels[k];
  for (const [k, v] of Object.entries(custom)) typeNames[k] = labels[k] || v.label;
  typeOrder.length = 0;
  typeOrder.push('cash', 'bank', 'ewallet', 'crypto', 'invest', 'asset', 'other', ...Object.keys(custom), 'card', 'loan');
  setLiab(Object.entries(custom).filter(([, v]) => v.liab).map(([k]) => k));
}
const typeOrder = ['cash', 'bank', 'ewallet', 'crypto', 'invest', 'asset', 'other', 'card', 'loan'];

// ---- view choices (remembered on this device) ----
const VKEY = 'sukli-acctview2';
const view = (() => { try { return { group: 'class', sort: 'high', ...JSON.parse(localStorage.getItem(VKEY) || '{}') }; } catch { return { group: 'class', sort: 'high' }; } })();
const saveView = () => { try { localStorage.setItem(VKEY, JSON.stringify(view)); } catch { /* blocked */ } };
const render = () => window.dispatchEvent(new Event('sukli-render'));
const num = (s) => parseFloat(String(s ?? '').replace(/,/g, ''));
const sum = (a) => a.reduce((s, x) => s + x, 0);
const baseOf = (db, a, v) => v * (homeFx(db, a.cur) || 0);

function spendable(db, bal) {
  let total = 0;
  for (const a of live(db.accounts)) if (!a.archived && a.include) total += baseOf(db, a, bal.get(a.id) || 0);
  return total;
}

// banner used on Home and Accounts: cards due soon, cards near their limit
export function reminderBanner(db) {
  const list = cardReminders(db, db.settings.remindDays || 3);
  if (!list.length) return '';
  return `<section class="remind" aria-label="Credit card reminders">${list.map((r) => {
    const due = r.due && r.dueAmount > 0.005 && (r.days <= (db.settings.remindDays || 3));
    const when = r.overdue ? `was due ${dayLabel(r.due + ' 00:00:00')}` : r.days === 0 ? 'is due today, until midnight' : r.days === 1 ? 'is due tomorrow' : `is due in ${r.days} days`;
    return `<button class="rem ${due ? (r.days <= 1 ? 'urgent' : '') : 'high'}" data-act="acct" data-id="${r.a.id}">
      <i>${ic('wallet')}</i><span><strong>${esc(r.a.name)} ${due ? when : `is ${r.used}% of its limit`}</strong>
      <small>${due ? `Pay ${money(r.dueAmount, r.a.cur)}${r.dueAmount < r.owed - 0.005 ? ` (total owed ${money(r.owed, r.a.cur)})` : ''}` : `Owed ${money(r.owed, r.a.cur)} of ${money(r.limit, r.a.cur)}`}</small></span>${ic('right')}</button>`;
  }).join('')}</section>`;
}

// ---------- the page ----------
// platform > wallet totals (home currency) for the investments block
function walletTotals(list, val) {
  const m = new Map(); for (const a of list) { const ex = a.exchange || 'Other products', w = a.exchange ? walletOf(a) : ''; if (!m.has(ex)) m.set(ex, new Map()); const ws = m.get(ex); ws.set(w, (ws.get(w) || 0) + val(a)); }
  return `<ul class="calfacts wtots">${[...m.entries()].map(([ex, ws]) => `<li><span><b>${esc(ex)}</b>${ws.size > 1 || ![...ws.keys()].every((w) => !w || w === 'Spot') ? ` <small class="muted">${[...ws.entries()].filter(([w]) => w).map(([w, v]) => `${esc(w)} ${money(v)}`).join(' · ')}</small>` : ''}</span><b>${money([...ws.values()].reduce((x, y) => x + y, 0))}</b></li>`).join('')}</ul>`;
}
export function accounts(db) {
  const bal = balances(db), nw = netWorth(db);
  const allShown = live(db.accounts).filter((a) => !a.archived);
  const invAccts = allShown.filter(inInvestAcct);          // investments live in their own tab; here they are one separate block
  const shown = allShown.filter((a) => !inInvestAcct(a));
  const hidden = live(db.accounts).length - shown.length;
  const val = (a) => baseOf(db, a, bal.get(a.id) || 0);
  const grp = view.sort === 'cat' ? 'class' : view.group;             // sorting by category groups assets and debts, then sorts inside each group by the second choice
  const key = view.sort === 'cat' ? (view.then || 'high') : view.sort;
  const cmp = key === 'name' ? (a, b) => a.name.localeCompare(b.name)
    : key === 'low' ? (a, b) => val(a) - val(b) || a.name.localeCompare(b.name)
      : (a, b) => val(b) - val(a) || a.name.localeCompare(b.name);
  let groups;
  if (grp === 'cur') {
    const m = new Map(); for (const a of shown) { if (!m.has(a.cur)) m.set(a.cur, []); m.get(a.cur).push(a); }
    groups = [...m.entries()].map(([k, list]) => ({ key: 'cur-' + k, title: k, list, native: k, total: sum(list.map((a) => bal.get(a.id) || 0)), base: sum(list.map(val)) }))
      .sort((a, b) => (a.title === HOME ? -1 : b.title === HOME ? 1 : b.base - a.base));
  } else if (grp === 'exchange') {
    const m = new Map(); for (const a of shown) { const k = a.exchange || 'No exchange'; if (!m.has(k)) m.set(k, []); m.get(k).push(a); }
    groups = [...m.entries()].map(([k, list]) => ({ key: 'ex-' + k, title: k, list, native: null, total: sum(list.map(val)), base: sum(list.map(val)) }))
      .sort((a, b) => (a.title === 'No exchange') - (b.title === 'No exchange') || b.base - a.base);
  } else if (grp === 'class' && view.sort === 'cat') {
    // assets and debts first, then each kind of account inside (Cash, Bank, E-wallet…)
    groups = [];
    for (const top of ['Assets', 'Liabilities']) {
      const inTop = shown.filter((a) => (top === 'Liabilities') === isLiability(a));
      const kinds = [...new Set(inTop.map((a) => a.type))].sort((x, y) => (typeOrder.indexOf(x) < 0 ? 99 : typeOrder.indexOf(x)) - (typeOrder.indexOf(y) < 0 ? 99 : typeOrder.indexOf(y)));
      for (const k of kinds) { const list = inTop.filter((a) => a.type === k); groups.push({ key: 'cls-' + top + '-' + k, title: typeNames[k] || k, list, native: null, total: sum(list.map(val)), base: sum(list.map(val)), top }); }
    }
  } else if (grp === 'class') {
    const cls = (a) => {
      if (isLiability(a)) return a.type === 'card' ? 'Credit cards' : (a.type === 'loan' || a.loan) ? 'Loans and money owed' : 'Other debts';
      return ['invest', 'crypto'].includes(a.type) ? 'Investments and crypto' : a.type === 'asset' ? 'Property and other assets' : 'Cash and bank';
    };
    const order = [['Assets', ['Cash and bank', 'Investments and crypto', 'Property and other assets']], ['Liabilities', ['Credit cards', 'Loans and money owed', 'Other debts']]];
    const m = new Map(order.flatMap(([, ks]) => ks).map((k) => [k, []])); for (const a of shown) m.get(cls(a)).push(a);
    groups = []; for (const [top, ks] of order) for (const k of ks) { const list = m.get(k); if (list.length) groups.push({ key: 'cls-' + k, title: k, list, native: null, total: sum(list.map(val)), base: sum(list.map(val)), top }); }
  } else if (grp === 'type') {
    const m = new Map(); for (const a of shown) { if (!m.has(a.type)) m.set(a.type, []); m.get(a.type).push(a); }
    groups = [...m.entries()].map(([k, list]) => ({ key: 'type-' + k, title: typeNames[k] || k, list, native: null, total: sum(list.map(val)), base: sum(list.map(val)), t: k }))
      .sort((a, b) => (typeOrder.indexOf(a.t) - typeOrder.indexOf(b.t)));
  } else groups = [{ key: 'all', title: 'All accounts', list: shown, native: null, total: sum(shown.map(val)), base: sum(shown.map(val)) }];
  const sp = spendable(db, bal);
  const rowFor = (a) => {
    const v = bal.get(a.id) || 0, c = a.type === 'card' ? cardInfo(db, a, v) : null;
    const meta = [typeNames[a.type] || a.type];
    if (rateAt(a, today()) > 0 || hasRate(a)) meta.push(`${rateAt(a, today())}% a year`);
    if (c && c.due && c.owed > 0) meta.push(c.days === 0 ? 'due today' : `due in ${c.days}d`);
    if (!a.include && !isLiability(a)) meta.push('not in spendable');
    const bar = c && c.limit ? `<span class="util ${c.used >= 80 ? 'hot' : c.used >= 50 ? 'mid' : ''}" role="img" aria-label="${c.used}% of limit used"><i style="width:${c.used}%"></i></span>` : '';
    return `<button class="row acct" data-act="acct" data-id="${a.id}"><i class="badge sm" style="background:${groupColor(a.type)}">${groupLetter(typeNames[a.type] || a.type)}</i>
      <span class="rmain"><strong>${esc(a.name)}</strong><small>${esc(meta.join(' · '))}</small>${bar}</span>
      <span class="ramt"><b class="${v < 0 ? 'neg' : ''}">${money(v, a.cur)}</b>${eq(v, a.cur, rateFor(db, a.cur)) ? `<small>${eq(v, a.cur, rateFor(db, a.cur))}</small>` : ''}</span></button>`;
  };
  // when grouped by exchange, each group can be renamed on all its accounts at once
  const exBtn = (g) => (grp === 'exchange' && g.key.startsWith('ex-') && g.title !== 'No exchange' ? `<button type="button" class="linkbtn sm" data-act="inv-rename" data-ex="${esc(g.title)}">Rename</button>` : '');
  const secOf = (g) => coll(g.key, `${esc(g.title)} <small class="muted gsum">${g.native ? money(g.total, g.native) : money(g.top === 'Liabilities' ? Math.abs(g.total) : g.total)}</small>`,
    `<div class="rows plain">${g.list.slice().sort(cmp).map(rowFor).join('')}</div>`, exBtn(g));
  const sections = grp === 'class' ? ['Assets', 'Liabilities'].map((top) => { const gs = groups.filter((g) => g.top === top); if (!gs.length) return ''; const tot = sum(gs.map((g) => g.total));
    return `<section class="topgrp ${top === 'Assets' ? 'assets' : 'liabs'}"><div class="tophead"><h2>${top}</h2><b>${money(Math.abs(tot))}</b></div><p class="hint">${top === 'Assets' ? 'What you own: cash, bank, investments, property.' : 'What you owe: credit cards, loans, money owed.'}</p>${gs.map(secOf).join('')}</section>`; }).join('') : groups.map((g) => coll(g.key, `${esc(g.title)} <small class="muted gsum">${g.native ? money(g.total, g.native) : money(g.total)}</small>`,
    `<div class="rows plain">${g.list.slice().sort(cmp).map(rowFor).join('')}</div>`, exBtn(g))).join('');
  const segs = (name, opts, cur) => `<div class="seg sm" role="group" aria-label="${name}">${opts.map(([v, l]) => `<button type="button" data-act="aview" data-k="${name}" data-v="${v}" class="${cur === v ? 'on' : ''}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
  return `${hdr('Accounts', '<button class="btn sm ghost" data-act="loan-plan">Loan planner</button> <button class="btn sm" data-act="acct-new">Add account</button>')}
    ${reminderBanner(db)}
    <section class="nwcard"><button class="nwmain" data-act="nw" aria-label="Net worth details">
      <span>Net worth</span><b class="${nw.net < 0 ? 'neg' : ''}">${money(nw.net)}</b>
      <small>Assets ${money(nw.assets)} · Debts ${money(nw.debts)}</small>
      ${nw.assets + nw.debts > 0 ? `<span class="nwbar" role="img" aria-label="Assets against debts"><i style="width:${Math.round(nw.assets / (nw.assets + nw.debts) * 100)}%"></i></span>` : ''}</button>
      <button class="nwsp" data-act="acct-sp"><span>Spendable now</span><b>${money(sp)}</b></button></section>
    ${nw.missing ? `<p class="hint">Some accounts have no exchange rate yet, so they are left out of these totals. Set rates in Settings.</p>` : ''}
    <div class="aview compact"><label>Group <select data-aview="group" aria-label="Group accounts by">${[['class', 'Assets / debts'], ['cur', 'Currency'], ['type', 'Category'], ['exchange', 'Exchange'], ['none', 'None']].map(([v, l]) => `<option value="${v}" ${grp === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Sort <select data-aview="sort" aria-label="Sort accounts">${[['high', 'High → low'], ['low', 'Low → high'], ['name', 'A–Z'], ['cat', 'Category']].map(([v, l]) => `<option value="${v}" ${view.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${view.sort === 'cat' ? `<label>Then <select data-aview="then" aria-label="Sort inside each category">${[['high', 'High → low'], ['low', 'Low → high'], ['name', 'A–Z']].map(([v, l]) => `<option value="${v}" ${(view.then || 'high') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}</div>
    ${sections || (invAccts.length ? '' : '<p class="empty">No accounts yet. Tap “Add account” and start with the money you have today, for example your wallet or a bank account.</p>')}
    ${invAccts.length ? `<section class="topgrp assets invblock"><div class="tophead"><h2>Investments</h2><b>${money(sum(invAccts.map(val)))}</b></div><p class="hint">Crypto, stocks, funds and similar are kept in their own tab, with prices, gains and trades. They are already counted in your net worth above.</p>${walletTotals(invAccts, val)}<a class="btn wide ghost" href="#/invest">Open the Investments tab (${invAccts.length} ${invAccts.length === 1 ? 'account' : 'accounts'})</a></section>` : ''}
    ${hidden ? `<p class="muted center">${hidden} hidden ${hidden === 1 ? 'account' : 'accounts'} (archived).</p>` : ''}`;
}
document.addEventListener('change', (e) => { const el = e.target.closest && e.target.closest('select[data-aview]'); if (el) { view[el.dataset.aview] = el.value; saveView(); render(); } });
ACT.aview = (el) => { view[el.dataset.k] = el.dataset.v; saveView(); render(); };
// move an asset to another wallet of the same platform in one tap (the name follows when it carried the wallet)
ACT['wallet-move'] = async (el) => {
  const db = get(), a = db.accounts.find((x) => x.id === el.dataset.id); if (!a) return;
  let w = el.dataset.w;
  if (w === '__new') { w = (await promptDialog('New wallet', '', { okLabel: 'Move', hint: 'For example: Launchpool, Savings, Copy trading' }))?.trim(); if (!w) return; }
  const old = walletOf(a); if (w.toLowerCase() === old.toLowerCase()) return;
  if (db.accounts.some((x) => !x.deleted && x.id !== a.id && x.cur === a.cur && (x.exchange || '').toLowerCase() === (a.exchange || '').toLowerCase() && walletOf(x).toLowerCase() === w.toLowerCase())) { toast(`${a.exchange} already has ${a.cur} in ${w}. Open that one instead.`); return; }
  commit((d) => { const x = d.accounts.find((q) => q.id === a.id); const pre = `${x.exchange}${old === 'Spot' ? '' : ' ' + old} `; if (x.name.startsWith(pre)) x.name = `${x.exchange}${w === 'Spot' ? '' : ' ' + w} ${x.name.slice(pre.length)}`; x.wallet = w; stamp(x); });
  toast(`Moved to ${w}.`);
};
ACT['acct-sp'] = () => toast('Spendable counts cash, bank, e-wallet and card accounts marked “Count in spendable total”.');

// ---------- net worth ----------
ACT.nw = () => openNetWorth();
function openNetWorth() {
  const s = sheet('<div id="nw"></div>', { title: 'Net worth', wide: true });
  const db = get(), nw = netWorth(db);
  const byType = new Map();
  for (const i of nw.items) { const k = i.a.type; byType.set(k, (byType.get(k) || 0) + i.base); }
  const types = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  const maxT = Math.max(1, ...types.map(([, v]) => Math.abs(v)));
  // net worth at each of the last 12 month ends (today's exchange rates)
  const pts = [];
  for (let i = 11; i >= 0; i--) {
    const ym = shiftMonth(thisMonth(), -i), last = i === 0 ? '9999-12-31' : ym + '-31 23:59:59';
    const b = balances(db, last);
    let v = 0; for (const a of live(db.accounts)) v += (b.get(a.id) || 0) * (rateFor(db, a.cur) || 0);
    pts.push({ ym, v });
  }
  const mx = Math.max(1, ...pts.map((p) => Math.abs(p.v))), W = 320, H = 110, bw = W / pts.length, mid = pts.some((p) => p.v < 0) ? 70 : H - 18;
  const bars = pts.map((p, i) => {
    const h = Math.abs(p.v) / mx * (mid - 8);
    return `<g data-tip="${esc(`${monthLabel(p.ym)}: ${money(p.v)}`)}"><rect x="${i * bw}" y="0" width="${bw}" height="${H}" fill="transparent"/>
      <rect x="${i * bw + 4}" y="${p.v >= 0 ? mid - h : mid}" width="${bw - 8}" height="${Math.max(h, 1)}" rx="2" fill="${p.v >= 0 ? (i === 11 ? 'var(--line)' : 'var(--bar)') : 'var(--bad)'}"/>
      <text x="${i * bw + bw / 2}" y="${H - 3}" text-anchor="middle" class="axis">${monthLabel(p.ym).slice(0, 1)}</text></g>`;
  }).join('');
  const rowOf = (i) => `<button class="row acct" data-act="acct" data-id="${i.a.id}"><i class="badge sm" style="background:${groupColor(i.a.type)}">${groupLetter(typeNames[i.a.type] || i.a.type)}</i>
    <span class="rmain"><strong>${esc(i.a.name)}</strong><small>${esc(typeNames[i.a.type] || i.a.type)}</small></span>
    <span class="ramt"><b class="${i.base < 0 ? 'neg' : ''}">${money(i.base)}</b>${i.a.cur !== HOME ? `<small>${money(i.v, i.a.cur)}</small>` : ''}</span></button>`;
  s.el.querySelector('#nw').innerHTML = `
    <div class="gdhead"><b class="big ${nw.net < 0 ? 'neg' : ''}">${money(nw.net)}</b><span class="muted">Assets ${money(nw.assets)} − debts ${money(nw.debts)}, in ${BASE} at your current rates.</span></div>
    <h3>Last 12 months <small class="muted">(today’s rates · tap a bar)</small></h3>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Net worth at each month end"><line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="var(--rule)"/>${bars}</svg>
    <h3>By kind</h3>${types.map(([k, v]) => `<div class="gbar" data-tip="${esc(`${typeNames[k] || k}: ${money(v)}`)}"><i class="badge sm" style="background:${groupColor(k)}">${groupLetter(typeNames[k] || k)}</i>
      <div class="gmain"><div class="gtop"><span>${esc(typeNames[k] || k)}</span><b class="${v < 0 ? 'neg' : ''}">${money(v)}</b></div><div class="track"><div class="fill" style="width:${Math.abs(v) / maxT * 100}%;background:${v < 0 ? 'var(--bad)' : groupColor(k)}"></div></div></div></div>`).join('')}
    <h3>Assets</h3><div class="rows plain">${nw.items.filter((i) => i.base > 0).sort((a, b) => b.base - a.base).map(rowOf).join('') || '<p class="empty">None yet.</p>'}</div>
    <h3>Debts</h3><div class="rows plain">${nw.items.filter((i) => i.base < 0).sort((a, b) => a.base - b.base).map(rowOf).join('') || '<p class="empty">None.</p>'}</div>
    <p class="hint">Houses, vehicles and investments: add them as an account of type Asset or Investment, then use “Update value” on the account whenever the worth changes. The change is kept out of your income and spending.</p>`;
}

// ---------- account detail ----------
ACT.acct = (el) => openAccountDetail(el.dataset.id);
ACT['acct-new'] = () => openAccount(null);

// a new transfer from an account page: this account on its usual side, the usual other account on the other side.
// Cards and loans usually receive money, otherwise the most used route decides (this account can be the receiver).
const inInvestAcct = (a) => !!a && !a.archived && (a.type === 'crypto' || a.type === 'invest' || !!a.invtab);
function transferPreset(db, id) {
  const a = db.accounts.find((x) => x.id === id), h = transferHints(db), ok = (x) => { const o = db.accounts.find((q) => q.id === x); return o && !o.deleted && !o.archived; };
  const mine = h.routes.filter((r) => (r.from === id && ok(r.to)) || (r.to === id && ok(r.from))).sort((x, y) => y.n - x.n || (x.last < y.last ? 1 : -1))[0];
  if (mine) return mine.from === id ? { kind: 'transfer', acct: id, toAcct: mine.to, ...(mine.amount ? { amount: String(mine.amount) } : {}) } : { kind: 'transfer', acct: mine.from, toAcct: id, ...(mine.amount ? { amount: String(mine.amount) } : {}) };
  if (a && ['card', 'loan'].includes(a.type)) return { kind: 'transfer', toAcct: id, acct: (db.accounts.find((x) => !x.deleted && !x.archived && x.id !== id && x.include) || {}).id || '' };
  return { kind: 'transfer', acct: id };
}
export function openAccountDetail(id) {
  const s = sheet('<div id="ad"></div>', { title: 'Account', wide: true });
  const root = s.el.querySelector('#ad');
  const st = { range: 90, more: 25, from: '', to: '', type: 'all' };
  const draw = () => {
    const db = get(), a = db.accounts.find((x) => x.id === id);
    if (!a || a.deleted) { s.close(); return; }
    const bal = balances(db).get(id) || 0, r = homeFx(db, a.cur);
    const hist = accountHistory(db, id);                         // newest first
    const inRange = (h) => (!st.from || h.t.date.slice(0, 10) >= st.from) && (!st.to || h.t.date.slice(0, 10) <= st.to);
    const typeOk = (h) => st.type === 'all' || (st.type === 'in' && h.d > 0 && h.t.kind !== 'transfer') || (st.type === 'out' && h.d < 0 && h.t.kind !== 'transfer') || (st.type === 'tr' && h.t.kind === 'transfer');
    // a fee that belongs to a trade or transfer shown on the same account is folded into that row (its amount and balance follow)
    const kidsInfo = tradeKids(db), idx = new Map(hist.map((h, i) => [h.t.id, i])), absorbed = new Map(), hidden = new Set();
    for (const h of hist) { const par = kidsInfo.parentOf.get(h.t.id); if (par && idx.has(par.id)) { hidden.add(h.t.id); if (!absorbed.has(par.id)) absorbed.set(par.id, []); absorbed.get(par.id).push(h); } }
    const ranged = hist.filter(inRange), shownH = ranged.filter(typeOk).filter((h) => !hidden.has(h.t.id));
    const rsum = { inc: 0, exp: 0, tin: 0, tout: 0 };
    for (const h of ranged) { if (h.t.kind === 'transfer') { if (h.d > 0) rsum.tin += h.d; else rsum.tout -= h.d; } else if (h.d > 0) rsum.inc += h.d; else rsum.exp -= h.d; }
    const closeBal = ranged.length ? ranged[0].bal : null, openBal = ranged.length ? ranged[ranged.length - 1].bal - ranged[ranged.length - 1].d : null;
    const cm = catMap(db);
    const ym = thisMonth();
    const monthRows = hist.filter((h) => h.t.date.startsWith(ym));
    const inM = sum(monthRows.filter((h) => h.d > 0).map((h) => h.d)), outM = sum(monthRows.filter((h) => h.d < 0).map((h) => -h.d));
    // day-by-day balance for the chart
    const t0 = today(), days = st.range === 0 ? Math.min(730, Math.max(30, hist.length ? Math.round((new Date(t0) - new Date(hist[hist.length - 1].t.date.slice(0, 10))) / 864e5) + 1 : 30)) : st.range;
    const series = [];
    const asc = hist.slice().reverse();
    const od = openDates(db).get(a.id) || '', openV = a.open || 0; let k = 0, cum = 0;
    const startDay = new Date(new Date(t0).getTime() - (days - 1) * 864e5);
    const val = (dstr) => (od && dstr < od ? 0 : openV) + cum;                 // the opening balance counts from its own date
    for (; k < asc.length && asc[k].t.date.slice(0, 10) < startDay.toISOString().slice(0, 10); k++) cum += asc[k].d;
    for (let i = 0; i < days; i++) {
      const dstr = new Date(startDay.getTime() + i * 864e5).toISOString().slice(0, 10);
      while (k < asc.length && asc[k].t.date.slice(0, 10) <= dstr) { cum += asc[k].d; k++; }
      series.push({ d: dstr, v: val(dstr) });
    }
    const W = 320, H = 110, lo = Math.min(...series.map((x) => x.v), 0), hi = Math.max(...series.map((x) => x.v), 0.0001), span = hi - lo || 1;
    const X = (i) => 4 + i / Math.max(1, series.length - 1) * (W - 8), Y = (v) => H - 8 - (v - lo) / span * (H - 20);
    const pts = series.map((x, i) => [+X(i).toFixed(1), +Y(x.v).toFixed(1), dayLabel(x.d + ' 00:00:00'), fmt(x.v, a.cur)]);
    const path = series.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x.v).toFixed(1)}`).join('');
    const area = `${path}L${X(series.length - 1).toFixed(1)} ${Y(lo).toFixed(1)}L${X(0).toFixed(1)} ${Y(lo).toFixed(1)}Z`;
    const card = a.type === 'card' ? cardInfo(db, a, bal) : null;
    const earned = hasRate(a) ? sum(hist.filter((h) => h.t.auto).map((h) => h.d)) : 0, taxed = hasRate(a) ? sum(hist.filter((h) => h.t.auto).map((h) => h.t.tax || 0)) : 0, taxPct = interestTaxPct(a);
    const perDay = rateAt(a, today()) > 0 && bal > 0 ? bal * rateAt(a, today()) / 100 / 365 * (1 - taxPct / 100) : 0;
    const openRowHtml = (o) => `<div class="row openrow"><i class="badge sm" style="background:var(--line)">O</i><span class="rmain"><strong>Opening balance</strong><small>${dayLabel(o.date + ' 00:00:00')} · starting amount of this account</small></span><span class="ramt ${o.amount >= 0 ? 'income' : 'expense'}"><b>${money(o.amount, a.cur)}</b></span></div>`;
    const showOpen = hist.opening && st.type === 'all' && (!st.from || hist.opening.date >= st.from) && (!st.to || hist.opening.date <= st.to);
    const rowOf = (h) => {
      const t = h.t, c = cm.get(t.cat), tr = t.kind === 'transfer';
      const other = tr ? (t.acct === id ? (db.accounts.find((x) => x.id === t.toAcct) || {}).name : (db.accounts.find((x) => x.id === t.acct) || {}).name) : '';
      const title = t.name || (c ? c.name : tr ? 'Transfer' : 'Entry');
      const kids = absorbed.get(t.id) || [], feeD = kids.reduce((m, k) => m + k.d, 0), top = kids.reduce((m, k) => (idx.get(k.t.id) < idx.get(t.id) && idx.get(k.t.id) < m.i ? { i: idx.get(k.t.id), bal: k.bal } : m), { i: idx.get(t.id), bal: h.bal });
      const dShow = h.d + feeD, balShow = top.bal;
      const feeTxt = kids.length ? kids.map((k) => `fee ${money(k.t.amount, k.t.cur)}`).join(', ') : (t.fee > 0 ? `fee ${money(t.fee, t.feeCur || t.cur)}` : '');
      const sub = `${dayLabel(t.date)} · ${tr ? (t.acct === id ? 'to ' : 'from ') + esc(other || '?') : esc(c ? c.name : 'No category')}${t.auto || t.autoDebt ? ' · automatic' : ''}${feeTxt ? ' · ' + esc(feeTxt) : ''}`;
      return `<button class="row" data-act="edit" data-id="${t.id}"><i class="badge sm" style="background:${tr ? 'var(--xfer)' : groupColor(c ? c.group : 'Uncategorized')}">${groupLetter(tr ? 'Transfer' : (c ? c.group : 'U'))}</i>
        <span class="rmain"><strong>${esc(title)}</strong><small>${sub}</small><small class="eff">${effectLine(t, null)}</small></span>
        <span class="ramt ${dShow >= 0 ? 'income' : 'expense'}"><b>${dShow >= 0 ? '+' : ''}${money(dShow, a.cur)}</b><small>${money(balShow, a.cur)}</small></span></button>`;
    };
    const listed = shownH.slice(0, st.more); let rowsHtml = '', placed = !showOpen;
    for (const h of listed) { if (!placed && h.t.date.slice(0, 10) < hist.opening.date) { rowsHtml += openRowHtml(hist.opening); placed = true; } rowsHtml += rowOf(h); }
    if (!placed && shownH.length <= st.more) rowsHtml += openRowHtml(hist.opening);
    const openLine = hist.opening ? `<p class="hint openline">Opening balance ${money(hist.opening.amount, a.cur)} on ${dayLabel(hist.opening.date + ' 00:00:00')} <button type="button" class="linkbtn" data-ad="edit">change</button></p>` : '';
    root.innerHTML = `
      <div class="gdhead"><span class="muted">${esc(typeNames[a.type] || a.type)} · ${a.cur}</span><b class="big ${bal < 0 ? 'neg' : ''}">${money(bal, a.cur)}</b>
        ${a.cur !== HOME && r ? `<span class="muted">≈ ${money(bal * r)} at ${fmt(r, HOME)} per ${a.cur}</span>` : ''}<strong class="adname">${esc(a.name)}</strong> <button type="button" class="linkbtn sm" data-ad="reclass">Change type</button></div>
      ${openLine}
      <div class="btnrow tight"><button class="btn sm" data-ad="add">Add entry</button>${isLiability(a) ? `<button class="btn sm ghost" data-act="loan-charge" data-id="${a.id}">Add charge</button>` : ''}
        ${['asset', 'invest', 'other'].includes(a.type) ? '<button class="btn sm ghost" data-ad="reval">Update value</button>' : ''}
        <button class="btn sm ghost" data-ad="edit">Edit</button></div>
      ${a.exchange ? `<div class="wmove"><span class="muted">Wallet on ${esc(a.exchange)}</span><div class="chips">${[...new Set([...WALLETS, ...db.accounts.filter((x) => !x.deleted && x.exchange === a.exchange).map(walletOf)])].map((w) => `<button type="button" class="chip ${walletOf(a) === w ? 'on' : ''}" data-act="wallet-move" data-id="${a.id}" data-w="${esc(w)}" aria-pressed="${walletOf(a) === w}">${esc(w)}</button>`).join('')}<button type="button" class="chip" data-act="wallet-move" data-id="${a.id}" data-w="__new">+ New wallet</button></div></div>` : ''}
      <div class="rangebar seg sm" role="group" aria-label="Chart range">${[[30, '30 days'], [90, '90 days'], [365, '1 year'], [0, 'All']].map(([v, l]) => `<button type="button" data-ad="range" data-v="${v}" class="${st.range === v ? 'on' : ''}" aria-pressed="${st.range === v}">${l}</button>`).join('')}</div>
      <svg class="chart scrub" data-pts="${esc(JSON.stringify(pts))}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Balance over time. Touch and drag to read each day.">
        <path d="${area}" fill="var(--tint)"/><path d="${path}" fill="none" stroke="var(--line)" stroke-width="2.4" stroke-linejoin="round"/></svg>
      <p class="hint tap">Touch and drag along the line to read the balance on each day.</p>
      <div class="facts"><div><span>In this month</span><b class="in">${money(inM, a.cur)}</b></div><div><span>Out this month</span><b>${money(outM, a.cur)}</b></div><div><span>Entries</span><b>${hist.length}</b></div></div>
      ${card ? `<div class="cardbox"><h3>Credit card</h3>
        <div class="facts"><div><span>Owed</span><b>${money(card.owed, a.cur)}</b></div><div><span>Limit</span><b>${card.limit ? money(card.limit, a.cur) : '—'}</b></div><div><span>Available</span><b>${card.avail != null ? money(Math.max(0, card.avail), a.cur) : '—'}</b></div></div>
        ${card.limit ? `<span class="util big ${card.used >= 80 ? 'hot' : card.used >= 50 ? 'mid' : ''}" role="img" aria-label="${card.used}% used"><i style="width:${card.used}%"></i></span><p class="hint">${card.used}% of the limit is used. Staying under about 30% is easier on your credit.</p>` : '<p class="hint">Add the credit limit in Edit to see how much is used.</p>'}
        ${card.stmt ? `<p class="hint">Statement date: <strong>${dayLabel(card.stmt + ' 00:00:00')}</strong>. Owed at the statement ${money(card.owedAtStmt, a.cur)}, paid since ${money(card.paid, a.cur)}.</p>` : '<p class="hint">Add the statement day in Edit to track each billing cycle.</p>'}
        ${card.due ? `<p>${card.dueAmount > 0.005 ? `Amount due: <strong>${money(card.dueAmount, a.cur)}</strong> by <strong>${dayLabel(card.due + ' 00:00:00')}</strong> (${card.overdue ? 'overdue' : card.days === 0 ? 'today, until midnight' : card.days + ' days'}).` : `Paid in full for this cycle. Next due date ${dayLabel(card.due + ' 00:00:00')}.`}</p>` : '<p class="hint">Add the due day in Edit to get reminders.</p>'}
        <div class="btnrow tight">${card.owed > 0.005 ? '<button class="btn sm" data-ad="pay">Pay card</button>' : ''}${card.due ? '<button class="btn sm ghost" data-ad="ics">Add reminders to my calendar (.ics)</button>' : ''}</div>
        <p class="hint">Paying moves money from one of your accounts into the card. It lowers what you owe and is not counted as spending a second time.</p></div>` : ''}
      ${(a.type === 'loan' || a.loan) ? loanBox(db, a, money) : ''}
      ${a.type === 'card' && a.limits && a.limits.length > 1 ? `<div class="cardbox"><h3>Credit limit history</h3><ul class="calfacts">${[...a.limits].reverse().map((l, i, arr) => { const nx = arr[i + 1]; return `<li><span>${l.date ? esc(l.date) : 'Earlier'}</span><b>${money(l.limit, a.cur)}${nx ? ` <small class="${l.limit >= nx.limit ? 'in' : 'neg'}">${l.limit >= nx.limit ? '+' : '−'}${money(Math.abs(l.limit - nx.limit), a.cur)}</small>` : ''}</b></li>`; }).join('')}</ul></div>` : ''}
      ${hasRate(a) ? `<div class="cardbox"><h3>Interest</h3><p>${rateAt(a, today())}% a year${perDay ? `, about <strong>${money(perDay, a.cur)}</strong> a day after tax on today’s balance` : ''}. Earned so far in Sukli: <strong>${money(earned, a.cur)}</strong>${taxPct > 0 ? ` after ${taxPct}% tax${taxed ? ` (${money(taxed, a.cur)} withheld)` : ''}` : ''}.</p>
        <p class="hint">Approximate: Sukli adds one entry a day (category ${a.type === 'crypto' ? 'Crypto earned' : 'Interest'}). Set the rate your app shows; edit or delete any entry that differs.</p></div>` : ''}
      ${hasRate(a) ? (() => { const pv = interestPreview(db, a, 7), rh = rateHistory(a), ps = promoStatus(db, a), t0 = today();
        const cur = [...rh].reverse().find((r) => !r.from || r.from <= t0) || rh[0];
        return `<div class="cardbox"><h3>Interest details</h3>
        ${(() => { const li = lockInfo(db, a); return li.locked > 0 ? `<p class="lockline"><strong>Locked: ${money(li.locked, a.cur)}</strong> · free to take out: ${money(li.available, a.cur)} · next part unlocks ${esc(li.nextUnlock)}<br><small class="muted">Taking out more than the free amount before then may cost you the promo rate (Sukli stops counting it as promo money).</small></p>` : ''; })()}
        <h4 class="subh">Rate history</h4><ul class="calfacts">${rh.map((r) => `<li><span>${r.from ? 'From ' + esc(r.from) : 'Starting rate'}${r === cur ? ' · now' : ''}</span><b>${r.rate}% a year</b></li>`).join('')}</ul>
        ${ps.length ? `<h4 class="subh">Promotional rates</h4><ul class="calfacts">${ps.map((x) => `<li><span>${x.p.rate}% on money deposited ${esc(x.p.depFrom)} to ${esc(x.p.depTo)}<br><small class="muted">${esc(x.status)} · ${money(x.deposited, a.cur)} deposited in that window${x.lock ? ` · ${esc(x.lock)}` : ''}</small></span><b class="promo ${/^Earning/.test(x.status) ? 'on' : ''}">${/^Earning/.test(x.status) ? 'Active' : /^Ended/.test(x.status) ? 'Ended' : /^Starts/.test(x.status) ? 'Upcoming' : 'Open'}</b></li>`).join('')}</ul>` : ''}
        <h4 class="subh">Next 7 days <small class="muted">(if the balance stays at ${money(pv.balance, a.cur)})</small></h4>
        <ul class="calfacts ipreview">${pv.rows.map((r) => `<li><span>${esc(dayLabel(r.date + ' 12:00:00'))}${r.promo ? ' · promo' : ''}${r.note ? ` <small class="muted">· ${esc(r.note)}</small>` : ''}</span><b>${money(pv.taxPct > 0 ? r.net : r.gross, a.cur, { force: false })}</b></li>`).join('')}</ul>
        <p class="hint">${pv.taxPct > 0 ? `After ${pv.taxPct}% tax. ` : ''}Interest is added ${pv.comp === 'daily' ? 'every day' : pv.comp} at 23:55${pv.comp === 'daily' ? '' : ` (next: ${esc(pv.nextCredit)})`}.</p></div>`; })() : ''}
      ${hasDebtInt(a) ? (() => { const dv = debtPreview(db, a, 7), D = a.debtInt;
        return `<div class="cardbox"><h3>Interest on this debt</h3><p>${D.rate}% a year (${D.kind === 'addon' ? 'add-on, flat on the amount borrowed' : 'effective'}), added ${esc(dv.comp)}. ${D.fromDue ? 'Starts after each payment due date that passes with money still owed.' : `Starts on ${esc(D.start || '?')} if money is still owed.`}</p>
        <ul class="calfacts ipreview">${dv.rows.map((r) => `<li><span>${esc(dayLabel(r.date + ' 12:00:00'))}</span><b>${r.on ? money(r.charge, a.cur, { force: false }) : '<span class="muted">not yet</span>'}</b></li>`).join('')}</ul>
        <p class="hint">Charges are added at 23:55 (next: ${esc(dv.nextCharge)}) and count as a financial loss. Paying the debt off stops them.</p></div>`; })() : ''}
      <h3>History</h3>
      <div class="histfilter"><div class="seg sm" role="group" aria-label="Show">${[['all', 'All'], ['in', 'Money in'], ['out', 'Money out'], ['tr', 'Transfers']].map(([v, l]) => `<button type="button" data-ad="type" data-v="${v}" class="${st.type === v ? 'on' : ''}" aria-pressed="${st.type === v}">${l}</button>`).join('')}</div>
        <div class="seg sm" role="group" aria-label="Period">${[['m', 'This month'], ['p', 'Last month'], ['y', 'This year'], ['', 'All time']].map(([v, l]) => `<button type="button" data-ad="preset" data-v="${v}" class="${(st.preset ?? '') === v && (v === '' ? (!st.from && !st.to) : true) ? 'on' : ''}" aria-pressed="${(st.preset ?? '') === v}">${l}</button>`).join('')}</div>
        <div class="two"><button type="button" class="whenbtn" data-ad="from"><span>${st.from ? esc(st.from) : 'From: any date'}</span>${ic('calendar')}</button><button type="button" class="whenbtn" data-ad="to"><span>${st.to ? esc(st.to) : 'To: any date'}</span>${ic('calendar')}</button></div></div>
      ${st.from || st.to || st.type !== 'all' ? `<div class="facts"><div><span>Income / in</span><b class="in">${money(rsum.inc, a.cur)}</b></div><div><span>Expenses / out</span><b>${money(rsum.exp, a.cur)}</b></div><div><span>Transfers in</span><b>${money(rsum.tin, a.cur)}</b></div><div><span>Transfers out</span><b>${money(rsum.tout, a.cur)}</b></div><div><span>Opening</span><b>${openBal == null ? '—' : money(openBal, a.cur)}</b></div><div><span>Closing</span><b>${closeBal == null ? '—' : money(closeBal, a.cur)}</b></div></div>` : ''}
      <div class="rows plain">${rowsHtml || '<p class="empty">No entries for this filter.</p>'}</div>
      ${shownH.length > st.more ? `<button class="btn ghost wide" data-ad="more">Show more (${shownH.length - st.more} left)</button>` : ''}
      <div class="adfab ${st.fab ? 'open' : ''}">${st.fab ? `<div class="adfab-menu" role="menu">${(inInvestAcct(a) ? ['trade', 'transfer', 'expense', 'income'] : ['expense', 'income', 'transfer']).map((k) => `<button type="button" role="menuitem" data-ad="fab-new" data-v="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>` : ''}<button type="button" class="adfab-btn" data-ad="fab" aria-label="Add to this account" aria-expanded="${!!st.fab}">${ic(st.fab ? 'x' : 'plus')}</button></div>`;
  };
  draw();
  const un = (() => { let q = false; const f = () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; if (root.isConnected) draw(); }); }; window.addEventListener('sukli-render', f); const u2 = subscribe(f); return () => { window.removeEventListener('sukli-render', f); u2(); }; })();
  const oldClose = s.close; s.close = () => { un(); oldClose(); };
  s.root.querySelector('[data-close]').onclick = () => s.close();
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ad]'); if (!b) return;
    const db = get(), a = db.accounts.find((x) => x.id === id);
    switch (b.dataset.ad) {
      case 'add': openEntry({ preset: { acct: id } }); break;
      case 'fab': st.fab = !st.fab; draw(); break;
      case 'fab-new': { st.fab = false; draw(); const k = b.dataset.v;
        if (k === 'trade') { import('./trades.js').then((m) => m.openTrade({ asset: id })); break; }
        if (k === 'income' && inInvestAcct(db.accounts.find((x) => x.id === id))) { import('./invest.js').then((m) => m.openIncome({ asset: id })); break; } openEntry({ preset: k === 'transfer' ? transferPreset(db, id) : { kind: k, acct: id } }); break; }
      case 'edit': openAccount(id); break;
      case 'reclass': openReclass(id); break;
      case 'range': st.range = +b.dataset.v; draw(); break;
      case 'more': st.more += 25; draw(); break;
      case 'type': st.type = b.dataset.v; st.more = 25; draw(); break;
      case 'preset': {
        const v = b.dataset.v, ym = thisMonth(); st.more = 25; st.preset = v;
        if (v === 'm') { st.from = ym + '-01'; st.to = ym + '-31'; }
        else if (v === 'p') { const pm = shiftMonth(ym, -1); st.from = pm + '-01'; st.to = pm + '-31'; }
        else if (v === 'y') { st.from = ym.slice(0, 4) + '-01-01'; st.to = ym.slice(0, 4) + '-12-31'; }
        else { st.from = ''; st.to = ''; }
        draw(); break;
      }
      case 'from': openDatePicker((st.from || today()) + ' 00:00:00', (v) => { st.preset = 'custom'; st.from = v.slice(0, 10); if (st.to && st.to < st.from) st.to = st.from; draw(); }, { title: 'From date', time: false }); break;
      case 'to': openDatePicker((st.to || today()) + ' 00:00:00', (v) => { st.preset = 'custom'; st.to = v.slice(0, 10); if (st.from && st.to < st.from) st.from = st.to; draw(); }, { title: 'To date', time: false }); break;
      case 'pay': {
        const other = db.accounts.find((x) => !x.deleted && !x.archived && x.type !== 'card' && x.cur === a.cur) || db.accounts.find((x) => !x.deleted && !x.archived && x.type !== 'card');
        const c2 = cardInfo(db, a, balances(db).get(id));
        openEntry({ preset: { kind: 'transfer', toAcct: id, acct: other ? other.id : '', name: 'Card payment', amount: String(Math.round((c2.dueAmount > 0.005 ? c2.dueAmount : c2.owed) * 100) / 100) } }); break;
      }
      case 'ics': { const t = cardIcs(db); if (t) { download('sukli-card-reminders.ics', t, 'text/calendar'); toast('Open the file to add the reminders to your calendar app.'); } break; }
      case 'reval': {
        const cur = balances(db).get(id) || 0;
        const v = await askValue(a, cur);
        if (v == null) return;
        const diff = Math.round((v - cur) * 1e6) / 1e6;
        if (!diff) { toast('Already that value.'); return; }
        commit((d) => {
          const c = adjustmentCategory(d);
          d.txs.push(stamp({ id: uid(), kind: diff > 0 ? 'income' : 'expense', date: nowStamp(), name: 'Value update', amount: Math.abs(diff), cur: a.cur, fx: rateFor(d, a.cur) || 1, cat: c.id, acct: id, reval: true, notes: 'Worth changed. Not counted as income or spending.', items: [] }));
        });
        toast(`Value updated to ${fmt(v, a.cur, { force: false })}.`);
        break;
      }
    }
  });
}
function askValue(a, cur) {
  return new Promise((res) => {
    const s = sheet(`<form><label class="field"><span>What is it worth now? (${a.cur})</span><input name="v" inputmode="decimal" value="${cur}" autofocus></label>
      <p class="hint">The change is recorded as a value update, and left out of income and spending.</p>
      <div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn">Update</button></div></form>`, { title: 'Update value', onClose: () => res(null) });
    s.el.querySelector('[data-no]').onclick = () => s.close();
    s.el.querySelector('form').onsubmit = (e) => { e.preventDefault(); const v = num(e.target.v.value); if (!isFinite(v)) return; s.dispose(); res(v); };
  });
}

// ---------- add / edit an account ----------
export function openAccount(id, preset = {}) {
  const db = get();
  const a = id ? db.accounts.find((x) => x.id === id) : { name: '', cur: HOME, type: 'bank', open: 0, include: true, archived: false, ...preset };
  const used = id && db.txs.some((t) => !t.deleted && (t.acct === id || t.toAcct === id));
  const bal = id ? (balances(db).get(id) || 0) : 0;
  const curs = [...new Set([...favCurs(), ...db.accounts.map((x) => x.cur), ...allCurrencies()])];
  const s = sheet(`<form id="acct-form">
    <label class="field"><span>Name</span><input name="name" value="${esc(a.name)}" required ${id ? '' : 'autofocus'}></label>
    <label class="field"><span>Exchange or platform (optional)</span><select name="exchange" data-keep="${esc(exchangeOf(a))}">${(() => { const cur = exchangeOf(a), pn = platformNames(), all = [...new Set([...(cur ? [cur] : []), ...pn.used])]; return `<option value="">None</option><optgroup label="Yours">${all.map((x) => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('')}</optgroup><optgroup label="Popular">${pn.popular.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</optgroup>`; })()}</select></label>
    <label class="field" id="walletf" ${exchangeOf(a) ? '' : 'hidden'}><span>Wallet inside the platform</span><select name="wallet">${[...new Set([...WALLETS, ...db.accounts.map((x) => x.wallet).filter(Boolean)])].map((w) => `<option value="${esc(w)}" ${(a.wallet || 'Spot') === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select><small class="muted">Spot, Funding, Futures, Margin, Earn… One asset can sit in several wallets, for example USDT in Spot and USDT in Earn.</small></label>
    <div class="two"><label class="field"><span>Currency</span><input type="hidden" name="cur" value="${esc(a.cur)}"><button type="button" class="curbtn wide" data-act="acct-cur" ${used ? 'disabled' : ''}>${flagOf(a.cur)} ${esc(a.cur)} ▾</button></label>
    <label class="field"><span>Type</span><select name="type" data-prev="${esc(a.type)}">${Object.entries(typeNames).map(([v, l]) => `<option value="${v}" ${v === a.type ? 'selected' : ''}>${esc(l)}</option>`).join('')}<option value="__new">＋ New account type…</option></select></label></div>
    <div class="two"><label class="field"><span>Opening balance</span><input name="open" inputmode="decimal" value="${a.open || 0}"></label>
    <label class="field"><span>Opening date</span><input name="openDate" type="date" value="${esc(openDateOf(a))}"></label></div>
    <div id="cardfields" ${a.type === 'card' ? '' : 'hidden'}>
      <label class="field"><span>Credit limit</span><input name="limit" inputmode="decimal" value="${a.limit || ''}" placeholder="e.g. 50000"></label>
      <div class="two"><label class="field"><span>Statement closes on day</span><input name="stmtDay" inputmode="numeric" value="${a.stmtDay || ''}" placeholder="1–31"></label>
      <label class="field"><span>Payment due on day</span><input name="dueDay" inputmode="numeric" value="${a.dueDay || ''}" placeholder="1–31"></label></div>
      <p class="hint">Sukli shows a banner on Home when the payment is near, and can give you calendar reminders (.ics) from the account page.</p></div>
    <div id="intfields" ${isLiability(a) ? 'hidden' : ''}><div class="field"><span>Interest (optional) ${tipBtn('rate')}${tipBtn('start')}${tipBtn('tax')}</span>
      <div class="two"><label class="amtwrap sm"><input name="apy" inputmode="decimal" value="${a.apy || ''}" placeholder="0" aria-label="Yearly interest percent"><b>% a year</b></label>
      <input name="interestFrom" type="date" value="${esc(a.interestFrom || today())}" aria-label="Start date"></div>
      <label class="amtwrap sm"><input name="taxPct" inputmode="decimal" value="${interestTaxPct(a)}" aria-label="Tax withheld on interest percent"><b>% tax on interest</b></label>
      <small class="hint">Local banks withhold tax on interest before crediting it (usually 20%), so only the rest is added to your balance. Use 0 for e-wallets, crypto or anything that pays gross. It applies to interest added from now on.</small>
      <small class="hint">For Maya Savings, Binance Earn and the like. Sukli adds one small entry a day (Interest, or Crypto earned for crypto accounts) based on that day’s balance. It is an estimate, so set the rate your app shows.</small></div>
      <label class="field"><span>Interest is added to the balance ${tipBtn('compounding')}</span><select name="compound" aria-label="Compounding">${Object.entries(COMP_LABEL).map(([v, l]) => `<option value="${v}" ${(a.compound || 'daily') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="field tiphost"><span>When the rate changes ${tipBtn('ratechange')}</span><div data-rows="rc">${(a.rates || []).map(rateRow).join('')}</div><button type="button" class="linkbtn addrow" data-add-row="rc">Add a rate change</button></div>
      <div class="field tiphost"><span>Promotional rates ${tipBtn('promo')}</span><div data-rows="pr">${(a.promos || []).map(promoRow).join('')}</div><button type="button" class="linkbtn addrow" data-add-row="pr">Add a promotional rate</button></div>
      ${calcHtml(a.compound || 'monthly')}</div>
    <div id="debtfields" ${isLiability(a) ? '' : 'hidden'}>${debtInt(a)}</div>
    <p class="hint" id="liabnote" hidden>Debts do not earn interest. Record interest charges, late fees and penalties from the account page with “Add charge”.</p>
    <label class="check"><input type="checkbox" name="include" ${a.include ? 'checked' : ''}> Count in spendable total</label>
    <label class="check"><input type="checkbox" name="invtab" ${a.invtab || ['crypto', 'invest'].includes(a.type) ? 'checked' : ''}> Show in the Investments tab (crypto, funds, MP2…)</label>
    ${id ? `<label class="check"><input type="checkbox" name="archived" ${a.archived ? 'checked' : ''}> Hide this account (archive)</label>` : ''}
    ${used ? '<p class="hint">Currency is locked because this account has entries.</p>' : ''}
    <div class="btnrow">${id && !used ? '<button type="button" class="btn danger ghost" data-del>Delete</button>' : ''}<button class="btn">Save</button></div></form>
    ${id ? `<form id="recon" class="recon"><h3>Does the real balance differ?</h3>
      <p class="hint">App says ${money(bal, a.cur)}. Type what your bank or wallet really shows and the app adds one correcting entry.</p>
      <div class="two"><input name="real" inputmode="decimal" placeholder="Real balance" aria-label="Real balance"><button class="btn ghost">Correct it</button></div></form>` : ''}`,
  { title: id ? 'Edit account' : 'New account' });
  const walletAdd = { title: 'Wallet', addLabel: 'Add a new wallet', onAdd: async () => { const nm = (await promptDialog('New wallet', '', { okLabel: 'Add', hint: 'For example: Launchpool, Savings, Copy trading' }))?.trim(); if (!nm) return; const sel = s.el.querySelector('select[name=wallet]'); if (![...sel.options].some((o) => o.value.toLowerCase() === nm.toLowerCase())) sel.add(new Option(nm, nm)); sel.value = [...sel.options].find((o) => o.value.toLowerCase() === nm.toLowerCase()).value; sel.dispatchEvent(new Event('change', { bubbles: true })); } };
  s.el.querySelector('select[name=exchange]').addEventListener('change', (e) => { s.el.querySelector('#walletf').hidden = !e.target.value; });
  pickAll(s.el, { wallet: walletAdd, exchange: { title: 'Exchange or platform', addLabel: 'Add a new platform', onAdd: async () => { const sel = s.el.querySelector('select[name=exchange]'); const nm = (await promptDialog('New platform', '', { okLabel: 'Add', hint: 'For example: Binance, Moomoo, SBI Securities' }))?.trim(); if (!nm) return; let v = canonPlatform(nm); const nr = nearPlatform(v); if (nr && await confirmDialog(`Did you mean ${nr}? You typed ${v}.`, `Yes, ${nr}`)) v = nr; if (![...sel.options].some((o) => o.value === v)) sel.add(new Option(v, v)); sel.value = v; } }, type: { title: 'Account type', addLabel: 'Add a new account type', onAdd: () => { const t = s.el.querySelector('select[name=type]'); t.value = '__new'; t.dispatchEvent(new Event('change', { bubbles: true })); } } });
  const form = s.el.querySelector('#acct-form');
  form.type.addEventListener('change', () => { s.el.querySelector('#cardfields').hidden = form.type.value !== 'card'; const L = isLiability({ type: form.type.value }); s.el.querySelector('#intfields').hidden = L; s.el.querySelector('#debtfields').hidden = !L; });
  // add / remove rows, debt interest switch, calculators
  s.el.addEventListener('click', (e) => { const add = e.target.closest('[data-add-row]'), rm = e.target.closest('[data-rm-row]');
    if (add) { const box = s.el.querySelector(`[data-rows="${add.dataset.addRow}"]`); box.insertAdjacentHTML('beforeend', add.dataset.addRow === 'rc' ? rateRow() : promoRow()); box.lastElementChild.querySelector('input').focus(); }
    if (rm) rm.closest('[data-row]').remove(); });
  const dOn = form.querySelector('[name=d-on]'); if (dOn) dOn.onchange = () => { s.el.querySelector('[data-debtbox]').hidden = !dOn.checked; };
  s.el.querySelectorAll('#intfields, #debtfields').forEach((box) => bindCalc(box, { onUse: (nm, comp) => { const inp = box.id === 'intfields' ? form.apy : form['d-rate']; inp.value = String(+nm.toFixed(4)); const sel = box.id === 'intfields' ? form.compound : form['d-comp']; if (sel && [...sel.options].some((o) => o.value === comp)) sel.value = comp; toast('Rate filled in.'); } }));
  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = fd.get('name').trim();
    const open = num(fd.get('open')) || 0;
    const extra = {
      limit: num(fd.get('limit')) > 0 ? num(fd.get('limit')) : 0,
      stmtDay: Math.min(31, Math.max(0, Math.round(num(fd.get('stmtDay')) || 0))),
      dueDay: Math.min(31, Math.max(0, Math.round(num(fd.get('dueDay')) || 0))),
      apy: num(fd.get('apy')) > 0 ? num(fd.get('apy')) : 0,
      taxPct: Math.min(100, Math.max(0, num(fd.get('taxPct')) || 0)),
      exchange: canonPlatform(fd.get('exchange') || ''), wallet: fd.get('exchange') ? (fd.get('wallet') || 'Spot') : '', invtab: fd.has('invtab'),
      interestFrom: fd.get('interestFrom') || today(),
      openDate: fd.get('openDate') || '',
    };
    const rcF = fd.getAll('rc-from'), rcR = fd.getAll('rc-rate'), pF = fd.getAll('pr-from'), pT = fd.getAll('pr-to'), pR = fd.getAll('pr-rate'), pU = fd.getAll('pr-until'), pL = fd.getAll('pr-lock'), pLE = fd.getAll('pr-lockend');
    extra.compound = fd.get('compound') || 'daily';
    extra.rates = rcF.map((f, i) => ({ from: f, rate: num(rcR[i]) })).filter((r, i) => r.from && String(rcR[i]).trim() !== '');
    extra.promos = pF.map((f, i) => ({ depFrom: f, depTo: pT[i], rate: num(pR[i]), until: pU[i] || '', lockDays: Math.max(0, Math.round(num(pL[i]))) || 0, lockEnd: pLE[i] || '' })).filter((p) => p.depFrom && p.depTo && p.rate > 0);
    extra.debtInt = fd.has('d-on') ? { on: true, rate: num(fd.get('d-rate')), kind: fd.get('d-kind') || 'effective', comp: fd.get('d-comp') || 'monthly', fromDue: fd.has('d-due'), start: fd.get('d-start') || today(), principal: num(fd.get('d-principal')) } : { on: false };
    if (isLiability({ type: fd.get('type') })) { extra.apy = 0; extra.rates = []; extra.promos = []; } else extra.debtInt = { on: false };
    if (fd.get('type') !== 'card') { extra.limit = 0; extra.stmtDay = 0; extra.dueDay = 0; }
    let retaxed = 0;
    commit((d) => {
      if (id) {
        const x = d.accounts.find((q) => q.id === id);
        if (extra.limit > 0 && (x.limit || 0) !== extra.limit && x.type === 'card') { x.limits = [...(x.limits || (x.limit ? [{ date: x.limitSince || '', limit: x.limit }] : [])), { date: today(), limit: extra.limit }]; x.limitSince = today(); }
        if (extra.taxPct !== interestTaxPct(x)) retaxed = retaxInterest(d, id, extra.taxPct);
        Object.assign(x, { name, type: fd.get('type'), open, include: fd.has('include'), archived: fd.has('archived'), guessed: false }, extra);
        if (!used) x.cur = fd.get('cur');
        stamp(x);
      } else d.accounts.push(stamp({ id: uid(), name, cur: fd.get('cur'), type: fd.get('type'), open, include: fd.has('include'), archived: false, ...extra, ...(extra.limit > 0 && fd.get('type') === 'card' ? { limits: [{ date: today(), limit: extra.limit }], limitSince: today() } : {}) }));
      if (hasRate(extra)) postInterest(d);
      if (extra.debtInt && extra.debtInt.on) postDebtInterest(d);
    });
    s.close();
    if (retaxed) toast(`Tax rate updated on ${retaxed} interest ${retaxed === 1 ? 'entry' : 'entries'}.`);
  };
  const del = s.el.querySelector('[data-del]');
  if (del) del.onclick = () => { commit((d) => { const x = d.accounts.find((q) => q.id === id); softDelete(x); }); s.close(); toast('Account deleted'); };
  const rec = s.el.querySelector('#recon');
  if (rec) rec.onsubmit = (e) => {
    e.preventDefault();
    const real = num(new FormData(rec).get('real'));
    if (!isFinite(real)) return;
    const diff = Math.round((real - bal) * 100) / 100;
    if (!diff) { toast('Already matches.'); s.close(); return; }
    commit((d) => {
      const c = adjustmentCategory(d);
      d.txs.push(stamp({ id: uid(), kind: diff > 0 ? 'income' : 'expense', date: nowStamp(), name: 'Balance correction', amount: Math.abs(diff),
        cur: a.cur, fx: rateFor(d, a.cur) || 1, cat: c.id, acct: id, notes: 'Added to match the real balance', items: [] }));
    });
    s.close();
    toast(`Added a ${money(Math.abs(diff), a.cur)} correction.`);
  };
}

ACT['acct-cur'] = (el) => openCurrencyPicker((c) => { el.closest('form').elements.cur.value = c; el.textContent = `${flagOf(c)} ${c} ▾`; }, { title: 'Currency', keep: false });

// a type that does not exist yet can be made right inside the account form
export function createAccountType(name, liab) {
  const key = 'c_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) + '_' + Math.random().toString(36).slice(2, 5);
  commit((d) => { d.settings.customTypes = { ...(d.settings.customTypes || {}), [key]: { label: name, liab } }; });
  applyTypes(get().settings);
  return key;
}
document.addEventListener('change', async (e) => {
  const sel = e.target; if (!sel.matches || !sel.matches('select[name="type"]') || sel.value !== '__new') return;
  const back = () => { sel.value = sel.dataset.prev || 'bank'; };
  const name = (await promptDialog('New account type', '', { okLabel: 'Next', hint: 'For example: Money owed to me, Savings pot, Prepaid card' }))?.trim();
  if (!name) { back(); return; }
  if (Object.values(typeNames).some((l) => l.toLowerCase() === name.toLowerCase())) { toast('That type already exists. Pick it from the list.'); back(); return; }
  const liab = await confirmDialog(`Is “${name}” money you owe (a liability)? Choose Cancel if it is money you have or are owed.`, 'Yes, I owe it');
  const key = createAccountType(name, liab);
  const o = new Option(name, key); sel.insertBefore(o, sel.querySelector('option[value="__new"]')); sel.value = key; sel.dataset.prev = key;
  toast(`Added “${name}” and selected it.`, { ms: 4000 });
});

// ---- interest fields in the account form ----
const rateRow = (r = {}) => `<div class="two rowline" data-row><input type="date" name="rc-from" value="${esc(r.from || '')}" aria-label="Rate changes on"><label class="amtwrap sm"><input name="rc-rate" inputmode="decimal" value="${r.rate ?? ''}" placeholder="new rate" aria-label="New yearly rate"><b>%</b></label><button type="button" class="linkbtn" data-rm-row aria-label="Remove">✕</button></div>`;
const promoRow = (p = {}) => `<div class="promoline rowline" data-row><div class="two"><label class="field"><span>Deposited from</span><input type="date" name="pr-from" value="${esc(p.depFrom || '')}"></label><label class="field"><span>to</span><input type="date" name="pr-to" value="${esc(p.depTo || '')}"></label></div><div class="two"><label class="field"><span>Earns</span><span class="amtwrap sm"><input name="pr-rate" inputmode="decimal" value="${p.rate ?? ''}" placeholder="%"><b>% a year</b></span></label><label class="field"><span>until</span><input type="date" name="pr-until" value="${esc(p.until || '')}"></label></div><div class="two"><label class="field"><span>Locked for (days after each deposit)</span><input name="pr-lock" inputmode="numeric" value="${p.lockDays || ''}" placeholder="0 = no lock"></label><label class="field"><span>or locked until</span><input type="date" name="pr-lockend" value="${esc(p.lockEnd || '')}"></label></div><button type="button" class="linkbtn" data-rm-row>Remove</button></div>`;
function debtInt(a) {
  const D = a.debtInt || {};
  return `<div class="field tiphost"><label class="check"><input type="checkbox" name="d-on" ${D.on ? 'checked' : ''}> This debt charges interest when the deadline passes ${tipBtn('debt')}</label>
    <div class="debtbox" ${D.on ? '' : 'hidden'} data-debtbox>
      <div class="two"><label class="field"><span>Rate % a year ${tipBtn('rate')}</span><input name="d-rate" inputmode="decimal" value="${D.rate || ''}" placeholder="e.g. 24"></label>
      <label class="field"><span>Kind ${tipBtn('effective')}${tipBtn('addon')}</span><select name="d-kind"><option value="effective" ${D.kind !== 'addon' ? 'selected' : ''}>Effective (counts compounding)</option><option value="addon" ${D.kind === 'addon' ? 'selected' : ''}>Add-on (flat on the amount borrowed)</option></select></label></div>
      <div class="two"><label class="field"><span>Compounding ${tipBtn('compounding')}</span><select name="d-comp">${Object.entries(COMP_LABEL).filter(([v]) => v !== 'yearly').map(([v, l]) => `<option value="${v}" ${(D.comp || 'monthly') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Interest starts on (deadline) ${tipBtn('start')}</span><input name="d-start" type="date" value="${esc(D.start || '')}"></label></div>
      <label class="check"><input type="checkbox" name="d-due" ${D.fromDue ? 'checked' : ''}> Credit card: charge interest after each payment due date that passes with money still owed</label>
      <label class="field"><span>Principal (amount borrowed, for add-on) ${tipBtn('principal')}</span><input name="d-principal" inputmode="decimal" value="${D.principal || ''}" placeholder="optional"></label>
      <small class="hint">If the amount is still owed on that date, Sukli adds an interest charge to this debt (at 23:55 each day, month or quarter, as you choose). It counts as a financial loss.</small></div></div>
    ${calcHtml(D.comp || 'monthly')}`;
}
// tap an automatic interest entry: gross, tax, net, and a way to change the account's tax rate
export function openInterestDetail(t) {
  const db = get(), a = db.accounts.find((x) => x.id === t.acct); if (!a) return false;
  const pct = t.taxPct != null ? t.taxPct : 0, gross = t.gross != null ? t.gross : t.amount;
  const s = sheet(`<div class="facts three"><div><span>Interest</span><b>${money(gross, a.cur)}</b></div><div><span>Tax ${pct}%</span><b class="cr">${money(t.tax || 0, a.cur)}</b></div><div><span>Credited</span><b class="cg">${money(t.amount, a.cur)}</b></div></div>
    <p class="hint">${esc(a.name)} · ${esc(String(t.date).slice(0, 10))}. Current tax rate for this account: <b>${interestTaxPct(a)}%</b>. Changing it recalculates every interest entry this account has earned.</p>
    <label class="amtwrap sm"><input id="it-pct" inputmode="decimal" value="${interestTaxPct(a)}" aria-label="Tax percent"><b>% tax on interest</b></label>
    <div class="btnrow"><button class="btn ghost" data-close2>Close</button><button class="btn" data-go>Apply to all</button></div>`, { title: 'Interest details' });
  s.el.querySelector('[data-close2]').onclick = () => s.close();
  s.el.querySelector('[data-go]').onclick = () => { const p = Math.min(100, Math.max(0, parseFloat(s.el.querySelector('#it-pct').value) || 0)); let n = 0; commit((d) => { const x = d.accounts.find((q) => q.id === a.id); x.taxPct = p; stamp(x); n = retaxInterest(d, a.id, p); }); s.close(); toast(`Tax rate ${p}%: ${n} ${n === 1 ? 'entry' : 'entries'} updated.`); };
  return true;
}
