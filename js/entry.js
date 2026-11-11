// The add / edit sheet, the category picker and the "add many at once" sheet.
import { suggestedGroups } from './catsuggest.js';
import { catIcon, ICONS, ICON_KEYS, iconKeyOf, iconSvg, guessIcon } from './caticons.js';
import { GICONS, GKEYS, gsvg, pickOwnImage, merchPic } from './pictures.js';
import {
  get, commit, undoLast, uid, stamp, nowStamp, toLocalInput, fromLocalInput, rateFor, fmt, freqNames, accountMap, catMap,
  findOrAddCategory, groupColor, groupLetter, accLabel, BASE, HOME, homeFx, homeRate, balances, CUR, priv, softDelete, exactAmt, r9, qtyR, commitQuiet, isEarnAcct, EARN_MSG,
} from './core.js';
import { buildGraph, makeResolver, explain } from './simgraph.js';
import { seg, toggle, box, button } from './components.js';
import { nameRules } from './merchants.js';
import { compareCard, relatedNames } from './compare.js';
import { smartKind, openLoanPlanner } from './loans.js';
import { fxBlockHtml, fxBlockUpdate, openConverter } from './fxview.js';
import { parseTags, joinTags, tagCounts } from './tags.js';
import { tipBtn } from './interest.js';
import { captureLoc, hereWhy, permState, parsePt } from './loc.js';
import { pickOnMap } from './mappick.js';
import { suggestBranch, branchFar } from './merchantset.js';
import { splitOf, openSplit, deleteWithMates } from './splitbill.js';
import { guessItemCat, itemCatIndex, itemsForWhat, knownItemNames } from './itemcat.js';
import { cachedAddress, lookupAddress, saveAddress } from './geo.js';
import { isLiability, isOwed, lockInfo, periodFor, addDay } from './finance.js';
import { budgetAlerts, newAlertsSince } from './budgetsetup.js';
import { guessLabel, transferLabel } from './label.js';
import { parseRoute, routeName, routeStats, suggestTrips, rankRouteNames, isTransportCat, transportWord, modeOf, tripLabel, bareMode } from './route.js';
import { buildModel, predict, suggest, lookup, catCandidates, byAmount, recentNames } from './predict.js';
import { evalExpr, isExpr, tidy } from './calc.js';
import { predictFee, safetyCheck, typeGroupName, typeGroupOrder, transferHints } from './finance.js';
import { esc, sheet, toast, ic, confirmDialog, promptDialog } from './ui.js';
import { applyHide } from './appearance.js';
import { openDatePicker, prettyDate } from './datepicker.js';
import { openCurrencyPicker, favCurs, flagOf, curIcon } from './curpicker.js';
import { openAccountPicker } from './acctpicker.js';
import { pickerList, enhanceSelect } from './picker.js';
import { similarNames } from './merchants.js';
import { openMerchantPicker, canonMerchant, guessMerchant } from './merchantpick.js';
import { groupsOf, unitOf, addGroup, countLines, splitParts, countsFromParts } from './spendgroups.js';

// ---- models are rebuilt only when the data changed ----
const cache = {};
export function modelFor(kind) {
  const db = get();
  const key = db.txs.length + ':' + db.txs.reduce((m, t) => Math.max(m, t.updatedAt || 0), 0) + ':' + db.categories.length + ':' + db.categories.reduce((m, c) => Math.max(m, c.updatedAt || 0), 0) + ':' + JSON.stringify(nameRules());
  if (!cache[kind] || cache[kind].key !== key) cache[kind] = { key, m: buildModel(db.txs, kind, db.categories, makeResolver(buildGraph(db))) };
  return cache[kind].m;
}

// "grocery shopping" -> "Grocery Shopping". Only words typed fully in lower case change; anything with a capital (iPhone, GCash, JR, McDonald's) or a digit is left as typed; small joining words stay small.
const SMALLW = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'at', 'by', 'with', 'from', 'vs', 'per', 'as', 'but', 'nor', 'into']);
export function titleCase(t) {
  let first = true;
  return String(t).replace(/(^|[\s(\/-])([a-z][a-z'’]*)(?![A-Za-z0-9])/g, (m, pre, w, off) => { const lead = first; first = false; return pre + (!lead && SMALLW.has(w) ? w : w[0].toUpperCase() + w.slice(1)); });
}
const titleOn = () => (get().settings || {}).titleCase !== false;
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
  return { cb: { on: false, mode: 'fixed', v: '' }, kind: 'expense', debt: false, flow: '', merchant: '', merchTouched: false, merchSuggested: false, amount: '', name: '', acct: last ? last.id : '', toAcct: '', toAmount: '', fx: '', cat: '',
    catTouched: false, acctTouched: false, acctSuggested: false, fxMode: 'rate', peso: '', date: nowStamp(), posted: '', postedOn: false, notes: '', labels: '', items: [], tax: { on: false, mode: 'pct', v: '' }, wd: { on: false, mode: 'pct', v: '' }, counts: [], parts: [], partsOff: '', showCounts: false, flag: null, id: null, pred: null, showItems: false, from: '', to: '', autoName: '',
    fee: '', feeMode: 'none', feePct: '', feeModeSet: false, feeCat: '', feeBy: 'from', feeTouched: false, calc: false, convert: false, cRate: '', qtab: '', qtabManual: false };
}
function fromTx(t) {
  const db = get();
  const cross = t.kind === 'transfer' && t.toAmount != null && Math.abs(t.toAmount - t.amount) > 1e-9;
  const flow = t.kind !== 'transfer' ? '' : t.debtPay ? 'pay' : t.debtBorrow ? 'borrow' : t.lent ? 'lend' : t.lentBack ? 'back' : '';
  return { cb: t.cashback ? { on: true, mode: t.cashback.mode, v: String(t.cashback.v) } : { on: false, mode: 'fixed', v: '' }, branch: t.branch || '', loc: t.loc || null, place: t.place || '', kind: t.kind, debt: !!flow, flow, merchant: t.merchant || '', merchTouched: true, merchSuggested: false, amount: String(t.amount), name: t.name || '', acct: t.acct, toAcct: t.toAcct || '',
    toAmount: t.toAmount != null ? String(t.toAmount) : '', fx: t.hfx > 0 ? prec(t.hfx) : t.fx ? prec(t.fx / homeRate(db, t.date)) : '', cat: t.cat || '',
    fee: t.fee > 0 ? String(t.fee) : '', feeMode: t.fee > 0 ? 'fixed' : 'none', feePct: '', feeModeSet: true, feeCat: t.feeCat || '', feeBy: t.feeBy || 'from', feeTouched: true, calc: false,
    convert: cross, cRate: cross ? prec(t.toAmount / t.amount) : '', qtab: '', qtabManual: false,
    catTouched: true, acctTouched: true, date: t.date, posted: t.posted || '', postedOn: !!t.posted, notes: t.notes || '', labels: t.labels || '', flag: t.flag || null, id: t.id, pred: null,
    items: (t.items || []).filter((i) => !i.tax && !i.wd).map((i) => (i.u != null ? { n: i.n, amt: String(i.u), q: i.q || 1, cat: i.cat || '', ...(i.dm ? { disc: { on: true, mode: i.dm, v: String(i.dv) } } : {}), ...(i.tp ? { tx: { on: true, v: String(i.tp) } } : {}) } : { n: i.n, amt: String(i.amt), q: 1, cat: i.cat || '', ...(i.tp ? { tx: { on: true, v: String(i.tp) } } : {}) })), tax: (() => { const x = (t.items || []).find((i) => i.tax); return x && !(x.pi && !x.tm) ? { on: true, mode: x.tm || 'amt', v: String(x.tv != null ? x.tv : x.amt) } : { on: false, mode: 'pct', v: '' }; })(), wd: (() => { const x = (t.items || []).find((i) => i.wd); return x ? { on: true, mode: x.dm || 'amt', v: String(x.dv != null ? x.dv : Math.abs(x.amt)) } : { on: false, mode: 'pct', v: '' }; })(), showItems: !!(t.items && t.items.length), counts: (t.counts || []).map((c) => ({ g: c.g, n: String(c.n) })), showCounts: !!(t.counts && t.counts.length), parts: (t.parts || []).map((x) => ({ ...x })), partsOff: '', from: t.from || '', to: t.to || '' };
}

// accounts grouped by kind (Banks, E-wallets, Crypto…), most recently used first inside each group
function acctOptions(sel, skip, cur) {
  const db = get();
  const lastUsed = new Map();
  for (const t of db.txs) { if (t.deleted) continue; for (const id of [t.acct, t.toAcct]) if (id && (lastUsed.get(id) || '') < t.date) lastUsed.set(id, t.date); }
  const groups = new Map();
  for (const a of db.accounts) {
    if (a.deleted || a.id === skip || (a.archived && a.id !== sel) || (cur && a.cur !== cur)) continue;
    const g = a.exchange && (a.type === 'crypto' || a.type === 'invest' || a.invtab) ? `${a.exchange} · ${a.wallet || 'Spot'}` : typeGroupName(a.type);
    if (!groups.has(g)) groups.set(g, { o: typeGroupOrder(a.type), list: [] });
    groups.get(g).list.push(a);
  }
  const opt = (a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(accLabel(a))} · ${a.cur}</option>`;
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

// Pay debt works like a transfer, but the form asks plain questions: which debt, paid from where. Keep the two sides sensible.
const owedOf = (id) => Math.max(0, -(balances(get()).get(id) || 0));
const owedToMe = (id) => Math.max(0, balances(get()).get(id) || 0);
const isMine = (a) => !!a && !isLiability(a) && !isOwed(a);
// The four guided money flows. All are plain transfers underneath (never spending or income); the form asks plain questions instead.
// person = which side is the card/loan/person ('to' or 'from'); the other side is always one of your own accounts.
const FLOWS = {
  pay: { person: 'to', only: 'debt', pLabel: 'What will you pay?', pEmpty: 'Choose a card or loan', mLabel: 'Paid from', ph: 'e.g. Monthly payment', hint: 'This is not counted as spending. It lowers what you owe and the money in the account you pay from.', auto: (p) => `Paid ${p.name}`, flag: 'debtPay' },
  borrow: { person: 'from', only: 'debt', pLabel: 'Who did you borrow from?', pEmpty: 'Choose a card or loan', mLabel: 'Received into', ph: 'e.g. Loan payout, cash from card', hint: 'This is not income. It adds to what you owe and to the money in the account that received it.', auto: (p) => `Borrowed from ${p.name}`, flag: 'debtBorrow' },
  lend: { person: 'to', only: 'owed', pLabel: 'Who did you lend to?', pEmpty: 'Choose or add a person', mLabel: 'Lent from', ph: 'e.g. Lent for rent', hint: 'This is not spending. The money moves to “money owed to me”, so you can see who still owes you.', auto: (p) => `Lent to ${p.name}`, flag: 'lent' },
  back: { person: 'from', only: 'owed', pLabel: 'Who paid you back?', pEmpty: 'Choose a person', mLabel: 'Received into', ph: 'e.g. Paid back', hint: 'This is not income. It lowers what they owe you.', auto: (p) => `Paid back by ${p.name}`, flag: 'lentBack' },
};
const SEGNOTE = { transfer: 'Move money between your own accounts. Not spending.', debt: 'Pay a card or loan, or record money you borrowed.', lent: 'Money you lent to someone, or that they paid back.' };
const FLOW_FLAGS = ['debtPay', 'debtBorrow', 'lent', 'lentBack'];
function setFlow(f, nf) {
  const o = f.flow ? FLOWS[f.flow].person : 'to', n = FLOWS[nf].person;
  if (o !== n) { const t = f.acct; f.acct = f.toAcct; f.toAcct = t; }
  f.flow = nf; f.debt = true; f.acctTouched = false; f.extraKind = '';
}
function debtFix(f) {
  const fl = FLOWS[f.flow || 'pay'], pk = fl.person === 'to' ? 'toAcct' : 'acct', mk = pk === 'toAcct' ? 'acct' : 'toAcct';
  const live = get().accounts.filter((a) => !a.deleted && !a.archived), mine = live.filter(isMine), people = live.filter((a) => (fl.only === 'debt' ? isLiability(a) : isOwed(a)));
  const amt = (id) => (fl.only === 'debt' ? owedOf(id) : owedToMe(id));
  const p0 = live.find((a) => a.id === f[pk]);
  if (!p0 || !people.includes(p0)) { const d = people.filter((a) => amt(a.id) > 0.004).sort((x, y) => amt(y.id) - amt(x.id))[0] || people[0]; f[pk] = d ? d.id : ''; }
  const m0 = live.find((a) => a.id === f[mk]), pp = live.find((a) => a.id === f[pk]);
  if (!m0 || !isMine(m0) || (!f.acctTouched && pp && m0.cur !== pp.cur)) { const same = (x) => !pp || x.cur === pp.cur, p = mine.find((a) => same(a) && a.include) || mine.find(same) || mine.find((a) => a.include) || mine[0]; f[mk] = p ? p.id : ''; }
}

export function openEntry(opts = {}) {
  const db = get();
  if (opts.id && !opts.preset && splitOf(db, opts.id) && openSplit(opts.id)) return;      // a part of a shared bill is always managed as the whole bill
  const existing = opts.id ? db.txs.find((t) => t.id === opts.id) : null;
  const f = existing ? fromTx(existing) : { ...blank(), ...(opts.preset || {}) };
  if (opts.showItems) { f.showItems = true; if (!f.items.length) f.items.push({ n: '', amt: '', q: 1, cat: '' }); }
  if (f.debt && !f.flow) f.flow = 'pay'; if (f.flow) f.debt = true;
  if (f.debt && f.kind === 'transfer') debtFix(f);
  if (!db.accounts.some((a) => !a.deleted)) {
    toast('Add an account first (Accounts tab), then you can record entries.');
    location.hash = '#/accounts';
    return;
  }
  const s = sheet('<form id="entry" novalidate></form>', { title: existing ? 'Edit entry' : 'New entry', wide: true });
  const form = s.el.querySelector('form');
  form.innerHTML = `
    <div class="segbox" id="seg" role="group" aria-label="Entry type"></div>
    <div id="freq" class="qp"></div>
    <div class="field" id="namefield"><span id="namelabel">What was it?</span>
      <input id="f-what" name="memo" type="text" role="combobox" aria-autocomplete="list" aria-controls="sugg" aria-expanded="false" autocomplete="off" data-form-type="other" data-lpignore="true" value="${esc(f.name)}" placeholder="e.g. Grab, Matcha, Cheesecake, . . ." ${existing ? '' : 'autofocus'}>
      <div id="sugg" class="sugg" hidden></div></div>
    <div class="field adv-only" id="merchrow" hidden></div>
    <div class="field amount" id="amountbox"><span class="amtlabel">Amount <button type="button" class="linkbtn eye" data-e="eye" aria-label="Hide or show amounts">${priv.on ? 'Show' : 'Hide'} amounts</button></span>
      <div class="amtrow"><div class="amtwrap"><input id="f-amount" inputmode="${f.calc ? 'none' : 'decimal'}" autocomplete="off" placeholder="0" value="${esc(commasOn() ? withCommas(f.amount) : f.amount)}"><button type="button" class="amtx" data-e="amtclear" aria-label="Clear amount" ${f.amount ? '' : 'style="visibility:hidden"'}>×</button><button type="button" class="allin" id="f-all" data-e="allamt" hidden title="Use the whole balance of the From account">All</button><button type="button" class="calcbtn" data-e="calc" aria-label="Calculator" aria-pressed="false" title="Calculator">${ic('calc')}</button></div><span id="curwrap" class="curwrap"></span></div>
      <div id="calcres" class="calcres" hidden></div><div id="keypad" class="keypad" hidden></div></div>
    <div id="fxline"></div>
    <div id="acctwhen" class="acctwhen"><div id="acctrow"></div><div class="field" id="whenrow"><span>When</span><button type="button" class="whenbtn" id="f-when" data-e="when"></button></div></div>
    <div id="postedrow" class="postedrow" hidden></div>
    <div id="convrow"></div>
    <div id="feerow"></div>
    <div id="catrow"></div>
    <div id="triprow"></div>
    <div id="itemsrow"></div>
    <div class="adv-only" id="countsrow"></div>
    <div class="field" id="tagsrow"></div>
    <div class="field" id="locrow"></div>
    <div class="field" id="branchrow"></div>
    <div class="field" id="cbrow"></div>
    <label class="field" id="notesrow"><span>Notes</span><textarea id="f-notes" rows="2" placeholder="Optional">${esc(f.notes)}</textarea></label>
    <div id="safety" class="safety" aria-live="polite"></div>
    <p class="err" id="err" role="alert" hidden></p>
    <div class="btnrow" id="btns"></div>`;
  const $f = (id) => form.querySelector('#' + id);
  // iPhone (installed web app): giving a "name"-like field focus again after a tap makes Safari offer contact autofill. Do not re-focus a field that already has focus.
  const focusKeep = (el) => { if (el && document.activeElement !== el) el.focus(); };
  const acctOf = (id) => get().accounts.find((a) => a.id === id);
  const ORDER = {
    flow: ['seg', 'freq', 'namefield', 'merchrow', 'amountbox', 'fxline', 'acctwhen', 'postedrow', 'catrow', 'triprow', 'itemsrow', 'countsrow', 'tagsrow', 'notesrow', 'locrow', 'branchrow', 'cbrow', 'safety', 'err', 'btns'],
    transfer: ['seg', 'freq', 'namefield', 'acctrow', 'amountbox', 'convrow', 'fxline', 'feerow', 'whenrow', 'tagsrow', 'notesrow', 'locrow', 'branchrow', 'safety', 'err', 'btns'],
  };
  function arrange() {
    const ids = f.kind === 'transfer' ? ORDER.transfer : ORDER.flow;
    if (f.kind !== 'transfer') $f('acctwhen').append($f('acctrow'), $f('whenrow'));          // Account and When share one block (a row) for expense and income
    for (const id of ids) form.appendChild($f(id));
    const nh = form.querySelector('#namehelp'), nr = $f('notesrow'); if (nh && nr) nr.after(nh);
  }

  // ---------- renderers ----------
  // Merchant: where it was bought. Only for expenses; one fixed-height row, so nothing moves while typing.
  function renderMerch() {
    const el = $f('merchrow'); el.hidden = f.kind !== 'expense'; el.classList.toggle('keep', !!f.merchant); if (el.hidden) return;   // Simple mode hides this row unless the entry already has a merchant
    // Merchant and Branch share one row (they belong together); the row keeps its height, Branch just waits until a merchant is chosen
    el.innerHTML = `<div class="mbpair"><div class="mbcell"><span>Merchant (optional) ${f.merchSuggested && f.merchant ? '<small class="sugnote">· suggested</small>' : ''}</span><button type="button" class="acctbtn" data-e="merchpick">${f.merchant ? `<i class="minipic">${merchPic(get(), f.merchant)}</i>${esc(f.merchant)}` : '<span class="muted">e.g. 7-Eleven, Starbucks, McDo, ...</span>'} ▾</button></div><div class="mbcell" id="branchcell"></div></div>`;
    renderBranch();
  }
  function suggestMerchant() {
    if (f.merchTouched || existing) return;
    const g = guessMerchant(get(), f.name);
    if (g && g !== f.merchant) { f.merchant = g; f.merchSuggested = true; f.branch = ''; f.branchTouched = false; renderMerch(); renderBranch(); autoBranch(); } else if (!g && f.merchSuggested) { f.merchant = ''; f.merchSuggested = false; renderMerch(); renderBranch(); }
  }
  const isPersonSide = (to) => (to ? FLOWS[f.flow].person === 'to' : FLOWS[f.flow].person === 'from');
  async function addPerson() {
    const n = (await promptDialog('Who did you lend to?', '', { okLabel: 'Add', hint: 'A name is enough, for example Ana or Kuya Ben. It is kept under “money owed to me”.' }))?.trim(); if (!n) return;
    const ex = get().accounts.find((x) => !x.deleted && isOwed(x) && x.name.toLowerCase() === n.toLowerCase()); let id = ex ? ex.id : uid();
    if (!ex) commit((d) => { d.accounts.push(stamp({ id, name: n, cur: HOME, type: 'owed', open: 0, include: true, archived: false })); });
    f.toAcct = id; f.acctTouched = false; debtFix(f); renderAccts(); renderFx(); syncCross();
  }
  // they paid back more than they owed: say what the extra is (never silently negative)
  function askExtra(extra, cur, onPick) {
    const s2 = sheet(`<p class="confirm-text">They paid ${esc(fmt(extra, cur, { force: true }))} more than they owed you. What is the extra?</p>
      <div class="chips">${button({ label: 'Interest earned', kind: 'chip', attr: { 'data-x': 'Interest earned' } })}${button({ label: 'Other income', kind: 'chip', attr: { 'data-x': 'Other income' } })}</div>
      <p class="hint">The extra is counted as income. The rest only lowers what they owe you.</p><div class="btnrow"><button type="button" class="btn ghost" data-no>Cancel</button></div>`, { title: 'Paid Back Extra' });
    s2.el.querySelector('[data-no]').onclick = () => s2.close();
    s2.el.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b) { s2.close(); onPick(b.dataset.x); } });
  }
  function renderSeg() {
    const dOn = f.flow === 'pay' || f.flow === 'borrow', lOn = f.flow === 'lend' || f.flow === 'back', on3 = (v) => (v === 'transfer' ? f.kind === 'transfer' && !f.flow : f.kind === v);
    const b3 = [['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']].map(([v, l]) => `<button type="button" data-e="kind" data-v="${v}" aria-pressed="${on3(v)}" class="${on3(v) ? 'on' : ''}">${l}</button>`).join('') + (/^#\/invest/.test(location.hash) || (existing && existing.internal) ? `<button type="button" data-e="internal" aria-pressed="false" class="segint" title="Move a coin between wallets of the same platform (Spot, Earn, Futures…)">Internal</button>` : '');   /* Internal Transfer only lives in the Investment tab */
    const big = (v, l, sub, on) => `<button type="button" data-e="kind" data-v="${v}" aria-pressed="${on}" class="${on ? 'on' : ''}"><b>${l}</b><small>${sub}</small></button>`;
    const sub = (items) => `<div class="chips segsub" role="group">${items.map(([v, l]) => `<button type="button" class="chip ${f.flow === v ? 'on' : ''}" data-e="flow" data-v="${v}" aria-pressed="${f.flow === v}">${l}</button>`).join('')}</div>`;
    const note = f.kind === 'transfer' && !f.flow ? SEGNOTE.transfer : dOn ? SEGNOTE.debt : lOn ? SEGNOTE.lent : '';
    $f('seg').innerHTML = `<div class="seg ${/^#\/invest/.test(location.hash) || (existing && existing.internal) ? 'four' : 'three'}">${b3}</div><div class="seg two segloan">${big('debt', 'Debt', 'Pay or borrow', dOn)}${big('lent', 'Lent', 'Lend or get paid back', lOn)}</div>${dOn ? sub([['pay', 'I paid a debt'], ['borrow', 'I borrowed money']]) : lOn ? sub([['lend', 'I lent money'], ['back', 'They paid me back']]) : ''}${note ? `<p class="segnote">${note}</p>` : ''}`;
    $f('namelabel').textContent = f.kind === 'transfer' ? (f.debt ? 'Note (optional)' : 'Label (optional, remembers the route)') : f.kind === 'income' ? 'Where from?' : 'What was it?';
    $f('f-what').placeholder = f.kind === 'transfer' ? (f.debt ? FLOWS[f.flow].ph : 'e.g. Card payment, Top up Maya') : f.kind === 'income' ? 'e.g. Salary, Bonus, Refund, . . .' : 'e.g. Grab, Matcha, Cheesecake, . . .';
  }
  // quick picks: tap one and the name, amount, account and category are filled in
  function renderFreq() {
    const el = $f('freq');
    el.classList.toggle('qp-off', !!(f.debt && f.flow !== 'pay' && !existing));
    if (existing || (f.debt && f.flow !== 'pay')) { el.innerHTML = ''; return; }
    const db2 = get(), am = accountMap(db2);
    let tabs, chips = '', hint = '';
    if (f.kind === 'transfer') {
      const hints = transferHints(db2);
      tabs = [['routes', 'Usual routes'], ['recent', 'Recent']];
      if (!f.qtab || !tabs.some((t) => t[0] === f.qtab)) f.qtab = 'routes';
      const nm = (id) => (am.get(id) || { name: '?' }).name;
      const routes = hints.routes.filter((r) => am.has(r.from) && am.has(r.to) && !am.get(r.from).deleted && !am.get(r.to).deleted && (!f.debt || (f.flow === 'pay' && isLiability(am.get(r.to)))));
      const list = (f.qtab === 'routes' ? routes.sort((a, b) => b.n - a.n) : routes.sort((a, b) => (a.last < b.last ? 1 : -1))).slice(0, 6);
      chips = list.map((r) => `<button type="button" class="chip" data-e="route" data-from="${r.from}" data-to="${r.to}">${esc(nm(r.from))} → ${esc(nm(r.to))}${r.name && r.name !== `${nm(r.from)} → ${nm(r.to)}` ? ` <small>${esc(r.name)}</small>` : ''}</button>`).join('');
      hint = chips ? '' : (f.flow === 'pay' ? 'Debts you pay often will show here.' : f.debt ? '' : 'Routes you use often will show here.');
    } else {
      const amt = num(f.amount), a = acctOf(f.acct);
      tabs = [['usual', 'Usual'], ['recent', 'Recent']];
      if (f.qtab !== 'usual' && f.qtab !== 'recent') f.qtab = 'usual';
      const m = modelFor(f.kind);
      let names = [];
      if (f.qtab === 'usual') { const isT = isTransportCat(db2.categories); names = rankRouteNames(db2, isT, freqNames(db2, 90, 14, f.kind), hourOf(f.date)).slice(0, 6).map((n) => ({ name: n })); }
      else if (f.qtab === 'recent') names = recentNames(m, 6);
      chips = names.map((x) => `<button type="button" class="chip" data-e="pick" data-v="${esc(x.name)}">${esc(x.name)}${x.amount ? ` <small>${esc(fmt(x.amount, a ? a.cur : HOME, { force: !priv.on }).replace(/\.00$/, ''))}</small>` : ''}</button>`).join('');
      hint = 'Tap one to fill in the name, amount, account and category.';
    }
    el.innerHTML = `<div class="qptabs" role="tablist" aria-label="Quick picks">${tabs.map(([v, l]) => `<button type="button" role="tab" class="qtab ${f.qtab === v ? 'on' : ''}" aria-selected="${f.qtab === v}" data-e="qtab" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="chips ${f.kind === 'transfer' ? 'qpone' : ''}">${chips || ''}</div><span class="qphint">${hint || '&nbsp;'}</span>`;
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
    $f('curwrap').innerHTML = `<button type="button" class="curbtn sm" data-e="curpick" aria-label="Choose currency" title="Currency">${curIcon(cur)} ${cur} ▾</button><select id="f-cur" hidden aria-hidden="true">${list.map((c) => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c}</option>`).join('')}</select>`;
  }
  function updateNamePh() {                                             // a transfer left unnamed will be called "from - to"
    const el = form.querySelector('#f-what'); if (!el) return;
    el.placeholder = f.kind === 'transfer' && f.debt ? 'Optional. Blank is filled in for you' : f.kind === 'transfer' ? (acctOf(f.acct) && acctOf(f.toAcct) ? `Leave blank: ${acctOf(f.acct).name} - ${acctOf(f.toAcct).name}` : 'Leave blank to use the two account names') : f.kind === 'income' ? 'e.g. Salary, Bonus, Refund, . . .' : 'e.g. Grab, Matcha, Cheesecake, . . .';
  }
  // what the account holds right now, shown under its name in a transfer
  const balLine = (id) => { const a = acctOf(id); if (!a) return ''; const v = balances(get()).get(id) || 0; return `<small class="acctbal ${v < 0 ? 'neg' : ''}">Balance ${esc(fmt(v, a.cur, { force: !priv.on }))}</small>`; };
  function renderAccts() {
    updateNamePh();
    const el = $f('acctrow');
    const a = acctOf(f.acct);
    renderCur(); renderPosted();
    $f('acctwhen').classList.toggle('inrow', f.kind !== 'transfer'); $f('f-all').hidden = f.kind !== 'transfer' || f.debt; renderWhen();                  // Account and When share a row, except for transfers (From / To need the width)
    if (f.kind !== 'transfer') {
      const sug = f.acctSuggested && !f.acctTouched;
      el.innerHTML = `<div class="field ${sug ? 'suggested' : ''}"><span>Account ${sug ? '<small class="sugnote">· suggested</small>' : ''}</span><button type="button" class="acctbtn" data-e="acctpick" data-which="acct">${esc(accLabel(acctOf(f.acct)) || 'Choose account')}${acctOf(f.acct) ? ' · ' + acctOf(f.acct).cur : ''} ▾</button><select id="f-acct" hidden aria-hidden="true">${acctOptions(f.acct, '', '')}</select></div>`;
    } else if (f.debt) {
      debtFix(f); const fl = FLOWS[f.flow], pk = fl.person === 'to' ? 'toAcct' : 'acct', mk = pk === 'toAcct' ? 'acct' : 'toAcct', pa = acctOf(f[pk]), ma = acctOf(f[mk]);
      const owed = pa ? (fl.only === 'debt' ? owedOf(pa.id) : owedToMe(pa.id)) : 0, same = pa && ma && pa.cur === ma.cur, fm = (v, c) => esc(fmt(v, c, { force: !priv.on }));
      let q = '';
      if (same && owed > 0.004 && f.flow === 'pay') { const L = pa.loan, minV = (pa.dm && pa.dm.min) || (L && L.monthly) || 0; q = `<div class="chips debtq">${minV > 0 && minV < owed ? `<button type="button" class="chip" data-e="debtamt" data-v="${minV}">Minimum <small>${fm(minV, pa.cur)}</small></button>` : ''}<button type="button" class="chip" data-e="debtamt" data-v="${owed}">All I owe <small>${fm(owed, pa.cur)}</small></button></div>`; }
      else if (same && owed > 0.004 && f.flow === 'back') q = `<div class="chips debtq"><button type="button" class="chip" data-e="debtamt" data-v="${owed}">All they owe <small>${fm(owed, pa.cur)}</small></button></div>`;
      const sel = (key, other, third) => `<select id="${key === 'toAcct' ? 'f-to' : 'f-acct'}" hidden aria-hidden="true">${third === undefined ? acctOptions(f[key], other) : acctOptions(f[key], other, third)}</select>`, which = (k) => (k === 'toAcct' ? 'to' : 'acct');
      const owedNote = pa ? `<small class="acctbal ${fl.only === 'debt' ? 'neg' : ''}">${fl.only === 'debt' ? 'You owe ' : 'Owes you '}${fm(owed, pa.cur)}</small>` : '';
      const pBtn = `<div class="field"><span>${fl.pLabel}</span><button type="button" class="acctbtn" data-e="acctpick" data-which="${which(pk)}">${esc(accLabel(pa) || fl.pEmpty)} ▾${owedNote}</button>${sel(pk, f[mk], pk === 'acct' ? '' : undefined)}</div>`;
      const mBtn = `<div class="field"><span>${fl.mLabel}</span><button type="button" class="acctbtn" data-e="acctpick" data-which="${which(mk)}">${esc(accLabel(ma) || 'Choose')} ▾${balLine(f[mk])}</button>${sel(mk, f[pk], mk === 'acct' ? '' : undefined)}</div>`;
      el.innerHTML = `<div class="two dbtpair">${pBtn}${mBtn}</div>${q}<p class="hint">${fl.hint}</p>`;
    } else {
      if (!f.toAcct) { const o = get().accounts.find((x) => !x.deleted && !x.archived && x.id !== f.acct); f.toAcct = o ? o.id : ''; }
      el.innerHTML = `<div class="two sw"><div class="field"><span>From</span><button type="button" class="acctbtn" data-e="acctpick" data-which="acct">${esc(accLabel(acctOf(f.acct)) || 'Choose')} ▾${balLine(f.acct)}</button><select id="f-acct" hidden aria-hidden="true">${acctOptions(f.acct, f.toAcct, '')}</select></div>
        <div class="swapcol field"><span aria-hidden="true">&nbsp;</span><button type="button" class="swapbtn" data-e="swapacct" aria-label="Swap From and To" title="Swap From and To">${ic('swap')}</button></div>
        <div class="field"><span>To</span><button type="button" class="acctbtn" data-e="acctpick" data-which="to">${esc(accLabel(acctOf(f.toAcct)) || 'Choose')} ▾${balLine(f.toAcct)}</button><select id="f-to" hidden aria-hidden="true">${acctOptions(f.toAcct, f.acct)}</select></div></div>`;
    }
    renderConv();
    renderFee();
    renderSafety();
  }
  const diffNote = (f, a) => { const d = num(f.amount) - num(f.toAmount); return d > 0 ? `${fmt(d, a.cur, { force: false })} less arrived than was sent (a fee or a loss on the way).` : d < 0 ? `${fmt(-d, a.cur, { force: false })} more arrived than was sent.` : ''; };
  // converting between currencies is optional: off means the same number arrives
  function renderConv() {
    const el = $f('convrow');
    const a = acctOf(f.acct), b = acctOf(f.toAcct);
    if (f.kind === 'transfer' && a && b && a.cur === b.cur) {
      // the received amount differs from the sent amount in the same currency (a fee or loss in the transfer): keep it visible and keep it on save
      if (f.diffInit === undefined) f.diffInit = num(f.toAmount) > 0 && Math.abs(num(f.toAmount) - num(f.amount)) > 1e-9;
      f.sameDiff = f.diffInit;
      el.innerHTML = f.sameDiff ? `<div class="convbox"><label class="fxpeso"><span>Received in ${esc(b.name)} (${b.cur})</span><input id="f-toamt" inputmode="decimal" value="${esc(f.toAmount)}" placeholder="0"></label><small class="hint" id="diffnote">${diffNote(f, a)}</small>${button({ label: 'Make the received amount the same', kind: 'link', e: 'samediff' })}</div>` : '';
      f.convert = false; return;
    }
    f.sameDiff = false;
    if (f.kind !== 'transfer' || !a || !b || a.cur === b.cur) { el.innerHTML = ''; f.convert = false; return; }
    if (a.type === 'crypto' && b.type === 'crypto' && !f.convTouched) f.convert = true;   // two coins are never exactly 1:1
    el.innerHTML = `<label class="check"><input type="checkbox" id="f-conv" ${f.convert ? 'checked' : ''}> ${a.type === 'crypto' && b.type === 'crypto' ? `Trade ${a.cur} for ${b.cur} (not 1:1)` : `Convert ${a.cur} to ${b.cur} (use an exchange rate)`}</label>
      ${f.convert ? `<div class="convbox">${fxBlockHtml({ from: a.cur, to: b.cur, amount: num(f.amount), rate: num(f.cRate), always: true, open: 'data-e="fxopen2"' })}<input id="f-crate" type="hidden" value="${esc(f.cRate)}">
        <label class="fxpeso"><span>Received (${b.cur})</span><input id="f-toamt" inputmode="decimal" value="${esc(f.toAmount)}" placeholder="0"></label>
        ${a.type === 'crypto' || b.type === 'crypto' ? '<small class="hint">Add the exchange’s buy or sell fee below (Fee, type “Trading fee”).</small>' : ''}</div>`
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
    const showInv = () => { const a2 = acctOf(f.acct), b2 = acctOf(f.toAcct), box = $f('convrow'); if (a2 && b2 && box) fxBlockUpdate(box, { from: a2.cur, to: b2.cur, amount: num(f.amount), rate: num(f.cRate) }); };
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
    // the rate and the home value are kept in two hidden fields; the person sees "Exchange Rate" and a three-line summary
    el.innerHTML = `${fxBlockHtml({ from: a.cur, to: HOME, amount: num(f.amount), rate: num(f.fx), always: true, open: 'data-e="fxopen"' })}<input id="f-fx" type="hidden" value="${esc(f.fx)}"><input id="f-peso" type="hidden" value="${esc(f.peso)}">`;
    updateFxVal();
  }
  function refreshFxView() { const a = acctOf(f.acct), el = $f('fxline'); if (a && el && a.cur !== HOME) fxBlockUpdate(el, { from: a.cur, to: HOME, amount: num(f.amount), rate: num(f.fx) }); }
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
      pe.value = f.peso;
    }
    fe.value = f.fx; refreshFxView();
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
  function feeCalcTxt() { const a = acctOf(f.acct), b = acctOf(f.toAcct); const cur = f.feeBy === 'to' ? (b && b.cur) : (a && a.cur); return num(f.fee) > 0 ? `= ${fmt(num(f.fee), cur || HOME)}` : ''; }
  function recalcFee() { if (f.feeMode === 'pct') { const v = r9(((num(f.amount) || 0) * (num(f.feePct) || 0)) / 100); f.fee = v > 0 ? String(v) : ''; } }
  function renderFee() {
    const el = $f('feerow');
    if (f.kind !== 'transfer' || f.debt) { el.innerHTML = ''; return; }
    suggestFee();
    const a = acctOf(f.acct), b = acctOf(f.toAcct);
    if (!a || !b) { el.innerHTML = ''; return; }
    const cur = f.feeBy === 'to' ? b.cur : a.cur;
    const sug = f.feeSuggested && !f.feeTouched;
    if (f.feeMode === 'none' && num(f.fee) > 0 && !f.feeModeSet) f.feeMode = 'fixed';   // a usual fee for the route, or a saved fee, opens the amount row
    const md = f.feeMode, who = (f.feeBy === 'to' ? b : a).name;
    el.innerHTML = `<div class="field feebox ${sug ? 'suggested' : ''}"><div class="feehead"><span class="feelab">Fee (optional)</span>${seg({ options: [['none', '0 Fee'], ['fixed', 'Fixed Amount'], ['pct', '% of the Transfer']].map(([value, label]) => ({ value, label })), value: md, e: 'feemode', aria: 'Fee' })}</div>
      ${sug && md !== 'none' ? '<small class="sugnote">usual fee for this route · change if different</small>' : ''}
      ${md === 'none' ? '' : `<div class="feedet"><label class="field"><span>${md === 'pct' ? 'Fee % of the Transfer (e.g. 0.1)' : `Fee Amount (${esc(cur)})`}</span><input id="f-fee" inputmode="decimal" autocomplete="off" aria-label="Fee" placeholder="0" value="${esc(md === 'pct' ? f.feePct : f.fee)}"></label>
        ${md === 'pct' ? `<small class="muted" id="feecalc">${feeCalcTxt()}</small>` : ''}
        <div class="field"><span>Fee Responsibility</span>${seg({ options: [{ value: 'from', label: 'Taken from Maker', title: `Taken from the sender (${a.name})` }, { value: 'to', label: 'Taken from Taker', title: `Taken from the receiver (${b.name})` }], value: f.feeBy === 'to' ? 'to' : 'from', e: 'feeby', aria: 'Fee responsibility' })}</div>
        <select id="f-feecat" aria-label="Fee type">${f.feeCat ? '' : '<option value="">Fee type</option>'}${feeCatOptions(f.feeCat)}</select>
        <small class="muted feewho">Taken from ${esc(who)}</small></div>`}</div>`;
    const fs = el.querySelector('#f-feecat');
    if (fs) enhanceSelect(fs, { title: 'Fee Type', addLabel: 'Add a new fee type', onAdd: async () => { const n = (await promptDialog('New fee type', '', { okLabel: 'Add', hint: 'For example: Withdrawal fee, Gas fee' }))?.trim(); if (!n) return; fs.add(new Option(n, '__new:' + n)); fs.value = '__new:' + n; fs.dispatchEvent(new Event('change', { bubbles: true })); } });
  }
  function topCats(kind, n) {
    const m = modelFor(kind);
    const top = [...m.classes.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, n).map(([id]) => ({ id, p: 0 })), have = new Set([...m.classes.keys()]);
    // a category you just made has no entries yet, so the model does not know it: offer the newest ones straight away
    const fresh = get().categories.filter((c) => !c.deleted && !have.has(c.id) && c.group !== 'Adjustments' && (c.kind === kind || c.kind === 'both') && Date.now() - (c.createdAt || c.updatedAt || 0) < 30 * 864e5)
      .sort((a, b) => (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0)).slice(0, 2).map((c) => ({ id: c.id, p: 0 }));
    return [...top, ...fresh];
  }
  function candidates() { return f.name.trim() ? catCandidates(modelFor(f.kind), get().categories, f.name, f.kind, 6) : []; }
  // no category yet: offer the existing groups (the larger headings), most used first; tapping one lists its categories
  function groupSuggest(cm) {
    const m = modelFor(f.kind), use = new Map();
    for (const [id, v] of m.classes.entries()) { const c = cm.get(id); if (c) use.set(c.group, (use.get(c.group) || 0) + v.n); }
    for (const c of get().categories) if (!c.deleted && c.group !== 'Adjustments' && (c.kind === f.kind || c.kind === 'both') && !use.has(c.group)) use.set(c.group, 0);
    const gs = [...use.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([g]) => g);
    if (!gs.length) return '';
    return `<small class="muted">Not sure which category? Choose a group first:</small><div class="chips cattiles grptiles">${gs.map((g) => `<button type="button" class="chip cattile" data-e="catgroup" data-v="${esc(g)}"><i style="background:${groupColor(g)}">${groupLetter(g)}</i><span>${esc(g)}</span></button>`).join('')}</div>`;
  }
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
      <div class="chips cattiles">${list.map((x) => { const c = cm.get(x.id); return ` <button type="button" class="chip cat cattile ${f.cat === x.id ? 'on' : ''} ${guess && f.cat === x.id ? 'guess' : ''}" data-e="cat" data-v="${x.id}"><i style="background:${groupColor(c.group)}">${catIcon(c)}</i><span>${esc(c.name)}</span></button>`; }).join('')}
      <button type="button" class="chip more cattile" data-e="allcats"><i class="ghosti">${iconSvg('dots')}</i><span>All</span></button>
      <button type="button" class="chip more cattile" data-e="newcat"><i class="ghosti"><svg class="cico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></i><span>New</span></button></div>
      ${!f.cat || nofit ? groupSuggest(cm) : ''}
      ${nofit ? `<button type="button" class="linkbtn nofit" data-e="newcat">No category fits “${esc(typed.slice(0, 24))}”. Add it as a new category</button>` : ''}</div>`;
  }
  const itemPh = () => { const a = acctOf(f.acct); return fmt(0, a ? a.cur : HOME, { force: true }); };   /* the empty price shows the account's own currency, like ₱0.00 or ¥0 */
  const grossOf = (i) => Math.round((num(i.amt) || 0) * (i.q > 0 ? i.q : 1) * 100) / 100;
  const discOf = (i) => { if (!i.disc || !i.disc.on) return 0; const g = grossOf(i), v = num(i.disc.v) || 0; return Math.round(Math.min(Math.max(i.disc.mode === 'pct' ? (g * v) / 100 : v, 0), g) * 100) / 100; };
  const lineOf = (i) => Math.round((grossOf(i) - discOf(i)) * 100) / 100;
  const itemBase = () => f.items.reduce((s2, i) => s2 + lineOf(i), 0);
  const kOf = () => 10 ** (CUR[(acctOf(f.acct) || {}).cur] || { dec: 2 }).dec;
  const wdOf = () => { if (!f.wd || !f.wd.on) return 0; const b = itemBase(), v = num(f.wd.v) || 0, k = kOf(); return Math.round(Math.min(Math.max(f.wd.mode === 'pct' ? (b * v) / 100 : v, 0), b) * k) / k; };   // a discount on the whole bill, taken off the items before the whole-bill tax
  const wRatio = () => { const b = itemBase(); return b > 0 ? wdOf() / b : 0; };
  const ownTax = (i) => { if (!i.tx || !i.tx.on) return 0; const k = kOf(); return Math.round(Math.max(lineOf(i) * (1 - wRatio()) * (num(i.tx.v) || 0) / 100, 0) * k) / k; };   // this line's own tax (for example 8% on food)
  const ownTaxSum = () => f.items.reduce((s2, i) => s2 + ownTax(i), 0);
  const plainBase = () => f.items.reduce((s2, i) => s2 + (i.tx && i.tx.on ? 0 : lineOf(i)), 0) * (1 - wRatio());   // lines without their own tax: the whole-bill rate applies to these
  const taxOf = () => { if (!f.tax || !f.tax.on) return 0; const v = num(f.tax.v) || 0, k = kOf(); return Math.round(Math.max(f.tax.mode === 'pct' ? (plainBase() * v) / 100 : v, 0) * k) / k; };
  function itemSum() { return itemBase() - wdOf() + ownTaxSum() + taxOf(); }
  function wdText() { const d = wdOf(), cur = (acctOf(f.acct) || {}).cur || HOME; return d > 0 ? `Discount ${fmt(d, cur)} off ${fmt(itemBase(), cur)}` : 'Type the percent or the amount taken off at the till.'; }
  const itemLine = (it) => { const g = grossOf(it), d = discOf(it); const base = (it.q > 1 ? `${it.q} × ${esc(it.amt || 0)}` : ''); const tx0 = ownTax(it); if (!d && !base && !tx0) return ''; const cur = (acctOf(f.acct) || {}).cur || HOME; const tx = ownTax(it); return `${base}${base && d ? ' ' : ''}${d ? `− ${fmt(d, cur)} discount` : ''}${tx ? `${base || d ? ' ' : ''}+ ${fmt(tx, cur)} tax (${num(it.tx.v) || 0}%)` : ''} = ${fmt(lineOf(it) + tx, cur)}`; };
  function taxText() { const t = taxOf(), cur = (acctOf(f.acct) || {}).cur || HOME; return t > 0 ? `Tax ${fmt(t, cur)} on ${fmt(plainBase(), cur)}` : 'Type the tax rate or the amount from the receipt.'; }
  function renderItems() {
    const el = $f('itemsrow');
    if (f.kind !== 'expense') { el.innerHTML = ''; return; }
    if (!f.showItems) { el.innerHTML = `<button type="button" class="linkbtn split" data-e="items-on">${ic('split')} Split into items (groceries, receipts)</button>`; return; }
    el.innerHTML = box({ title: 'Items on This Receipt', hint: 'Price of one, then tap + for more of the same.', cancel: { e: 'items-off' }, cls: 'items itembox', body: `
      <div class="chips itemsugg" id="itemsugg" aria-label="Items you often add"></div><datalist id="itemnames">${knownItemNames(get()).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div id="itemlist">${f.items.map((it, i) => `<div class="item" data-i="${i}">
        <input class="in-n" list="itemnames" autocomplete="off" placeholder="Item" value="${esc(it.n)}" aria-label="Item name">
        <select class="in-c" aria-label="Item category"><option value="">Same as above</option>${catOptions(it.cat, 'expense')}</select>
        <div class="inamt"><input class="in-a" inputmode="decimal" placeholder="${esc(itemPh())}" value="${esc(it.amt)}" aria-label="Price of one, you can type a sum like 120+45"><button type="button" class="calcin" data-e="item-calc" data-v="${i}" aria-label="Calculator: type a sum such as 120+45*2, then tap = " title="Calculator">=</button></div>
        <div class="qty" role="group" aria-label="Quantity"><button type="button" data-e="item-q" data-v="${i}:-1" aria-label="One less">−</button><b>${it.q > 0 ? it.q : 1}</b><button type="button" data-e="item-q" data-v="${i}:1" aria-label="One more">+</button></div>
        ${it.disc && it.disc.on ? `<div class="idisc">${seg({ options: [{ label: 'Amount', value: 'amt' }, { label: '%', value: 'pct' }], value: it.disc.mode === 'pct' ? 'pct' : 'amt', e: 'disc-mode', aria: 'Discount type', pack: (m) => `${i}:${m}` })}<input class="in-d" inputmode="decimal" autocomplete="off" placeholder="${it.disc.mode === 'pct' ? 'e.g. 20' : 'e.g. 50'}" value="${esc(it.disc.v)}" aria-label="Discount ${it.disc.mode === 'pct' ? 'percent' : 'amount'}"></div>` : ''}
        ${it.tx && it.tx.on ? `<div class="itax">${seg({ options: [{ label: '10%', value: '10', title: 'Standard consumption tax' }, { label: '8%', value: '8', title: 'Reduced rate: food and non-alcoholic drinks' }], value: ['10', '8'].includes(String(it.tx.v)) ? String(it.tx.v) : null, e: 'item-tax-set', aria: 'Tax rate', pack: (m) => `${i}:${m}` })}<input class="in-t" inputmode="decimal" autocomplete="off" placeholder="Other %" value="${esc(it.tx.v)}" aria-label="Tax rate percent for this item"></div>` : ''}
        <div class="itail"><small class="muted iline">${itemLine(it)}</small>${toggle({ label: 'Discount', on: !!(it.disc && it.disc.on), e: 'item-disc', v: i })}${toggle({ label: 'Tax', on: !!(it.tx && it.tx.on), e: 'item-tax', v: i })}${button({ label: 'Remove item', kind: 'link', cls: 'rm', e: 'item-del', v: i, aria: 'Remove this item' })}</div></div>`).join('')}</div>
      <div class="itemfoot">${button({ label: '+ Add item', kind: 'link', e: 'item-add' })}<span id="itemleft"></span></div>
      <div class="taxbox" id="wdbox"><div class="taxhead"><span class="feelab">Discount on the Whole Bill</span>${toggle({ label: 'Discount', on: f.wd.on, e: 'wd-toggle' })}</div>
        ${f.wd.on ? `<div class="taxdet">${seg({ options: [{ label: 'Percent %', value: 'pct' }, { label: 'Amount', value: 'amt' }], value: f.wd.mode === 'pct' ? 'pct' : 'amt', e: 'wd-mode', aria: 'Discount type' })}
          <input id="f-wdv" inputmode="decimal" autocomplete="off" placeholder="${f.wd.mode === 'pct' ? 'e.g. 10' : 'e.g. 100'}" value="${esc(f.wd.v)}" aria-label="Discount ${f.wd.mode === 'pct' ? 'percent' : 'amount'}">
          <small class="muted" id="wdcalc">${wdText()}</small></div>` : ''}</div>
      <div class="taxbox"><div class="taxhead"><span class="feelab">Tax on the Whole Bill</span>${toggle({ label: 'Tax', on: f.tax.on, e: 'tax-toggle' })}</div>
        ${f.tax.on ? `<div class="taxdet">${seg({ options: [{ label: 'Rate %', value: 'pct' }, { label: 'Amount', value: 'amt' }], value: f.tax.mode === 'pct' ? 'pct' : 'amt', e: 'tax-mode', aria: 'Tax type' })}
          <input id="f-taxv" inputmode="decimal" autocomplete="off" placeholder="${f.tax.mode === 'pct' ? 'e.g. 10' : 'e.g. 150'}" value="${esc(f.tax.v)}" aria-label="Tax ${f.tax.mode === 'pct' ? 'rate percent' : 'amount'}">
          ${f.tax.mode === 'pct' ? '<div class="chips taxchips">' + button({ label: '10%', kind: 'chip', e: 'tax-set', v: '10' }) + '' + button({ label: '8% (reduced)', kind: 'chip', e: 'tax-set', v: '8' }) + '</div>' : ''}
          <small class="muted" id="taxcalc">${taxText()}${ownTaxSum() ? ' (items with their own tax are left out)' : ''}</small></div>` : ''}</div>` });
    el.querySelectorAll('select.in-c').forEach((sel) => enhanceSelect(sel, { title: 'Category', addLabel: 'Add a new category', onAdd: () => openCategoryForm({ kind: 'expense', onDone: (c) => { sel.add(new Option(c.name, c.id)); sel.value = c.id; sel.dispatchEvent(new Event('change', { bubbles: true })); } }) }));
    updateItemLeft(); fillItemSugg();
  }
  // chips of items you usually list for this "What is it?" (or category); tap one to add it with its usual category
  function fillItemSugg() {
    const el = $f('itemsugg'); if (!el) return;
    const list = itemsForWhat(get(), f.name, f.cat, f.items.map((x) => x.n));
    el.innerHTML = list.length ? `<small class="hint">${f.name.trim() ? `Often on "${esc(f.name.trim())}"` : 'Often listed'}:</small>` + list.map((s, k) => `<button type="button" class="chip" data-e="item-sug" data-v="${k}">+ ${esc(s.n)}</button>`).join('') : '';
    el._list = list;
  }
  function updateItemLeft() {
    const el = $f('itemleft'); if (!el) return;
    const a = acctOf(f.acct); const total = num(f.amount) || 0; const left = total - itemSum();
    const cur = a ? a.cur : HOME;
    el.className = Math.abs(left) < 0.005 ? 'ok' : 'off';
    el.textContent = Math.abs(left) < 0.005 ? 'Items add up to the total' : (left > 0 ? `${fmt(left, cur)} not assigned yet` : `Items are ${fmt(-left, cur)} over the total`);
  }
  // Count by group (Advanced): how many drinks, snacks... no names, no prices. Sukli works out roughly what each group costs from many receipts.
  function partsHint() {
    const pts = f.kind === 'expense' && !document.body.classList.contains('simple') && f.name !== f.partsOff ? splitParts(f.name) : null;
    const listHint = pts && !parseRoute(f.name) ? `<p class="relhint partshint">Looks like one receipt with ${pts.length} things (${esc(pts.map((x) => (x.k > 1 ? x.k + ' ' : '') + x.n).join(', '))}). The total is split between them. ${button({ label: 'Count them by group', kind: 'link', e: 'parts-use' })} <button type="button" class="linkbtn muted" data-e="parts-off">Not a list</button></p>` : '';
    return listHint;
  }
  // "Paid for others": you paid the whole bill and part of it belongs to other people (one or many, equal / amounts / percent, with or without your own share).
  // Your part is the expense; each person's part is a Lent transfer to their line under Owed to you. Nothing of theirs counts as your spending.
  const owedPeople = () => get().accounts.filter((x) => !x.deleted && !x.archived && isOwed(x));
  const r2c = (x) => Math.round(x * 100) / 100;
  const newOth = () => ({ on: true, mode: 'equal', me: true, rows: [{ who: (owedPeople()[0] || {}).id || '', v: '' }] });
  function othParts() {
    const o = f.others || newOth(), T = num(f.amount) || 0, rows = o.rows.filter((r) => r.who), n = rows.length; let list = [], mine = 0, err = '';
    if (new Set(rows.map((r) => r.who)).size !== n) err = 'Choose each person only once.';
    if (o.mode === 'equal') {
      const parts = n + (o.me ? 1 : 0), sh = parts ? r2c(T / parts) : 0; list = rows.map((r) => ({ who: r.who, amt: sh }));
      const diff = r2c(T - sh * n); if (o.me) mine = Math.max(0, diff); else if (list.length) list[list.length - 1].amt = r2c(sh + diff);
    } else if (o.mode === 'amount') {
      list = rows.map((r) => ({ who: r.who, amt: r2c(num(r.v) || 0) })); const sum = list.reduce((q, x) => q + x.amt, 0); mine = r2c(T - sum);
      if (T > 0 && mine < -0.004) err = err || 'Their parts add up to more than the bill.';
      if (T > 0 && !o.me && Math.abs(mine) > 0.004) err = err || 'Their parts must add up to the whole bill when you are not part of it.';
      if (o.me) mine = Math.max(0, mine); else mine = 0;
    } else {
      const P = rows.reduce((q, r) => q + (num(r.v) || 0), 0); list = rows.map((r) => ({ who: r.who, amt: r2c(T * (num(r.v) || 0) / 100) }));
      if (P > 100.004) err = err || 'The percentages add up to more than 100.';
      if (!o.me && Math.abs(P - 100) > 0.004) err = err || 'The percentages must add up to 100 when you are not part of the bill.';
      const sum = list.reduce((q, x) => q + x.amt, 0); if (o.me) mine = Math.max(0, r2c(T - sum)); else { mine = 0; const d = r2c(T - sum); if (list.length && Math.abs(d) < 0.05) list[list.length - 1].amt = r2c(list[list.length - 1].amt + d); }
    }
    return { total: T, list, mine, err };
  }
  function othSum() {
    const el = $f('oth-sum'); if (!el) return; const a = acctOf(f.acct), c = (a && a.cur) || HOME, P = othParts(), nm = (id) => { const x = acctOf(id); return x ? x.name : '?'; }, m = (n) => esc(fmt(n, c, { force: true }));
    el.innerHTML = P.total > 0 ? `${f.others.me ? `You (spending): <b>${m(P.mine)}</b> · ` : 'You paid it all and are not part of it · '}${P.list.map((x) => `${esc(nm(x.who))}: <b>${m(x.amt)}</b>`).join(' · ') || 'choose who you paid for'}${P.err ? `<br><span class="oth-err">${esc(P.err)}</span>` : ''}` : 'Type the total first.';
  }
  function othersHtml() {
    if (f.kind !== 'expense' || existing) return '';
    if (!f.others || !f.others.on) return `<button type="button" class="linkbtn split" data-e="oth-on">${ic('split')} Paid for others? (they pay you back later)</button>`;
    const o = f.others, ppl = owedPeople(), mode = o.mode, ph = mode === 'pct' ? '%' : 'Amount';
    return `<div class="field items othbox" id="othbox"><div class="othhead"><b>Paid for Others</b>${button({ label: 'Cancel', kind: 'ghost', size: 'sm', e: 'oth-off' })}</div><small class="hint">Their parts are not your spending. Each waits under Owed to You until that person pays you back.</small>
      <div class="chips othmode">${[['equal', 'Split Equally'], ['amount', 'Set Each Amount'], ['pct', 'Percentages']].map(([k, l]) => `<button type="button" class="chip ${mode === k ? 'on' : ''}" data-e="oth-mode" data-v="${k}">${l}</button>`).join('')}</div>
      <div id="othrows">${o.rows.map((r, i) => `<div class="cnt othrow" data-i="${i}"><select class="oth-who" aria-label="Who owes you"><option value="">Choose a person</option>${ppl.filter((x) => x.id === r.who || !o.rows.some((q, j) => j !== i && q.who === x.id)).map((x) => `<option value="${x.id}" ${r.who === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="__new">+ Add a new person</option></select>${mode === 'equal' ? '' : `<div class="inamt othamt"><input class="oth-n" data-noclear="1" inputmode="decimal" placeholder="${ph}" value="${esc(r.v || '')}" aria-label="${mode === 'pct' ? 'Percent they owe, you can type a sum' : 'Amount they owe, you can type a sum like 120+45'}"><button type="button" class="calcin" data-e="oth-calc" data-v="${i}" aria-label="Calculator: type a sum such as 120+45, then tap =" title="Calculator">=</button></div>`}${o.rows.length > 1 ? `<button type="button" class="iconbtn" data-e="oth-del" data-v="${i}" aria-label="Remove person">${ic('x')}</button>` : ''}</div>`).join('')}</div>
      <div class="itemfoot">${button({ label: '+ Add another person', kind: 'link', e: 'oth-add' })}</div>
      <label class="check"><input type="checkbox" class="oth-me" ${o.me ? '' : 'checked'}> <span>I paid the bill but I am not part of it (I did not use any of it)</span></label>
      <p class="hint" id="oth-sum"></p>
</div>`;
  }
  /* each person can be in the bill only once: choosing someone again takes them out of the row they were in before */
  function othOnce(i) { const w = f.others.rows[i].who; if (!w) return; const gone = []; f.others.rows.forEach((r, j) => { if (j !== i && r.who === w) gone.push(j); });
    if (!gone.length) return; for (const j of gone.reverse()) { if (f.others.rows.length > 1) { f.others.rows.splice(j, 1); if (j < i) i -= 1; } else f.others.rows[j].who = ''; } toast('That person was already in this bill, so the earlier line was removed.'); renderCounts(); }
  async function othNew(i) {
    const n = (await promptDialog('Who did you pay for?', '', { okLabel: 'Add', hint: 'A name is enough, for example Ana or Kuya Ben.' }))?.trim(); if (!n) { f.others.rows[i].who = ''; renderCounts(); return; }
    const ex = get().accounts.find((x) => !x.deleted && isOwed(x) && x.name.toLowerCase() === n.toLowerCase()); const id = ex ? ex.id : uid();
    if (!ex) commit((d) => { d.accounts.push(stamp({ id, name: n, cur: HOME, type: 'owed', open: 0, include: true, archived: false })); });
    f.others.rows[i].who = id; othOnce(i); renderCounts();
  }
  function renderCounts() {
    const el = $f('countsrow');
    if (f.kind !== 'expense') { el.innerHTML = ''; return; }
    const ph = partsHint();      // below the keypad on purpose: a row appearing above it would move the keys while typing
    if (!f.showCounts) { el.innerHTML = ph + `<button type="button" class="linkbtn split" data-e="counts-on">${ic('split')} Count by group (drinks, snacks...)</button>` + othersHtml(); othSum(); return; }
    const db3 = get(), gs = Object.keys(groupsOf(db3));
    el.innerHTML = ph + box({ title: 'Count by Group', hint: 'No names or prices, just how many.', cancel: { e: 'counts-off' }, cls: 'items countbox', body: `
      <div id="countlist">${f.counts.map((c, i) => `<div class="cnt" data-i="${i}">
        <select class="cnt-g" aria-label="Group"><option value="">Choose group</option>${gs.map((g) => `<option value="${esc(g)}" ${c.g === g ? 'selected' : ''}>${esc(g)}${unitOf(db3, g) === 'kg' ? ' (kg)' : ''}</option>`).join('')}</select>
        <input class="cnt-n" inputmode="decimal" placeholder="${c.g && unitOf(db3, c.g) === 'kg' ? 'kg, e.g. 0.35' : 'how many'}" value="${esc(c.n)}" aria-label="How many">
        ${button({ label: 'Remove', kind: 'link', cls: 'rm', e: 'count-del', v: i, aria: 'Remove this group' })}</div>`).join('')}</div>
      <div class="itemfoot">${button({ label: '+ Add group', kind: 'link', e: 'count-add' })}</div>` }) + othersHtml(); othSum();
    el.querySelectorAll('select.cnt-g').forEach((sel) => enhanceSelect(sel, { title: 'Group', addLabel: 'Add a new group', onAdd: async () => {
      const nm = await promptDialog('New group', '', { okLabel: 'Next', hint: 'Group by price level, for example "drinks" and "ready meals" apart.' }); if (!nm || !nm.trim()) return;
      const kg = await confirmDialog('Is it counted by weight (kg)?', 'Yes, by weight', false, 'No, by pieces');
      const g = addGroup(nm, kg ? 'kg' : 'pc'); if (!g) return; sel.add(new Option(g, g)); sel.value = g; sel.dispatchEvent(new Event('change', { bubbles: true })); } }));
  }
  // optional "posted" date for a card entry: it counts in the statement of that day (for a charge made on the statement day that the bank posts the next day)
  function renderPosted() {
    const el = $f('postedrow'), a = acctOf(f.acct), show = f.kind !== 'transfer' && a && a.type === 'card' && a.stmtDay > 0;
    if (!show) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false; const day = String(f.date).slice(0, 10);
    if (f.postedOn && (!f.posted || f.posted <= day)) f.posted = addDay(day, 1);
    if (!f.postedOn) { el.innerHTML = `${button({ label: 'Posted on a later day? (optional)', kind: 'link', e: 'postedon' })}`; return; }
    const p = periodFor(a, f.posted);
    el.innerHTML = `<div class="field"><span>Posted date ${button({ label: 'Remove', kind: 'link', e: 'postedoff' })}</span><button type="button" class="whenbtn" data-e="posted">${esc(prettyDate(f.posted + ' 00:00:00').split(' · ')[0])}${ic('calendar')}</button><small class="muted">Counts in the statement ${p ? esc(p.label) : ''}, not the one for ${esc(prettyDate(f.date).split(' · ')[0])}.</small></div>`;
  }
  function renderWhen() {
    const pd = prettyDate(f.date);
    if (f.kind === 'transfer') { $f('f-when').innerHTML = `<span>${esc(pd)}</span>${ic('calendar')}`; return; }
    const [d, t] = pd.split(' · '), cy = String(new Date().getFullYear());                  // beside Account there is little room: date on top, time under it
    $f('f-when').innerHTML = `<span class="w2"><b>${esc(d.replace(new RegExp(',? ' + cy + '$'), ''))}</b>${t ? `<small>${esc(t)}</small>` : ''}</span>${ic('calendar')}`;
  }
  function renderBtns() {
    $f('btns').innerHTML = `${existing ? `${button({ label: 'Delete', kind: 'danger-ghost', e: 'del' })}` : ''}
      ${existing ? '' : `${button({ label: 'Save and add another', kind: 'ghost', e: 'save-again' })}`}
      ${button({ label: 'Save', kind: 'primary', e: 'save' })}`;
  }
  // warnings: budget and spending limit, income, card bills, cash for upcoming payments
  let safeTimer;
  function renderSafety() {
    clearTimeout(safeTimer);
    safeTimer = setTimeout(() => {
      const el = $f('safety'); if (!el) return;
      if (f.kind !== 'expense' && f.kind !== 'transfer') { el.innerHTML = ''; return; }
      const cm = catMap(get()), c = cm.get(f.cat);
      const list = f.kind === 'expense' ? safetyCheck(get(), { amount: num(f.amount), acctId: f.acct, kind: f.kind, date: f.date, group: c ? c.group : '' }) : [];
      const fa = acctOf(f.acct); if (fa && (fa.promos || []).length) { const li = lockInfo(get(), fa, (f.date || '').slice(0, 10) || undefined); if (li.locked > 0 && num(f.amount) > li.available) list.push({ level: 'warn', text: `${fmt(li.locked, fa.cur)} in ${fa.name} is locked until ${li.nextUnlock}. Taking out more than ${fmt(li.available, fa.cur)} may cost you the promo rate.` }); }
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
      list = q ? transferHints(get()).names.filter((x) => x.name.toLowerCase().includes(q) && x.name !== f.name.trim()).sort((a, b) => b.n - a.n).slice(0, 5)
        .map((x) => ({ name: x.name, n: x.n, route: `${(am.get(x.from) || {}).name || '?'} → ${(am.get(x.to) || {}).name || '?'}` })) : [];
    } else list = suggest(modelFor(f.kind), f.name, 5).filter((x) => x.name !== f.name.trim());   // only hide a suggestion that is exactly what is typed: "Gu" still offers "GU"
    el.hidden = !list.length; const wf = $f('f-what'); if (wf) wf.setAttribute('aria-expanded', String(!!list.length));
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
    if (f.from.trim() && f.to.trim() && (!f.name.trim() || f.name === f.autoName || parseRoute(f.name) || bareMode(f.name))) { f.name = tripLabel(modeNow(), f.from, f.to); f.autoName = f.name; $f('f-what').value = f.name; refreshPred(); renderSugg(); renderNameHelp(); }
    if (f.from.trim() && f.to.trim() && !f.catTouched) { const x = suggestTrips(get(), isTransportCat(get().categories), { hour: hourOf(f.date), from: f.from, to: f.to, limit: 1 })[0]; if (x && x.cat && x.cat !== f.cat) { f.cat = x.cat; f.guessWhy = 'your usual for this trip'; renderCats(); } }
  }
  function pickTrip(x) {
    f.from = x.from; f.to = x.to; if (!f.name.trim() || f.name === f.autoName || parseRoute(f.name) || bareMode(f.name)) { f.name = tripLabel(modeNow(), x.from, x.to); f.autoName = f.name; $f('f-what').value = f.name; }
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
  // tag or event: pick one you used before, or add a new one (several are fine)
  // Cashback: a percentage or a fixed amount, saved as its own linked income entry
  const cbAmount = () => { const am = num(f.amount) || 0, v = num(f.cb.v) || 0, dec = (CUR[(acctOf(f.acct) || {}).cur] || { dec: 2 }).dec; const x = f.cb.mode === 'pct' ? am * v / 100 : v; return +Math.min(Math.max(x, 0), am || x).toFixed(dec); };
  function cbText() { const a = acctOf(f.acct), cur = a ? a.cur : HOME, v = cbAmount(); return v > 0 ? `Cashback: ${fmt(v, cur)}${f.cb.mode === 'pct' ? ` (${f.cb.v}% of ${fmt(num(f.amount) || 0, cur)})` : ''}` : 'Type the cashback you get.'; }
  function renderCb() {
    const el = $f('cbrow'); if (!el) return; el.hidden = f.kind !== 'expense' || f.debt; if (el.hidden) return;
    if (!f.cb.on) { el.innerHTML = '' + button({ label: '+ Cashback', kind: 'link', e: 'cb-on' }) + ''; return; }
    el.innerHTML = `<span>Cashback</span>${seg({ options: [{ label: 'Fixed Amount', value: 'fixed' }, { label: 'Percentage', value: 'pct' }], value: f.cb.mode, e: 'cb-mode', aria: 'Cashback type', cls: 'cbseg' })}
      <div class="two"><input id="f-cbv" inputmode="decimal" autocomplete="off" aria-label="${f.cb.mode === 'pct' ? 'Cashback percent' : 'Cashback amount'}" placeholder="${f.cb.mode === 'pct' ? 'e.g. 5' : 'e.g. 50'}" value="${esc(f.cb.v)}">${button({ label: 'Remove', kind: 'chip', e: 'cb-off' })}</div><small class="muted" id="cbcalc">${esc(cbText())}</small>`;
  }
  const updCb = () => { const c = $f('cbcalc'); if (c) c.textContent = cbText(); };
  // Branch of the merchant (Life > Tsukagoshi): below the keypad, shown once a merchant is chosen
  function renderBranch() {
    const bh = $f('branchrow'); if (bh) bh.hidden = true;   // the old separate row is no longer used
    const el = form.querySelector('#branchcell'); if (!el) return;
    const far = f.merchant && f.branch ? branchFar(get(), f.merchant, f.branch, f.loc) : 0, note = f.branchSuggested && f.branch ? `<small class="sugnote">· ${esc(f.branchSuggested)}</small>` : far ? `<small class="sugnote warn">· ${far.toFixed(1)} km from here</small>` : '';
    el.innerHTML = f.merchant ? `<span>Branch (optional) ${note}</span><button type="button" class="acctbtn" data-e="branchpick">${f.branch ? esc(f.branch) : '<span class="muted">Which branch?</span>'} ▾</button>` : `<span>Branch (optional)</span><button type="button" class="acctbtn" disabled><span class="muted">Pick a merchant first</span></button>`;
  }
  function autoBranch() {   /* suggest a branch for the merchant: the one near this place, else the one used last; never over a branch the person chose */
    if (f.branchTouched || !f.merchant || f.kind !== 'expense' || (existing && existing.branch)) return;
    const g = suggestBranch(get(), f.merchant, f.loc);
    if (g && g.name !== f.branch) { f.branch = g.name; f.branchSuggested = g.why; renderBranch(); } else if (!g && f.branchSuggested) { f.branch = ''; f.branchSuggested = ''; renderBranch(); }
  }
  async function pickBranch() {
    const { branchesOf } = await import('./merchantset.js'); const list = branchesOf(get(), f.merchant);
    const s = sheet(`<div class="rows plain"><button type="button" class="row cur" data-b=""><span class="rmain"><strong class="onel">No branch</strong></span></button>${list.map((b) => `<button type="button" class="row cur" data-b="${esc(b.name)}"><span class="rmain"><strong>${esc(b.name)}</strong><small>${b.n} ${b.n === 1 ? 'entry' : 'entries'}</small></span></button>`).join('')}</div><div class="btnrow left"><button type="button" class="btn ghost" data-new>Add a New Branch</button></div>`, { title: `${f.merchant}: Branch`, cls: 'pickfix' });
    s.el.addEventListener('click', async (e) => { const r = e.target.closest('[data-b]'); if (r) { s.close(); f.branch = r.dataset.b; f.branchTouched = true; f.branchSuggested = ''; renderBranch(); return; }
      if (e.target.closest('[data-new]')) { s.dispose(); let v = ((await promptDialog('New branch', '', { okLabel: 'Add', hint: `A place of ${f.merchant}, for example Kawasaki Station.` })) || '').replace(/\s+/g, ' ').trim(); if (!v) return; v = titleCase(v);   /* branch names are saved in Title Case */ f.branch = v; f.newBranch = v; f.branchTouched = true; f.branchSuggested = ''; renderBranch(); } });
  }
  // Current Location: below the keypad, so nothing above it moves
  function renderLoc() {
    autoBranch();
    const el = $f('locrow'); if (!el) return; const L = f.locUi || (f.locUi = { perm: 'unknown', msg: '', edit: false });
    const pt = f.loc, permTxt = { granted: 'Location permission: allowed', denied: 'Location permission: blocked. Allow it in your phone’s settings for this app, or type a place below.', prompt: 'Location permission: will ask when you tap', unknown: 'Location permission: not known yet (your phone asks when you tap)' }[L.perm];
    el.innerHTML = `<span>Location (optional)</span><div class="locbox"><button type="button" class="acctbtn" data-e="loc-get">${pt ? `📍 ${f.place ? esc(f.place) : L.busy ? 'Finding the address…' : 'Location saved, address not found yet'}` : 'Add Location'}</button>
      <div class="chips">${pt ? (f.place ? '' + button({ label: 'Edit Address', kind: 'chip', e: 'addr-edit' }) + '' : '' + button({ label: 'Show Address', kind: 'chip', e: 'addr-get' }) + '') + '' + button({ label: 'Remove', kind: 'chip', e: 'loc-clear' }) + '' + button({ label: '\' + (L.detail ? \'Hide Details\' : \'Details\') + \'', kind: 'chip', e: 'loc-detail' }) + '' : ''}${button({ label: 'Pick on Map', kind: 'chip', e: 'loc-map' })}<button type="button" class="chip" data-e="loc-edit">${L.edit ? 'Close' : 'Type It'}</button></div></div>
      ${pt && L.detail ? `<pre class="locjson" aria-label="Location details">${esc(JSON.stringify({ latitude: pt.la, longitude: pt.lo, address: f.place || null, approx: 'about 1 km' }, null, 2))}</pre>` : ''}
      ${L.edit ? `<input id="f-loc" inputmode="decimal" placeholder="Latitude, longitude (e.g. 35.53, 139.69)" value="${pt ? `${pt.la}, ${pt.lo}` : ''}" aria-label="Location as latitude and longitude">` : ''}
      ${pt && L.addrEdit ? `<input id="f-place" autocomplete="off" placeholder="Type the address or place name" value="${esc(f.place || '')}" aria-label="Address">` : ''}
      <small class="muted">${esc(permTxt)}</small>${L.msg ? `<small class="locmsg">${esc(L.msg)}</small>` : ''}`;
  }
  const fillAddr = () => { if (f.loc && !f.place) { const c = cachedAddress(get(), f.loc); if (c) f.place = c; } };
  async function getAddr() {
    const L = f.locUi; if (!f.loc) return; L.msg = 'Looking up the address (one request, then it is kept)…'; L.busy = true; renderLoc();
    const r = await lookupAddress(f.loc); L.busy = false;
    if (r.text && existing && existing.loc && !existing.place) commitQuiet((d) => { const t = d.txs.find((q) => q.id === existing.id); if (t && !t.place) t.place = r.text; });
    if (r.text) { f.place = r.text; L.msg = r.cached ? 'Address from your saved places.' : 'Address found. Tap Edit Address if it is not right.'; }
    else L.msg = r.err === 'busy' ? 'The address service is busy. Try again in a minute, or type the address.' : r.err === 'none' ? 'No address found for this spot. Type one with Edit Address.' : 'Could not reach the address service. Try again later, or type the address.';
    renderLoc();
  }
  async function getLoc() {
    const L = f.locUi || (f.locUi = { perm: 'unknown', msg: '', edit: false }); L.msg = 'Finding where you are…'; renderLoc();
    const r = await hereWhy(); L.perm = await permState();
    if (r.p) { f.loc = r.p; f.place = ''; fillAddr(); L.msg = 'Saved with this entry (about 1 km accuracy). Tap Remove to drop it.'; if (L.perm === 'unknown') L.perm = 'granted'; renderLoc(); if (!f.place) await getAddr(); return; }
    else { L.msg = r.err === 'denied' ? 'Location is blocked for this app. Allow it in your phone’s settings, or type a place with Type It.' : r.err === 'timeout' ? 'Could not find you in time. Try again, or type it.' : 'Location is not available on this device. You can type it.'; if (r.err === 'denied') L.perm = 'denied'; }
    renderLoc();
  }
  function renderTags() {
    const el = $f('tagsrow'); if (!el) return;
    const on = parseTags(f.labels), onSet = new Set(on.map((x) => x.toLowerCase())), more = tagCounts(get()).filter((x) => !onSet.has(x.tag.toLowerCase())).slice(0, 8);
    el.innerHTML = `<span>Tag or event (optional) ${tipBtn('tags')}</span><div class="chips tagchips">${on.map((x) => `<button type="button" class="chip on" data-e="tag" data-v="${esc(x)}" aria-pressed="true">#${esc(x)} ×</button>`).join('')}${more.map((x) => `<button type="button" class="chip" data-e="tag" data-v="${esc(x.tag)}" aria-pressed="false">#${esc(x.tag)}</button>`).join('')}${button({ label: '+ New tag', kind: 'chip', e: 'newtag' })}</div>`;
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
  function pickCat(id) { const nm = $f('f-what'); if (nm && nm.value !== f.name) f.name = nm.value; if (!f.catTouched && f.cat && f.cat !== id) f.guessed = f.cat; f.cat = id; f.catTouched = true; }

  // a new name that looks like one you already use: ask, remember the answer
  // labels like "Loan Payment", "Credit Card Payment", "Credit to Cash" point to a different kind of entry: offer it (never switches by itself)
  function renderSmart() {
    let el = form.querySelector('#smarthint');
    if (!el) { const nf = $f('namefield'); if (!nf) return; el = document.createElement('div'); el.id = 'smarthint'; nf.after(el); }
    const k = smartKind(f.name); let html = '';
    if (k === 'cash') html = `${button({ label: 'Credit to cash: see the fees and interest first', kind: 'chip', e: 'smart', v: 'cash' })}`;
    else if (k === 'loan') html = `${button({ label: 'Taking a loan? Open the loan planner', kind: 'chip', e: 'smart', v: 'loan' })}`;
    else if ((k === 'cardpay' || k === 'loanpay') && !(f.kind === 'transfer' && f.debt)) html = `<button type="button" class="chip" data-e="smart" data-v="${k}">Paying ${k === 'cardpay' ? 'your card' : 'your loan'}? Use Debt</button>`;
    el.innerHTML = html ? `<div class="chips">${html}</div>` : '';
  }
  function smartAct(v) {
    if (v === 'cash') return openLoanPlanner({ kind: 'cash' });
    if (v === 'loan') return openLoanPlanner({ kind: 'personal' });
    const accts = get().accounts.filter((a) => !a.deleted && !a.archived), t = accts.filter((a) => (v === 'cardpay' ? a.type === 'card' : a.type === 'loan' || a.loan) && a.id !== f.acct).sort((x, y) => (y.loan ? 1 : 0) - (x.loan ? 1 : 0))[0];
    form.querySelector('[data-e=kind][data-v=debt]').click();
    if (t) { f.toAcct = t.id; if (!num(f.amount) && t.loan && t.loan.monthly) { f.amount = String(t.loan.monthly); $f('f-amount').value = f.amount; } renderAccts(); renderFx(); syncCross(); }
  }
  function renderNameHelp() {
    let el = form.querySelector('#namehelp');
    if (!el) { const nf = $f('notesrow'); if (!nf) return; el = document.createElement('div'); el.id = 'namehelp'; el.className = 'namehelp'; nf.after(el); }
    const c = f.kind === 'transfer' ? [] : similarNames(get(), f.name, 1);
    const rel = f.kind === 'transfer' || !f.name.trim() ? [] : relatedNames(get(), f.name).slice(0, 2);
    el.innerHTML = c.map((x) => compareCard(get(), f.name.trim(), x.name)).join('') + (c.length ? '' : rel.map((x) => `<p class="relhint muted">Related to <b>${esc(x.name)}</b>${x.cat ? ` (${esc(x.cat)})` : ''}, ${Math.round(x.w * 100)}% close. It keeps its own category.</p>`).join(''));
  }
  function applyPick(name) {
    f.name = name; $f('f-what').value = name;
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
    focusKeep($f(num(f.amount) ? 'f-what' : 'f-amount'));
  }
  function pickRoute(from, to) {
    const h = transferHints(get()).routes.find((r) => r.from === from && r.to === to);
    f.acct = from; f.toAcct = to; f.acctTouched = true; f.feeTouched = false;
    if (h) { if (!f.name.trim() && h.name) { f.name = h.name; $f('f-what').value = h.name; } if (!num(f.amount) && h.amount) { f.amount = String(h.amount); $f('f-amount').value = f.amount; } }
    renderAccts(); renderFx(); syncCross(); renderSugg();
    focusKeep($f(num(f.amount) ? 'f-what' : 'f-amount'));
  }

  // ---------- events ----------
  form.addEventListener('focusout', (e) => { if (e.target.id === 'f-amount') formatAmountInput(e.target); if (e.target.id === 'f-what' && titleOn()) { const v = titleCase(e.target.value); if (v !== e.target.value) { e.target.value = v; f.name = v; renderNameHelp && renderNameHelp(); } } });
  form.addEventListener('input', (e) => {
    const id = e.target.id;
    if (id === 'f-amount') {
      formatAmountInput(e.target); f.amount = e.target.value; if (f.feeMode === 'pct') { recalcFee(); const fc = $f('feecalc'); if (fc) fc.textContent = feeCalcTxt(); } showCalcRes(); syncX(); updateFxVal(); heavy(); othSum(); updCb(); updateItemLeft();
    }
    else if (e.target.classList.contains('oth-n')) { f.others.rows[+e.target.closest('.othrow').dataset.i].v = e.target.value; othSum(); }
    else if (id === 'f-cbv') { f.cb.v = e.target.value; updCb(); }
    else if (e.target.classList.contains('in-d')) { const it = f.items[+e.target.closest('.item').dataset.i]; if (it && it.disc) { it.disc.v = e.target.value; const ln = e.target.closest('.item').querySelector('.iline'); if (ln) ln.innerHTML = itemLine(it); updateItemLeft(); const tc = $f('taxcalc'); if (tc) tc.textContent = taxText(); } }
    else if (e.target.classList.contains('in-t')) { const it = f.items[+e.target.closest('.item').dataset.i]; if (it && it.tx) { it.tx.v = e.target.value; const ln = e.target.closest('.item').querySelector('.iline'); if (ln) ln.innerHTML = itemLine(it); const sg = e.target.closest('.itax').querySelector('.seg'); if (sg) sg.querySelectorAll('button').forEach((bt) => { const on = bt.dataset.v && bt.dataset.v.split(':')[1] === String(it.tx.v); bt.classList.toggle('on', !!on); bt.setAttribute('aria-pressed', String(!!on)); }); updateItemLeft(); const tc = $f('taxcalc'); if (tc) tc.textContent = taxText(); } }
    else if (id === 'f-wdv') { f.wd.v = e.target.value; const wc = $f('wdcalc'); if (wc) wc.textContent = wdText(); const tc = $f('taxcalc'); if (tc) tc.textContent = taxText(); updateItemLeft(); }
    else if (id === 'f-taxv') { f.tax.v = e.target.value; const tc = $f('taxcalc'); if (tc) tc.textContent = taxText(); updateItemLeft(); }
    else if (id === 'f-fee') { if (f.feeMode === 'pct') { f.feePct = e.target.value; recalcFee(); const fc = $f('feecalc'); if (fc) fc.textContent = feeCalcTxt(); } else f.fee = e.target.value; f.feeTouched = true; f.feeSuggested = false; }
    else if (id === 'f-from' || id === 'f-to') { if (id === 'f-from') f.from = e.target.value; else f.to = e.target.value; tripName(); tripChips(); }
    else if (id === 'f-place') { f.place = e.target.value.trim(); if (f.loc) saveAddress(f.loc, f.place); f.locUi.msg = f.place ? 'Address saved for this place.' : ''; }
    else if (id === 'f-loc') { const q = parsePt(e.target.value); if (q) { f.loc = q; f.place = ''; fillAddr(); f.locUi.msg = 'Saved with this entry.'; if (!f.place) setTimeout(getAddr, 0); } else if (!e.target.value.trim()) { f.loc = null; f.locUi.msg = 'Location removed.'; } else f.locUi.msg = 'Type latitude and longitude, like 35.53, 139.69.'; renderLoc(); }
    else if (id === 'f-what') { f.name = e.target.value; if (f.showItems) fillItemSugg(); renderNameHelp(); if (!document.activeElement || !document.activeElement.closest || !document.activeElement.closest('#countsrow')) renderCounts(); suggestAcct(); suggestMerchant(); refreshPred(); renderSugg(); if (f.kind !== 'transfer' && !f.qtabManual) renderFreq(); }
    else if (id === 'f-fx') { f.fx = e.target.value; f.fxMode = 'rate'; updateFxVal(); }
    else if (id === 'f-peso') { f.peso = e.target.value; f.fxMode = 'peso'; updateFxVal(); }
    else if (id === 'f-crate') { f.cRate = e.target.value; syncCross('rate'); }
    else if (id === 'f-toamt') { f.toAmount = e.target.value; syncCross('to'); const dn = $f('diffnote'); if (dn && f.sameDiff) dn.textContent = diffNote(f, acctOf(f.acct)); }
    else if (id === 'f-notes') f.notes = e.target.value;
    else if (e.target.classList.contains('cnt-n')) f.counts[+e.target.closest('.cnt').dataset.i].n = e.target.value;
    else if (e.target.closest('.item')) {
      const row = e.target.closest('.item'), i = +row.dataset.i, it = f.items[i];
      if (e.target.classList.contains('in-n')) {
        it.n = e.target.value;
        if (!it.catTouched) {
          const sel = row.querySelector('.in-c'); let c = '';
          const g = it.n.trim().length > 1 ? guessItemCat(get(), it.n) : null;           // what you chose before, then a word list (Meat, Rice, Coke...)
          if (g) c = g.cat; else { const p = predict(modelFor('expense'), it.n, num(it.amt) || 0, {}); if (p.cats[0] && it.n.trim().length > 2 && p.conf > 0.35) c = p.cats[0].id; }
          if (c !== it.cat) { it.cat = c; f._autoCat = true; sel.value = c; sel.dispatchEvent(new Event('change', { bubbles: true })); f._autoCat = false; }
        }
      } else if (e.target.classList.contains('in-a')) { it.amt = e.target.value; updateItemLeft(); { const tc = $f('taxcalc'); if (tc) tc.textContent = taxText(); } const ln = row.querySelector('.iline'); if (ln && isExpr(it.amt) && num(it.amt) > 0) ln.textContent = '= ' + tidy(num(it.amt)) + (it.q > 1 ? `  ·  ${it.q} × = ${lineOf(it)}` : ''); else if (ln) ln.textContent = it.q > 1 ? `${it.q} × ${it.amt || 0} = ${lineOf(it)}` : ''; }
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
      if (cur === '__more') { renderCur(); openCurrencyPicker((c) => choose(c), { title: 'More Currencies' }); }
      else await choose(cur);
    }
    else if (id === 'f-feecat') { f.feeCat = e.target.value; f.feeTouched = true; f.feeSuggested = false; renderFee(); }
    else if (e.target.classList.contains('in-c')) { const it = f.items[+e.target.closest('.item').dataset.i]; it.cat = e.target.value; if (!f._autoCat) it.catTouched = true; }
    else if (e.target.classList.contains('oth-who')) { const i = +e.target.closest('.othrow').dataset.i; if (e.target.value === '__new') othNew(i); else { f.others.rows[i].who = e.target.value; renderCounts(); } }
    else if (e.target.classList.contains('oth-me')) { f.others.me = !e.target.checked; othSum(); }
    else if (e.target.classList.contains('cnt-g')) { const c = f.counts[+e.target.closest('.cnt').dataset.i]; c.g = e.target.value; const inp = e.target.closest('.cnt').querySelector('.cnt-n'); if (inp) inp.placeholder = c.g && unitOf(get(), c.g) === 'kg' ? 'kg, e.g. 0.35' : 'how many'; }
  });
  form.addEventListener('focusout', (e) => {
    if (e.target.classList && e.target.classList.contains('in-a')) { const it = f.items[+e.target.closest('.item').dataset.i]; if (it && isExpr(it.amt) && num(it.amt) > 0) { const v = tidy(num(it.amt)); it.amt = v; e.target.value = v; updateItemLeft(); const ln = e.target.closest('.item').querySelector('.iline'); if (ln) ln.textContent = it.q > 1 ? `${it.q} × ${v} = ${lineOf(it)}` : ''; } }
    if (e.target.id === 'f-amount' && isExpr(f.amount) && !f.calc) { const v = num(f.amount); if (v > 0) { f.amount = tidy(v); e.target.value = f.amount; showCalcRes(); updateFxVal(); } }
  });
  // tapping a suggestion must not take focus from the text box (no blur, no re-focus, so Safari never shows the contact bar)
  form.addEventListener('mousedown', (e) => { if (e.target.closest('#sugg')) e.preventDefault(); });
  // Touch: choose on lift-off instead of waiting for the synthesized click, which the installed iPhone app can swallow or deliver to the wrong row
  let sgDown = null, sgDone = 0;
  form.addEventListener('pointerdown', (e) => { const b = e.pointerType !== 'mouse' && e.target.closest('#sugg [data-e=pick]'); sgDown = b ? { b, x: e.clientX, y: e.clientY } : null; });
  form.addEventListener('pointercancel', () => { sgDown = null; });
  form.addEventListener('pointerup', (e) => { const d = sgDown; sgDown = null; if (!d) return; const b = e.target.closest('#sugg [data-e=pick]');
    if (b !== d.b || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return; sgDone = Date.now(); applyPick(b.dataset.v); });
  form.addEventListener('focusout', () => setTimeout(() => { const el = $f('sugg'); if (el && !el.contains(document.activeElement) && document.activeElement !== $f('f-what')) el.hidden = true; }, 150));
  form.addEventListener('submit', (e) => { e.preventDefault(); save(false); });
  form.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-e]');
    if (!b) return;
    if (Date.now() - sgDone < 600 && b.dataset.e !== 'pick') return;   // the synthesized click after a touch pick lands on whatever moved up under the finger
    const v = b.dataset.v;
    switch (b.dataset.e) {
      case 'internal': { const a = acctOf(f.acct), id = existing ? existing.id : '', ok = existing && (existing.internal || true);
        if (existing && !(await confirmDialog('Replace this entry with an Internal Transfer? The entry goes to the recycle bin once the transfer is saved.', 'Continue'))) break;
        const { openInternal } = await import('./internal.js'); s.close(); openInternal({ asset: a && a.id, platform: a ? (a.exchange || '') : '', replaceId: id, amount: existing ? existing.amount : '' }); break; }
      case 'kind':
        { const was = f.debt; if (v === 'debt') { if (f.flow !== 'pay' && f.flow !== 'borrow') setFlow(f, 'pay'); f.kind = 'transfer'; } else if (v === 'lent') { if (f.flow !== 'lend' && f.flow !== 'back') setFlow(f, 'lend'); f.kind = 'transfer'; } else { f.flow = ''; f.kind = v; } f.debt = !!f.flow; if (was && !f.debt) { f.feeTouched = false; f.fee = ''; } } if (f.debt) { debtFix(f); f.feeTouched = true; f.fee = ''; f.convert = false; f.fx = ''; f.fxMode = 'rate'; f.peso = ''; } if (v !== 'expense') { f.items = []; f.showItems = false; }
        f.qtab = ''; f.qtabManual = false;
        if (!f.catTouched || f.kind === 'transfer') { f.cat = ''; f.catTouched = false; }
        else { const c = catMap(get()).get(f.cat); if (c && !(c.kind === f.kind || c.kind === 'both')) { f.cat = ''; f.catTouched = false; } }
        arrange(); renderSeg(); renderMerch(); renderBranch(); renderCb(); renderFreq(); renderAccts(); renderFx(); refreshPred(); renderCats(); renderItems(); renderCounts(); renderSugg(); renderSafety(); break;
      case 'flow': { setFlow(f, v); debtFix(f); f.feeTouched = true; f.fee = ''; f.convert = false; f.fx = ''; f.fxMode = 'rate'; f.peso = ''; renderSeg(); renderFreq(); renderAccts(); renderFx(); renderSugg(); renderSafety(); break; }
      case 'addperson': addPerson(); break;
      case 'debtamt': { f.amount = String(+(+v).toFixed(6)); const fa = $f('f-amount'); fa.value = commasOn() ? withCommas(f.amount) : f.amount; fa.dispatchEvent(new Event('input', { bubbles: true })); break; }
      case 'merchpick': openMerchantPicker({ selected: f.merchant }, (v) => { if (v !== f.merchant) { f.branch = ''; f.branchTouched = false; f.branchSuggested = ''; } f.merchant = v; f.merchTouched = true; f.merchSuggested = false; renderMerch(); renderBranch(); autoBranch(); }); break;
      case 'swapacct': { const t = f.acct; f.acct = f.toAcct; f.toAcct = t; f.acctTouched = true; f.acctSuggested = false; f.feeTouched = false; f.fx = ''; f.fxMode = 'rate'; f.peso = ''; f.cRate = ''; renderAccts(); renderFx(); syncCross(); renderSugg(); break; }
      case 'smart': smartAct(v); break;
      case 'qtab': f.qtab = v; f.qtabManual = true; renderFreq(); break;
      case 'pick': if (Date.now() - sgDone > 700) applyPick(v); break;
      case 'acctpick': { const to = b.dataset.which === 'to', sel = $f(to ? 'f-to' : 'f-acct'), a = acctOf(f.acct);
        openAccountPicker({ selected: sel.value, skip: to ? f.acct : (f.kind === 'transfer' ? f.toAcct : ''), cur: to ? '' : (a && a.cur) || '', only: f.debt ? (isPersonSide(to) ? FLOWS[f.flow].only : 'pay') : '', add: f.debt && f.flow === 'lend' && isPersonSide(to) ? { label: 'Add a new person', run: addPerson } : null, title: f.debt ? (isPersonSide(to) ? FLOWS[f.flow].pLabel : FLOWS[f.flow].mLabel) : to ? 'To account' : f.kind === 'transfer' ? 'From account' : 'Account' }, (id) => { sel.value = id; sel.dispatchEvent(new Event('change', { bubbles: true })); }); break; }
      case 'curpick': openCurrencyPicker((c) => { const sel = $f('f-cur'); if (![...sel.options].some((o) => o.value === c)) sel.add(new Option(c, c)); sel.value = c; sel.dispatchEvent(new Event('change', { bubbles: true })); }, { title: 'Currency' }); break;
      case 'route': pickRoute(b.dataset.from, b.dataset.to); break;
      case 'calc': f.calc = !f.calc; renderKeypad(); break;
      case 'k': keyPress(v); break;
      case 'postedon': f.postedOn = true; renderPosted(); break;
      case 'postedoff': f.postedOn = false; f.posted = ''; renderPosted(); break;
      case 'posted': openDatePicker(f.posted + ' 00:00:00', (val) => { const v = val.slice(0, 10), day = String(f.date).slice(0, 10); if (v <= day) { f.posted = addDay(day, 1); toast('The posted date must be after the entry date.'); } else f.posted = v; renderPosted(); }, { title: 'Posted Date', time: false }); break;
      case 'when': openDatePicker(f.date, (val) => { f.date = val; renderPosted(); renderWhen(); refreshPred(); renderSafety(); }, { title: 'When Was It?' }); break;
      case 'allamt': { const a0 = acctOf(f.acct); if (!a0) { toast('Choose the From account first.'); break; }
        let v = r9(balances(get()).get(f.acct) || 0); let fee = parseFloat(String(f.fee || '').replace(/,/g, '')) || 0;
        if (fee > 0 && f.feeSuggested && !f.feeTouched) { f.fee = ''; f.feeSuggested = false; f.feeTouched = true; fee = 0; const fe = $f('f-fee'); if (fe) fe.value = ''; toast('Moving the whole balance. The guessed fee was cleared. Type a fee if there is one.'); }
        if (f.feeBy !== 'to' && fee > 0) v = r9(v - fee);   // a fee taken from the sender comes out of the same balance
        if (!(v > 0)) { toast('There is nothing to move from this account.'); break; }
        const am = $f('f-amount'); am.value = exactAmt(v); am.dispatchEvent(new Event('input', { bubbles: true })); break; }
      case 'amtclear': { f.amount = ''; const am = $f('f-amount'); am.value = ''; showCalcRes(); syncX(); heavy(); if (!f.calc) am.focus(); break; }
      case 'samediff': f.toAmount = f.amount; f.diffInit = false; renderConv(); break;
      case 'fxopen': { const a = acctOf(f.acct); if (!a) break; openConverter({ from: a.cur, to: HOME, amount: num(f.amount), rate: num(f.fx), applyLabel: 'Use this rate',
        onApply: ({ rate, a: fa, b: tb, billed }) => { if (billed && num(f.amount) > 0 && Math.abs(fa - num(f.amount)) < 1e-9) { f.fxMode = 'peso'; f.peso = String(Math.round(tb * 100) / 100); } else { f.fxMode = 'rate'; f.fx = prec(rate); } renderFx(); } }); break; }
      case 'fxopen2': { const a = acctOf(f.acct), b = acctOf(f.toAcct); if (!a || !b) break; openConverter({ from: a.cur, to: b.cur, amount: num(f.amount), rate: num(f.cRate) || crossRate(), applyLabel: 'Use this rate',
        onApply: ({ rate, a: fa, b: tb, billed }) => { f.cRate = prec(rate); const cr = $f('f-crate'); if (cr) cr.value = f.cRate; if (billed && num(f.amount) > 0 && Math.abs(fa - num(f.amount)) < 1e-9) { f.toAmount = String(Math.round(tb * 1e6) / 1e6); const ta = $f('f-toamt'); if (ta) ta.value = f.toAmount; syncCross('to'); } else syncCross('rate'); } }); break; }
      case 'livecross': { const r = crossRate(); if (r) { f.cRate = prec(r); const cr = $f('f-crate'); if (cr) cr.value = f.cRate; syncCross('rate'); } else toast('No live rate for this pair yet. Type one.'); break; }
      case 'feemode': f.feeMode = v; f.feeModeSet = true; f.feeTouched = true; f.feeSuggested = false; if (v === 'none') { f.fee = ''; f.feePct = ''; } else if (v === 'pct') { f.feePct = ''; f.fee = ''; } renderFee(); { const fe = $f('f-fee'); if (fe && v !== 'none') fe.focus(); } break;
      case 'feeby': f.feeBy = v; f.feeTouched = true; f.feeSuggested = false; renderFee(); break;
      case 'cat': pickCat(v); renderCats(); renderTrip(); renderSafety(); break;
      case 'tag': { const cur = parseTags(f.labels), i = cur.findIndex((x) => x.toLowerCase() === v.toLowerCase()); if (i >= 0) cur.splice(i, 1); else cur.push(v); f.labels = joinTags(cur); renderTags(); break; }
      case 'newtag': { promptDialog('New tag or event', '', { okLabel: 'Add', hint: 'For example: Okinawa trip, Birthday, Moving' }).then((n) => { if (n && n.trim()) { f.labels = joinTags([...parseTags(f.labels), n.trim()]); renderTags(); } }); break; }
      case 'trip': { const x = (f._trips || [])[+v]; if (x) pickTrip(x); break; }
      case 'eye': priv.set(!priv.on); applyHide(); b.textContent = (priv.on ? 'Show' : 'Hide') + ' amounts'; updateFxVal(); updateItemLeft(); window.dispatchEvent(new Event('sukli-render')); break;
      case 'newcat': openCategoryForm({ kind: f.kind, name: f.name.trim().replace(/\b\w/g, (m) => m.toUpperCase()).slice(0, 40), keywords: f.name.trim().toLowerCase(), onDone: (c) => { pickCat(c.id); refreshPred(); renderCats(); } }); break;
      case 'catgroup': { const g = v, list = get().categories.filter((c) => !c.deleted && c.group === g && (c.kind === f.kind || c.kind === 'both')).sort((a, b) => a.name.localeCompare(b.name));
        pickerList(list.map((c) => ({ value: c.id, label: c.name, group: '' })), { title: g, addLabel: `Add a new category in ${g}`, onAdd: () => openCategoryForm({ kind: f.kind, group: g, name: f.name.trim().replace(/\b\w/g, (x) => x.toUpperCase()).slice(0, 40), keywords: f.name.trim().toLowerCase(), onDone: (c) => { pickCat(c.id); refreshPred(); renderCats(); } }), onPick: (id) => { pickCat(id); renderCats(); renderTrip(); renderSafety(); } }); break; }
      case 'allcats': openCategoryPicker(f.kind, (id) => { pickCat(id); renderCats(); }); break;
      case 'items-on': f.showItems = true; if (!f.items.length) f.items.push({ n: '', amt: '', q: 1, cat: '' }); renderItems(); break;
      case 'item-add': f.items.push({ n: '', amt: '', q: 1, cat: '' }); renderItems(); form.querySelectorAll('.item .in-n')[f.items.length - 1].focus(); break;
      case 'item-sug': { const s = ($f('itemsugg')._list || [])[+v]; if (!s) break; const blank = f.items.findIndex((x) => !x.n && !x.amt); const row = { n: s.n, amt: '', q: 1, cat: s.cat || '', catTouched: !!s.cat }; if (blank >= 0) f.items[blank] = row; else f.items.push(row); renderItems(); break; }
      case 'items-off': f.showItems = false; f.items = []; renderItems(); break;
      case 'item-del': f.items.splice(+v, 1); if (!f.items.length) f.showItems = false; renderItems(); break;   // removing the last row closes the section, back to the Split into items link
      case 'item-calc': { const it = f.items[+v], inp = form.querySelector(`.item[data-i="${v}"] .in-a`); if (!it || !inp) break; if (isExpr(it.amt) && num(it.amt) > 0) { it.amt = tidy(num(it.amt)); renderItems(); updateItemLeft(); } else { inp.inputMode = 'text'; inp.focus(); toast('Type a sum like 120+45, then tap = again.'); } break; }
      case 'item-disc': { const it = f.items[+v]; if (it) { it.disc = it.disc && it.disc.on ? { ...it.disc, on: false } : { on: true, mode: (it.disc && it.disc.mode) || 'amt', v: (it.disc && it.disc.v) || '' }; renderItems(); const di = form.querySelector(`.item[data-i="${v}"] .in-d`); if (di) di.focus(); } break; }
      case 'item-tax': { const it = f.items[+v]; if (it) { it.tx = it.tx && it.tx.on ? { ...it.tx, on: false } : { on: true, v: (it.tx && it.tx.v) || '10' }; renderItems(); } break; }
      case 'item-tax-set': { const [i, m] = v.split(':'), it = f.items[+i]; if (it && it.tx) { it.tx.v = m; renderItems(); } break; }
      case 'disc-mode': { const [i, m] = v.split(':'), it = f.items[+i]; if (it && it.disc) { it.disc.mode = m; renderItems(); } break; }
      case 'wd-toggle': f.wd.on = !f.wd.on; renderItems(); { const wi = $f('f-wdv'); if (wi) wi.focus(); } break;
      case 'wd-mode': f.wd.mode = v; renderItems(); break;
      case 'tax-toggle': f.tax.on = !f.tax.on; renderItems(); { const ti = $f('f-taxv'); if (ti) ti.focus(); } break;
      case 'tax-mode': f.tax.mode = v; renderItems(); break;
      case 'tax-set': f.tax.v = v; renderItems(); break;
      case 'item-q': { const [i, dq] = v.split(':').map(Number), it = f.items[i]; if (it) { it.q = Math.max(1, Math.min(99, (it.q > 0 ? it.q : 1) + dq)); renderItems(); } break; }
      case 'parts-use': { const pts = splitParts(f.name) || []; f.parts = pts; f.counts = countsFromParts(get(), pts); f.showCounts = true; renderCounts(); const open = f.counts.filter((c) => !c.g).length; toast(open ? `Pick a group for ${open} of them.` : 'Counted by group. Check it, then save.'); break; }
      case 'parts-off': f.partsOff = f.name; f.parts = []; renderCounts(); break;
      case 'oth-on': f.others = newOth(); renderCounts(); break;
      case 'oth-calc': { const r = f.others.rows[+v], inp = form.querySelector(`.othrow[data-i="${v}"] .oth-n`); if (!r || !inp) break; if (isExpr(r.v) && num(r.v) > 0) { r.v = tidy(num(r.v)); renderCounts(); } else { inp.inputMode = 'text'; inp.focus(); toast('Type a sum like 120+45, then tap = again.'); } break; }
      case 'oth-off': f.others = { on: false, mode: 'equal', me: true, rows: [] }; renderCounts(); break;
      case 'oth-mode': f.others.mode = v; renderCounts(); break;
      case 'oth-add': f.others.rows.push({ who: '', v: '' }); renderCounts(); break;
      case 'oth-del': f.others.rows.splice(+v, 1); renderCounts(); break;
      case 'cb-on': f.cb.on = true; renderCb(); break;
      case 'cb-off': f.cb = { on: false, mode: 'pct', v: '' }; renderCb(); break;
      case 'cb-mode': f.cb.mode = b.dataset.v; renderCb(); break;
      case 'branchpick': pickBranch(); break;
      case 'loc-get': getLoc(); break;
      case 'loc-map': (async () => { const p = await pickOnMap(f.loc); if (!p) return; f.loc = p; f.place = ''; fillAddr(); const L = f.locUi || (f.locUi = { perm: 'unknown', msg: '', edit: false }); L.msg = 'Place picked on the map (about 1 km).'; renderLoc(); if (!f.place) getAddr(); })(); break;
      case 'loc-detail': f.locUi.detail = !f.locUi.detail; renderLoc(); break;
      case 'addr-get': getAddr(); break;
      case 'addr-edit': f.locUi.addrEdit = !f.locUi.addrEdit; renderLoc(); break;
      case 'loc-clear': f.loc = null; f.place = ''; f.locUi.msg = 'Location removed from this entry.'; renderLoc(); break;
      case 'loc-edit': f.locUi.edit = !f.locUi.edit; renderLoc(); break;
      case 'counts-off': f.showCounts = false; f.counts = []; renderCounts(); break;
      case 'counts-on': f.showCounts = true; if (!f.counts.length) f.counts.push({ g: '', n: '' }); renderCounts(); break;
      case 'count-add': f.counts.push({ g: '', n: '' }); renderCounts(); break;
      case 'count-del': f.counts.splice(+v, 1); if (!f.counts.length) f.showCounts = false; renderCounts(); break;
      case 'save': save(false); break;
      case 'save-again': save(true); break;
      case 'del': {
        const t = get().txs.find((x) => x.id === f.id);
        deleteWithMates([t.id]);      // a part of a shared bill takes the whole bill with it
        s.close();
        break;
      }
    }
  });

  // ---------- calculator (opens under the amount; the phone keyboard stays away) ----------
  function showCalcRes() {
    const el = $f('calcres'), v = num(f.amount);
    const show = isExpr(f.amount) && v > 0;
    el.hidden = !(show || f.calc);
    el.textContent = '\u00a0';
    if (show) { const a = acctOf(f.acct); el.textContent = '= ' + fmt(v, a ? a.cur : HOME, { force: !priv.on }); }
  }
  function renderKeypad() {
    const kp = $f('keypad'), amt = $f('f-amount');
    form.querySelector('.calcbtn').setAttribute('aria-pressed', String(f.calc));
    kp.hidden = !f.calc; showCalcRes();
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
    amt.value = f.amount; showCalcRes(); syncX(); updateFxVal(); heavy();
  }
  // the slow work (guesses, home value, fee, warnings) waits until you pause, so keys react at once and nothing moves while you tap
  let heavyT;
  function heavy() {
    clearTimeout(heavyT);
    heavyT = setTimeout(() => {
      updateItemLeft();
      if (f.name.trim()) refreshPred(); else renderSafety();
      if (f.kind === 'transfer') { if (!f.feeTouched) { suggestFee(); const fe = $f('f-fee'); if (fe) fe.value = f.fee; } if (f.convert) syncCross('rate'); }
    }, 350);
  }
  function syncX() { const x = form.querySelector('.amtx'); if (x) x.style.visibility = f.amount ? 'visible' : 'hidden'; }

  function fail(msg) { const el = $f('err'); el.textContent = msg; el.hidden = false; el.scrollIntoView({ block: 'nearest' }); }

  function save(again) {
    const db2 = get();
    const a = acctOf(f.acct);
    const amount0 = qtyR(num(f.amount), (acctOf(f.acct) || {}).cur); let amount = amount0, extraAmt = 0;
    if (!(amount0 > 0)) return fail('Enter an amount greater than zero.');
    if (!a) return fail('Choose an account.');
    { const tb = f.kind === 'transfer' ? acctOf(f.toAcct) : null; if ((isEarnAcct(a) || isEarnAcct(tb)) && !(existing && (existing.internal || existing.earnDay || existing.auto || existing.earnAuto))) return fail(EARN_MSG); }
    if (f.flow === 'back' && !existing) {                           // paid back more than they owed: the extra is income (interest earned or other income), the rest lowers what they owe
      const b0 = acctOf(f.toAcct);
      if (b0 && a.cur === b0.cur) {
        const owedNow = owedToMe(a.id);
        if (owedNow <= 0.004) return fail('They do not owe you anything now. If this is new money, use Income.');
        if (amount0 > owedNow + 0.004) { if (!f.extraKind) { askExtra(amount0 - owedNow, a.cur, (k) => { f.extraKind = k; save(again); }); return; } extraAmt = +(amount0 - owedNow).toFixed(6); amount = +owedNow.toFixed(6); }
      }
    }
    // fx is kept with the entry as ledger value per unit, so later rate changes never alter this entry
    let fx = 1, hfxV = 0;
    if (a.cur === BASE) fx = 1;
    else if (a.cur === HOME) fx = homeRate(db2, f.date);
    else {
      const hr = homeRate(db2, f.date);
      let fh = num(f.fx);
      if (f.fxMode === 'peso' && num(f.peso) > 0) fh = num(f.peso) / amount;
      if (!(fh > 0)) return fail(`Enter the exchange rate (how many ${HOME} one ${a.cur} is worth).`);
      fx = fh * hr; hfxV = fh;      // hfxV: the home value of one unit that you saw and accepted; kept with the entry for good
    }
    let toAmount = null;
    if (f.kind === 'transfer') {
      const b = acctOf(f.toAcct);
      if (f.debt) {
        const fl = FLOWS[f.flow], pa = fl.person === 'to' ? b : a, ma = fl.person === 'to' ? a : b;
        if (!pa || (fl.only === 'debt' ? !isLiability(pa) : !isOwed(pa))) return fail(f.flow === 'pay' ? 'Choose the card or loan you are paying.' : fl.only === 'debt' ? 'Choose the card or loan you borrowed from.' : 'Choose the person (use “Add a new person” if they are not listed).');
        if (!isMine(ma)) return fail(f.flow === 'pay' ? 'Choose the account you pay from (not a card or loan).' : 'Choose one of your own accounts (not a card, loan or person).');
      }
      if (!b || b.id === a.id) return fail('Choose two different accounts.');
      toAmount = a.cur === b.cur ? (f.sameDiff && num(f.toAmount) > 0 ? qtyR(num(f.toAmount), a.cur) : amount) : !f.convert ? amount : qtyR(num(f.toAmount), b.cur);
      if (!(toAmount > 0)) return fail(`Enter how much arrived in ${b.name} (${b.cur}).`);
    }
    let fee = 0, feeCat = '', feeFx = null, feeCur = '';
    if (f.kind === 'transfer' && !f.debt && num(f.fee) > 0) {
      fee = r9(num(f.fee));
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
      items = f.items.filter((i) => i.n.trim() || num(i.amt)).map((i) => { const dsc = discOf(i), o = { n: i.n.trim(), amt: lineOf(i), cat: i.cat || '' }; if (i.q > 1 || dsc > 0) { o.q = i.q > 0 ? i.q : 1; o.u = num(i.amt) || 0; } if (dsc > 0) { o.dm = i.disc.mode; o.dv = num(i.disc.v) || 0; o.d = dsc; } if (i.tx && i.tx.on && num(i.tx.v) > 0) o.tp = num(i.tx.v); return o; });
      { const wd = wdOf(); if (items.length && wd > 0) items.push({ n: 'Discount', amt: -wd, cat: '', wd: true, dm: f.wd.mode, dv: num(f.wd.v) || 0 }); }
      { const tb = taxOf(), to = ownTaxSum(), tx = tb + to; if (items.length && tx > 0) items.push({ n: 'Tax', amt: Math.round(tx * 100) / 100, cat: '', tax: true, ...(tb > 0 ? { tm: f.tax.mode, tv: num(f.tax.v) || 0 } : {}), ...(to > 0 ? { pi: true } : {}) }); }
      if (items.length && Math.abs(items.reduce((s2, i) => s2 + i.amt, 0) - amount) >= 0.01) flag = 'review';
    }
    let counts = [];
    if (f.kind === 'expense') { const cl = countLines(db2, f.counts); if (cl.error) return fail(cl.error); counts = cl.lines; }
    // a blank label is filled in: a transfer gets "from - to", other entries get the usual label for this category and amount, and go to Review
    let label = titleOn() ? titleCase(f.name.trim()) : f.name.trim(), autoName = false;
    if (f.kind === 'expense' && tripCat() && label && bareMode(label)) {      // only "bus" was typed: name the trip
      const mode = modeNow(); label = tripLabel(mode, f.from.trim(), f.to.trim()); autoName = true;
    } else if (!label && f.kind === 'expense' && tripCat() && !(f.from.trim() && f.to.trim())) { label = tripLabel(modeNow(), '', ''); autoName = true; }
    if (!label) {
      autoName = true;
      if (f.kind === 'transfer' && f.debt) label = FLOWS[f.flow].auto(acctOf(FLOWS[f.flow].person === 'to' ? f.toAcct : f.acct));
      else if (f.kind === 'transfer') label = transferLabel(a, acctOf(f.toAcct));
      else if (f.kind === 'expense' && tripCat() && f.from.trim() && f.to.trim()) label = tripLabel(modeNow(), f.from.trim(), f.to.trim());
      else if (f.kind === 'expense' && tripCat() && (() => { const x = suggestTrips(db2, isTransportCat(db2.categories), { hour: hourOf(f.date), prevTo: prevTrip(), limit: 1 })[0]; if (x && x.p >= 0.4) { label = x.name; if (!f.from.trim() && !f.to.trim()) { f.from = x.from; f.to = x.to; } return true; } return false; })()) flag = 'review';
      else { label = guessLabel(db2, { kind: f.kind, cat, amount, acct: a.id, hour: hourOf(f.date) }).name; flag = 'review'; }
    }
    const rec = { kind: f.kind, amount, cur: a.cur, fx, hfx: hfxV > 0 ? hfxV : undefined, date: f.date, name: label, autoName, cat, acct: a.id,
      toAcct: f.kind === 'transfer' ? f.toAcct : '', toAmount, fee, feeBy: fee ? f.feeBy : '', feeFx, feeCur, notes: f.notes.trim(), labels: joinTags(parseTags(f.labels)), items: items && items.length ? items : [], counts, flag,
      posted: (f.kind !== 'transfer' && f.postedOn && a.type === 'card' && a.stmtDay > 0 && f.posted > String(f.date).slice(0, 10)) ? f.posted : '' };
    if (f.kind === 'expense' && counts.length && f.parts && f.parts.length && splitParts(f.name)) rec.parts = f.parts.map((x) => ({ n: x.n, k: x.k }));   // the things the total is made of, kept so item prices can be worked out later
    if (f.debt && f.kind === 'transfer') rec[FLOWS[f.flow].flag] = true;
    if (f.loc) { rec.loc = f.loc; rec.place = f.place || null; } else if (existing && existing.loc) { rec.loc = null; rec.place = null; }
    { const mc = f.kind === 'expense' ? canonMerchant(db2, f.merchant) : ''; if (mc) { rec.merchant = mc; if (f.branch) rec.branch = f.branch; } }
    if (f.kind !== 'transfer' && cat && ((f.catTouched && f.guessed && f.guessed !== cat) || (existing && existing.cat && existing.cat !== cat) || (existing && existing.corrected))) rec.corrected = true;
    if (f.kind === 'expense' && tripCat() && f.from.trim() && f.to.trim()) { rec.from = f.from.trim(); rec.to = f.to.trim(); } else if (existing && (existing.from || existing.to)) { rec.from = ''; rec.to = ''; }
    // paid for others: your part is the expense, each person's part moves to "money owed to you"
    let oth = null;
    if (!existing && f.kind === 'expense' && f.others && f.others.on) {
      const P = othParts(); if (P.err) return fail(P.err);
      if (!P.list.length) return fail('Choose who you paid for, or tap "Not paid for others".');
      const list = []; for (const x of P.list) { const pp = acctOf(x.who); if (!pp || !isOwed(pp)) return fail('Choose who you paid for, or tap "Not paid for others".'); if (!(x.amt > 0)) return fail(`Type ${pp.name}'s part of the bill.`); list.push({ pp, theirs: x.amt, lid: uid() }); }
      const theirsAll = list.reduce((q, x) => q + x.theirs, 0); if (theirsAll > amount0 + 0.005) return fail('Their parts are more than the whole bill.');
      oth = { list, mine: P.mine, eid: uid(), gid: uid() };
      rec.amount = P.mine > 0 ? P.mine : amount0; rec.paidFor = { total: amount0, who: list.map((x) => x.pp.name).join(', '), me: P.mine > 0, mode: f.others.mode };
      rec.splitId = oth.gid;
      if (rec.counts && rec.counts.length) { rec.counts = []; delete rec.parts; }          // the groups were counted on the whole bill; they would not add up to your part
    }
    // cashback: its own income entry, linked to this expense and kept in step when the expense changes
    const cbAmt = f.kind === 'expense' && !f.debt && f.cb.on ? (() => { const v = num(f.cb.v) || 0, x = f.cb.mode === 'pct' ? rec.amount * v / 100 : v, dec = (CUR[a.cur] || { dec: 2 }).dec; return +Math.min(Math.max(x, 0), rec.amount).toFixed(dec); })() : 0;
    const cbId = existing && existing.cashback ? existing.cashback.id : uid();
    if (cbAmt > 0) rec.cashback = { mode: f.cb.mode, v: num(f.cb.v) || 0, id: cbId }; else rec.cashback = null;
    let savedAs; const alertsBefore = budgetAlerts(get(), rec.date.slice(0, 7));
    commit((d) => {
      if (fee) {
        if (f.feeCat.startsWith('__new:')) rec.feeCat = findOrAddCategory(d, 'Fees', f.feeCat.slice(6), 'expense').id;
        else rec.feeCat = f.feeCat;
      } else rec.feeCat = '';
      if (existing) { const t = d.txs.find((x) => x.id === existing.id);
        // keep what it was before this change, so the Input history can put it back (the last 5 versions)
        const before = {}; for (const k of ['kind', 'date', 'name', 'amount', 'cur', 'fx', 'acct', 'toAcct', 'toAmount', 'cat', 'notes', 'fee', 'feeCat', 'feeBy']) if (t[k] !== undefined) before[k] = t[k];
        t.rev = [{ at: Date.now(), ...before }, ...(t.rev || [])].slice(0, 5);
        Object.assign(t, rec); for (const k of FLOW_FLAGS) if (!rec[k]) delete t[k]; if (!rec.merchant) delete t.merchant; if (!rec.branch) delete t.branch; if (!rec.cashback) delete t.cashback; if (!t.loc) delete t.loc; if (!t.place) delete t.place; stamp(t); savedAs = t; }
      else if (oth) {
        const hx = (c) => homeFx(d, c) || 1, hA = a.cur === HOME ? 1 : fx / (homeRate(d, rec.date) || 1), toAmt = (pp0, v) => (pp0.cur === a.cur ? v : +(v * hA / hx(pp0.cur)).toFixed(2));   // the bill's own (possibly hand-set) rate, not today's
        if (oth.mine > 0) { savedAs = stamp({ id: oth.eid, ...rec, createdAt: Date.now() }); d.txs.push(savedAs); }
        for (const x of oth.list) { const lent = stamp({ id: x.lid, kind: 'transfer', amount: x.theirs, cur: a.cur, fx, hfx: hfxV > 0 ? hfxV : undefined, date: rec.date, name: `Paid for ${x.pp.name}${label ? ': ' + label : ''}`, autoName: false, cat: '', acct: a.id, toAcct: x.pp.id, toAmount: toAmt(x.pp, x.theirs), fee: 0, feeBy: '', notes: '', labels: '', items: [], counts: [], flag: null, lent: true, splitId: oth.gid, ...(rec.merchant ? { merchant: rec.merchant } : {}), ...(rec.branch ? { branch: rec.branch } : {}), createdAt: Date.now() }); d.txs.push(lent); if (!savedAs) savedAs = lent; }
      }
      else { savedAs = stamp({ id: uid(), ...rec, createdAt: Date.now() }); d.txs.push(savedAs);
        if (extraAmt > 0) d.txs.push(stamp({ id: uid(), kind: 'income', date: rec.date, name: `${f.extraKind} from ${a.name}`, amount: extraAmt, cur: a.cur, fx, cat: findOrAddCategory(d, 'Income', f.extraKind, 'income').id, acct: f.toAcct, toAcct: '', toAmount: null, fee: 0, notes: '', labels: '', items: [], flag: null, createdAt: Date.now() })); }
      if (savedAs) { const sa = d.txs.find((q) => q.id === savedAs.id) || savedAs, old = d.txs.find((q) => q.id === cbId);
        if (!rec.cashback) { delete sa.cashback; if (old && !old.deleted) softDelete(old); }
        else { const base = { kind: 'income', date: sa.date, acct: sa.acct, cur: sa.cur, amount: cbAmt, fx: sa.fx, cat: findOrAddCategory(d, 'Earn', 'Cashback', 'income').id, name: `Cashback: ${sa.name || 'purchase'}`, cashbackOf: sa.id, auto: false };
          if (old) { Object.assign(old, base, { deleted: false }); delete old.deletedAt; stamp(old); } else d.txs.push(stamp({ id: cbId, ...base, createdAt: Date.now() })); } }
      d.settings.lastAcct = a.id;
      if (rec.merchant && rec.branch && rec.loc) { const all = (d.settings.merchantInfo = d.settings.merchantInfo || {}), mi = (all[rec.merchant] = all[rec.merchant] || { branches: {} }); mi.branches = mi.branches || {}; const bi = (mi.branches[rec.branch] = mi.branches[rec.branch] || {}); if (!bi.loc) bi.loc = rec.loc; }   /* a new branch remembers where it is */
    });
    // say so when this entry pushed a budget past the warning line (once per budget per month)
    try { const fresh = newAlertsSince(alertsBefore, budgetAlerts(get(), rec.date.slice(0, 7))); if (fresh.length && rec.kind === 'expense') setTimeout(() => toast(fresh[0].text, { ms: 7000 }), 900); } catch { /* alerts are a bonus */ }
    if (!existing && savedAs && !f.loc) captureLoc(get(), savedAs.id, rec.date);
    s.close();
    toast(rec.flag === 'review' ? 'Saved. It is in Review so you can confirm the category later.' : 'Saved', { undo: () => undoLast() });
    if (again) openEntry({ preset: { acct: a.id } });
  }

  arrange(); renderSeg(); renderMerch(); renderFreq(); renderAccts(); renderFx(); renderItems(); renderCounts(); renderWhen(); renderBtns(); renderSafety();
  if (existing) { refreshPred(); f.cat = existing.cat || ''; renderCats(); } else renderCats();
  renderTrip(); renderTags(); renderBranch(); renderCb(); fillAddr(); renderLoc(); if (f.loc && !f.place) getAddr(); permState().then((st) => { (f.locUi || (f.locUi = { msg: '', edit: false })).perm = st; renderLoc(); });
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
    <div class="newcat">${button({ label: '+ New category', kind: 'ghost', cls: 'wide', id: 'newcat-btn' })}</div>`, { title: 'All Categories' });
  const list = s.el.querySelector('#catlist');
  const draw = (q = '') => {
    q = q.toLowerCase();
    list.innerHTML = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, cs]) => {
      const m = cs.filter((c) => !q || c.name.toLowerCase().includes(q) || g.toLowerCase().includes(q));
      return m.length ? `<div class="catgroup"><h3><i class="ghd" style="background:${groupColor(g)}">${groupLetter(g)}</i>${esc(g)}</h3><div class="chips cattiles">${m.sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<button type="button" class="chip cattile" data-id="${c.id}"><i style="background:${groupColor(g)}">${catIcon(c)}</i><span>${esc(c.name)}</span></button>`).join('')}</div></div>` : '';
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
  const groups = [...new Set([...db.categories.filter((x) => !x.deleted && (x.kind === kind || x.kind === 'both')).map((x) => x.group), ...suggestedGroups(kind)])].sort();   /* your groups plus suggested ones to start a new group with one tap */
  const isInc = (c ? c.kind : kind) === 'income';
  const s = sheet(`<form id="catform">
    <label class="field"><span>Group (the bigger heading)</span><input name="g" value="${esc(c ? c.group : group)}" placeholder="${isInc ? 'e.g. Employer, Side income' : 'e.g. Food &amp; Drinks, Health'}" required autocomplete="off"></label>
    <div class="chips pickchips" id="gchips" aria-label="Existing groups"></div>
    <label class="field"><span>Category (the detail)</span><input name="n" value="${esc(c ? c.name : name)}" placeholder="${isInc ? 'e.g. Bonus, Freelance, Refund' : 'e.g. Gym, Vet, Gifts'}" required autocomplete="off" ${id ? '' : 'autofocus'}></label>
    <div class="chips pickchips" id="nchips" aria-label="Existing categories in this group"></div>
    <div class="field"><span>Picture</span><button type="button" class="acctbtn icopick" id="icopick"></button><input type="hidden" name="ico" value="${esc(c && c.icon ? c.icon : '')}"></div>
    <label class="field"><span>Words that should land here (optional)</span><input name="k" value="${esc(c ? c.keywords || '' : keywords)}" placeholder="${isInc ? 'e.g. bonus, 13th month' : 'e.g. gym, fitness, anytime'}" autocomplete="off" autocapitalize="off"></label>
    ${id ? '<div class="chips pickchips" id="kchips" aria-label="Words from your entries"></div>' : ''}
    <p class="hint">Separate words with commas. Next time a name contains one of them, this category is guessed. It also learns from every entry you put here.${id ? ' Tap a suggested word to add it.' : ''}</p>
    <div class="btnrow">${c ? '<button type="button" class="btn danger ghost" data-del>Delete</button>' : ''}<button class="btn">${c ? 'Save' : 'Add and use'}</button></div></form>`,
  { title: c ? 'Edit category' : (isInc ? 'New income category' : 'New category') });
  // pick an existing group or category with one tap, or just type a new one
  { const fm = s.el.querySelector('#catform'), gi = fm.g, ni = fm.n, ki = fm.k, cats = get().categories.filter((x) => !x.deleted && (x.kind === kind || x.kind === 'both' || (c && x.kind === c.kind)) && x.group !== 'Adjustments');
    const chip = (t, a, on) => `<button type="button" class="chip ${on ? 'on' : ''}" ${a}>${esc(t)}</button>`;
    const drawG = () => { const q = gi.value.trim().toLowerCase(), list = groups.filter((g) => !q || g.toLowerCase().includes(q)); fm.querySelector('#gchips').innerHTML = list.length ? list.map((g) => chip(g, `data-g="${esc(g)}"`, g.toLowerCase() === q)).join('') : (q ? `<small class="muted">New group “${esc(gi.value.trim())}” will be created.</small>` : ''); };
    const drawN = () => { const g = gi.value.trim().toLowerCase(), q = ni.value.trim().toLowerCase(), list = cats.filter((x) => x.group.toLowerCase() === g && (!q || x.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name)); const exact = cats.some((x) => x.group.toLowerCase() === g && x.name.toLowerCase() === q);
      fm.querySelector('#nchips').innerHTML = (g ? list.map((x) => chip(x.name, `data-n="${esc(x.name)}"`, x.name.toLowerCase() === q)).join('') : '') + (q && g && !exact ? `<small class="muted">New category “${esc(ni.value.trim())}” will be created.</small>` : ''); };
    const STOP = new Set('the and for with from shop store mart payment pay paid new one two buy bought ' .split(' '));
    const drawK = () => { const box = fm.querySelector('#kchips'); if (!box) return; const have = new Set(ki.value.toLowerCase().split(/[,\n]/).map((w) => w.trim()).filter(Boolean)), cnt = new Map();
      for (const t of get().txs) { if (t.deleted || t.cat !== c.id || !t.name) continue; for (const w of new Set(String(t.name).toLowerCase().match(/[a-z\u00c0-\u024f\u3040-\u30ff\u4e00-\u9fff]{3,}/g) || [])) if (!STOP.has(w) && !have.has(w)) cnt.set(w, (cnt.get(w) || 0) + 1); }
      const top = [...cnt.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
      box.innerHTML = top.length ? top.map(([w, n]) => chip(`${w} (${n})`, `data-k="${esc(w)}"`, false)).join('') : '<small class="muted">No new words found in the entries of this category.</small>'; };
    gi.addEventListener('input', () => { drawG(); drawN(); }); ni.addEventListener('input', drawN); ki.addEventListener('input', drawK);
    fm.addEventListener('click', (e) => { const b = e.target.closest('[data-g],[data-n],[data-k]'); if (!b) return;
      if (b.dataset.g != null) { gi.value = b.dataset.g; drawG(); drawN(); ni.focus(); }
      else if (b.dataset.n != null) { ni.value = b.dataset.n; drawN(); }
      else { ki.value = [ki.value.trim().replace(/,\s*$/, ''), b.dataset.k].filter(Boolean).join(', '); drawK(); } });
    const icoBtn = fm.querySelector('#icopick'), icoIn = fm.ico;
    const drawI = () => { const k = icoIn.value || guessIcon(ni.value || (c && c.name) || '', gi.value || (c && c.group) || ''); icoBtn.innerHTML = `<i class="icoprev" style="background:${groupColor(gi.value || (c && c.group) || 'x')}">${iconSvg(k)}</i> <span>${esc(ICONS[k][0])}${icoIn.value ? '' : ' (automatic)'}</span> ▾`; };
    icoBtn.onclick = () => openIconLibrary(icoIn.value, (k) => { icoIn.value = k; drawI(); });
    gi.addEventListener('input', drawI); ni.addEventListener('input', drawI);
    drawG(); drawN(); drawK(); drawI(); }
  s.el.querySelector('#catform').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const g = fd.get('g').trim(), n = fd.get('n').trim(), k = fd.get('k').trim();
    let out;
    // naming it like another category in the same group merges the two: entries, items and budgets move over
    const twin = c && get().categories.find((q) => !q.deleted && q.id !== c.id && q.group === g && q.name.toLowerCase() === n.toLowerCase() && (q.kind === c.kind || q.kind === 'both' || c.kind === 'both'));
    if (twin) {
      const used = get().txs.filter((t) => !t.deleted && (t.cat === c.id || (t.items || []).some((i) => i.cat === c.id))).length;
      confirmDialog(`“${twin.name}” already exists in ${g}. Move ${used} ${used === 1 ? 'entry' : 'entries'} from “${c.name}” into it and remove “${c.name}”?`, 'Merge').then((yes) => {
        if (!yes) return;
        commit((d) => { for (const t of d.txs) { let ch = false; if (t.cat === c.id) { t.cat = twin.id; ch = true; } for (const i of t.items || []) if (i.cat === c.id) { i.cat = twin.id; ch = true; } if (ch) stamp(t); }
          for (const b of d.budgets) if (!b.deleted && b.cat === c.id) { b.cat = twin.id; stamp(b); }
          const t2 = d.categories.find((q) => q.id === twin.id), x = d.categories.find((q) => q.id === c.id); if (k) { t2.keywords = [t2.keywords, k].filter(Boolean).join(', '); stamp(t2); } softDelete(x); });
        s.close(); toast(`Merged into “${twin.name}”.`); if (onDone) onDone(twin);
      });
      return;
    }
    commit((d) => {
      if (c) {
        const x = d.categories.find((q) => q.id === c.id);
        if (x.group !== g) { for (const b of d.budgets) if (!b.deleted && b.group === x.group && !d.categories.some((o) => o !== x && !o.deleted && o.group === x.group)) { b.group = g; stamp(b); } }
        Object.assign(x, { group: g, name: n, keywords: k }); if (fd.get('ico')) x.icon = fd.get('ico'); else delete x.icon; stamp(x); out = x;
      } else {
        out = findOrAddCategory(d, g, n, kind);
        if (k) { out.keywords = [out.keywords, k].filter(Boolean).join(', '); stamp(out); }
        if (fd.get('ico')) { out.icon = fd.get('ico'); stamp(out); }
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

// the picture library: tap a picture to use it for this category; Automatic goes back to the guessed one
export function openIconLibrary(current, onPick, o = {}) {
  /* o.group: show the solid group pictures first; o.own: let the person use an image of their own; o.auto: label of the automatic button; o.hint */
  const cell = (k, svg, label) => `<button type="button" class="icocell ${k === current ? 'on' : ''}" data-ico="${k}" aria-label="${esc(label)}"><i>${svg}</i><span>${esc(label)}</span></button>`;
  const s = sheet(`<div class="icolib"><p class="hint">${esc(o.hint || 'Pick a picture for this category. It is used everywhere the category is shown.')}</p>
    <button type="button" class="btn ghost wide" data-ico="">${esc(o.auto || 'Automatic (guess from the name)')}</button>
    ${o.own ? '<button type="button" class="btn ghost wide" data-own>Use My Own Image…</button><p class="hint">Your image stays on this device. Sukli does not include company logos, because they are trademarks.</p>' : ''}
    ${o.group ? `<h3>Group Pictures</h3><div class="icogrid">${GKEYS.map((k) => cell(k, gsvg(k), GICONS[k][0])).join('')}</div><h3>More Pictures</h3>` : ''}
    <div class="icogrid">${ICON_KEYS.map((k) => cell(k, iconSvg(k), ICONS[k][0])).join('')}</div></div>`, { title: o.title || 'Category Pictures', wide: true });
  s.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-own]')) { const v = await pickOwnImage(); if (v) { s.close(); onPick(v); } return; }
    const b = e.target.closest('[data-ico]'); if (!b) return; s.close(); onPick(b.dataset.ico);
  });
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
    <div class="btnrow"><button class="btn">Add all</button></div></form>`, { title: 'Add Many at Once' });
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
