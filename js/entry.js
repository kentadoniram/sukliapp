// The add / edit sheet, the category picker and the "add many at once" sheet.
import {
  get, commit, uid, stamp, nowStamp, toLocalInput, fromLocalInput, rateFor, fmt, freqNames, accountMap, catMap,
  findOrAddCategory, groupColor, groupLetter, BASE, HOME, homeFx, homeRate, balances, CUR, priv, softDelete,
} from './core.js';
import { buildGraph, makeResolver, explain } from './simgraph.js';
import { nameRules } from './merchants.js';
import { compareCard, relatedNames } from './compare.js';
import { smartKind, openLoanPlanner } from './loans.js';
import { isLiability } from './finance.js';
import { guessLabel, transferLabel } from './label.js';
import { parseRoute, routeName, routeStats, suggestTrips, rankRouteNames, isTransportCat, transportWord, modeOf, tripLabel, bareMode } from './route.js';
import { buildModel, predict, suggest, lookup, catCandidates, byAmount, recentNames } from './predict.js';
import { evalExpr, isExpr, tidy } from './calc.js';
import { predictFee, safetyCheck, typeGroupName, typeGroupOrder, transferHints } from './finance.js';
import { esc, sheet, toast, ic, confirmDialog, promptDialog } from './ui.js';
import { applyHide } from './appearance.js';
import { openDatePicker, prettyDate } from './datepicker.js';
import { openCurrencyPicker, favCurs, flagOf } from './curpicker.js';
import { openAccountPicker } from './acctpicker.js';
import { similarNames } from './merchants.js';

// ---- models are rebuilt only when the data changed ----
const cache = {};
export function modelFor(kind) {
  const db = get();
  const key = db.txs.length + ':' + db.txs.reduce((m, t) => Math.max(m, t.updatedAt || 0), 0) + ':' + db.categories.length + ':' + db.categories.reduce((m, c) => Math.max(m, c.updatedAt || 0), 0) + ':' + JSON.stringify(nameRules());
  if (!cache[kind] || cache[kind].key !== key) cache[kind] = { key, m: buildModel(db.txs, kind, db.categories, makeResolver(buildGraph(db))) };
  return cache[kind].m;
}

const commasOn = () => { try { return localStorage.getItem('sukli.commas') !== '0'; } catch { return true; } };
const withCommas = (v) => {
  const m = String(v).match(/^(-?)(\d[\d,]*)(\.\d*)?$/);   // plain numbers only; sums like 120+45 are left alone
  return m ? m[1] + m[2].replace(/,/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (m[3] || '') : v;
};
function formatAmountInput(inp) {
  if (!commasOn()) return;
  const raw = inp.value, out = withCommas(raw);
  if (out === raw) return;
  const left = raw.slice(0, inp.selectionStart ?? raw.length).replace(/[^\d.]/g, '').length;
  inp.value = out;
  let i = 0, c = 0;
  while (i < out.length && c < left) { if (/[\d.]/.test(out[i])) c++; i++; }
  try { inp.setSelectionRange(i, i); } catch { /* ignore */ }
}
const num = (s) => evalExpr(s);   // plain numbers, or a sum like 120+45*2
const hourOf = (d) => parseInt(String(d).slice(11, 13), 10);
const prec = (x) => String(Number(Number(x).toPrecision(6)));

function blank() {
  const db = get();
  const accts = db.accounts.filter((a) => !a.deleted && !a.archived);
  const last = accts.find((a) => a.id === db.settings.lastAcct) || accts.find((a) => a.include) || accts[0];
  return { kind: 'expense', amount: '', name: '', acct: last ? last.id : '', toAcct: '', toAmount: '', fx: '', cat: '',
    catTouched: false, acctTouched: false, acctSuggested: false, fxMode: 'rate', peso: '', date: nowStamp(), notes: '', items: [], flag: null, id: null, pred: null, showItems: false, from: '', to: '', autoName: '',
    fee: '', feeCat: '', feeBy: 'from', feeTouched: false, calc: false, convert: false, cRate: '', qtab: '', qtabManual: false };
}
function fromTx(t) {
  const db = get();
  const cross = t.kind === 'transfer' && t.toAmount != null && Math.abs(t.toAmount - t.amount) > 1e-9;
  return { kind: t.kind, amount: String(t.amount), name: t.name || '', acct: t.acct, toAcct: t.toAcct || '',
    toAmount: t.toAmount != null ? String(t.toAmount) : '', fx: t.fx ? prec(t.fx / homeRate(db, t.date)) : '', cat: t.cat || '',
    fee: t.fee > 0 ? String(t.fee) : '', feeCat: t.feeCat || '', feeBy: t.feeBy || 'from', feeTouched: true, calc: false,
    convert: cross, cRate: cross ? prec(t.toAmount / t.amount) : '', qtab: '', qtabManual: false,
    catTouched: true, acctTouched: true, date: t.date, notes: t.notes || '', flag: t.flag || null, id: t.id, pred: null,
    items: (t.items || []).map((i) => ({ n: i.n, amt: String(i.amt), cat: i.cat || '' })), showItems: !!(t.items && t.items.length), from: t.from || '', to: t.to || '' };
}

// accounts grouped by kind (Banks, E-wallets, Crypto…), most recently used first inside each group
function acctOptions(sel, skip, cur) {
  const db = get();
  const lastUsed = new Map();
  for (const t of db.txs) { if (t.deleted) continue; for (const id of [t.acct, t.toAcct]) if (id && (lastUsed.get(id) || '') < t.date) lastUsed.set(id, t.date); }
  const groups = new Map();
  for (const a of db.accounts) {
    if (a.deleted || a.id === skip || (a.archived && a.id !== sel) || (cur && a.cur !== cur)) continue;
    const g = a.type === 'crypto' && a.exchange ? 'Crypto · ' + a.exchange : typeGroupName(a.type);
    if (!groups.has(g)) groups.set(g, { o: typeGroupOrder(a.type), list: [] });
    groups.get(g).list.push(a);
  }
  const opt = (a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)} · ${a.cur}</option>`;
  return [...groups.entries()].sort((x, y) => x[1].o - y[1].o || x[0].localeCompare(y[0])).map(([g, v]) =>
    `<optgroup label="${esc(g)}">${v.list.sort((a, b) => (lastUsed.get(b.id) || '').localeCompare(lastUsed.get(a.id) || '') || a.name.localeCompare(b.name)).map(opt).join('')}</optgroup>`).join('');
}
function catOptions(sel, kind) {
  const db = get();
  const groups = new Map();
  for (const c of db.categories) {
    if (c.deleted || !(c.kind === kind || c.kind === 'both')) continue;
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, cs]) =>
    `<optgroup label="${esc(g)}">${cs.sort((a, b) => a.name.localeCompare(b.name)).map((c) =>
      `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
}

export function openEntry(opts = {}) {
  const db = get();
  const existing = opts.id ? db.txs.find((t) => t.id === opts.id) : null;
  const f = existing ? fromTx(existing) : { ...blank(), ...(opts.preset || {}) };
  if (!db.accounts.some((a) => !a.deleted)) {
    toast('Add an account first (Accounts tab), then you can record entries.');
    location.hash = '#/accounts';
    return;
  }
  const s = sheet('<form id="entry" novalidate></form>', { title: existing ? 'Edit entry' : 'New entry', wide: true });
  const form = s.el.querySelector('form');
  form.innerHTML = `
    <div class="seg" id="seg" role="group" aria-label="Entry type"></div>
    <div id="freq" class="qp"></div>
    <div class="field" id="namefield"><span id="namelabel">What was it?</span>
      <input id="f-name" autocomplete="off" value="${esc(f.name)}" placeholder="e.g. Life Tsukagoshi, bus, salary" ${existing ? '' : 'autofocus'}>
      <div id="sugg" class="sugg" hidden></div></div>
    <div class="field amount" id="amountbox"><span class="amtlabel">Amount <button type="button" class="linkbtn eye" data-e="eye" aria-label="Hide or show amounts">${priv.on ? 'Show' : 'Hide'} amounts</button></span>
      <div class="amtrow"><div class="amtwrap"><input id="f-amount" inputmode="${f.calc ? 'none' : 'decimal'}" autocomplete="off" placeholder="0" value="${esc(commasOn() ? withCommas(f.amount) : f.amount)}"><button type="button" class="calcbtn" data-e="calc" aria-label="Calculator" aria-pressed="false" title="Calculator">${ic('calc')}</button></div><span id="curwrap" class="curwrap"></span></div>
      <div id="calcres" class="calcres" hidden></div><div id="keypad" class="keypad" hidden></div></div>
    <div id="fxline"></div>
    <div id="acctrow"></div>
    <div id="convrow"></div>
    <div id="feerow"></div>
    <div id="catrow"></div>
    <div id="triprow"></div>
    <div id="itemsrow"></div>
    <div class="field" id="whenrow"><span>When</span><button type="button" class="whenbtn" id="f-when" data-e="when"></button></div>
    <label class="field" id="notesrow"><span>Notes</span><textarea id="f-notes" rows="2" placeholder="Optional">${esc(f.notes)}</textarea></label>
    <div id="safety" class="safety" aria-live="polite"></div>
    <p class="err" id="err" role="alert" hidden></p>
    <div class="btnrow" id="btns"></div>`;
  const $f = (id) => form.querySelector('#' + id);
  const acctOf = (id) => get().accounts.find((a) => a.id === id);
  const ORDER = {
    flow: ['seg', 'freq', 'namefield', 'amountbox', 'fxline', 'acctrow', 'catrow', 'triprow', 'itemsrow', 'whenrow', 'notesrow', 'safety', 'err', 'btns'],
    transfer: ['seg', 'freq', 'namefield', 'acctrow', 'amountbox', 'convrow', 'fxline', 'feerow', 'whenrow', 'notesrow', 'err', 'btns'],
  };
  function arrange() {
    const ids = f.kind === 'transfer' ? ORDER.transfer : ORDER.flow;
    for (const id of ids) form.appendChild($f(id));
  }

  // ---------- renderers ----------
  function renderSeg() {
    const k = [['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']];
    $f('seg').innerHTML = k.map(([v, l]) => `<button type="button" data-e="kind" data-v="${v}" aria-pressed="${f.kind === v}" class="${f.kind === v ? 'on' : ''}">${l}</button>`).join('');
    $f('namelabel').textContent = f.kind === 'transfer' ? 'Label (optional, remembers the route)' : f.kind === 'income' ? 'Where from?' : 'What was it?';
    $f('f-name').placeholder = f.kind === 'transfer' ? 'e.g. Card payment, Top up Maya' : 'e.g. Life Tsukagoshi, bus, salary';
  }
  // quick picks: tap one and the name, amount, account and category are filled in
  function renderFreq() {
    const el = $f('freq');
    if (existing) { el.innerHTML = ''; return; }
    const db2 = get(), am = accountMap(db2);
    let tabs, chips = '', hint = '';
    if (f.kind === 'transfer') {
      const hints = transferHints(db2);
      tabs = [['routes', 'Usual routes'], ['recent', 'Recent']];
      if (!f.qtab || !tabs.some((t) => t[0] === f.qtab)) f.qtab = 'routes';
      const nm = (id) => (am.get(id) || { name: '?' }).name;
      const routes = hints.routes.filter((r) => am.has(r.from) && am.has(r.to) && !am.get(r.from).deleted && !am.get(r.to).deleted);
      const list = (f.qtab === 'routes' ? routes.sort((a, b) => b.n - a.n) : routes.sort((a, b) => (a.last < b.last ? 1 : -1))).slice(0, 5);
      chips = list.map((r) => `<button type="button" class="chip" data-e="route" data-from="${r.from}" data-to="${r.to}">${esc(nm(r.from))} → ${esc(nm(r.to))}${r.name ? ` <small>${esc(r.name)}</small>` : ''}</button>`).join('');
      hint = chips ? 'Tap a route to fill both accounts, the usual amount and fee.' : 'Routes you use often will show here.';
    } else {
      const amt = num(f.amount), a = acctOf(f.acct);
      tabs = [['usual', 'Usual'], ['recent', 'Recent'], ['fit', amt > 0 ? `Fits ${fmt(amt, a ? a.cur : HOME, { force: !priv.on })}` : 'Fits amount']];
      if (!f.qtabManual) f.qtab = (!f.name.trim() && amt > 0) ? 'fit' : (f.qtab === 'fit' ? 'usual' : (f.qtab || 'usual'));
      const m = modelFor(f.kind);
      let names = [];
      if (f.qtab === 'usual') { const isT = isTransportCat(db2.categories); names = rankRouteNames(db2, isT, freqNames(db2, 90, 14, f.kind), hourOf(f.date)).slice(0, 6).map((n) => ({ name: n })); }
      else if (f.qtab === 'recent') names = recentNames(m, 6);
      else names = byAmount(m, amt, a && a.cur, 6);
      chips = names.map((x) => `<button type="button" class="chip" data-e="pick" data-v="${esc(x.name)}">${esc(x.name)}${x.amount ? ` <small>${esc(fmt(x.amount, a ? a.cur : HOME, { force: !priv.on }).replace(/\.00$/, ''))}</small>` : ''}</button>`).join('');
      hint = f.qtab === 'fit' ? (amt > 0 ? (chips ? 'Names you usually pay about this amount. Tap one to fill the rest.' : 'Nothing matches this amount yet.') : 'Type an amount and your likely entries appear here.') : 'Tap one to fill in the name, amount, account and category.';
    }
    el.innerHTML = `<div class="qptabs" role="tablist" aria-label="Quick picks">${tabs.map(([v, l]) => `<button type="button" role="tab" class="qtab ${f.qtab === v ? 'on' : ''}" aria-selected="${f.qtab === v}" data-e="qtab" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="chips">${chips || ''}</div><span class="qphint">${hint}</span>`;
  }
  function currencies() {
    const cnt = new Set(favCurs());
    for (const a of get().accounts) if (!a.deleted && !a.archived) cnt.add(a.cur);
    const a = acctOf(f.acct); if (a) cnt.add(a.cur);
    return [...cnt];
  }
  function renderCur() {
    const a = acctOf(f.acct), list = currencies(), cur = (a && a.cur) || list[0];
    if (!list.includes(cur)) list.push(cur);
    $f('curwrap').innerHTML = `<button type="button" class="curbtn sm" data-e="curpick" aria-label="Choose currency" title="Currency">${flagOf(cur)} ${cur} ▾</button><select id="f-cur" hidden aria-hidden="true">${list.map((c) => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c}</option>`).join('')}</select>`;
  }
  function updateNamePh() {                                             // a transfer left unnamed will be called "from - to"
    const el = form.querySelector('#f-name'); if (!el) return;
    el.placeholder = f.kind === 'transfer' ? (acctOf(f.acct) && acctOf(f.toAcct) ? `Leave blank: ${acctOf(f.acct).name} - ${acctOf(f.toAcct).name}` : 'Leave blank to use the two account names') : 'e.g. Life Tsukagoshi, bus, salary (blank is filled in for you)';
  }
  function renderAccts() {
    updateNamePh();
    const el = $f('acctrow');
    const a = acctOf(f.acct);
    renderCur();
    if (f.kind !== 'transfer') {
      const sug = f.acctSuggested && !f.acctTouched;
      el.innerHTML = `<div class="field ${sug ? 'suggested' : ''}"><span>Account ${sug ? '<small class="sugnote">suggested from your history  tap to change</small>' : ''}</span><button type="button" class="acctbtn" data-e="acctpick" data-which="acct">${esc((acctOf(f.acct) || { name: 'Choose account' }).name)}${acctOf(f.acct) ? ' · ' + acctOf(f.acct).cur : ''} ▾</button><select id="f-acct" hidden aria-hidden="true">${acctOptions(f.acct, '', '')}</select></div>`;
    } else {
      if (!f.toAcct) { const o = get().accounts.find((x) => !x.deleted && !x.archived && x.id !== f.acct); f.toAcct = o ? o.id : ''; }
      el.innerHTML = `<div class="two sw"><div class="field"><span>From</span><button type="button" class="acctbtn" data-e="acctpick" data-which="acct">${esc((acctOf(f.acct) || { name: 'Choose' }).name)} ▾</button><select id="f-acct" hidden aria-hidden="true">${acctOptions(f.acct, f.toAcct, '')}</select></div>
        <button type="button" class="swapbtn" data-e="swapacct" aria-label="Swap From and To" title="Swap From and To">${ic('swap')}</button>
        <div class="field"><span>To</span><button type="button" class="acctbtn" data-e="acctpick" data-which="to">${esc((acctOf(f.toAcct) || { name: 'Choose' }).name)} ▾</button><select id="f-to" hidden aria-hidden="true">${acctOptions(f.toAcct, f.acct)}</select></div></div>`;
    }
    renderConv();
    renderFee();
    renderSafety();
  }
  // converting between currencies is optional: off means the same number arrives
  function renderConv() {
    const el = $f('convrow');
    const a = acctOf(f.acct), b = acctOf(f.toAcct);
    if (f.kind !== 'transfer' || !a || !b || a.cur === b.cur) { el.innerHTML = ''; f.convert = false; return; }
    if (a.type === 'crypto' && b.type === 'crypto' && !f.convTouched) f.convert = true;   // two coins are never exactly 1:1
    el.innerHTML = `<label class="check"><input type="checkbox" id="f-conv" ${f.convert ? 'checked' : ''}> ${a.type === 'crypto' && b.type === 'crypto' ? `Trade ${a.cur} for ${b.cur} (not 1:1)` : `Convert ${a.cur} to ${b.cur} (use an exchange rate)`}</label>
      ${f.convert ? `<div class="convbox"><div class="fxline one"><label class="fxrate"><span>1 ${a.cur} =</span><input id="f-crate" inputmode="decimal" aria-label="Exchange rate" value="${esc(f.cRate)}"><span>${b.cur}</span></label>
        <label class="fxpeso"><span>Received (${b.cur})</span><input id="f-toamt" inputmode="decimal" value="${esc(f.toAmount)}" placeholder="0"></label></div>
        <button type="button" class="linkbtn" data-e="livecross">Use today’s rate</button> <small class="muted" id="crossnote"></small><small class="hint" id="invrate"></small>${a.type === 'crypto' || b.type === 'crypto' ? '<small class="hint">Add the exchange’s buy or sell fee below (Fee, type “Trading fee”).</small>' : ''}</div>`
        : `<small class="hint">Off: the same number arrives in ${esc(b.name)}. Turn on when the amounts differ, like USDT to PHP.</small>`}`;
  }
  function crossRate() {
    const a = acctOf(f.acct), b = acctOf(f.toAcct); if (!a || !b) return 0;
    const ra = rateFor(get(), a.cur), rb = rateFor(get(), b.cur);
    return ra > 0 && rb > 0 ? ra / rb : 0;
  }
  function syncCross(from) {
    const amt = num(f.amount), cr = $f('f-crate'), ta = $f('f-toamt');
    if (!cr || !ta) return;
    const inv = $f('invrate'); const showInv = () => { const r = num(f.cRate), a2 = acctOf(f.acct), b2 = acctOf(f.toAcct); if (inv) inv.textContent = r > 0 && a2 && b2 ? `1 ${b2.cur} = ${prec(1 / r)} ${a2.cur}` : ''; };
    if (from === 'rate') { const r = num(f.cRate); if (amt > 0 && r > 0) { f.toAmount = String(Math.round(amt * r * 1e6) / 1e6); ta.value = f.toAmount; } }
    else if (from === 'to') { const t = num(f.toAmount); if (amt > 0 && t > 0) { f.cRate = prec(t / amt); cr.value = f.cRate; } }
    else { const r = num(f.cRate); if (amt > 0 && r > 0) { f.toAmount = String(Math.round(amt * r * 1e6) / 1e6); ta.value = f.toAmount; } }
    showInv();
  }
  function renderFx() {
    const a = acctOf(f.acct);
    const el = $f('fxline');
    if (!a || a.cur === HOME || a.cur === BASE) { el.innerHTML = ''; return; }
    if (!f.fx && f.fxMode !== 'peso') { const r = homeFx(get(), a.cur); f.fx = r ? prec(r) : ''; }
    el.innerHTML = `<div class="fxline one"><label class="fxrate"><span>1 ${a.cur} =</span><input id="f-fx" inputmode="decimal" aria-label="Exchange rate" value="${esc(f.fx)}"><span>${HOME}</span></label><span class="fxeq">=</span><span class="amtwrap sm"><b>${(CUR[HOME] || { sym: HOME }).sym}</b><input id="f-peso" inputmode="decimal" autocomplete="off" aria-label="Value in ${HOME}" placeholder="0" value="${esc(f.peso)}"></span></div>
      <small class="fxhint">Type the rate, or the ${HOME} value from your bill: the other follows.</small>`;
    updateFxVal();
  }
  // two-way: whichever of the rate and the home value you typed last is kept, the other follows the amount
  function updateFxVal() {
    const pe = $f('f-peso'), fe = $f('f-fx');
    if (!pe || !fe) return;
    const amt = num(f.amount);
    if (f.fxMode === 'peso') {
      const pv = num(f.peso);
      if (amt > 0 && pv > 0) { f.fx = prec(pv / amt); fe.value = f.fx; }
    } else {
      const x = amt * num(f.fx);
      f.peso = x > 0 ? String(Math.round(x * 100) / 100) : '';
      if (document.activeElement !== pe) pe.value = f.peso;
    }
  }
  // ---- transfer fee (bank service fee, network fee, transfer fee): predicted from earlier transfers ----
  function feeCatOptions(sel) {
    const have = get().categories.filter((c) => !c.deleted && c.group === 'Fees' && (c.kind === 'expense' || c.kind === 'both'));
    const names = ['Transfer fee', 'Trading fee', 'Bank service fee', 'Network fee'].filter((n) => !have.some((c) => c.name === n));
    return `${have.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}${names.map((n) => `<option value="__new:${n}" ${sel === '__new:' + n ? 'selected' : ''}>${n}</option>`).join('')}<optgroup label="Other categories">${catOptions(sel, 'expense')}</optgroup>`;
  }
  function suggestFee() {
    if (f.kind !== 'transfer' || f.feeTouched) return;
    const p = predictFee(get(), f.acct, f.toAcct, num(f.amount) || 0);
    if (!p) { if (f.feeSuggested) { f.fee = ''; f.feeSuggested = false; } return; }
    f.fee = String(p.fee); f.feeCat = p.feeCat; f.feeBy = p.feeBy; f.feeSuggested = true;
  }
  function renderFee() {
    const el = $f('feerow');
    if (f.kind !== 'transfer') { el.innerHTML = ''; return; }
    suggestFee();
    const a = acctOf(f.acct), b = acctOf(f.toAcct);
    if (!a || !b) { el.innerHTML = ''; return; }
    const cur = f.feeBy === 'to' ? b.cur : a.cur;
    const sug = f.feeSuggested && !f.feeTouched;
    el.innerHTML = `<div class="field feebox ${sug ? 'suggested' : ''}"><span>Fee (optional) ${sug ? '<small class="sugnote">usual fee for this route · change if different</small>' : ''}</span>
      <div class="feegrid"><label class="amtwrap sm"><b>${(CUR[cur] || { sym: cur }).sym}</b><input id="f-fee" inputmode="decimal" autocomplete="off" aria-label="Fee" placeholder="0" value="${esc(f.fee)}"></label>
      <select id="f-feecat" aria-label="Fee type">${f.feeCat ? '' : '<option value="">Fee type</option>'}${feeCatOptions(f.feeCat)}</select></div>
      <div class="seg sm" role="group" aria-label="Who pays the fee">
        <button type="button" data-e="feeby" data-v="from" class="${f.feeBy !== 'to' ? 'on' : ''}" aria-pressed="${f.feeBy !== 'to'}">Taken from sender (${esc(a.name)})</button>
        <button type="button" data-e="feeby" data-v="to" class="${f.feeBy === 'to' ? 'on' : ''}" aria-pressed="${f.feeBy === 'to'}">Taken from receiver (${esc(b.name)})</button></div></div>`;
  }
  function topCats(kind, n) {
    const m = modelFor(kind);
    return [...m.classes.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, n).map(([id]) => ({ id, p: 0 }));
  }
  function candidates() { return f.name.trim() ? catCandidates(modelFor(f.kind), get().categories, f.name, f.kind, 6) : []; }
  function renderCats() {
    const el = $f('catrow');
    if (f.kind === 'transfer') { el.innerHTML = ''; return; }
    const cm = catMap(get());
    const typed = f.name.trim(), short = typed.length < 3;
    const cands = candidates().filter((x) => cm.has(x.id));
    const pl = (f.pred && f.pred.cats.length && typed) ? f.pred.cats.slice() : [];
    let list = typed ? (short ? [...cands, ...pl] : [...pl, ...cands]) : topCats(f.kind, 4);
    const seen = new Set(); list = list.filter((x) => !seen.has(x.id) && seen.add(x.id));
    if (f.cat && !list.some((x) => x.id === f.cat)) list.unshift({ id: f.cat, p: 0 });
    list = list.filter((x) => cm.has(x.id)).slice(0, 6);
    const guess = typed && !f.catTouched && f.cat && (f.guessWhy || (f.pred && f.pred.cats[0] ? `${Math.round(f.pred.cats[0].p * 100)}% sure` : ''));
    const nofit = typed.length >= 2 && !cands.length && !(f.pred && f.pred.cats.length && f.pred.conf >= 0.35);
    el.innerHTML = `<div class="field"><span>Category ${guess ? `<small class="muted">· guessed: ${esc(f.guessWhy || guess)}</small>` : ''}</span>
      ${guess && f.pred && f.pred.via ? `<small class="muted via">Matched through: ${esc(explain({ path: f.pred.via.path }))}</small>` : ''}
      <div class="chips">${list.map((x) => { const c = cm.get(x.id); return ` <button type="button" class="chip cat ${f.cat === x.id ? 'on' : ''} ${guess && f.cat === x.id ? 'guess' : ''}" data-e="cat" data-v="${x.id}"><i style="background:${groupColor(c.group)}">${groupLetter(c.group)}</i>${esc(c.name)}</button>`; }).join('')}
      <button type="button" class="chip more" data-e="allcats">All</button>
      <button type="button" class="chip more" data-e="newcat">+ New</button></div>
      ${nofit ? `<button type="button" class="linkbtn nofit" data-e="newcat">No category fits “${esc(typed.slice(0, 24))}”. Add it as a new category</button>` : ''}</div>`;
  }
  function itemSum() { return f.items.reduce((s2, i) => s2 + (num(i.amt) || 0), 0); }
  function renderItems() {
    const el = $f('itemsrow');
    if (f.kind !== 'expense') { el.innerHTML = ''; return; }
    if (!f.showItems) { el.innerHTML = `<button type="button" class="linkbtn split" data-e="items-on">${ic('split')} Split into items (groceries, receipts)</button>`; return; }
    el.innerHTML = `<div class="field items"><span>Items on this receipt</span>
      <div id="itemlist">${f.items.map((it, i) => `<div class="item" data-i="${i}">
        <input class="in-n" placeholder="Item" value="${esc(it.n)}" aria-label="Item name">
        <input class="in-a" inputmode="decimal" placeholder="0.00" value="${esc(it.amt)}" aria-label="Item price">
        <select class="in-c" aria-label="Item category"><option value="">Same as above</option>${catOptions(it.cat, 'expense')}</select>
        <button type="button" class="iconbtn" data-e="item-del" data-v="${i}" aria-label="Remove item">${ic('x')}</button></div>`).join('')}</div>
      <div class="itemfoot"><button type="button" class="linkbtn" data-e="item-add">+ Add item</button><span id="itemleft"></span></div></div>`;
    updateItemLeft();
  }
  function updateItemLeft() {
    const el = $f('itemleft'); if (!el) return;
    const a = acctOf(f.acct); const total = num(f.amount) || 0; const left = total - itemSum();
    const cur = a ? a.cur : HOME;
    el.className = Math.abs(left) < 0.005 ? 'ok' : 'off';
    el.textContent = Math.abs(left) < 0.005 ? 'Items add up to the total' : (left > 0 ? `${fmt(left, cur)} not assigned yet` : `Items are ${fmt(-left, cur)} over the total`);
  }
  function renderWhen() { $f('f-when').innerHTML = `<span>${esc(prettyDate(f.date))}</span>${ic('calendar')}`; }
  function renderBtns() {
    $f('btns').innerHTML = `${existing ? `<button type="button" class="btn danger ghost" data-e="del">Delete</button>` : ''}
      ${existing ? '' : `<button type="button" class="btn ghost" data-e="save-again">Save and add another</button>`}
      <button type="button" class="btn" data-e="save">Save</button>`;
  }
  // warnings: budget and spending limit, income, card bills, cash for upcoming payments
  let safeTimer;
  function renderSafety() {
    clearTimeout(safeTimer);
    safeTimer = setTimeout(() => {
      const el = $f('safety'); if (!el) return;
      if (f.kind !== 'expense') { el.innerHTML = ''; return; }
      const cm = catMap(get()), c = cm.get(f.cat);
      const list = safetyCheck(get(), { amount: num(f.amount), acctId: f.acct, kind: f.kind, date: f.date, group: c ? c.group : '' });
      el.innerHTML = list.map((x) => `<div class="sf ${x.level}" role="${x.level === 'danger' ? 'alert' : 'note'}"><strong>${x.level === 'danger' ? 'Careful: ' : x.level === 'warn' ? 'Heads up: ' : ''}</strong>${esc(x.text)}</div>`).join('');
    }, 120);
  }

  // ---------- prediction ----------
  function refreshPred() {
    if (f.kind === 'transfer') return;
    const a = acctOf(f.acct);
    f.pred = predict(modelFor(f.kind), f.name, num(f.amount) || 0, { acct: f.acct, cur: a && a.cur, hour: hourOf(f.date) });
    if (!f.catTouched && f.name.trim()) {
      const cands = candidates(), typed = f.name.trim();
      if (typed.length >= 3 && f.pred.cats[0] && f.pred.conf >= 0.3) { f.cat = f.pred.cats[0].id; f.guessWhy = ''; }
      else if (cands[0]) { f.cat = cands[0].id; f.guessWhy = cands[0].why; }
      else if (f.pred.cats[0]) { f.cat = f.pred.cats[0].id; f.guessWhy = ''; }
    }
    typedTransport();
    renderSmart();
    renderCats();
    if (tripCat() !== tripShown) renderTrip();
    renderSafety();
  }
  function renderSugg() {
    const el = $f('sugg');
    let list;
    if (f.kind === 'transfer') {
      const q = f.name.trim().toLowerCase();
      const am = accountMap(get());
      list = q ? transferHints(get()).names.filter((x) => x.name.toLowerCase().includes(q) && x.name.toLowerCase() !== q).sort((a, b) => b.n - a.n).slice(0, 5)
        .map((x) => ({ name: x.name, n: x.n, route: `${(am.get(x.from) || {}).name || '?'} → ${(am.get(x.to) || {}).name || '?'}` })) : [];
    } else list = suggest(modelFor(f.kind), f.name, 5).filter((x) => x.name.toLowerCase() !== f.name.trim().toLowerCase());
    el.hidden = !list.length;
    const an = (id) => (acctOf(id) || {}).name || '';
    el.innerHTML = list.map((x) => `<button type="button" data-e="pick" data-v="${esc(x.name)}">${esc(x.name)} <small>${x.route ? esc(x.route) + ' · ' : (an(x.acct) ? esc(an(x.acct)) + ' · ' : '')}${x.n}×</small></button>`).join('');
  }
  // while typing: guess the account you usually pay that name with (shown highlighted until you choose one yourself)
  function suggestAcct() {
    if (f.kind === 'transfer' || f.acctTouched || existing || !f.name.trim()) return;
    const sg = suggest(modelFor(f.kind), f.name, 1)[0];
    if (!sg || !sg.acct) return;
    const a = acctOf(sg.acct);
    if (!a || a.archived) return;
    if (sg.acct === f.acct) { if (!f.acctSuggested) { f.acctSuggested = true; renderAccts(); } return; }
    f.acct = sg.acct; f.acctSuggested = true; f.fx = ''; f.fxMode = 'rate'; f.peso = '';
    renderAccts(); renderFx();
  }
  function useAccount(id) { f.acct = id; f.acctSuggested = true; f.fx = ''; f.fxMode = 'rate'; f.peso = ''; renderAccts(); renderFx(); }
  // remember what the app guessed when you pick something else: a fixed guess teaches the model more
  // ---------- trips: optional From / To for public transport ----------
  const tripCat = () => { if (f.kind !== 'expense') return false; if (transportWord(f.name)) return true; return !!f.cat && isTransportCat(get().categories)(f.cat); };
  // typing "bus" or "MRT" means a trip: move to a transport category (unless you picked one yourself) and show From / To
  let tripShown = false;
  function typedTransport() {
    if (f.kind !== 'expense' || f.catTouched || !transportWord(f.name)) return;
    const cats = get().categories.filter((c) => !c.deleted && c.kind !== 'income'), isT = isTransportCat(get().categories);
    if (f.cat && isT(f.cat)) return;
    const w = (String(f.name).toLowerCase().match(/bus|mrt|lrt|jeep|train|tricycle|taxi|grab|ferry|metro|subway/) || [''])[0];
    const c = (w && cats.find((x) => isT(x.id) && x.name.toLowerCase().includes(w))) || cats.find((x) => x.group === 'Transportation') || cats.find((x) => isT(x.id));
    if (c) { f.cat = c.id; f.guessWhy = 'you typed a transport word'; }
  }
  // where the last trip you entered today ended: you are probably there now. Entry ORDER counts, not the clock time, so a night of catching up
  // ("Shibuya - Harajuku" then "Harajuku - Shibuya") still chains correctly.
  function prevTrip() {
    const day = String(f.date).slice(0, 10), isT = isTransportCat(get().categories), txs = get().txs; let best = '';
    const stop = existing ? txs.findIndex((t) => t.id === existing.id) : txs.length;
    for (let i = 0; i < (stop < 0 ? txs.length : stop); i++) { const t = txs[i]; if (t.deleted || t.kind !== 'expense' || !isT(t.cat) || String(t.date).slice(0, 10) !== day) continue; const r = parseRoute(t.name) || (t.from && t.to ? { to: t.to } : null); if (r) best = r.to; }
    return best;
  }
  const modeNow = () => modeOf(f.name, (catMap(get()).get(f.cat) || {}).name);
  function tripName() {
    if (f.from.trim() && f.to.trim() && (!f.name.trim() || f.name === f.autoName || parseRoute(f.name) || bareMode(f.name))) { f.name = tripLabel(modeNow(), f.from, f.to); f.autoName = f.name; $f('f-name').value = f.name; refreshPred(); renderSugg(); renderNameHelp(); }
    if (f.from.trim() && f.to.trim() && !f.catTouched) { const x = suggestTrips(get(), isTransportCat(get().categories), { hour: hourOf(f.date), from: f.from, to: f.to, limit: 1 })[0]; if (x && x.cat && x.cat !== f.cat) { f.cat = x.cat; f.guessWhy = 'your usual for this trip'; renderCats(); } }
  }
  function pickTrip(x) {
    f.from = x.from; f.to = x.to; if (!f.name.trim() || f.name === f.autoName || parseRoute(f.name) || bareMode(f.name)) { f.name = tripLabel(modeNow(), x.from, x.to); f.autoName = f.name; $f('f-name').value = f.name; }
    if (x.cat && (!f.catTouched || !tripCat())) { f.cat = x.cat; f.catTouched = false; f.guessWhy = 'your usual for this trip'; }
    if (!num(f.amount) && x.amount) { f.amount = String(x.amount); $f('f-amount').value = f.amount; updateFxVal && updateFxVal(); }
    refreshPred(); renderCats(); renderTrip(); renderSugg();
  }
  function tripChips() {
    const el = form.querySelector('#tripchips'); if (!el) return;
    const db2 = get(), isT = isTransportCat(db2.categories), cm = catMap(db2), both = f.from.trim() && f.to.trim();
    const list = both ? [] : suggestTrips(db2, isT, { hour: hourOf(f.date), from: f.from, to: f.to, prevTo: prevTrip() });
    f._trips = list;
    const guess = list[0] && !f.to.trim() ? list[0].to : '', inp = form.querySelector('#f-to'); if (inp) inp.placeholder = guess ? `${guess}?` : 'To';
    el.innerHTML = list.length ? `<small class="muted">${f.from.trim() ? 'Where to from ' + esc(f.from.trim()) + '?' : 'Likely trips now'}</small><div class="chips">${list.map((x, i) => `<button type="button" class="chip" data-e="trip" data-v="${i}">${esc(x.from)} → ${esc(x.to)} <small>${esc((cm.get(x.cat) || {}).name || '')} · ${Math.round(x.p * 100)}%</small></button>`).join('')}</div>` : '';
  }
  function renderTrip() {
    tripShown = tripCat();
    const el = $f('triprow'); if (!tripCat()) { el.innerHTML = ''; return; }
    const r = parseRoute(f.name); if (!f.from && !f.to && r) { f.from = r.from; f.to = r.to; }
    const places = [...routeStats(get(), isTransportCat(get().categories)).places.values()].sort((a, b) => b.n - a.n).slice(0, 40);
    el.innerHTML = `<div class="field trip"><span>Trip <small class="muted">· optional</small></span>
      <div class="tripin"><input id="f-from" list="placelist" placeholder="From" value="${esc(f.from)}" autocomplete="off" aria-label="From"><b aria-hidden="true">→</b><input id="f-to" list="placelist" placeholder="To" value="${esc(f.to)}" autocomplete="off" aria-label="To"></div>
      <datalist id="placelist">${places.map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist><div id="tripchips"></div></div>`;
    tripChips();
  }
  function pickCat(id) { const nm = $f('f-name'); if (nm && nm.value !== f.name) f.name = nm.value; if (!f.catTouched && f.cat && f.cat !== id) f.guessed = f.cat; f.cat = id; f.catTouched = true; }

  // a new name that looks like one you already use: ask, remember the answer
  // labels like "Loan Payment", "Credit Card Payment", "Credit to Cash" point to a different kind of entry: offer it (never switches by itself)
  function renderSmart() {
    let el = form.querySelector('#smarthint');
    if (!el) { const nf = $f('namefield'); if (!nf) return; el = document.createElement('div'); el.id = 'smarthint'; nf.after(el); }
    const k = smartKind(f.name); let html = '';
    if (k === 'cash') html = `<button type="button" class="chip" data-e="smart" data-v="cash">Credit to cash: see the fees and interest first</button>`;
    else if (k === 'loan') html = `<button type="button" class="chip" data-e="smart" data-v="loan">Taking a loan? Open the loan planner</button>`;
    else if ((k === 'cardpay' || k === 'loanpay') && f.kind !== 'transfer') html = `<button type="button" class="chip" data-e="smart" data-v="${k}">This is money moving to ${k === 'cardpay' ? 'your card' : 'your loan'}: record it as a transfer</button>`;
    el.innerHTML = html ? `<div class="chips">${html}</div>` : '';
  }
  function smartAct(v) {
    if (v === 'cash') return openLoanPlanner({ kind: 'cash' });
    if (v === 'loan') return openLoanPlanner({ kind: 'personal' });
    const accts = get().accounts.filter((a) => !a.deleted && !a.archived), t = accts.filter((a) => (v === 'cardpay' ? a.type === 'card' : a.type === 'loan' || a.loan) && a.id !== f.acct).sort((x, y) => (y.loan ? 1 : 0) - (x.loan ? 1 : 0))[0];
    form.querySelector('[data-e=kind][data-v=transfer]').click();
    if (t) { f.toAcct = t.id; if (!num(f.amount) && t.loan && t.loan.monthly) { f.amount = String(t.loan.monthly); $f('f-amount').value = f.amount; } renderAccts(); renderFx(); syncCross(); }
  }
  function renderNameHelp() {
    let el = form.querySelector('#namehelp');
    if (!el) { const nf = $f('namefield'); if (!nf) return; el = document.createElement('div'); el.id = 'namehelp'; el.className = 'namehelp'; nf.after(el); }
    const c = f.kind === 'transfer' ? [] : similarNames(get(), f.name, 1);
    const rel = f.kind === 'transfer' || !f.name.trim() ? [] : relatedNames(get(), f.name).slice(0, 2);
    el.innerHTML = c.map((x) => compareCard(get(), f.name.trim(), x.name)).join('') + (c.length ? '' : rel.map((x) => `<p class="relhint muted">Related to <b>${esc(x.name)}</b>${x.cat ? ` (${esc(x.cat)})` : ''}, ${Math.round(x.w * 100)}% close. It keeps its own category.</p>`).join(''));
  }
  function applyPick(name) {
    f.name = name; $f('f-name').value = name;
    if (f.kind === 'transfer') {
      const h = transferHints(get()).names.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (h) {
        if (acctOf(h.from) && !acctOf(h.from).archived) { f.acct = h.from; f.acctTouched = true; }
        if (acctOf(h.to) && !acctOf(h.to).archived) f.toAcct = h.to;
        if (!num(f.amount) && h.amount) { f.amount = String(h.amount); $f('f-amount').value = f.amount; }
        f.feeTouched = false; renderAccts(); renderFx(); syncCross();
      }
      renderSugg(); renderFreq();
      return;
    }
    const lk = lookup(modelFor(f.kind), name);
    if (lk) {
      if (!f.catTouched) f.cat = lk.cat;
      if (!f.acctTouched && lk.acct && acctOf(lk.acct) && !acctOf(lk.acct).archived) useAccount(lk.acct);
      if (!num(f.amount) && lk.amount) { f.amount = String(lk.amount); $f('f-amount').value = f.amount; }
    }
    refreshPred(); renderSugg(); updateFxVal(); updateItemLeft(); renderFreq();
    $f(num(f.amount) ? 'f-name' : 'f-amount').focus();
  }
  function pickRoute(from, to) {
    const h = transferHints(get()).routes.find((r) => r.from === from && r.to === to);
    f.acct = from; f.toAcct = to; f.acctTouched = true; f.feeTouched = false;
    if (h) { if (!f.name.trim() && h.name) { f.name = h.name; $f('f-name').value = h.name; } if (!num(f.amount) && h.amount) { f.amount = String(h.amount); $f('f-amount').value = f.amount; } }
    renderAccts(); renderFx(); syncCross(); renderSugg();
    $f(num(f.amount) ? 'f-name' : 'f-amount').focus();
  }

  // ---------- events ----------
  form.addEventListener('focusout', (e) => { if (e.target.id === 'f-amount') formatAmountInput(e.target); });
  form.addEventListener('input', (e) => {
    const id = e.target.id;
    if (id === 'f-amount') {
      formatAmountInput(e.target); f.amount = e.target.value; updateFxVal(); updateItemLeft(); showCalcRes(); if (f.name.trim()) refreshPred(); else renderSafety();
      if (f.kind === 'transfer') { if (!f.feeTouched) { suggestFee(); const fe = $f('f-fee'); if (fe) fe.value = f.fee; } if (f.convert) syncCross('rate'); }
      else if (!f.qtabManual || f.qtab === 'fit') renderFreq();
    }
    else if (id === 'f-fee') { f.fee = e.target.value; f.feeTouched = true; f.feeSuggested = false; }
    else if (id === 'f-from' || id === 'f-to') { if (id === 'f-from') f.from = e.target.value; else f.to = e.target.value; tripName(); tripChips(); }
    else if (id === 'f-name') { f.name = e.target.value; renderNameHelp(); suggestAcct(); refreshPred(); renderSugg(); if (f.kind !== 'transfer' && !f.qtabManual) renderFreq(); }
    else if (id === 'f-fx') { f.fx = e.target.value; f.fxMode = 'rate'; updateFxVal(); }
    else if (id === 'f-peso') { f.peso = e.target.value; f.fxMode = 'peso'; updateFxVal(); }
    else if (id === 'f-crate') { f.cRate = e.target.value; syncCross('rate'); }
    else if (id === 'f-toamt') { f.toAmount = e.target.value; syncCross('to'); }
    else if (id === 'f-notes') f.notes = e.target.value;
    else if (e.target.closest('.item')) {
      const row = e.target.closest('.item'), i = +row.dataset.i, it = f.items[i];
      if (e.target.classList.contains('in-n')) {
        it.n = e.target.value;
        if (!it.catTouched) {
          const p = predict(modelFor('expense'), it.n, num(it.amt) || 0, {});
          const sel = row.querySelector('.in-c');
          if (p.cats[0] && it.n.trim().length > 2 && p.conf > 0.35) { it.cat = p.cats[0].id; sel.value = it.cat; } else { it.cat = ''; sel.value = ''; }
        }
      } else if (e.target.classList.contains('in-a')) { it.amt = e.target.value; updateItemLeft(); }
    }
  });
  async function newAccountFor(cur) {
    const nm = await promptDialog(`Name for your new ${cur} account`, `${cur} wallet`, { okLabel: 'Create' });
    if (!nm || !nm.trim()) return null;
    let acc;
    commit((d) => { acc = stamp({ id: uid(), name: nm.trim(), cur, type: cur === 'USDT' || /^(BTC|ETH|BNB|SOL|XRP|USDC)$/.test(cur) ? 'crypto' : 'bank', open: 0, include: true, archived: false }); d.accounts.push(acc); });
    return acc;
  }
  form.addEventListener('change', async (e) => {
    const id = e.target.id;
    if (id === 'f-acct') { f.acct = e.target.value; f.acctTouched = true; f.acctSuggested = false; f.fx = ''; f.fxMode = 'rate'; f.peso = ''; if (f.kind === 'transfer' && f.toAcct === f.acct) f.toAcct = ''; renderAccts(); renderFx(); refreshPred(); updateItemLeft(); if (f.kind !== 'transfer') renderFreq(); }
    else if (id === 'f-to') { f.toAcct = e.target.value; f.feeTouched = f.feeTouched && !f.feeSuggested; renderAccts(); syncCross(); }
    else if (id === 'f-conv') {
      f.convTouched = true;
      f.convert = e.target.checked;
      if (f.convert && !f.cRate) { const r = crossRate(); if (r) f.cRate = prec(r); }
      renderConv(); syncCross('rate');
      const note = $f('crossnote'); if (note && f.convert) note.textContent = crossRate() ? '' : 'No rate known for this pair yet. Type one.';
    }
    else if (id === 'f-cur') {
      const cur = e.target.value, db2 = get();
      const choose = async (c) => {
        const pool = db2.accounts.filter((a) => !a.deleted && !a.archived && a.cur === c && a.id !== (f.kind === 'transfer' ? f.toAcct : ''));
        let pick = pool.find((a) => a.id === db2.settings.lastAcct) || pool.find((a) => a.include) || pool[0];
        if (!pick) pick = await newAccountFor(c);
        if (pick) { f.acct = pick.id; f.acctTouched = true; f.acctSuggested = false; f.fx = ''; f.fxMode = 'rate'; f.peso = ''; if (f.toAcct === f.acct) f.toAcct = ''; }
        renderAccts(); renderFx(); refreshPred(); updateItemLeft(); renderFreq();
      };
      if (cur === '__more') { renderCur(); openCurrencyPicker((c) => choose(c), { title: 'More currencies' }); }
      else await choose(cur);
    }
    else if (id === 'f-feecat') { f.feeCat = e.target.value; f.feeTouched = true; f.feeSuggested = false; renderFee(); }
    else if (e.target.classList.contains('in-c')) { const it = f.items[+e.target.closest('.item').dataset.i]; it.cat = e.target.value; it.catTouched = true; }
  });
  form.addEventListener('focusout', (e) => {
    if (e.target.id === 'f-amount' && isExpr(f.amount) && !f.calc) { const v = num(f.amount); if (v > 0) { f.amount = tidy(v); e.target.value = f.amount; showCalcRes(); updateFxVal(); } }
  });
  form.addEventListener('focusout', () => setTimeout(() => { const el = $f('sugg'); if (el && !el.contains(document.activeElement)) el.hidden = true; }, 150));
  form.addEventListener('submit', (e) => { e.preventDefault(); save(false); });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-e]');
    if (!b) return;
    const v = b.dataset.v;
    switch (b.dataset.e) {
      case 'kind':
        f.kind = v; if (v !== 'expense') { f.items = []; f.showItems = false; }
        f.qtab = ''; f.qtabManual = false;
        if (!f.catTouched || v === 'transfer') { f.cat = ''; f.catTouched = false; }
        else { const c = catMap(get()).get(f.cat); if (c && !(c.kind === v || c.kind === 'both')) { f.cat = ''; f.catTouched = false; } }
        arrange(); renderSeg(); renderFreq(); renderAccts(); renderFx(); refreshPred(); renderCats(); renderItems(); renderSugg(); renderSafety(); break;
      case 'swapacct': { const t = f.acct; f.acct = f.toAcct; f.toAcct = t; f.acctTouched = true; f.acctSuggested = false; f.feeTouched = false; f.fx = ''; f.fxMode = 'rate'; f.peso = ''; f.cRate = ''; renderAccts(); renderFx(); syncCross(); renderSugg(); break; }
      case 'smart': smartAct(v); break;
      case 'qtab': f.qtab = v; f.qtabManual = true; renderFreq(); break;
      case 'pick': applyPick(v); break;
      case 'acctpick': { const to = b.dataset.which === 'to', sel = $f(to ? 'f-to' : 'f-acct'), a = acctOf(f.acct);
        openAccountPicker({ selected: sel.value, skip: to ? f.acct : (f.kind === 'transfer' ? f.toAcct : ''), cur: to ? '' : (a && a.cur) || '', title: to ? 'To account' : f.kind === 'transfer' ? 'From account' : 'Account' }, (id) => { sel.value = id; sel.dispatchEvent(new Event('change', { bubbles: true })); }); break; }
      case 'curpick': openCurrencyPicker((c) => { const sel = $f('f-cur'); if (![...sel.options].some((o) => o.value === c)) sel.add(new Option(c, c)); sel.value = c; sel.dispatchEvent(new Event('change', { bubbles: true })); }, { title: 'Currency' }); break;
      case 'route': pickRoute(b.dataset.from, b.dataset.to); break;
      case 'calc': f.calc = !f.calc; renderKeypad(); break;
      case 'k': keyPress(v); break;
      case 'when': openDatePicker(f.date, (val) => { f.date = val; renderWhen(); refreshPred(); renderSafety(); }, { title: 'When was it?' }); break;
      case 'livecross': { const r = crossRate(); if (r) { f.cRate = prec(r); const cr = $f('f-crate'); if (cr) cr.value = f.cRate; syncCross('rate'); } else toast('No live rate for this pair yet. Type one.'); break; }
      case 'feeby': f.feeBy = v; f.feeTouched = true; f.feeSuggested = false; renderFee(); break;
      case 'cat': pickCat(v); renderCats(); renderTrip(); renderSafety(); break;
      case 'trip': { const x = (f._trips || [])[+v]; if (x) pickTrip(x); break; }
      case 'eye': priv.set(!priv.on); applyHide(); b.textContent = (priv.on ? 'Show' : 'Hide') + ' amounts'; updateFxVal(); updateItemLeft(); window.dispatchEvent(new Event('sukli-render')); break;
      case 'newcat': openCategoryForm({ kind: f.kind, name: f.name.trim().replace(/\b\w/g, (m) => m.toUpperCase()).slice(0, 40), keywords: f.name.trim().toLowerCase(), onDone: (c) => { pickCat(c.id); refreshPred(); renderCats(); } }); break;
      case 'allcats': openCategoryPicker(f.kind, (id) => { pickCat(id); renderCats(); }); break;
      case 'items-on': f.showItems = true; if (!f.items.length) f.items.push({ n: '', amt: '', cat: '' }); renderItems(); break;
      case 'item-add': f.items.push({ n: '', amt: '', cat: '' }); renderItems(); form.querySelectorAll('.item .in-n')[f.items.length - 1].focus(); break;
      case 'item-del': f.items.splice(+v, 1); renderItems(); break;
      case 'save': save(false); break;
      case 'save-again': save(true); break;
      case 'del': {
        const t = get().txs.find((x) => x.id === f.id);
        commit(() => { softDelete(t); });
        s.close();
        toast('Moved to the recycle bin', { undo: () => commit(() => { t.deleted = false; delete t.deletedAt; stamp(t); }) });
        break;
      }
    }
  });

  // ---------- calculator (opens under the amount; the phone keyboard stays away) ----------
  function showCalcRes() {
    const el = $f('calcres'), v = num(f.amount);
    const show = isExpr(f.amount) && v > 0;
    el.hidden = !show;
    if (show) { const a = acctOf(f.acct); el.textContent = '= ' + fmt(v, a ? a.cur : HOME, { force: !priv.on }); }
  }
  function renderKeypad() {
    const kp = $f('keypad'), amt = $f('f-amount');
    form.querySelector('.calcbtn').setAttribute('aria-pressed', String(f.calc));
    kp.hidden = !f.calc;
    amt.setAttribute('inputmode', f.calc ? 'none' : 'decimal');
    if (!f.calc) { amt.focus(); return; }
    kp.innerHTML = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '='].map((k) =>
      `<button type="button" data-e="k" data-v="${k}" class="${/[÷×−+=]/.test(k) ? 'op' : ''} ${k === '=' ? 'eq' : ''}">${k}</button>`).join('');
    amt.blur();
  }
  function keyPress(k) {
    const amt = $f('f-amount');
    if (k === 'C') f.amount = '';
    else if (k === '⌫') f.amount = f.amount.slice(0, -1);
    else if (k === '=') { const v = num(f.amount); if (v > 0) f.amount = tidy(v); }
    else f.amount += k;
    amt.value = f.amount; showCalcRes(); updateFxVal(); updateItemLeft();
    if (f.name.trim()) refreshPred(); else renderSafety();
    if (f.kind === 'transfer') { if (!f.feeTouched) { suggestFee(); const fe = $f('f-fee'); if (fe) fe.value = f.fee; } if (f.convert) syncCross('rate'); }
    else if (!f.qtabManual || f.qtab === 'fit') renderFreq();
  }

  function fail(msg) { const el = $f('err'); el.textContent = msg; el.hidden = false; el.scrollIntoView({ block: 'nearest' }); }

  function save(again) {
    const db2 = get();
    const a = acctOf(f.acct);
    const amount = +num(f.amount).toFixed(6);
    if (!(amount > 0)) return fail('Enter an amount greater than zero.');
    if (!a) return fail('Choose an account.');
    // fx is kept with the entry as ledger value per unit, so later rate changes never alter this entry
    let fx = 1;
    if (a.cur === BASE) fx = 1;
    else if (a.cur === HOME) fx = homeRate(db2, f.date);
    else {
      const hr = homeRate(db2, f.date);
      let fh = num(f.fx);
      if (f.fxMode === 'peso' && num(f.peso) > 0) fh = num(f.peso) / amount;
      if (!(fh > 0)) return fail(`Enter the exchange rate (how many ${HOME} one ${a.cur} is worth).`);
      fx = fh * hr;
    }
    let toAmount = null;
    if (f.kind === 'transfer') {
      const b = acctOf(f.toAcct);
      if (!b || b.id === a.id) return fail('Choose two different accounts.');
      toAmount = a.cur === b.cur || !f.convert ? amount : +num(f.toAmount).toFixed(6);
      if (!(toAmount > 0)) return fail(`Enter how much arrived in ${b.name} (${b.cur}).`);
    }
    let fee = 0, feeCat = '', feeFx = null, feeCur = '';
    if (f.kind === 'transfer' && num(f.fee) > 0) {
      fee = +num(f.fee).toFixed(6);
      if (!f.feeCat) return fail('Choose what kind of fee it is (transfer fee, bank service fee, network fee…).');
      const fa = f.feeBy === 'to' ? acctOf(f.toAcct) : a;
      feeCur = fa.cur;
      feeFx = fa.cur === BASE ? 1 : (fa.id === a.id ? fx : rateFor(db2, fa.cur)) || 1;
    }
    let cat = f.cat, flag = null, items;
    if (f.kind !== 'transfer') {
      if (!cat) {
        let c; commit((d) => { c = findOrAddCategory(d, 'Others', 'Uncategorized', f.kind); });
        cat = c.id; flag = 'review';
      } else if (!f.catTouched && !existing && f.pred && f.pred.conf < 0.6 && f.name.trim() && modelFor(f.kind).total > 0) flag = 'review';
    } else cat = '';
    if (f.kind === 'expense') {
      items = f.items.filter((i) => i.n.trim() || num(i.amt)).map((i) => ({ n: i.n.trim(), amt: num(i.amt) || 0, cat: i.cat || '' }));
      if (items.length && Math.abs(items.reduce((s2, i) => s2 + i.amt, 0) - amount) >= 0.01) flag = 'review';
    }
    // a blank label is filled in: a transfer gets "from - to", other entries get the usual label for this category and amount, and go to Review
    let label = f.name.trim(), autoName = false;
    if (f.kind === 'expense' && tripCat() && label && bareMode(label)) {      // only "bus" was typed: name the trip
      const mode = modeNow(); label = tripLabel(mode, f.from.trim(), f.to.trim()); autoName = true;
    } else if (!label && f.kind === 'expense' && tripCat() && !(f.from.trim() && f.to.trim())) { label = tripLabel(modeNow(), '', ''); autoName = true; }
    if (!label) {
      autoName = true;
      if (f.kind === 'transfer') label = transferLabel(a, acctOf(f.toAcct));
      else if (f.kind === 'expense' && tripCat() && f.from.trim() && f.to.trim()) label = tripLabel(modeNow(), f.from.trim(), f.to.trim());
      else if (f.kind === 'expense' && tripCat() && (() => { const x = suggestTrips(db2, isTransportCat(db2.categories), { hour: hourOf(f.date), prevTo: prevTrip(), limit: 1 })[0]; if (x && x.p >= 0.4) { label = x.name; if (!f.from.trim() && !f.to.trim()) { f.from = x.from; f.to = x.to; } return true; } return false; })()) flag = 'review';
      else { label = guessLabel(db2, { kind: f.kind, cat, amount, acct: a.id, hour: hourOf(f.date) }).name; flag = 'review'; }
    }
    const rec = { kind: f.kind, amount, cur: a.cur, fx, date: f.date, name: label, autoName, cat, acct: a.id,
      toAcct: f.kind === 'transfer' ? f.toAcct : '', toAmount, fee, feeBy: fee ? f.feeBy : '', feeFx, feeCur, notes: f.notes.trim(), items: items && items.length ? items : [], flag };
    if (f.kind !== 'transfer' && cat && ((f.catTouched && f.guessed && f.guessed !== cat) || (existing && existing.cat && existing.cat !== cat) || (existing && existing.corrected))) rec.corrected = true;
    if (f.kind === 'expense' && tripCat() && f.from.trim() && f.to.trim()) { rec.from = f.from.trim(); rec.to = f.to.trim(); } else if (existing && (existing.from || existing.to)) { rec.from = ''; rec.to = ''; }
    let savedAs;
    commit((d) => {
      if (fee) {
        if (f.feeCat.startsWith('__new:')) rec.feeCat = findOrAddCategory(d, 'Fees', f.feeCat.slice(6), 'expense').id;
        else rec.feeCat = f.feeCat;
      } else rec.feeCat = '';
      if (existing) { const t = d.txs.find((x) => x.id === existing.id); Object.assign(t, rec); stamp(t); savedAs = t; }
      else { savedAs = stamp({ id: uid(), ...rec }); d.txs.push(savedAs); }
      d.settings.lastAcct = a.id;
    });
    s.close();
    toast(rec.flag === 'review' ? 'Saved. It is in Review so you can confirm the category later.' : 'Saved');
    if (again) openEntry({ preset: { acct: a.id } });
  }

  arrange(); renderSeg(); renderFreq(); renderAccts(); renderFx(); renderItems(); renderWhen(); renderBtns(); renderSafety();
  if (existing) { refreshPred(); f.cat = existing.cat || ''; renderCats(); } else renderCats();
  renderTrip();
  updateFxVal();
}

export function openCategoryPicker(kind, onPick) {
  const db = get();
  const groups = new Map();
  for (const c of db.categories) {
    if (c.deleted || !(c.kind === kind || c.kind === 'both')) continue;
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  const s = sheet(`<input type="search" id="catq" class="search" placeholder="Search categories" autofocus>
    <div id="catlist"></div>
    <div class="newcat"><button type="button" class="btn ghost wide" id="newcat-btn">+ New category</button></div>`, { title: 'All categories' });
  const list = s.el.querySelector('#catlist');
  const draw = (q = '') => {
    q = q.toLowerCase();
    list.innerHTML = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, cs]) => {
      const m = cs.filter((c) => !q || c.name.toLowerCase().includes(q) || g.toLowerCase().includes(q));
      return m.length ? `<div class="catgroup"><h3><i style="background:${groupColor(g)}">${groupLetter(g)}</i>${esc(g)}</h3><div class="chips">${m.sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<button type="button" class="chip" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div></div>` : '';
    }).join('') || '<p class="muted">Nothing matches.</p>';
  };
  draw();
  s.el.querySelector('#catq').addEventListener('input', (e) => draw(e.target.value));
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { onPick(b.dataset.id); s.close(); } });
  s.el.querySelector('#newcat-btn').onclick = () => openCategoryForm({ kind, onDone: (c) => { onPick(c.id); s.close(); } });
}

// create or edit a category. Keywords make it predictable straight away: any entry whose name contains one is guessed into it.
export function openCategoryForm({ id = null, kind = 'expense', group = '', name = '', keywords = '', onDone } = {}) {
  const db = get();
  const c = id ? db.categories.find((x) => x.id === id) : null;
  const groups = [...new Set(db.categories.filter((x) => !x.deleted && (x.kind === kind || x.kind === 'both')).map((x) => x.group))].sort();
  const isInc = (c ? c.kind : kind) === 'income';
  const s = sheet(`<form id="catform">
    <label class="field"><span>Group (the bigger heading)</span><input name="g" list="grouplist" value="${esc(c ? c.group : group)}" placeholder="${isInc ? 'e.g. Employer, Side income' : 'e.g. Food &amp; Drinks, Health'}" required autocomplete="off"></label>
    <datalist id="grouplist">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist>
    <label class="field"><span>Category (the detail)</span><input name="n" value="${esc(c ? c.name : name)}" placeholder="${isInc ? 'e.g. Bonus, Freelance, Refund' : 'e.g. Gym, Vet, Gifts'}" required autocomplete="off" ${id ? '' : 'autofocus'}></label>
    <label class="field"><span>Words that should land here (optional)</span><input name="k" value="${esc(c ? c.keywords || '' : keywords)}" placeholder="${isInc ? 'e.g. bonus, 13th month' : 'e.g. gym, fitness, anytime'}" autocomplete="off" autocapitalize="off"></label>
    <p class="hint">Separate words with commas. Next time a name contains one of them, this category is guessed. It also learns from every entry you put here.</p>
    <div class="btnrow">${c ? '<button type="button" class="btn danger ghost" data-del>Delete</button>' : ''}<button class="btn">${c ? 'Save' : 'Add and use'}</button></div></form>`,
  { title: c ? 'Edit category' : (isInc ? 'New income category' : 'New category') });
  s.el.querySelector('#catform').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const g = fd.get('g').trim(), n = fd.get('n').trim(), k = fd.get('k').trim();
    let out;
    commit((d) => {
      if (c) {
        const x = d.categories.find((q) => q.id === c.id);
        if (x.group !== g) { for (const b of d.budgets) if (!b.deleted && b.group === x.group && !d.categories.some((o) => o !== x && !o.deleted && o.group === x.group)) { b.group = g; stamp(b); } }
        Object.assign(x, { group: g, name: n, keywords: k }); stamp(x); out = x;
      } else {
        out = findOrAddCategory(d, g, n, kind);
        if (k) { out.keywords = [out.keywords, k].filter(Boolean).join(', '); stamp(out); }
      }
    });
    s.close(); if (onDone) onDone(out);
  };
  const del = s.el.querySelector('[data-del]');
  if (del) del.onclick = async () => {
    const used = get().txs.filter((t) => !t.deleted && (t.cat === c.id || (t.items || []).some((i) => i.cat === c.id))).length;
    if (used && !(await confirmDialog(`${used} ${used === 1 ? 'entry uses' : 'entries use'} “${c.name}”. They keep the name, but you will not be able to pick it for new entries. Delete it?`, 'Delete', true))) return;
    commit((d) => { const x = d.categories.find((q) => q.id === c.id); softDelete(x); });
    s.close(); toast('Category removed. Old entries keep their label.'); if (onDone) onDone(null);
  };
}

// ---------- add many at once ----------
export function openBulk() {
  const db = get();
  const s = sheet(`<form id="bulk"><p class="hint">One entry per line: a name, then the amount. Start a line with + for money received.
Example:<br><code>bus 30<br>mcdo 358.5<br>+ refund 1200</code>The app guesses categories and puts anything it is unsure about in Review.</p>
    <label class="field"><span>Account for all of them</span><select id="b-acct">${acctOptions(db.settings.lastAcct)}</select></label>
    <label class="field"><span>Date</span><input id="b-date" type="date" value="${nowStamp().slice(0, 10)}"></label>
    <label class="field"><span>Lines</span><textarea id="b-text" rows="8" placeholder="bus 30&#10;pandesal 45" autofocus></textarea></label>
    <p class="err" id="b-err" hidden></p>
    <div class="btnrow"><button class="btn">Add all</button></div></form>`, { title: 'Add many at once' });
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const db2 = get();
    const aid = s.el.querySelector('#b-acct').value, a = db2.accounts.find((x) => x.id === aid);
    const day = s.el.querySelector('#b-date').value || nowStamp().slice(0, 10);
    const lines = s.el.querySelector('#b-text').value.split('\n').map((l) => l.trim()).filter(Boolean);
    const out = [], bad = [];
    for (const l of lines) {
      const income = l.startsWith('+');
      const m = l.replace(/^\+\s*/, '').match(/^(.*?)[\s:]*[₱¥$]?\s*(-?[\d,]+(?:\.\d+)?)\s*$/);
      if (!m || !m[1].trim() || !(num(m[2]) > 0)) { bad.push(l); continue; }
      out.push({ name: m[1].trim(), amount: Math.abs(num(m[2])), kind: income ? 'income' : 'expense' });
    }
    const err = s.el.querySelector('#b-err');
    if (!out.length) { err.textContent = 'No valid lines found. Each line needs a name and an amount, like “bus 30”.'; err.hidden = false; return; }
    const fx = a.cur === BASE ? 1 : (rateFor(db2, a.cur) || 1);
    let flagged = 0;
    commit((d) => {
      out.forEach((o, i) => {
        const m = modelFor(o.kind);
        const p = predict(m, o.name, o.amount, { acct: aid, cur: a.cur, hour: 12 });
        const lk = lookup(m, o.name);
        let cat = p.cats[0] && p.cats[0].id, flag = null;
        if (!cat) { cat = findOrAddCategory(d, 'Others', 'Uncategorized', o.kind).id; flag = 'review'; }
        else if (p.conf < 0.6) flag = 'review';
        if (flag) flagged++;
        d.txs.push(stamp({ id: uid(), kind: o.kind, date: `${day} 12:${String(i % 60).padStart(2, '0')}:00`, name: o.name, amount: o.amount,
          cur: a.cur, fx, cat, acct: aid, notes: '', items: [], flag, pred: { cat, conf: p.conf } }));
      });
      d.settings.lastAcct = aid;
    });
    s.close();
    toast(`Added ${out.length} ${out.length === 1 ? 'entry' : 'entries'}${bad.length ? `, skipped ${bad.length} unreadable ${bad.length === 1 ? 'line' : 'lines'}` : ''}${flagged ? `. ${flagged} to confirm in Review.` : '.'}`);
  };
}
