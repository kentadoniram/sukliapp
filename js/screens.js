// The five screens: Home, Ledger, Review, Accounts, Reports, and Settings.
import { softDelete } from './core.js';
import { safetyCfg, balanceTrail } from './finance.js';
import {
  get, commit, commitQuiet, stamp, uid, fmt, BASE, HOME, homeFx, homeRate, CUR, balances, sortedTxs, accountMap, catMap, monthStats, monthsPresent,
  compact, monthLabel, shiftMonth, thisMonth, dayLabel, rateFor, reviewCount, groupColor, groupLetter, adjustmentCategory, nowStamp,
  replaceAll, emptyDb, live, monthParts, priv, flush, factorFor,
} from './core.js';
import { pace, insights, trend, totals, baselineMonths, groupTrend } from './insights.js';
import { importBluecoins, previewImport, exportCSV, SPENDABLE_TYPES } from './importer.js';
import { predict } from './predict.js';
import { modelFor, openEntry, openBulk, openCategoryForm } from './entry.js';
import { syncNow, status as syncStatus } from './drive.js';
import { REMOVED_UI } from './features.js';
import { fxBlockHtml, openConverter } from './fxview.js';
import { feedbackCfg } from './feedback.js';
import { cloudSync, cloudStatus, signIn, signUp, signOut, signedIn, session, lastOk, SETUP_SQL, signInWithGoogle, configured } from './cloud.js';
import { applyHide, look, setLook, ACCENTS, SIZES } from './appearance.js';
import { lossCard } from './loans.js';
import { typeNames, accounts, openAccount, reminderBanner, openInterestDetail } from './accpage.js';
import { outlookCard } from './views.js';
import { openCurrencyPicker } from './curpicker.js';
import { backupSection } from './backup.js';
import { fetchRates, ratesStatus, RATE_CREDIT, hasLive } from './rates.js';
import { liveRate, curName, rateFor as rateFor2 } from './core.js';
export { accounts };
import { esc, ic, ACT, sheet, toast, confirmDialog, promptDialog, download, fileStamp } from './ui.js';
import { nameRules, similarPairs, learnSame, learnApart, learnRelated, forget } from './merchants.js';
import { compareCard } from './compare.js';
import './inputlog.js';
import { budgetBanner } from './budgetsetup.js';
import { versionText } from './version.js';
import { rollingSummary, rollingAvg, dailySpend, today as todayStr } from './rolling.js';
import { buildGraph, clusters, neighbourhood, matches, explain, edgeText } from './simgraph.js';

export const ui = { month: thisMonth(), q: '', filter: 'all', acct: '', from: '', to: '', cat: '', daysOff: new Set(), limit: 120, selecting: false, sel: new Set(), by: 'group', collapsed: (() => { try { return JSON.parse(localStorage.getItem('sukli-coll') || '{}'); } catch { return {}; } })() };

// collapsible section: tap the heading to fold it away (remembered on this device)
export function coll(id, title, body, extra = '') {
  const closed = !!ui.collapsed[id];
  return `<section class="coll ${closed ? 'closed' : ''}"><div class="collrow"><button class="collhead" data-act="coll" data-id="${id}" aria-expanded="${!closed}"><h2>${title}</h2>${ic('down', 'chev')}</button>${extra}</div><div class="collbody" ${closed ? 'hidden' : ''}>${body}</div></section>`;
}
// opening or closing a card only flips that card in place; redrawing the whole screen made the pie charts beside it flicker
ACT.coll = (el) => {
  const id = el.dataset.id, closed = !ui.collapsed[id]; ui.collapsed[id] = closed;
  try { localStorage.setItem('sukli-coll', JSON.stringify(ui.collapsed)); } catch { /* blocked */ }
  const sec = el.closest('.coll'), body = sec && sec.querySelector(':scope > .collbody');
  if (!sec || !body) { window.dispatchEvent(new Event('sukli-render')); return; }
  sec.classList.toggle('closed', closed); el.setAttribute('aria-expanded', String(!closed)); body.hidden = closed;
};

export const money = (n, cur = HOME) => fmt(n, cur);
const showHome = () => get().settings.showHome !== false;
// small "≈ ₱…" line for money in another currency, using the rate stored on the entry
export const eq = (amount, cur, fx, date) => (showHome() && cur !== HOME && fx > 0 ? `≈ ${money(amount * fx / homeRate(get(), date || nowStamp()))}` : '');

export function monthNav(title) {
  const isNow = ui.month === thisMonth();
  return `<header class="top"><div class="hl">${burger()}<div class="monthbox"><button class="iconbtn" data-act="month" data-d="-1" aria-label="Previous month">${ic('left')}</button>
    <h1>${esc(title || monthLabel(ui.month))}</h1>
    <button class="iconbtn" data-act="month" data-d="1" aria-label="Next month" ${isNow ? 'disabled' : ''}>${ic('right')}</button></div></div>
    <div class="hact">${eyeBtn()}</div></header>`;
}
const burger = () => { const n = reviewCount(get()); return `<button class="iconbtn burger" data-act="menu" aria-label="Open menu">${ic('menu')}${n ? '<em class="dot" aria-label="items to check"></em>' : ''}</button>`; };
export const hdr = (title, right = '') => `<header class="top"><div class="hl">${burger()}<h1>${esc(title)}</h1></div><div class="hact">${right}${eyeBtn()}</div></header>`;
const eyeBtn = () => `<button class="iconbtn" data-act="eye" aria-pressed="${priv.on}" aria-label="${priv.on ? 'Show amounts' : 'Hide amounts'}">${ic(priv.on ? 'eyeoff' : 'eye')}</button>`;
ACT.eye = () => { priv.set(!priv.on); applyHide(); window.dispatchEvent(new Event('sukli-render')); };
ACT.month = (el) => {
  const next = shiftMonth(ui.month, +el.dataset.d);
  if (next > thisMonth()) return;
  ui.month = next; ui.limit = 120; window.dispatchEvent(new Event('sukli-render'));
};

export function strip(st) {
  const net = st.income - st.spent;
  return `<section class="strip" aria-label="Month totals">
    <button data-act="flow" data-k="inflow"><span>Cash inflow</span><b class="in">${fmt(st.income, HOME, { round: true })}</b></button>
    <button data-act="flow" data-k="outflow"><span>Cash outflow</span><b>${fmt(st.spent, HOME, { round: true })}</b></button>
    <button data-act="flow" data-k="net"><span>Net income</span><b class="${net < 0 ? 'neg' : ''}">${fmt(net, HOME, { round: true })}</b></button></section>`;
}

function spendable(db) {
  const bal = balances(db);
  const by = new Map(); let total = 0, missing = [];
  for (const a of db.accounts) {
    if (a.deleted || a.archived || !a.include) continue;
    const v = bal.get(a.id) || 0;
    by.set(a.cur, (by.get(a.cur) || 0) + v);
  }
  for (const [cur, v] of by) { const r = rateFor(db, cur); if (r > 0) total += v * r; else if (Math.abs(v) > 0.005) missing.push(cur); }
  return { by, total, missing };
}

// fee entries that belong to a trade (older trades booked the fee as its own expense): child id -> parent trade
let _kidsKey = null, _kids = new Map(), _kidsOf = new Map();
export function tradeKids(db) {
  const key = db.txs.length + ':' + db.txs.reduce((m, t) => Math.max(m, t.updatedAt || 0), 0);
  if (key === _kidsKey) return { parentOf: _kids, kidsOf: _kidsOf };
  const by = new Map(db.txs.filter((t) => !t.deleted && t.trade).map((t) => [t.id, t])); _kids = new Map(); _kidsOf = new Map();
  for (const t of db.txs) if (!t.deleted && t.tradeOf && by.has(t.tradeOf)) { _kids.set(t.id, by.get(t.tradeOf)); if (!_kidsOf.has(t.tradeOf)) _kidsOf.set(t.tradeOf, []); _kidsOf.get(t.tradeOf).push(t); }
  _kidsKey = key; return { parentOf: _kids, kidsOf: _kidsOf };
}
// the small line under an entry: what it did to your records
export function effectLine(t, accts) {
  const db = get(), { kidsOf, parentOf } = tradeKids(db);
  let feeTxt = '';
  if (t.kind === 'transfer' && t.fee > 0) feeTxt = ` · fee ${money(t.fee, t.feeCur || t.cur)} recorded as an expense`;
  const kids = kidsOf.get(t.id) || []; for (const k of kids) feeTxt += ` · fee ${money(k.amount, k.cur)} recorded as an expense`;
  if (t._feeOf) return `Fee of “${esc(t._feeOf)}”, saved with it. Tap to open the whole entry`;
  if (parentOf.has(t.id)) return `Fee of “${esc(parentOf.get(t.id).name)}” recorded as an expense`;
  if (t.loanNet) return `Loan: borrowed ${money(t.loanNet.principal, t.cur)}${t.loanNet.fees > 0 ? `, fees ${money(t.loanNet.fees, t.cur)} deducted` : ''}, received ${money(t.loanNet.net, t.cur)}`;
  if (t.trade) return `Trade, not counted as spending${feeTxt}`;
  if (t.kind === 'transfer') return `Moved between accounts, not counted as spending${feeTxt}`;
  if (t.invIncome) return 'Investment income recorded';
  if (t.autoDebt) return 'Interest on a debt, added automatically';
  if (t.auto && t.kind === 'income') return 'Interest posted automatically';
  return t.kind === 'income' ? 'Income recorded' : 'Expense recorded';
}
// "balance after": what each affected account holds right after this entry, with an arrow and colour for up or down
function balLines(t, accts, trail) {
  if (!trail || t._feeOf) return '';
  const l = trail.get(t.id); if (!l) return '';
  return l.map((x) => { const a = accts.get(x.id), up = x.after > x.before + 0.00001, dn = x.after < x.before - 0.00001, cur = a ? a.cur : '';
    return `<small class="bal ${up ? 'up' : dn ? 'dn' : ''}"><i aria-hidden="true">${up ? '▲' : dn ? '▼' : '•'}</i><span class="sr">${up ? 'Up' : dn ? 'Down' : 'No change'}: </span><span class="bn">${esc(a ? a.name : '?')}</span> <span class="bv">${money(x.before, cur)} → <b>${money(x.after, cur)}</b></span></small>`; }).join('');
}
export function row(t, accts, cats, sel, trail) {
  const a = accts.get(t.acct), c = cats.get(t.cat), tr = t.kind === 'transfer';
  const group = tr ? 'Transfer' : (c ? c.group : 'Uncategorized');
  const title = t.name || (c ? c.name : 'Untitled');
  const sub = tr ? `${t.trade ? 'Trade · ' : 'Transfer · '}${esc(a ? a.name : '?')} → ${esc((accts.get(t.toAcct) || {}).name || '?')}`
    : `${esc(c ? c.name : 'No category')} · ${esc(a ? a.name : '')}${t.items && t.items.length ? ` · ${t.items.length} items` : ''}`;
  const bb = tr ? accts.get(t.toAcct) : null, arr = tr && t.toAmount != null && bb && Math.abs(t.toAmount - t.amount) > 1e-9 && !t.trade ? `<small class="arrived">arrived ${money(t.toAmount, bb.cur)}</small>` : '';
  const signed = tr ? money(t.amount, t.cur) : money(t.kind === 'income' ? t.amount : -t.amount, t.cur);
  const base = !tr && eq(t.amount, t.cur, t.fx, t.date) ? `<small>${eq(t.amount, t.cur, t.fx, t.date)}</small>` : '';
  const on = sel && ui.sel.has(t.id);
  return `<button class="row ${sel ? 'selrow' : ''} ${on ? 'picked' : ''}" data-act="${sel ? 'sel-toggle' : 'edit'}" data-id="${t.id}" ${sel ? `role="checkbox" aria-checked="${!!on}"` : ''}>
    ${sel ? `<i class="selbox ${on ? 'on' : ''}">${on ? ic('check') : ''}</i>` : ''}
    <i class="badge" style="background:${tr ? 'var(--xfer)' : groupColor(group)}">${groupLetter(group)}</i>
    <span class="rmain"><strong><span class="tt">${esc(title)}</span>${t.flag === 'review' ? '<em class="pill">Check</em>' : ''}</strong><small>${sub}</small><small class="eff">${effectLine(t, accts)}</small>${balLines(t, accts, trail)}</span>
    <span class="ramt ${t.kind}"><b>${t.kind === 'income' ? '+' : ''}${signed}</b>${base}${arr}</span></button>`;
}
ACT.edit = (el) => { const t = get().txs.find((x) => x.id === el.dataset.id); if (t && t.auto && t.kind === 'income' && openInterestDetail(t)) return; openEntry({ id: el.dataset.id }); };
ACT.add = async () => {
  // on the Investments tab the + button asks which account and what kind of entry
  if ((location.hash.replace(/^#\/?/, '').split('?')[0]) === 'invest') { (await import('./invest.js')).invEntryMenu(); return; }
  openEntry();
};
ACT.bulk = () => openBulk();

// ---------------- Home ----------------
const sum = (a) => a.reduce((x, y) => x + y, 0);
const R = (n) => fmt(n, HOME, { round: true });

const homeTitles = (h) => h.replace(/(<button class="collhead"[^>]*><h2>)([^<]*)(<\/h2>)/g, (m, a, t, c) => a + titleCase(t) + c).replace(/(<h3 class="subh">)([^<]*)/g, (m, a, t) => a + titleCase(t));
export function home(db) {
  const st = monthStats(db, ui.month);
  const lay = homeLayout(db);
  const body = lay.order.filter((id) => !lay.hidden.includes(id)).map((id) => { const sec = HOME_SECTIONS.find((x) => x[0] === id); if (!sec) return ''; return sec[2] ? `<div class="defer" data-defer="${id}" aria-busy="true"></div>` : homeSection(id, { db }); }).join('');
  const firstEntry = !db.txs.some((t) => !t.deleted) ? `<section class="nextstep"><b>Next step: write down your first spending.</b><br>Tap the round <b>+</b> button below. Type what it was (for example “lunch”), how much, and pick the account you paid from. Sukli learns your usual choices as you go.</section>` : '';
  return `${monthNav()}
    ${firstEntry}${strip(st)}${homeTitles(weekBars(db) + body)}`;
}
// what was spent on each of the last 7 days: plain HTML (not SVG) so the day, the bar and the amount never overlap and the text stays readable.
// Horizontal or vertical is a device choice; the data and the numbers are the same in both.
const weekMode = () => { try { return localStorage.getItem('sukli-week') === 'h' ? 'h' : 'v'; } catch { return 'v'; } };
ACT['week-mode'] = (el) => {
  try { localStorage.setItem('sukli-week', el.dataset.v); } catch { /* blocked */ }
  const sec = document.querySelector('.week'); if (sec) sec.outerHTML = weekBars(get());
  if (el.closest('.seg')) { el.closest('.seg').querySelectorAll('button').forEach((b) => { const on = b.dataset.v === el.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); }
};
function weekBars(db) {
  const { dates, vals } = dailySpend(db, todayStr(), 7), base = dayBaseline(db), cl = (i) => dayColor(vals[i], base), top = Math.max(...vals), total = vals.reduce((a, b) => a + b, 0), mode = weekMode();
  const day = (d, i) => (i === 6 ? 'Today' : new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }));
  const full = (d, i) => (i === 6 ? 'Today' : i === 5 ? 'Yesterday' : new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }));
  // a long amount is shortened (12.3k) so neighbouring labels never touch
  const amt = (v) => (v < 10 ? money(v) : compact(v));
  let body;
  if (!total) body = '<p class="empty">Nothing spent in the last 7 days.</p>';
  else if (mode === 'v') body = `<div class="wkv" role="img" aria-label="Spending for each of the last 7 days">${dates.map((d, i) => `<div class="wc ${i === 6 ? 'now' : ''}" data-tip="${esc(full(d, i) + ': ' + (vals[i] ? money(vals[i]) : 'nothing spent'))}"><span class="wa ${vals[i] ? '' : 'muted'}" ${cl(i) ? `style="color:${cl(i)}"` : ''}>${vals[i] ? esc(amt(vals[i])) : ''}</span><span class="wb"><i style="height:${vals[i] > 0 ? Math.max(3, Math.round(vals[i] / top * 100)) : 0}%${cl(i) ? `;background:${cl(i)}` : ''}"></i></span><span class="wl">${esc(day(d, i))}</span></div>`).join('')}</div>`;
  else body = dates.map((d, i) => `<div class="wk ${i === 6 ? 'now' : ''}"><span class="wd">${esc(full(d, i))}</span><span class="wtrack"><i style="width:${vals[i] > 0 ? Math.max(2, Math.round(vals[i] / top * 100)) : 0}%${cl(i) ? `;background:${cl(i)}` : ''}"></i></span><b class="wv ${vals[i] ? '' : 'muted'}" ${cl(i) ? `style="color:${cl(i)}"` : ''}>${vals[i] ? esc(money(vals[i])) : '–'}</b></div>`).join('');
  return `<section class="week" aria-label="Spending in the last 7 days"><div class="weekhead"><h3 class="subh">Spent each day, last 7 days <small class="muted">${total ? money(total) + ' in all' : ''}</small></h3></div>${body}</section>`;
}
// the cards on Home, in the order you chose in Settings. [id, name, heavy: drawn a moment later so the numbers above appear at once]
export const HOME_SECTIONS = [
  ['spendable', 'Spendable now', false], ['alerts', 'Reminders and items to check', false], ['insights', 'Worth knowing', true], ['pace', 'Pace', false], ['projpie', 'Spending vs expected income', false],
  ['rolling', 'Daily average, rolling 7 days', false], ['outlook', 'Next month outlook', true], ['went', 'Where it went', false], ['came', 'Where it came from', false],
  ['loss', 'Money lost to fees and interest', false], ['six', 'Last 6 months', false], ['latest', 'Latest entries', false],
];
export function homeLayout(db) {
  const L = (db.settings && db.settings.homeLayout) || {}, ids = HOME_SECTIONS.map((x) => x[0]);
  const order = [...(L.order || []).filter((x) => ids.includes(x)), ...ids.filter((x) => !(L.order || []).includes(x))];
  return { order, hidden: (L.hidden || []).filter((x) => ids.includes(x)) };
}
export function fillDeferred(db, done) {
  const ctxOf = () => { const st = monthStats(db, ui.month); return { db, st, accts: accountMap(db), cats: catMap(db) }; };
  const els = [...document.querySelectorAll('[data-defer]')];
  els.forEach((el, i) => setTimeout(() => { try { if (!el.isConnected) return; el.outerHTML = homeTitles(homeSection(el.dataset.defer, ctxOf())); } catch (e) { el.remove(); } }, 16 * (i + 1)));
  if (done) setTimeout(done, 16 * (els.length + 1) + 30);
}
function homeSection(id, c) {
  const { db } = c;
  switch (id) {
    case 'spendable': { const sp = spendable(db), chips = [...sp.by.entries()].filter(([, v]) => Math.abs(v) >= 0.005).map(([cur, v]) => { const e = eq(v, cur, rateFor(db, cur)); return `<span>${money(v, cur)}${e ? `<small> ${e}</small>` : ''}</span>`; }).join('');
      return `<section class="spendable"><div><span>Spendable now</span><b>${money(sp.total)}</b></div><div class="curs">${chips || '<span class="muted">No balances yet</span>'}</div>
      ${sp.missing.length ? `<p class="hint">Not counted: ${sp.missing.join(', ')} (set a rate in Settings).</p>` : ''}</section>`; }
    case 'alerts': { const n = reviewCount(db); return `${reminderBanner(db)}${budgetBanner(db)}${n ? `<a class="banner" href="#/review"><strong>${n} ${n === 1 ? 'entry needs' : 'entries need'} a quick check</strong><span>Confirm the guessed categories</span>${ic('right')}</a>` : ''}`; }
    case 'insights': { const ins = insights(db, ui.month); return ins.length ? coll('h-ins', 'Worth knowing', `<ul class="ins">${ins.map((x) => `<li class="${x.tone}">${x.id ? `<button class="insb" data-act="edit" data-id="${x.id}">${esc(x.text)}</button>` : esc(x.text)}</li>`).join('')}</ul>`) : ''; }
    case 'loss': return lossCard(db, ui.month, coll, (n) => money(n));
    case 'pace': return paceCard(db);
    case 'projpie': return projPie(db);
    case 'rolling': return rollingCard(db);
    case 'outlook': return outlookCard(db);
    case 'went': { const out = totals(db, ui.month), groups = [...out.by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), max = groups.length ? Math.max(groups[0][1], ...groups.map(([g]) => budgetOf(db, g))) : 1;
      return coll('h-out', 'Where it went', groups.length ? wentToggle() + (wentMode() === 'pie' ? wentPie([...out.by.entries()].sort((a, b) => b[1] - a[1]), out.total) : groups.map(([g, v]) => gbar(db, g, v, max, 'expense', out.total)).join('') + '<p class="hint tap">Tap a group to see what is in it.</p>') : `<p class="empty">Nothing spent in ${esc(monthLabel(ui.month))} yet.</p>`); }
    case 'came': { const inc = totals(db, ui.month, 'income'), g = [...inc.by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      return coll('h-in', 'Where it came from', g.length ? g.map(([k, v]) => gbar(db, k, v, g[0][1], 'income', inc.total)).join('') : `<p class="empty">Nothing came in during ${esc(monthLabel(ui.month))} yet.</p>`); }
    case 'six': return coll('h-6', 'Last 6 months', `${trendChart(trend(db, ui.month, 6), ui.month, 6)}<p class="legend"><i class="k bar"></i>Cash outflow <i class="k inc"></i>Cash inflow · tap a month</p>`);
    case 'latest': { const recent = sortedTxs(db).filter((t) => t.date.startsWith(ui.month)).slice(0, 6), accts = accountMap(db), cats = catMap(db);
      return coll('h-latest', 'Latest', `<div class="rows">${recent.length ? recent.map((t) => row(t, accts, cats)).join('') : '<p class="empty">No entries this month. Tap + to add one.</p>'}</div>`, '<a href="#/ledger" class="linkbtn">All entries</a>'); }
    default: return '';
  }
}
// the share written outside the pie with a short leader line to its slice (readable without telling colours apart);
// labels on the same side are pushed apart so they never overlap; tiny slices are left to the legend
export function pieLabels(shares, { cx = 70, cy = 70, r = 52, hw = 13, min = 0.03 } = {}) {
  let acc = 0; const L = [];
  shares.forEach((sh) => { const mid = acc + sh / 2; acc += sh; if (!(sh >= min)) return; const a = mid * 2 * Math.PI - Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), R1 = r + hw + 1, R2 = R1 + 7;
    L.push({ sh, side: c >= 0 ? 1 : -1, p1: [cx + R1 * c, cy + R1 * sn], p2: [cx + R2 * c, cy + R2 * sn], y: cy + R2 * sn }); });
  for (const side of [1, -1]) { const g = L.filter((l) => l.side === side).sort((a, b) => a.y - b.y); for (let k = 1; k < g.length; k++) if (g[k].y - g[k - 1].y < 14) g[k].y = g[k - 1].y + 14; }
  return L.map((l) => { const tx = l.p2[0] + l.side * 4;
    return `<polyline class="pie-lead" points="${l.p1[0].toFixed(1)},${l.p1[1].toFixed(1)} ${l.p2[0].toFixed(1)},${l.p2[1].toFixed(1)} ${tx.toFixed(1)},${l.y.toFixed(1)}" fill="none"/><text class="slice-pct" x="${(tx + l.side * 2).toFixed(1)}" y="${(l.y + 3.8).toFixed(1)}" text-anchor="${l.side > 0 ? 'start' : 'end'}">${Math.round(l.sh * 100)}%</text>`; }).join('');
}
// Where it went: bars or a pie with the share on its right (a device choice)
const wentMode = () => { try { return localStorage.getItem('sukli-went') === 'pie' ? 'pie' : 'bars'; } catch { return 'bars'; } };
// switching Bars/Pie replaces only this card, not the whole screen, so nothing else on Home flashes
ACT['went-mode'] = (el) => {
  try { localStorage.setItem('sukli-went', el.dataset.v); } catch { /* blocked */ }
  const sec = el.closest('.coll');
  if (sec && sec.querySelector('.collhead[data-id="h-out"]')) { const y = window.scrollY; sec.outerHTML = homeSection('went', { db: get() }); window.scrollTo(0, y); return; }
  window.dispatchEvent(new Event('sukli-render'));
};
const wentToggle = () => `<div class="seg two small" role="group" aria-label="Show as">${[['bars', 'Bars'], ['pie', 'Pie']].map(([v, l]) => `<button type="button" data-act="went-mode" data-v="${v}" class="${wentMode() === v ? 'on' : ''}" aria-pressed="${wentMode() === v}">${l}</button>`).join('')}</div>`;
function wentPie(all, total) {
  const top = all.slice(0, 7), rest = all.slice(7).reduce((a, [, v]) => a + v, 0), slices = top.map(([g, v]) => ({ g, v })); if (rest > 0) slices.push({ g: 'Everything else', v: rest, other: true });
  const C = 2 * Math.PI * 52; let acc = 0;
  const arcs = slices.map((x) => { const len = total ? (x.v / total) * C : 0, d = Math.max(0, len - 1.5);
    const el = `<circle class="slice" data-act="${x.other ? 'went-mode' : 'grp'}" ${x.other ? 'data-v="bars"' : `data-g="${esc(x.g)}" data-k="expense"`} data-tip="${esc(`${x.g}: ${money(x.v)} (${total ? Math.round((x.v / total) * 100) : 0}%)`)}" cx="70" cy="70" r="52" fill="none" stroke="${groupColor(x.other ? 'Others' : x.g)}" stroke-width="26" stroke-dasharray="${d.toFixed(2)} ${(C - d).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 70 70)"></circle>`;
    acc += len; return el; }).join('');
  const labels = pieLabels(slices.map((x) => (total ? x.v / total : 0)));
  return `<div class="wentpie"><svg class="donut sm" viewBox="-30 -12 200 164" role="img" aria-label="Where the money went">${arcs}${labels}<text x="70" y="68" text-anchor="middle" class="dl">Spent</text><text x="70" y="86" text-anchor="middle" class="dv">${esc(compact(total, ''))}</text></svg>
    <ul class="pielegend">${slices.map((x) => `<li><button type="button" data-act="${x.other ? 'went-mode' : 'grp'}" ${x.other ? 'data-v="bars"' : `data-g="${esc(x.g)}" data-k="expense"`}><i class="dot2" style="background:${groupColor(x.other ? 'Others' : x.g)}"></i><span class="pl">${esc(x.g)}</span><b class="pp">${total ? Math.round((x.v / total) * 100) : 0}%</b><small>${money(x.v)}</small></button></li>`).join('')}</ul></div><p class="hint tap">Tap a slice or a name for the detail.</p>`;
}

const esc0 = (t) => String(t);
// the rolling window ends today, or on the last day of the month you are looking at
const rollEndDate = (p) => (p.live ? todayStr() : `${ui.month}-${String(p.dim).padStart(2, '0')}`);
const rollEnd = (p) => rollingSummary(get(), rollEndDate(p));
// what was spent each day over the last 30 days; the 7 darker bars are the days inside today's average
function dailyBars(end) {
  const { dates, vals } = dailySpend(get(), end, 30), top = Math.max(1, ...vals) * 1.05, W = 320, H = 74, bw = (W - 8) / 30;
  const bars = vals.map((v, i) => { const h = Math.max(v > 0 ? 2 : 0, (v / top) * (H - 16)), last7 = i >= 23;
    return `<rect x="${(4 + i * bw + 1).toFixed(1)}" y="${(H - 12 - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${last7 ? 'var(--line)' : 'var(--bar)'}" opacity="${last7 ? 1 : 0.75}" data-tip="${esc(`${dayLabel(dates[i])}: ${v ? money(v) : 'nothing spent'}`)}"></rect>`; }).join('');
  const lbl = [0, 7, 14, 21, 29].map((i) => `<text x="${(4 + i * bw + bw / 2).toFixed(1)}" y="${H - 1}" font-size="9" fill="var(--ink2)" text-anchor="middle">${+dates[i].slice(8)}</text>`).join('');
  return `<h3 class="subh">What you spent each day <small class="muted">(last 30 days, darker = the 7 in the average)</small></h3><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending for each of the last 30 days">${bars}<line x1="4" x2="${W - 4}" y1="${H - 12}" y2="${H - 12}" stroke="var(--rule)"/>${lbl}</svg>`;
}
function rollingCard(db) {
  const p = pace(db, ui.month), r = rollEnd(p);
  if (!r.enough) return '';
  const W = 320, H = 110, n = r.series.length, top = Math.max(1, ...r.series.map((x) => x.avg)) * 1.08;
  const X = (i) => 4 + (i / Math.max(1, n - 1)) * (W - 8), Y = (v) => H - 14 - (v / top) * (H - 24);
  const path = r.series.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x.avg).toFixed(1)}`).join('');
  const band = `<rect x="4" width="${W - 8}" y="${Y(r.high).toFixed(1)}" height="${Math.max(1, Y(r.low) - Y(r.high)).toFixed(1)}" fill="var(--line)" opacity=".10"/>`;
  const ticks = r.series.map((x, i) => (x.date.slice(8) === '01' && x.date.slice(5, 7) % 3 === 0 ? `<text x="${X(i).toFixed(1)}" y="${H - 2}" font-size="9" fill="var(--ink2)" text-anchor="middle">${monthLabel(x.date.slice(0, 7)).split(' ')[0].slice(0, 3)}</text>` : '')).join('');
  const pts = r.series.filter((_, i) => i % 3 === 0 || i === n - 1).map((x) => { const i = r.series.indexOf(x); return [+X(i).toFixed(1), +Y(x.avg).toFixed(1), x.date, `7 days to here: ${R(x.avg)} a day`]; });
  const tr = r.trend ? `${r.trend === 'rising' ? 'Rising' : r.trend === 'falling' ? 'Falling' : 'Steady'}: the last 3 months ${R(r.recent)} a day against ${R(r.before)} before (${r.trendPct > 0 ? '+' : '−'}${Math.round(Math.abs(r.trendPct) * 100)}%).` : '';
  const vs = r.typical > 0 ? Math.round(((r.now - r.typical) / r.typical) * 100) : 0;
  const mrows = r.months.slice().reverse().map((m) => `<div class="mrow"><span>${esc(monthLabel(m.ym))}</span><b>${R(m.avg)}</b></div>`).join('');
  return coll('h-roll', 'Daily average, rolling 7 days', `<svg class="chart scrub" data-pts="${esc(JSON.stringify(pts))}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rolling seven day average of daily spending over the last 12 months. Touch to read values.">${band}
      <line x1="4" x2="${W - 4}" y1="${Y(r.typical).toFixed(1)}" y2="${Y(r.typical).toFixed(1)}" stroke="var(--ink2)" stroke-dasharray="3 3"/>
      <path d="${path}" stroke="var(--line)" stroke-width="2" fill="none" stroke-linejoin="round"/>${ticks}</svg>
    <p class="legend"><i class="k lineb"></i>7-day average <i class="k dash"></i>typical (median) <i class="k bar"></i>usual range</p>
    ${dailyBars(rollEndDate(p))}
    <div class="facts"><div><span>Now (last 7 days)</span><b>${R(r.now)}</b>${r.typical ? `<small class="${vs > 10 ? 'neg' : vs < -10 ? 'in' : ''}">${vs >= 0 ? '+' : '−'}${Math.abs(vs)}% vs typical</small>` : ''}</div>
      <div><span>Typical day</span><b>${R(r.typical)}</b><small>usual ${R(r.low)} to ${R(r.high)}</small></div>
      <div><span>Busiest / quietest week</span><b>${R(r.hi.avg)}</b><small>to ${esc(r.hi.date)} · quietest ${R(r.lo.avg)}</small></div></div>
    ${tr ? `<p class="hint">${esc(tr)}</p>` : ''}
    <details class="mrows"><summary>Average per day, month by month</summary>${mrows}</details>
    <p class="hint">Each point is the spending of the 7 days up to that date (days with nothing count as 0) divided by 7. It moves forward one day at a time, so it does not depend on which weekday a week starts.</p>`);
}
function paceCard(db) {
  const p = pace(db, ui.month);
  if (!p.spent && !p.prev[p.prev.length - 1]) return '';
  const W = 320, H = 96, days = Math.max(p.cur.length, p.prev.length);
  const top = Math.max(1, ...p.cur.slice(0, p.day), ...p.prev);
  const X = (i) => 4 + (i / (days - 1)) * (W - 8), Y = (v) => H - 6 - (v / top) * (H - 14);
  const line = (a, n) => a.slice(0, n).map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
  const last = p.day - 1;
  const proj = p.live && p.day >= 3 && p.day < p.dim ? `<path d="M${X(last).toFixed(1)} ${Y(p.cur[last]).toFixed(1)}L${X(p.dim - 1).toFixed(1)} ${Y(Math.min(top, p.projected)).toFixed(1)}" stroke="var(--line)" stroke-width="1.6" stroke-dasharray="3 4" fill="none" opacity=".6"/>` : '';
  const cmp = p.usual > 0 ? `<div><span>Usual month</span><b>${R(p.usual)}</b></div>` : '';
  const pts = Array.from({ length: days }, (_, i) => {
    const thisV = i < p.day && i < p.cur.length ? p.cur[i] : null, prevV = i < p.prev.length ? p.prev[i] : null;
    const lab = `Day ${i + 1}`;
    const txt = [thisV != null ? `${esc0(monthLabel(ui.month).split(' ')[0])} ${R(thisV)}` : '', prevV != null ? `${esc0(monthLabel(p.prevYm).split(' ')[0])} ${R(prevV)}` : ''].filter(Boolean).join(' · ');
    return [+X(i).toFixed(1), +Y(thisV != null ? thisV : prevV || 0).toFixed(1), lab, txt];
  });
  return coll('h-pace', 'Pace', `<svg class="chart scrub" data-pts="${esc(JSON.stringify(pts))}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending so far this month compared with last month. Touch and drag to read each day.">
      <line x1="0" x2="${W}" y1="${H - 6}" y2="${H - 6}" stroke="var(--rule)"/>
      <path d="${line(p.prev, p.prev.length)}" stroke="var(--bar)" stroke-width="2" fill="none"/>
      ${proj}
      <path d="${line(p.cur, p.day)}" stroke="var(--line)" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${X(last).toFixed(1)}" cy="${Y(p.cur[last]).toFixed(1)}" r="3.5" fill="var(--line)"/></svg>
    <p class="hint pacecap"><b>Pace</b> is how fast you are spending. The line shows what you have spent so far this month, day by day, next to last month. If your line is above last month’s, you are spending faster than last month.</p>
    <p class="legend"><i class="k lineb"></i>${esc(monthLabel(ui.month).split(' ')[0])} <i class="k bar"></i>${esc(monthLabel(p.prevYm).split(' ')[0])}${p.live ? ' <i class="k dash"></i>at this pace' : ''}</p>
    <div class="facts">
      <div><span>Daily average, last 7 days</span><b>${R(rollEnd(p).now)}</b></div>
      <div><span>${p.live ? 'By month end' : 'Month total'}</span><b>${R(p.live ? p.projected : p.spent)}</b></div>
      ${cmp || `<div><span>Same day last month</span><b>${R(p.prevSame)}</b></div>`}
    </div>`);
}

export function trendChart(list, sel, n, click = true) {
  const W = 320, H = 120, bw = W / n;
  const top = Math.max(1, ...list.map((x) => Math.max(x.spent, x.income)));
  const bars = list.map((x, i) => {
    const hs = (x.spent / top) * (H - 22), hi = (x.income / top) * (H - 22);
    const lab = new Date(+x.m.slice(0, 4), +x.m.slice(5) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
    return `<g data-tip="${esc(`${monthLabel(x.m)}: out ${money(x.spent)} · in ${money(x.income)}`)}" ${click ? `data-act="mon" data-m="${x.m}" role="button" tabindex="0" aria-label="${monthLabel(x.m)} details" class="hit"` : ''}><title>${esc(`${monthLabel(x.m)}: cash outflow ${money(x.spent)}, cash inflow ${money(x.income)}`)}</title>
      <rect x="${i * bw}" y="0" width="${bw}" height="${H}" fill="transparent"/>
      <rect x="${i * bw + 5}" y="${H - 16 - hs}" width="${bw - 10}" height="${Math.max(hs, 0)}" rx="2" fill="${x.m === sel ? 'var(--line)' : 'var(--bar)'}"/>
      <rect x="${i * bw + 5}" y="${H - 18 - hi}" width="${bw - 10}" height="2" fill="var(--in)"/>
      <text x="${i * bw + bw / 2}" y="${H - 3}" text-anchor="middle" class="axis">${n > 8 ? lab.slice(0, 1) : lab}</text></g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spent and came in by month"><line x1="0" x2="${W}" y1="${H - 16}" y2="${H - 16}" stroke="var(--rule)"/>${bars}</svg>`;
}

export const budgetOf = (db, g) => { const b = db.budgets.find((x) => !x.deleted && x.group === g); return b ? b.amount : 0; };
export function gbar(db, g, v, max, kind, total) {
  const b = kind === 'income' ? 0 : budgetOf(db, g), over = b && v > b;
  const inner = `<i class="badge sm" style="background:${groupColor(g)}">${groupLetter(g)}</i>
    <div class="gmid"><div class="gtop"><span>${esc(g)}${total > 0 ? ` <small class="pct">${Math.round(v / total * 100)}%</small>` : ''}</span><b>${money(v)}${b ? `<small> of ${money(b)}</small>` : ''}</b></div>
    <div class="track"><div class="fill" style="width:${Math.min(100, (v / max) * 100)}%;background:${kind === 'income' ? 'var(--in)' : groupColor(g)}"></div>${b ? `<u style="left:${Math.min(100, (b / max) * 100)}%"></u>` : ''}</div></div>${kind ? ic('right', 'chev') : ''}`;
  return kind
    ? `<button class="gbar click ${over ? 'over' : ''}" data-act="grp" data-g="${esc(g)}" data-k="${kind}" aria-label="${esc(g)} details">${inner}</button>`
    : `<div class="gbar ${over ? 'over' : ''}">${inner}</div>`;
}

// what is inside one group this month: totals, comparison, history, categories and every entry
ACT.grp = (el) => openGroupDetail(el.dataset.g, el.dataset.k, el.dataset.m || ui.month);
export function openGroupDetail(g, kind, ym) {
  const db0 = get();
  const isOut = kind === 'expense';
  const s = sheet('<div id="gd"></div>', { title: g, wide: true });
  const root = s.el.querySelector('#gd');
  let pick = '';
  const draw = () => {
    const db = get(), cats = catMap(db);
    const parts = monthParts(db, ym).filter((p) => p.kind === kind && p.group === g);
    const total = sum(parts.map((p) => p.v));
    const all = totals(db, ym, kind).total;
    const tr = groupTrend(db, ym, g, kind, 6);
    const prev = tr[tr.length - 2].v;
    const bm = baselineMonths(db, ym, 3);
    const usual = bm.length ? sum(bm.map((m) => sum(monthParts(db, m).filter((p) => p.kind === kind && p.group === g).map((p) => p.v)))) / bm.length : 0;
    const delta = (a, b) => (b > 0 ? `<small class="${(a > b) === isOut ? 'neg' : 'in'}">${a >= b ? '+' : '−'}${Math.round(Math.abs(a - b) / b * 100)}%</small>` : '');
    const byCat = new Map();
    for (const p of parts) byCat.set(p.cat || 'none', (byCat.get(p.cat || 'none') || 0) + p.v);
    const catRows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const cmax = catRows.length ? catRows[0][1] : 1;
    const shown = (pick ? parts.filter((p) => (p.cat || 'none') === pick) : parts).slice().sort((a, b) => (a.t.date < b.t.date ? 1 : -1));
    const ctot = sum(shown.map((p) => p.v));
    const budget = isOut ? budgetOf(db, g) : 0;
    root.innerHTML = `
      <div class="gdhead"><b class="big">${money(total)}</b>
        <span class="muted">${all ? Math.round(total / all * 100) : 0}% of ${isOut ? 'everything spent' : 'everything that came in'} · ${parts.length} ${parts.length === 1 ? 'entry' : 'entries'}</span>
        ${budget ? `<span class="${total > budget ? 'neg' : 'muted'}">${total > budget ? 'Over' : 'Under'} the ${money(budget)} budget by ${money(Math.abs(budget - total))}</span>` : ''}</div>
      <div class="facts"><div><span>Last month</span><b>${money(prev)}</b>${delta(total, prev)}</div>
        <div><span>Usual (${bm.length || 0} mo avg)</span><b>${bm.length ? money(usual) : '—'}</b>${bm.length ? delta(total, usual) : ''}</div>
        <div><span>Biggest</span><b>${parts.length ? money(Math.max(...parts.map((p) => p.v))) : '—'}</b></div></div>
      ${trendChart(tr.map((x) => (isOut ? { m: x.m, spent: x.v, income: 0 } : { m: x.m, spent: 0, income: x.v })), ym, 6, false)}
      <h3>By category</h3>
      <div class="catbars">${catRows.map(([id, v]) => { const c = cats.get(id); return `<button class="cbar ${pick === id ? 'on' : ''}" data-cat="${id}"><span>${esc(c ? c.name : 'No category')}</span><b>${money(v)}</b><div class="track"><div class="fill" style="width:${Math.max(3, v / cmax * 100)}%;background:${isOut ? groupColor(g) : 'var(--in)'}"></div></div></button>`; }).join('')}</div>
      <div class="h2row"><h3>${pick ? esc((cats.get(pick) || { name: 'No category' }).name) : 'All entries'} · ${money(ctot)}</h3>${pick ? '<button class="linkbtn" data-clear>Show all</button>' : ''}</div>
      <div class="rows plain">${shown.slice(0, 80).map((p) => {
        const t = p.t, c = cats.get(p.cat), a = db.accounts.find((x) => x.id === t.acct);
        const orig = !p.split && t.cur !== HOME ? money(t.amount, t.cur) : '';
        return `<button class="row prow" data-id="${t.id}"><span class="pdate">${dayLabel(t.date).replace(/^\w+, /, '')}</span>
          <span class="rmain"><strong><span class="tt">${esc(p.label || t.name || (c ? c.name : ''))}</span></strong><small>${esc(c ? c.name : '')}${a ? ' · ' + esc(a.name) : ''}${p.split ? ' · receipt item' : ''}</small></span>
          <span class="ramt ${kind}"><b>${kind === 'income' ? '+' : ''}${money(p.v)}</b>${orig ? `<small>${orig}</small>` : ''}</span></button>`;
      }).join('') || '<p class="empty">Nothing here.</p>'}</div>
      ${shown.length > 80 ? `<p class="hint">Showing the 80 newest of ${shown.length}. Use Entries and search for the rest.</p>` : ''}`;
  };
  root.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]');
    if (c) { pick = pick === c.dataset.cat ? '' : c.dataset.cat; draw(); return; }
    if (e.target.closest('[data-clear]')) { pick = ''; draw(); return; }
    const r = e.target.closest('[data-id]');
    if (r) { s.close(); openEntry({ id: r.dataset.id }); }
  });
  draw();
}

// ---------------- Ledger ----------------
function ledgerRows(db) {
  const accts = accountMap(db), cats = catMap(db);
  const q = ui.q.trim().toLowerCase();
  let list = sortedTxs(db);
  const ranged = !!(ui.from || ui.to);
  if (ranged) list = list.filter((t) => (!ui.from || t.date.slice(0, 10) >= ui.from) && (!ui.to || t.date.slice(0, 10) <= ui.to));
  else if (!q) list = list.filter((t) => t.date.startsWith(ui.month));
  const feeSource = ui.filter === 'expense' ? list.filter((t) => t.kind === 'transfer' && t.fee > 0) : [];   // fees saved on transfers, trades and loans are expenses too
  if (ui.filter === 'review') list = list.filter((t) => t.flag === 'review');
  else if (ui.filter !== 'all') list = list.filter((t) => t.kind === ui.filter);
  if (ui.acct) list = list.filter((t) => t.acct === ui.acct || t.toAcct === ui.acct);
  if (ui.cat) { const isG = ui.cat.startsWith('g:'), key = ui.cat.slice(2); list = list.filter((t) => { const c = cats.get(t.cat); return c && (isG ? c.group === key : c.id === key); }); }
  if (feeSource.length) {
    const fa = (t) => (t.feeBy === 'to' ? t.toAcct : t.acct);
    const fees = feeSource.filter((t) => !ui.acct || fa(t) === ui.acct).map((t) => ({ ...t, _feeOf: t.name || 'transfer', kind: 'expense', amount: t.fee, cur: t.feeCur || t.cur, fx: t.feeFx, name: `Fee · ${t.name || (t.trade ? 'trade' : 'transfer')}`, cat: t.feeCat, acct: fa(t), toAcct: undefined, fee: 0, items: [], trade: false, loanNet: undefined, flag: undefined }));
    list = [...list, ...fees].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  if (q) list = list.filter((t) => {
    const c = cats.get(t.cat), a = accts.get(t.acct);
    return [t.name, t.notes, c && c.name, c && c.group, a && a.name, (t.items || []).map((i) => i.n).join(' ')].join(' ').toLowerCase().includes(q);
  });
  // a fee that belongs to a trade is shown inside the trade's row, not as a separate entry (still searchable, and in the Expense filter)
  const kidMap = tradeKids(db).parentOf, hideKids = !q && ui.filter !== 'expense';
  const hiddenFees = hideKids ? list.filter((t) => kidMap.has(t.id) && list.some((p) => p.id === kidMap.get(t.id).id)) : [];
  if (hiddenFees.length) { const hs = new Set(hiddenFees.map((t) => t.id)); list = list.filter((t) => !hs.has(t.id)); }
  const total = list.length, trail = balanceTrail(db);
  const sumHtml = filterSummary(db, list, hiddenFees, kidMap);
  list = list.slice(0, ui.limit);
  let html = '', day = '', dayTotal = 0, buf = '', byCur = new Map(), n = 0; const shown = []; ui.shown = shown;
  const flush = () => { if (buf) { const off = ui.daysOff.has(day), col = '', curs = [...byCur.entries()].sort((a, b) => (a[0] === HOME ? 1 : b[0] === HOME ? -1 : 0)), foreign = curs.some(([c]) => c !== HOME);
    const lines = curs.map(([c, v]) => `<span class="dline">${money(-v, c)}</span>`).join('');
    html += `<div class="day ${off ? 'off' : ''}"><button type="button" class="dayhead" data-act="day-toggle" data-d="${day}" aria-expanded="${!off}"><span class="dcaret">${off ? '▸' : '▾'}</span><span class="dlabel">${dayLabel(day)}${off ? ` <small class="muted">${n} ${n === 1 ? 'entry' : 'entries'}</small>` : ''}</span><span class="dtot" ${col ? `style="color:${col}"` : ''}>${dayTotal ? (foreign ? `${lines}<small class="dcur">${money(-dayTotal)}</small>` : `<span class="dline">${money(-dayTotal)}</span>`) : ''}</span></button><div class="rows" ${off ? 'hidden' : ''}>${buf}</div></div>`; } buf = ''; dayTotal = 0; byCur = new Map(); n = 0; };
  for (const t of list) {
    const d = t.date.slice(0, 10);
    if (d !== day) { flush(); day = d; }
    buf += row(t, accts, cats, ui.selecting, trail); shown.push(t.id); n++;
    if (t.kind === 'expense') { dayTotal += t.amount * factorFor(db, t); byCur.set(t.cur, (byCur.get(t.cur) || 0) + t.amount); }
    for (const k of hiddenFees) if (kidMap.get(k.id).id === t.id) { dayTotal += k.amount * factorFor(db, k); byCur.set(k.cur, (byCur.get(k.cur) || 0) + k.amount); }
  }
  flush();
  if (!html) html = `<p class="empty">${q ? 'No entries match your search.' : ui.filter === 'review' ? 'Nothing to check. Every entry this month is confirmed.' : 'No entries here.'}</p>`;
  if (total > list.length) html += `<button class="btn ghost wide" data-act="more">Show more (${total - list.length} left)</button>`;
  return sumHtml + html;
}
// what a normal day costs: the median of your last 60 days that had spending (home currency)
function dayBaseline(db) {
  try { const v = dailySpend(db, todayStr(), 60).vals.filter((x) => x > 0).sort((a, b) => a - b); return v.length >= 5 ? v[v.length >> 1] : 0; } catch { return 0; }
}
// green when the day was cheaper than a normal day, through amber, to dark red when it was much dearer
function dayColor(v, base) {
  if (!v || !base) return '';
  const r = Math.min(2.2, Math.max(0.3, v / base)), x = r <= 1 ? (r - 0.3) / 0.7 * 0.5 : 0.5 + (r - 1) / 1.2 * 0.5;
  const hue = 135 - x * 135, light = 36 - Math.max(0, x - 0.5) * 12;
  return `hsl(${hue.toFixed(0)} 70% ${light.toFixed(0)}%)`;
}
// when a filter, a category or a date range is on, show what the selection adds up to
function filterSummary(db, list, hiddenFees, kidMap) {
  const on = ui.filter !== 'all' || ui.cat || ui.from || ui.to || ui.acct || ui.q.trim();
  if (!on) return '';
  const acc = { expense: new Map(), income: new Map(), transfer: new Map() }, hm = { expense: 0, income: 0, transfer: 0 }, cnt = { expense: 0, income: 0, transfer: 0 };
  const add = (t) => { const k = acc[t.kind] ? t.kind : null; if (!k) return; cnt[k]++; acc[k].set(t.cur, (acc[k].get(t.cur) || 0) + t.amount); hm[k] += t.amount * factorFor(db, t); };
  const seen = new Set(list.map((t) => t.id));
  for (const t of list) add(t);
  for (const k of hiddenFees || []) if (!seen.has(k.id)) add(k);
  const cats = catMap(db);
  const catName = ui.cat ? (ui.cat.startsWith('g:') ? ui.cat.slice(2) : ((cats.get(ui.cat) || {}).name || '')) : '';
  const range = ui.from || ui.to ? `${ui.from || 'start'} to ${ui.to || 'today'}` : '';
  // which dates the totals cover: the chosen range, otherwise the month shown (a search looks at every date)
  const period = ui.from || ui.to ? `${ui.from ? fshort(ui.from) : 'the first entry'} to ${ui.to ? fshort(ui.to) : 'today'}` : (ui.q.trim() ? 'all dates' : monthLabel(ui.month));
  const title = [catName, range, ui.filter !== 'all' ? (ui.filter === 'review' ? 'Check' : ui.filter[0].toUpperCase() + ui.filter.slice(1)) : ''].filter(Boolean).join(' · ') || 'This selection';
  const line = (label, k) => { if (!cnt[k]) return ''; const cur = [...acc[k].entries()].map(([c, v]) => money(v, c)).join(' · '); return `<div class="sumrow"><span>${label} <small class="muted">${cnt[k]} ${cnt[k] === 1 ? 'entry' : 'entries'}</small></span><b>${money(hm[k])}</b>${acc[k].size > 1 || ![...acc[k].keys()].every((c) => c === HOME) ? `<small class="muted">${cur}</small>` : ''}</div>`; };
  const inner = line('Total spent', 'expense') + line('Income received', 'income') + line('Moved between accounts', 'transfer');
  return `<div class="fsum" id="lsum"><b class="fsumtitle">${esc(title)}</b><small class="muted fsumrange">Dates covered: ${esc(period)}</small>${inner || '<span class="muted">Nothing matches.</span>'}</div>`;
}
ACT.more = () => { ui.limit += 150; const el = document.getElementById('ledger-list'); if (el) el.innerHTML = ledgerRows(get()); };

function catOptions(db) {
  const live = db.categories.filter((c) => !c.deleted), groups = [...new Set(live.map((c) => c.group))].sort();
  return `<option value="">All categories</option>` + groups.map((g) => `<optgroup label="${esc(g)}"><option value="g:${esc(g)}" ${ui.cat === 'g:' + g ? 'selected' : ''}>All of ${esc(g)}</option>${live.filter((c) => c.group === g).sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}" ${ui.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
}
const ledgerRefresh = () => { const l = document.getElementById('ledger-list'); if (l) l.innerHTML = ledgerRows(get()); };
ACT['day-toggle'] = (el) => { const d = el.dataset.d; if (ui.daysOff.has(d)) ui.daysOff.delete(d); else ui.daysOff.add(d); const box = el.closest('.day'); if (box) { const off = ui.daysOff.has(d); box.classList.toggle('off', off); el.setAttribute('aria-expanded', String(!off)); const r = box.querySelector('.rows'); if (r) r.hidden = off; el.querySelector('.dcaret').textContent = off ? '▸' : '▾'; } };
const fshort = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
ACT['f-pick'] = async (el) => { const k = el.dataset.k, { openDatePicker } = await import('./datepicker.js'); openDatePicker(ui[k] || todayStr(), (v) => { ui[k] = v.slice(0, 10); if (ui.from && ui.to && ui.from > ui.to) { if (k === 'from') ui.to = ui.from; else ui.from = ui.to; } ui.limit = 120; window.dispatchEvent(new Event('sukli-render')); }, { time: false, title: k === 'from' ? 'From which day?' : 'Up to which day?' }); };
ACT['f-range'] = (el) => { const v = el.dataset.v, t = todayStr(), d = new Date(); const sub = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  if (v === '7') { ui.from = sub(6); ui.to = t; } else if (v === '30') { ui.from = sub(29); ui.to = t; } else if (v === 'm') { ui.from = `${t.slice(0, 7)}-01`; ui.to = t; } else { ui.from = `${t.slice(0, 4)}-01-01`; ui.to = t; }
  ui.limit = 120; window.dispatchEvent(new Event('sukli-render')); };
ACT['f-clear'] = () => { ui.from = ui.to = ui.cat = ''; ui.filter = 'all'; ui.acct = ''; ui.q = ''; window.dispatchEvent(new Event('sukli-render')); };
export function ledger(db) {
  const f = [['all', 'All'], ['review', 'Check'], ['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']];
  return `${monthNav()}
    <div class="searchbar">${ic('search')}<input id="q" type="search" placeholder="Search entries, items, notes" value="${esc(ui.q)}" aria-label="Search entries"></div>
    <div class="filters" role="group" aria-label="Filter">${f.map(([v, l]) => `<button class="chip ${ui.filter === v ? 'on' : ''}" data-act="filter" data-v="${v}" ${v === 'review' ? 'title="Entries with a guessed category or label that you have not confirmed yet"' : ''}>${l}</button>`).join('')}</div>
    <div class="frow2">
      <div class="frange"><button type="button" class="fdbtn ${ui.from ? 'set' : ''}" data-act="f-pick" data-k="from" aria-label="From date"><small>From</small><b>${ui.from ? esc(fshort(ui.from)) : 'Any date'}</b></button><span class="fdash" aria-hidden="true">–</span><button type="button" class="fdbtn ${ui.to ? 'set' : ''}" data-act="f-pick" data-k="to" aria-label="To date"><small>To</small><b>${ui.to ? esc(fshort(ui.to)) : 'Any date'}</b></button></div>
      <div class="fquick" role="group" aria-label="Quick ranges">${[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['m', 'This month'], ['y', 'This year']].map(([v, l]) => `<button type="button" class="chip" data-act="f-range" data-v="${v}">${l}</button>`).join('')}</div>
    </div>
    <div class="frow3">
      <select id="acctfilter" aria-label="Account filter"><option value="">All accounts</option>${db.accounts.filter((a) => !a.deleted).sort((a, b) => a.name.localeCompare(b.name)).map((a) => `<option value="${a.id}" ${ui.acct === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
      <label class="fcat"><select id="lf-cat" aria-label="Category filter">${catOptions(db)}</select></label>
      <button type="button" class="btn sm ghost" data-act="f-clear">Clear all</button></div>
    <p class="hint filterhint" id="filterhint">${filterHint()}</p>
    <div id="selbar-wrap">${selBar()}</div>
    <div id="ledger-list">${ledgerRows(db)}</div>`;
}
// one line under the filters saying what the chosen filter shows
const FILTER_HINTS = {
  review: 'Check means Sukli guessed something for you (the category or the label) and you have not confirmed it yet. Open an entry and save it to confirm, or use Review in the menu to go through them one by one. Nothing is wrong with the money itself.',
  expense: 'Money you spent. Fees from trades, transfers and loans are listed here too, each one pointing to its entry.',
  transfer: 'Money moved between your own accounts, including trades. Not counted as spending, and fees are not listed here (see Expense).',
  income: 'Money that came in.',
  all: '',
};
const filterHint = () => esc(FILTER_HINTS[ui.filter] || '');
// choose several entries and delete them together (they go to the recycle bin and can be undone)
function selBar() {
  if (!ui.selecting) return `<div class="btnrow left selstart"><button type="button" class="btn sm ghost" data-act="sel-start">${ic('check')} Select entries</button><button type="button" class="btn sm ghost" data-act="ih-open">Input history</button></div>`;
  const n = ui.sel.size;
  return `<div class="selbar" role="toolbar" aria-label="Selected entries"><span><b>${n}</b> selected</span><button type="button" class="btn sm ghost" data-act="sel-all">${n && n >= (ui.shown || []).length ? 'Clear' : 'Select all shown'}</button><button type="button" class="btn sm danger" data-act="sel-del" ${n ? '' : 'disabled'}>${ic('trash')} Delete (${n})</button><button type="button" class="btn sm ghost" data-act="sel-end">Done</button></div>`;
}
const selRefresh = () => { const l = document.getElementById('ledger-list'), w = document.getElementById('selbar-wrap'); if (!l) return window.dispatchEvent(new Event('sukli-render')); const y = window.scrollY; l.innerHTML = ledgerRows(get()); w.innerHTML = selBar(); window.scrollTo(0, y); };
ACT['sel-start'] = () => { ui.selecting = true; ui.sel = new Set(); selRefresh(); };
ACT['sel-end'] = () => { ui.selecting = false; ui.sel = new Set(); selRefresh(); };
ACT['sel-toggle'] = (el) => { const id = el.dataset.id; if (ui.sel.has(id)) ui.sel.delete(id); else ui.sel.add(id); selRefresh(); };
ACT['sel-all'] = () => { const all = ui.shown || []; if (ui.sel.size >= all.length) ui.sel = new Set(); else ui.sel = new Set(all); selRefresh(); };
ACT['sel-del'] = async () => {
  const ids = [...ui.sel]; if (!ids.length) return;
  if (!(await confirmDialog(`Delete ${ids.length} ${ids.length === 1 ? 'entry' : 'entries'}? They move to the recycle bin and can be restored.`, 'Delete', true))) return;
  const gone = [];
  commit((d) => { for (const t of d.txs) if (ids.includes(t.id) && !t.deleted) { softDelete(t); gone.push(t.id); } });
  ui.selecting = false; ui.sel = new Set();
  toast(`${gone.length} moved to the recycle bin`, { undo: () => commit((d) => { for (const t of d.txs) if (gone.includes(t.id)) { t.deleted = false; delete t.deletedAt; stamp(t); } }) });
};
ACT.filter = (el) => { ui.filter = el.dataset.v; const h = document.getElementById('filterhint'); if (h) h.textContent = FILTER_HINTS[ui.filter] || ''; ui.limit = 120; window.dispatchEvent(new Event('sukli-render')); };
export function bindLedger() {
  const q = document.getElementById('q');
  if (q) q.oninput = () => { ui.q = q.value; ui.limit = 120; document.getElementById('ledger-list').innerHTML = ledgerRows(get()); };
  const a = document.getElementById('acctfilter');
  if (a) a.onchange = () => { ui.acct = a.value; document.getElementById('ledger-list').innerHTML = ledgerRows(get()); };
  for (const [id, k] of [['lf-cat', 'cat']]) { const e = document.getElementById(id); if (e) e.onchange = () => { ui[k] = e.value; ui.limit = 120; ledgerRefresh(); }; }
}

// ---------------- Review ----------------
export function review(db) {
  const accts = accountMap(db), cats = catMap(db);
  const list = sortedTxs(db).filter((t) => t.flag === 'review');
  const cards = list.map((t) => {
    const a = accts.get(t.acct);
    const p = predict(modelFor(t.kind === 'income' ? 'income' : 'expense'), t.name, t.amount, { acct: t.acct, cur: t.cur, hour: +t.date.slice(11, 13) });
    const opts = p.cats.slice(0, 3).filter((x) => cats.has(x.id));
    return `<article class="rcard"><div class="rtop"><strong>${esc(t.name || 'Untitled')}</strong><b>${money(t.kind === 'income' ? t.amount : -t.amount, t.cur)}${eq(t.amount, t.cur, t.fx) ? `<small class="eqs"> ${eq(t.amount, t.cur, t.fx)}</small>` : ''}</b></div>
      <small>${dayLabel(t.date)} · ${esc(a ? a.name : '')}${t.autoName ? ' · label was left blank and guessed, tap Edit to rename' : ''}${t.items && t.items.length ? ' · items do not add up to the total' : ''}</small>
      <div class="chips">${opts.map((x) => { const c = cats.get(x.id); return `<button class="chip cat" data-act="confirm" data-id="${t.id}" data-cat="${x.id}"><i style="background:${groupColor(c.group)}">${groupLetter(c.group)}</i>${esc(c.name)} <small>${Math.round(x.p * 100)}%</small></button>`; }).join('')}
      <button class="chip more" data-act="edit" data-id="${t.id}">Edit</button></div></article>`;
  });
  const sure = list.filter((t) => { const p = predict(modelFor(t.kind === 'income' ? 'income' : 'expense'), t.name, t.amount, { acct: t.acct, cur: t.cur, hour: +t.date.slice(11, 13) }); return p.conf >= 0.8 && !(t.items && t.items.length); }).length;
  return `${hdr('Review')}
    <p class="lede">${list.length ? 'Tap the right category to confirm each one. Your choice teaches the guesser.' : 'All caught up. Entries the app is unsure about will show up here.'}</p>
    ${sure ? `<button class="btn wide" data-act="confirm-sure">Confirm the ${sure} I’m sure about (80%+)</button>` : ''}
    <div class="rcards">${cards.join('')}</div>`;
}
ACT.confirm = (el) => commit((d) => { const t = d.txs.find((x) => x.id === el.dataset.id); if (t.cat !== el.dataset.cat) t.corrected = true; t.cat = el.dataset.cat; t.flag = null; stamp(t); });
ACT['confirm-sure'] = () => {
  let n = 0;
  commit((d) => {
    for (const t of d.txs) {
      if (t.deleted || t.flag !== 'review' || (t.items && t.items.length)) continue;
      const p = predict(modelFor(t.kind === 'income' ? 'income' : 'expense'), t.name, t.amount, { acct: t.acct, cur: t.cur, hour: +t.date.slice(11, 13) });
      if (p.conf >= 0.8 && p.cats[0]) { t.cat = p.cats[0].id; t.flag = null; stamp(t); n++; }
    }
  });
  toast(`Confirmed ${n} ${n === 1 ? 'entry' : 'entries'}.`);
};

// ---------------- Accounts ----------------

// shown right after an import so people sort out which accounts are really spendable
export function openAccountSetup() {
  const db = get();
  const list = db.accounts.filter((a) => !a.deleted && a.guessed);
  if (!list.length) return;
  const bal = balances(db);
  const s = sheet(`<p class="hint">The app guessed what each account is from its name. Fix anything that’s wrong. Only accounts ticked here count toward “Spendable now”.</p>
    <form id="setup">${list.sort((a, b) => a.name.localeCompare(b.name)).map((a) => `<div class="setrow" data-id="${a.id}">
      <div><strong>${esc(a.name)}</strong><small>${money(bal.get(a.id) || 0, a.cur)}</small></div>
      <select aria-label="Type of ${esc(a.name)}">${Object.entries(typeNames).map(([v, l]) => `<option value="${v}" ${v === a.type ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" ${a.include ? 'checked' : ''}> Spendable</label></div>`).join('')}
    <div class="btnrow"><button class="btn">Done</button></div></form>`, { title: 'Sort your accounts', wide: true });
  s.el.querySelector('#setup').onsubmit = (e) => {
    e.preventDefault();
    commit((d) => {
      for (const r of s.el.querySelectorAll('.setrow')) {
        const a = d.accounts.find((x) => x.id === r.dataset.id);
        a.type = r.querySelector('select').value; a.include = r.querySelector('input').checked; a.guessed = false; stamp(a);
      }
    });
    s.close();
  };
}

// ---------------- Reports ----------------
const BYS = [['group', 'Group'], ['category', 'Category'], ['account', 'Account'], ['weekday', 'Weekday']];
ACT.by = (el) => { ui.by = el.dataset.v; window.dispatchEvent(new Event('sukli-render')); };

export function reports(db) {
  const st = monthStats(db, ui.month);
  const cats = catMap(db);
  const groups = [...st.byGroup.entries()].sort((a, b) => b[1] - a[1]);
  const max = groups.length ? Math.max(groups[0][1], ...groups.map(([g]) => budgetOf(db, g))) : 1;
  const chart = trendChart(trend(db, thisMonth(), 12), ui.month, 12);
  const parts = monthParts(db, ui.month).filter((p) => p.kind === 'expense');
  const total = st.spent;
  const flat = (rows) => { const m = rows.length ? Math.max(...rows.map((r) => r.v)) : 1; return rows.map((r) => `<div class="gbar"><i class="badge sm" style="background:${groupColor(r.color)}">${esc(r.letter || groupLetter(r.color))}</i>
    <div class="gmid"><div class="gtop"><span>${esc(r.name)} <small class="pct">${total ? Math.round(r.v / total * 100) : 0}%</small></span><b>${money(r.v)}</b></div>
    <div class="track"><div class="fill" style="width:${Math.max(2, r.v / m * 100)}%;background:${groupColor(r.color)}"></div></div></div></div>`).join('') || '<p class="empty">Nothing spent this month.</p>'; };
  let body;
  if (ui.by === 'category') {
    const rows = [...st.byCat.entries()].map(([id, v]) => { const c = cats.get(id); return { name: c ? c.name : 'No category', color: c ? c.group : 'Uncategorized', v }; }).sort((a, b) => b.v - a.v);
    body = flat(rows);
  } else if (ui.by === 'account') {
    const m = new Map(); const am = accountMap(db);
    for (const p of parts) m.set(p.t.acct, (m.get(p.t.acct) || 0) + p.v);
    body = flat([...m.entries()].map(([id, v]) => ({ name: (am.get(id) || { name: '?' }).name, color: (am.get(id) || { type: 'other' }).type, v })).sort((a, b) => b.v - a.v));
  } else if (ui.by === 'weekday') {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], sum2 = new Array(7).fill(0), seen = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];
    for (const p of parts) { const d = new Date(p.t.date.slice(0, 10) + 'T00:00:00').getDay(); sum2[d] += p.v; seen[d].add(p.t.date.slice(0, 10)); }
    body = flat(sum2.map((v, i) => ({ name: names[i], letter: names[i][0], color: names[i], v })).sort((a, b) => b.v - a.v)) + '<p class="hint">Totals for the month, busiest weekday first.</p>';
  } else {
    body = groups.map(([g, v]) => {
      const inner = [...st.byCat.entries()].filter(([id]) => (cats.get(id) || { group: 'Uncategorized' }).group === g).sort((a, b) => b[1] - a[1]);
      const b = budgetOf(db, g);
      return `<details class="gdet"><summary>${gbar(db, g, v, max, undefined, total)}</summary>
        <ul class="catlist">${inner.map(([id, x]) => `<li><span>${esc((cats.get(id) || { name: 'No category' }).name)} <small class="pct">${v ? Math.round(x / v * 100) : 0}%</small></span><b>${money(x)}</b></li>`).join('')}</ul>
        <div class="btnrow left"><button class="btn ghost sm" data-act="grp" data-g="${esc(g)}" data-k="expense">See entries</button><button class="btn ghost sm" data-act="budget" data-g="${esc(g)}">${b ? 'Change monthly budget' : 'Set a monthly budget'}</button>${b ? `<button class="btn ghost sm" data-act="budget-clear" data-g="${esc(g)}">Remove budget</button>` : ''}</div></details>`;
    }).join('') || '<p class="empty">Nothing spent this month.</p>';
  }
  const seg = `<div class="seg four" role="group" aria-label="Group spending by">${BYS.map(([v, l]) => `<button type="button" data-act="by" data-v="${v}" class="${ui.by === v ? 'on' : ''}" aria-pressed="${ui.by === v}">${l}</button>`).join('')}</div>`;
  return `${monthNav()}${strip(st)}
    ${coll('r-12', 'Last 12 months', `${chart}<p class="legend"><i class="k bar"></i>Cash outflow <i class="k inc"></i>Cash inflow · tap a month</p>`)}
    ${coll('r-by', 'Spending by', `${seg}${body}<p class="hint">Entries split into items are counted under each item’s own category.</p>`)}`;
}
ACT.budget = async (el) => {
  const g = el.dataset.g, cur = budgetOf(get(), g);
  const v = await promptDialog(`Monthly budget for ${g} (${HOME})`, cur || '', { type: 'number', hint: 'You will see a marker on the bar and it turns amber when you pass it.' });
  const n = parseFloat(v);
  if (!(n > 0)) return;
  commit((d) => { let b = d.budgets.find((x) => !x.deleted && x.group === g); if (b) { b.amount = n; stamp(b); } else d.budgets.push(stamp({ id: uid(), group: g, amount: n })); });
};
ACT['budget-clear'] = (el) => commit((d) => { const b = d.budgets.find((x) => !x.deleted && x.group === el.dataset.g); if (b) softDelete(b); });

// ---------------- Settings ----------------
const segBtns = (act, k, opts, cur) => `<div class="seg sm" role="group">${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-k="${k}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
ACT['rates-now'] = async () => { try { await fetchRates(); } catch (e) { /* status already shown */ } };
ACT['rate-live'] = (el) => commit((d) => { delete d.settings.rates[el.dataset.c]; });
// Settings: open the converter for one currency; saving makes it a manual rate, "Back to live" removes the override
ACT['rate-open'] = (el) => { const c = el.dataset.c, db = get();
  openConverter({ from: c, to: HOME, amount: 1, rate: homeFx(db, c), applyLabel: 'Save as my rate',
    onApply: ({ rate }) => commit((d) => { const hr = (d.settings.rates && d.settings.rates[HOME] > 0 ? d.settings.rates[HOME] : rateFor(d, HOME)) || 1; d.settings.rates = d.settings.rates || {}; d.settings.rates[c] = rate * (HOME === BASE ? 1 : hr); }),
    onReset: () => commit((d) => { if (d.settings.rates) delete d.settings.rates[c]; }) }); };
ACT['home-cur'] = () => openCurrencyPicker(async (c) => {
  const db = get(); if (c === HOME) return;
  if (!(await confirmDialog(`Show totals in ${c} (${curName(c)}) from now on? Budgets and limits you set will be converted at today’s rate. Nothing else is rewritten.`, 'Change'))) return;
  commit((d) => {
    const k = (rateFor(d, HOME) || 1) / (rateFor(d, c) || 1);
    for (const b of d.budgets) if (!b.deleted && b.amount > 0) { b.amount = Math.round(b.amount * k * 100) / 100; stamp(b); }
    if (d.settings.spendLimit > 0) d.settings.spendLimit = Math.round(d.settings.spendLimit * k);
    d.settings.home = c;
  });
  toast(`Totals are now shown in ${c}.`);
}, { title: 'Home currency' });
ACT.look = (el) => { setLook({ [el.dataset.k]: el.dataset.v }); window.dispatchEvent(new Event('sukli-render')); };
ACT.hidestyle = (el) => { priv.setStyle(el.dataset.v); applyHide(); window.dispatchEvent(new Event('sukli-render')); };
ACT.remind = (el) => { commit((d) => { d.settings.remindDays = +el.dataset.v; }); };
export function settings(db) {
  const s = db.settings;
  const groups = [...new Set(db.categories.filter((c) => !c.deleted && c.kind !== 'income').map((c) => c.group))].sort();
  const curs = [...new Set(db.accounts.filter((a) => !a.deleted).map((a) => a.cur))].filter((c) => c !== HOME);
  const lk = look();
  const cl = s.cloud || {};
  const me = signedIn() ? (session() || {}).user : null;
  return settingsGrouped(`${hdr('Settings')}
    <section><h2>Categories</h2>
      <p class="hint">Add, rename and delete your expense and income categories, with keywords so the app guesses them.</p>
      <div class="btnrow left"><a class="btn" href="#/categories?k=expense">Expense categories</a><a class="btn ghost" href="#/categories?k=income">Income categories</a></div></section>
    ${(() => { const own = [...new Set([...Object.keys(db.settings.curDec || {}), ...db.accounts.filter((a) => !a.deleted && a.type === 'crypto').map((a) => a.cur)])]; return own.length ? `<section><h2>Coins and tokens: decimals</h2><p class="hint">How many decimals to show for coins and tokens (for example MNT as Mantle, or BBSOL).</p>${own.map((c) => `<label class="field inline"><span>${esc(c)}</span><select data-curdec="${esc(c)}">${[2, 4, 6, 8].map((n) => `<option ${CUR[c].dec === n ? 'selected' : ''}>${n}</option>`).join('')}</select><span>decimals</span></label>`).join('')}</section>` : ''; })()}
    ${(() => { const r = nameRules(), groups = new Map(); for (const [a, k] of Object.entries(r.same)) { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
      return `<section id="nmatch"><h2>Name matching</h2><label class="field"><span>Home stop (optional)</span><input id="homeplace" value="${esc(s.homePlace || '')}" placeholder="e.g. San Pedro" autocomplete="off"><small class="muted">The stop you leave in the morning and come back to in the evening. Left empty, Sukli works it out from your trips.</small></label>
      <label class="field"><span>Workplace stop (optional)</span><input id="workplace" value="${esc(s.workPlace || '')}" placeholder="e.g. Shinagawa" autocomplete="off"><small class="muted">Sukli remembers it: on weekday mornings it suggests home to work, and in the evening work to home.</small></label><p class="hint">Teach Sukli which names mean the same thing (“starbucks antipolo” and “starbucks tagaytay”) and which do not (“tennis” the sport and “tennis socks”). It also asks when you type a new name that looks like an old one.</p>
      <button type="button" class="btn ghost wide" data-act="nm-review">Review similar names</button>
      <button type="button" class="btn ghost wide" data-act="nm-map">Name map (how names connect)</button>
      ${[...groups.entries()].map(([k, as]) => `<div class="nmgroup"><b>${esc(k)}</b><div>${as.filter((a) => a !== k).map((a) => `<span class="chip">${esc(a)} <button type="button" class="x" data-act="nm-forget" data-kind="same" data-v="${esc(a)}" aria-label="Unlink ${esc(a)}">×</button></span>`).join('') || '<small class="muted">only itself</small>'}</div></div>`).join('')}
      ${(r.related || []).length ? `<h3>Related (same family, separate)</h3>${r.related.map((k) => `<div class="nmgroup"><span>${esc(k.replace('|', '  ~  '))} <small class="muted">${Math.round(((r.relw || {})[k] ?? 0.6) * 100)}% close</small></span><button type="button" class="btn sm ghost" data-act="nm-forget" data-kind="related" data-v="${esc(k)}">Undo</button></div>`).join('')}` : ''}
      ${r.apart.length ? `<h3>Kept apart</h3>${r.apart.map((k) => `<div class="nmgroup"><span>${esc(k.replace('|', '  ≠  '))}</span><button type="button" class="btn sm ghost" data-act="nm-forget" data-kind="apart" data-v="${esc(k)}">Undo</button></div>`).join('')}` : ''}</section>`; })()}
    ${(() => { const st = db.settings, custom = st.customTypes || {}, n = (k) => db.accounts.filter((a) => !a.deleted && a.type === k).length;
      return `<section id="atypes"><h2>Account types</h2><p class="hint">Rename any type, or add your own, for example "Money owed to me" or "Savings pot". Choose whether a new type is something you have or something you owe.</p>
      ${Object.entries(typeNames).map(([k, l]) => `<div class="field inline"><input data-atype-label="${esc(k)}" value="${esc(l)}" aria-label="Name of ${esc(l)}"><small class="muted">${n(k)} account${n(k) === 1 ? '' : 's'}${custom[k] ? (custom[k].liab ? ' · liability' : ' · asset') : ''}</small>${custom[k] ? `<button type="button" class="btn sm ghost" data-act="atype-del" data-k="${esc(k)}">Delete</button>` : ''}</div>`).join('')}
      <div class="field"><span>New account type</span><div class="atyperow"><input id="atype-new" placeholder="e.g. Savings pot" data-noclear="1" aria-label="New account type name"><select id="atype-kind" aria-label="Asset or liability"><option value="asset">Asset (I have)</option><option value="liab">Liability (I owe)</option></select><button type="button" class="btn sm" data-act="atype-add">Add</button></div></div></section>`; })()}
    ${arrangeSection(db)}
    <section><h2>Appearance</h2>
      <label class="check"><input type="checkbox" data-act="commas" ${localStorage.getItem('sukli.commas') === '0' ? '' : 'checked'}> Show thousands separators when typing (119,000)</label>
      <p class="hint">These are kept on this device only.</p>
      <div class="field"><span>Theme</span>${segBtns('look', 'theme', [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']], lk.theme)}</div>
      <div class="field"><span>Colour</span><div class="swatches" role="group" aria-label="Accent colour">${Object.entries(ACCENTS).map(([k, v]) => `<button type="button" class="swatch ${lk.accent === k ? 'on' : ''}" data-act="look" data-k="accent" data-v="${k}" style="background:${v.l[0]}" aria-label="${v.n}" aria-pressed="${lk.accent === k}"></button>`).join('')}</div></div>
      <div class="field"><span>“Spent each day” chart on Home</span><div class="seg two small" role="group" aria-label="Chart direction">${[['v', 'Vertical bars'], ['h', 'Horizontal bars']].map(([v, l]) => `<button type="button" data-act="week-mode" data-v="${v}" class="${weekMode() === v ? 'on' : ''}" aria-pressed="${weekMode() === v}">${l}</button>`).join('')}</div></div>
      <div class="field"><span>Tap feedback</span>${(() => { const c = feedbackCfg(); return `<label class="check"><input type="checkbox" data-fb="haptic" ${c.haptic ? 'checked' : ''}> Vibrate a little when I tap</label><label class="check"><input type="checkbox" data-fb="visual" ${c.visual ? 'checked' : ''}> Flash the button I tapped</label><label class="check"><input type="checkbox" data-fb="sound" ${c.sound ? 'checked' : ''}> Soft click sound</label>`; })()}
        <small class="hint">Some iPhones and browsers cannot vibrate, so the flash (and the click, if you turn it on) tells you the tap worked.</small></div>
      <div class="field"><span>Text size</span>${segBtns('look', 'size', SIZES.map((x) => [x[0], x[1]]), lk.size)}
        <small class="hint">Smaller text leaves more room above the on-screen keyboard.</small></div>
      <div class="field"><span>When amounts are hidden (the eye button)</span>${segBtns('hidestyle', 'style', [['dot', 'Dots  ₱•••••'], ['blur', 'Blur']], priv.style)}</div>
      <div class="field"><span>Card payment reminders</span>${segBtns('remind', 'days', [[3, '3 days'], [5, '5 days'], [7, '7 days'], [10, '10 days']], db.settings.remindDays || 5)}
        <small class="hint">How early the banner on Home appears before a credit card is due. A web page cannot send alerts when it is closed, so for phone alerts use “Add reminders to my calendar” on the card’s account page.</small></div>
      <p class="hint">Fuller style customisation (fonts, density, layout) is planned for later.</p></section>
    <section><h2>Currency</h2>
      <div class="field"><span>Home currency (totals are shown in this)</span><button type="button" class="btn ghost wide curbtn" data-act="home-cur">${HOME} · ${esc(curName(HOME))}</button></div>
      <p class="hint">Changing it only changes how totals are shown. Your accounts and entries stay in their own currencies, and each entry keeps the rate it had.</p></section>
    <section><h2>Display</h2>
      <label class="check"><input type="checkbox" id="showhome" ${s.showHome === false ? '' : 'checked'}> Show the ${HOME} equivalent next to other currencies</label>
      <p class="hint">For example a ¥1,200 lunch shows a small “≈ ₱…” under it. The eye button at the top hides every amount on screen, handy in public. It is remembered on this device only.</p></section>
    ${REMOVED_UI ? `<section><h2>Cloud sync</h2>
      <p class="hint">Keeps your phone and your Mac in step through your own free Supabase project. Only you can read your rows. <a href="#" data-act="cloud-setup" class="linkbtn">Set up Supabase (5 minutes)</a></p>
      ${configured() ? '<p class="hint">Project connected (from config.js).</p>' : `<label class="field"><span>Project URL</span><input id="c-url" value="${esc(cl.url || '')}" placeholder="https://abcdxyz.supabase.co" autocomplete="off" spellcheck="false" inputmode="url"></label>
      <label class="field"><span>Public (anon) key</span><input id="c-key" value="${esc(cl.key || '')}" placeholder="eyJ…" autocomplete="off" spellcheck="false"></label>`}
      ${me ? `<p>Signed in as <b>${esc(me.email || '')}</b></p>
        <label class="check"><input type="checkbox" id="c-auto" ${cl.auto === false ? '' : 'checked'}> Sync automatically</label>
        <div class="btnrow left"><button class="btn" data-act="cloud-sync">Sync now</button><button class="btn ghost" data-act="cloud-signout">Sign out</button></div>`
      : `<button class="btn google wide" data-act="cloud-google">Continue with Google</button>
        <p class="hint">Needs Google sign-in switched on in your Supabase project once. <a href="#" data-act="google-setup" class="linkbtn">How</a>. Or use email below.</p>
        <label class="field"><span>Email</span><input id="c-email" type="email" value="${esc(cl.email || '')}" autocomplete="username"></label>
        <label class="field"><span>Password</span><input id="c-pass" type="password" autocomplete="current-password"></label>
        <div class="btnrow left"><button class="btn" data-act="cloud-signin">Sign in</button><button class="btn ghost" data-act="cloud-signup">Create account</button></div>`}
      <p class="status" id="cloudstatus" role="status">${esc(cloudStatus.text || (me && lastOk() ? 'Last synced ' + new Date(lastOk()).toLocaleString() : ''))}</p></section>
` : ''}
    ${backupSection(db)}
    ${REMOVED_UI ? `<section><h2>Google backup (optional)</h2>
      <p class="hint">Backs up to a private, hidden folder in your own Google Drive and keeps both your phones in step. Nothing else in your Drive is touched. <a href="#" data-act="gsetup" class="linkbtn">How to get a client ID</a></p>
      <label class="field"><span>Google client ID</span><input id="clientid" value="${esc(s.driveClientId)}" placeholder="1234-abc.apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>
      <label class="check"><input type="checkbox" id="autosync" ${s.autoSync ? 'checked' : ''}> Back up automatically after changes</label>
      <div class="btnrow left"><button class="btn" data-act="sync">Back up now</button></div>
      <p class="status" id="syncstatus" role="status">${esc(syncStatus.text || (s.lastSync ? 'Last backup ' + new Date(s.lastSync).toLocaleString() : 'Not backed up yet.'))}</p></section>` : ''}
    <section><h2>Your data</h2>
      <div class="btnstack">
        <label class="btn ghost filebtn">Import Bluecoins CSV<input type="file" id="file-bc" accept=".csv,text/csv" hidden></label>
        <button class="btn ghost" data-act="export-csv">Export CSV</button>
        <button class="btn ghost" data-act="export-json">Download full backup (JSON)</button>
        <label class="btn ghost filebtn">Restore from backup (JSON)<input type="file" id="file-json" accept=".json,application/json" hidden></label></div>
      <p class="hint">Importing the same file twice is safe: entries already here are skipped.</p></section>
    <section><h2>Left out of cash outflow</h2>
      <p class="hint">Groups ticked here don’t count as spending in totals and charts (for example trading losses).</p>
      <div class="checks">${groups.map((g) => `<label class="check"><input type="checkbox" data-act="exclude" data-g="${esc(g)}" ${s.excludeGroups.includes(g) ? 'checked' : ''}> ${esc(g)}</label>`).join('')}</div></section>
    <section><h2>Spending safety</h2>
      <p class="hint">While you add an expense, Sukli warns you when it gets close to your limit, spends more than comes in, loads up your credit cards, or leaves too little cash for upcoming card payments.</p>
      ${(() => { const c = safetyCfg(db); return `<label class="check"><input type="checkbox" id="ss-on" ${c.on ? 'checked' : ''}> Show warnings when I add an expense</label>
      <label class="field"><span>Compare spending and income over</span><select id="ss-mode"><option value="month" ${c.mode !== 'rolling' ? 'selected' : ''}>The calendar month</option><option value="rolling" ${c.mode === 'rolling' ? 'selected' : ''}>The last 30 days</option></select></label>
      <label class="field"><span>My spending limit for that period (${HOME}, 0 = none)</span><input id="ss-limit" inputmode="decimal" value="${c.limit || ''}" placeholder="0"></label>
      <label class="field"><span>Warn me at this % of the limit or budget</span><input id="ss-warn" inputmode="numeric" value="${c.warnPct}"></label>
      <label class="field"><span>Warn when card balances are more than this % of income</span><input id="ss-card" inputmode="numeric" value="${c.cardPct}"></label>
      <div class="field"><span>Essentials (kept as cash for upcoming card payments)</span><div class="chips">${groups.map((g) => `<label class="chip ${((c.essentials || []).includes(g)) ? 'on' : ''}"><input type="checkbox" data-ess="${esc(g)}" ${((c.essentials || []).includes(g)) ? 'checked' : ''} hidden>${esc(g)}</label>`).join('')}</div><small class="hint">Leave all unselected to let Sukli guess (food, transport, rent, utilities, health).</small></div>`; })()}
    </section>
    <section><h2>Exchange rates</h2>
      <label class="check"><input type="checkbox" id="liverates" ${s.liveRates === false ? '' : 'checked'}> Update rates automatically (free, about once a day)</label>
      <div class="btnrow left"><button class="btn ghost sm" data-act="rates-now">Update now</button></div>
      <p class="status" id="ratesstatus" role="status">${esc(ratesStatus.text || (s.live ? 'Last updated ' + new Date(s.live.ts).toLocaleString() : 'Not updated yet.'))}</p>
      <p class="hint">Rates are used for new entries and for today’s balances. An entry you saved keeps the rate it was saved with, so old reports do not change. Type a rate below to override the live one; tap ✕ to go back to live. ${esc(RATE_CREDIT)}.</p>
      ${curs.map((c) => `<div class="ratebox">${fxBlockHtml({ from: c, to: HOME, amount: 0, rate: homeFx(db, c), open: `data-act="rate-open" data-c="${c}"`, db })}</div>`).join('')}
      <p class="hint">Tap “Exchange Rate” to convert an amount, type your own rate, or get the latest one. Each entry also lets you set the ${HOME} value from your bill.</p></section>
    <section><h2>Put it on your phone</h2><p class="hint">iPhone: open this page in Safari, tap Share, then Add to Home Screen. Android: open the browser menu and choose Install app. It then works without a connection.</p></section>
    <section><h2>Erase</h2><button class="btn danger ghost" data-act="erase">Erase everything on this device</button>
      <p class="hint">Backups in your Google Drive are not touched.</p></section>`);
}
export function bindSettings() {
  for (const [id, k] of [['c-url', 'url'], ['c-key', 'key'], ['c-email', 'email']]) {
    const el = document.getElementById(id);
    if (el) el.onchange = () => commitQuiet((d) => { d.settings.cloud = { ...(d.settings.cloud || {}), [k]: el.value.trim() }; });
  }
  const ssSave = () => commit((d) => {
    const g = (id) => document.getElementById(id);
    d.settings.safety = { on: g('ss-on').checked, mode: g('ss-mode').value, limit: Math.max(0, parseFloat(g('ss-limit').value) || 0), warnPct: Math.min(100, Math.max(1, parseInt(g('ss-warn').value, 10) || 80)),
      cardPct: Math.max(1, parseInt(g('ss-card').value, 10) || 50), essentials: [...document.querySelectorAll('[data-ess]')].filter((x) => x.checked).map((x) => x.dataset.ess) };
  });
  for (const id of ['ss-on', 'ss-mode', 'ss-limit', 'ss-warn', 'ss-card']) { const e = document.getElementById(id); if (e) e.onchange = ssSave; }
  document.querySelectorAll('[data-ess]').forEach((e) => { e.onchange = ssSave; });
  const lr = document.getElementById('liverates');
  if (lr) lr.onchange = () => commit((d) => { d.settings.liveRates = lr.checked; });
  const sh = document.getElementById('showhome');
  if (sh) sh.onchange = () => commit((d) => { d.settings.showHome = sh.checked; });
  const ca = document.getElementById('c-auto');
  if (ca) ca.onchange = () => commit((d) => { d.settings.cloud = { ...(d.settings.cloud || {}), auto: ca.checked }; });
  const hp = document.getElementById('homeplace');
  const wp = document.getElementById('workplace');
  if (wp) wp.onchange = () => commitQuiet((d) => { d.settings.workPlace = wp.value.trim(); });
  if (hp) hp.onchange = () => commitQuiet((d) => { d.settings.homePlace = hp.value.trim(); });
  const cid = document.getElementById('clientid');
  if (cid) cid.onchange = () => commitQuiet((d) => { d.settings.driveClientId = cid.value.trim(); });
  const as = document.getElementById('autosync');
  if (as) as.onchange = () => commit((d) => { d.settings.autoSync = as.checked; });
  const bc = document.getElementById('file-bc');
  if (bc) bc.onchange = async () => {
    const file = bc.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const pv = previewImport(get(), text);
      const choice = await confirmImport(pv);
      if (!choice) { bc.value = ''; return; }
      let st;
      commit((d) => { st = importBluecoins(d, text, choice); });
      window.dispatchEvent(new Event('sukli-latest'));
      toast(`Imported ${st.added} entries, skipped ${st.skipped} already here. ${st.accounts} new accounts. Existing accounts were not changed.${st.openingFilled ? ` Filled ${st.openingFilled} empty opening balance${st.openingFilled > 1 ? 's' : ''}.` : ''}${st.noOpening ? ` ${st.noOpening} accounts have no opening balance in this file; set it in the account if their balance looks off.` : ''}`, { ms: 12000 });
      if (st.accounts) openAccountSetup();
    } catch (e) { toast(e.message, { ms: 9000 }); }
    bc.value = '';
  };
  const js = document.getElementById('file-json');
  if (js) js.onchange = async () => {
    const file = js.files[0]; if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      if (!obj || !obj.v || !Array.isArray(obj.txs)) throw new Error('That does not look like a backup from this app.');
      if (!(await confirmDialog('Replace everything on this device with the backup? Entries not in the backup will be lost.', 'Replace', true))) return;
      obj.settings = { ...emptyDb().settings, ...obj.settings, driveClientId: get().settings.driveClientId, cloud: get().settings.cloud };
      replaceAll(obj); toast('Backup restored.');
    } catch (e) { toast(e.message || 'Could not read that file.', { ms: 8000 }); }
    js.value = '';
  };
}
function readCloudFields() {
  const v = (id) => (document.getElementById(id) || { value: '' }).value.trim();
  commitQuiet((d) => { d.settings.cloud = { ...(d.settings.cloud || {}), url: v('c-url'), key: v('c-key'), email: v('c-email') }; });
  return { email: v('c-email'), pass: (document.getElementById('c-pass') || { value: '' }).value };
}
async function cloudAuth(fn) {
  const { email, pass } = readCloudFields();
  if (!email || !pass) { toast('Enter your email and a password (at least 6 characters).'); return; }
  try { await fn(email, pass); await cloudSync(); toast('Signed in and synced.'); } catch (e) { toast(e.message, { ms: 10000 }); }
  window.dispatchEvent(new Event('sukli-render'));
}
ACT['cloud-signin'] = () => cloudAuth(signIn);
ACT['cloud-signup'] = () => cloudAuth(signUp);
ACT['cloud-signout'] = () => { signOut(); window.dispatchEvent(new Event('sukli-render')); };
ACT['cloud-sync'] = async () => { try { await cloudSync(); toast('Synced.'); } catch (e) { toast(e.message, { ms: 10000 }); } };
ACT['cloud-setup'] = () => {
  const s2 = sheet(`<ol class="steps">
    <li>Go to <b>supabase.com</b>, sign up (free), and press <b>New project</b>. Pick a name, a database password (save it somewhere), and the region closest to you.</li>
    <li>When it finishes, open <b>SQL Editor</b>, paste the setup script below, and press <b>Run</b>.</li>
    <li>Open <b>Project Settings, API</b>. Copy the <b>Project URL</b> and the <b>anon public</b> key into the two boxes here.</li>
    <li>Optional: under <b>Authentication, Providers, Email</b>, turn off <b>Confirm email</b>, so you can sign in straight away.</li>
    <li>Enter your email and a password here and press <b>Create account</b>. Do the same sign-in on your phone.</li></ol>
    <pre class="sql" id="sqltext">${esc(SETUP_SQL)}</pre>
    <div class="btnrow left"><button class="btn" id="copysql">Copy the script</button></div>
    <p class="hint">The public key is safe to keep in the app: the database rule in the script is what keeps your rows private. Free projects pause after a week with no use, and you restore them with one click in the dashboard.</p>`, { title: 'Set up Supabase', wide: true });
  s2.el.querySelector('#copysql').onclick = async () => { try { await navigator.clipboard.writeText(SETUP_SQL); toast('Copied.'); } catch { toast('Select the script and copy it by hand.'); } };
};
ACT.sync = async () => {
  const cid = document.getElementById('clientid');
  if (cid && cid.value.trim() !== get().settings.driveClientId) commitQuiet((d) => { d.settings.driveClientId = cid.value.trim(); });
  try { await syncNow({ interactive: true }); toast('Backed up to Google Drive.'); } catch (e) { toast(e.message, { ms: 9000 }); }
};
ACT['export-csv'] = () => download(`sukli-${fileStamp()}.csv`, exportCSV(get()));
ACT['export-json'] = () => download(`sukli-backup-${fileStamp()}.json`, JSON.stringify({ ...get(), settings: { ...get().settings, driveClientId: '' } }), 'application/json');
ACT.exclude = (el) => commit((d) => {
  const set = new Set(d.settings.excludeGroups);
  el.checked ? set.add(el.dataset.g) : set.delete(el.dataset.g);
  d.settings.excludeGroups = [...set];
});
ACT.erase = async () => {
  if (!(await confirmDialog('Erase all entries, accounts and settings on this device? Download a backup first if you might want them back.', 'Erase everything', true))) return;
  const keep = get().settings.driveClientId, keepCloud = get().settings.cloud;
  const fresh = emptyDb(); fresh.settings.driveClientId = keep; fresh.settings.cloud = keepCloud;
  replaceAll(fresh); toast('Everything on this device was erased.');
};
ACT['cloud-google'] = async () => { try { readCloudFields(); await flush(); signInWithGoogle(); } catch (e) { toast(e.message, { ms: 8000 }); } };
ACT['google-setup'] = () => sheet(`<ol class="steps">
  <li>Open <b>console.cloud.google.com</b>, make (or reuse) a project, then <b>Google Auth Platform, Clients, Create client</b>. Type <b>Web application</b>.</li>
  <li><b>Authorised JavaScript origins</b>: your app address, for example <b>https://your-name.pages.dev</b> (no path at the end).</li>
  <li><b>Authorised redirect URIs</b>: the callback address Supabase shows on its Google page, like <b>https://abcdxyz.supabase.co/auth/v1/callback</b>.</li>
  <li>Copy the <b>Client ID</b> and <b>Client secret</b>. In Supabase open <b>Authentication, Sign In / Providers, Google</b>, turn it on and paste both.</li>
  <li>In Supabase open <b>Authentication, URL Configuration</b>. Set <b>Site URL</b> to your app address and add the same address under <b>Redirect URLs</b>.</li>
  <li>Back here press <b>Continue with Google</b>. Do the same on every device: no export or import.</li></ol>
  <p class="hint">Tip: put your Supabase URL and public key into <b>config.js</b> before you deploy, and no device needs anything pasted.</p>`, { title: 'Set up Google sign-in', wide: true });
ACT.gsetup = () => sheet(`<ol class="steps">
  <li>Open <b>console.cloud.google.com</b>, create a project (free, no card needed to my knowledge).</li>
  <li>Search “Google Drive API” and press <b>Enable</b>.</li>
  <li>Go to <b>APIs &amp; Services → OAuth consent screen</b>. Choose External, fill in an app name and your email, and under <b>Test users</b> add your own Google address.</li>
  <li>Go to <b>Credentials → Create credentials → OAuth client ID</b>, type <b>Web application</b>. Under <b>Authorised JavaScript origins</b> add the exact address where this app is hosted (for example <b>https://your-name.netlify.app</b>).</li>
  <li>Copy the client ID it shows and paste it here, then press <b>Back up now</b> and approve access.</li></ol>
  <p class="hint">The app asks only for its own hidden folder (drive.appdata). Google may ask you to sign in again from time to time; if auto-backup stops, tap Back up now.</p>`, { title: 'Get a Google client ID' });

ACT.commas = (el) => { try { localStorage.setItem('sukli.commas', el.checked ? '1' : '0'); } catch { /* ignore */ } };
document.addEventListener('change', (e) => { const c = e.target.dataset && e.target.dataset.curdec; if (c) { const n = +e.target.value; commit((d) => { d.settings.curDec = { ...(d.settings.curDec || {}), [c]: n }; }); CUR[c].dec = n; } });

ACT['atype-add'] = () => {
  const name = (document.getElementById('atype-new').value || '').trim(), liab = document.getElementById('atype-kind').value === 'liab';
  if (!name) { toast('Type a name for the new account type.'); return; }
  if (Object.values(typeNames).some((l) => l.toLowerCase() === name.toLowerCase())) { toast('That name is already used.'); return; }
  const key = 'c_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) + '_' + Math.random().toString(36).slice(2, 5);
  commit((d) => { d.settings.customTypes = { ...(d.settings.customTypes || {}), [key]: { label: name, liab } }; });
  toast(`Added “${name}”. You can pick it when you add or edit an account.`, { ms: 5000 });
};
ACT['atype-del'] = async (el) => {
  const k = el.dataset.k, used = get().accounts.filter((a) => !a.deleted && a.type === k).length;
  if (used) { toast(`${used} account${used === 1 ? ' uses' : 's use'} this type. Change them to another type first.`, { ms: 5000 }); return; }
  if (!(await confirmDialog('Delete this account type?', 'Delete', true))) return;
  commit((d) => { const c = { ...(d.settings.customTypes || {}) }; delete c[k]; d.settings.customTypes = c; const l = { ...(d.settings.typeLabels || {}) }; delete l[k]; d.settings.typeLabels = l; });
};
document.addEventListener('change', (e) => {
  const k = e.target.dataset && e.target.dataset.atypeLabel; if (!k) return;
  const v = e.target.value.trim(); if (!v) { e.target.value = typeNames[k]; return; }
  commit((d) => { d.settings.typeLabels = { ...(d.settings.typeLabels || {}), [k]: v }; });
});

ACT['nm-forget'] = (el) => { commit((d) => forget(d, el.dataset.kind, el.dataset.v)); };
ACT['nm-review'] = () => {
  const db = get(), pairs = similarPairs(db);
  sheet(`<p class="hint">Names that start the same way. For each pair choose Same, Related or Different.</p>${pairs.length ? pairs.map((x) => compareCard(db, x.a, x.b)).join('') : '<p class="empty">Nothing to review. All similar names are decided.</p>'}`, { title: 'Review similar names' });
};

// ---- name map: the similarity graph, drawn ----
function mapSvg(g, key) {
  const nb = neighbourhood(g, key), W = 340, H = 300, cx = W / 2, cy = H / 2, r = 108, pos = new Map();
  nb.keys.forEach((k, i) => { if (i === 0) pos.set(k, [cx, cy]); else { const a = ((i - 1) / Math.max(1, nb.keys.length - 1)) * Math.PI * 2 - Math.PI / 2; pos.set(k, [cx + r * Math.cos(a), cy + r * Math.sin(a)]); } });
  const col = { you: 'var(--ok, #2a8a4a)', chain: 'var(--accent, #3a6ee8)', text: 'var(--muted, #888)', related: 'var(--warn, #c9871a)', reverse: 'var(--warn, #c9871a)' };
  const lines = nb.edges.map((e) => { const [x1, y1] = pos.get(e.a), [x2, y2] = pos.get(e.b); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col[e.type]}" stroke-width="${(1 + e.w * 4).toFixed(1)}" ${e.type === 'related' || e.type === 'reverse' ? 'stroke-dasharray="5 4"' : ''} stroke-opacity="${(0.35 + e.w * 0.6).toFixed(2)}"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}" class="mapw">${Math.round(e.w * 100)}</text>`; }).join('');
  const dots = nb.keys.map((k) => { const [x, y] = pos.get(k), n = g.nodes.get(k), lab = n.name.length > 16 ? n.name.slice(0, 15) + '…' : n.name; return `<g><circle cx="${x}" cy="${y}" r="${k === key ? 9 : 6 + Math.min(4, n.n / 5)}" class="${k === key ? 'mapc on' : 'mapc'}"/><text x="${x}" y="${y + 22}" class="mapt">${esc(lab)}</text></g>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="namemap" role="img" aria-label="Names connected to ${esc(g.nodes.get(key).name)}">${lines}${dots}</svg>
    <p class="legend"><i class="k you"></i>you said same <i class="k chain"></i>same chain <i class="k text"></i>similar spelling <i class="k rel"></i>related (dashed) · numbers are the link strength (%)</p>`;
}
let mapApi = null;
function mapSheet(key, q = '') {
  const g = buildGraph(get()), cl = clusters(g, 0.6);
  const hit = q ? matches(g, q, 4) : [];
  const start = key && g.nodes.has(key) ? key : (cl[0] ? cl[0][0] : [...g.nodes.keys()][0]);
  if (!start) { sheet('<p class="empty">No names yet.</p>', { title: 'Name map' }); return; }
  const put = (html) => { if (mapApi && document.body.contains(mapApi.root)) mapApi.el.innerHTML = html; else mapApi = sheet(html, { title: 'Name map', onClose: () => { mapApi = null; } }); };
  const nodeRows = (g.adj.get(start) || []).sort((a, b) => b.w - a.w).map((x) => `<button type="button" class="chip" data-act="nm-focus" data-k="${esc(x.to)}">${esc(g.nodes.get(x.to).name)} <small>${edgeText(x)}</small></button>`).join('');
  put(`<div class="field"><span>Try a name</span><input id="nmq" type="text" value="${esc(q)}" placeholder="e.g. Mang Inasal Antipolo" autocomplete="off"></div>
    ${q ? `<div class="nmcard"><span>${hit.length ? hit.map((m) => `<b>${esc(m.name)}</b> ${Math.round(m.score * 100)}%${m.cat ? ` · ${esc(m.cat)}` : ''}<br><small class="muted">${esc(explain(m))}</small>`).join('<br>') : 'Nothing close enough in your history (needs a path of at least 60%).'}</span></div>` : ''}
    ${mapSvg(g, start)}
    <p class="hint"><b>${esc(g.nodes.get(start).name)}</b>: ${g.nodes.get(start).n} entries${g.nodes.get(start).cat ? ` · usually ${esc(g.nodes.get(start).cat)}` : ''}. Tap a neighbour to move the map.</p>
    <div class="chips">${nodeRows || '<small class="muted">No links yet.</small>'}</div>
    <h3>Groups</h3>${cl.slice(0, 10).map((c) => `<button type="button" class="chip" data-act="nm-focus" data-k="${esc(c[0])}">${c.slice(0, 4).map((k) => esc(g.nodes.get(k).name)).join(' · ')}${c.length > 4 ? ` +${c.length - 4}` : ''}</button>`).join('') || '<p class="empty">No groups yet.</p>'}`);
  const inp = document.getElementById('nmq');
  if (inp) inp.addEventListener('change', () => mapSheet(start, inp.value.trim()));
}
ACT['nm-map'] = () => mapSheet();
ACT['nm-focus'] = (el) => mapSheet(el.dataset.k);

// Settings, grouped by what they are for. Advanced items sit in their own folded group.
const SET_GROUPS = [
  ['look', 'Look and Feel', 'Tabs, Home cards, colours, text size', ['Tabs and Home cards', 'Appearance', 'Display']],
  ['money', 'Money and Alerts', 'Home currency, spending warnings', ['Currency', 'Spending safety', 'Left out of cash outflow']],
  ['organise', 'Accounts and Names', 'How things are sorted and matched', ['Categories', 'Account types', 'Name matching']],
  ['data', 'Backup and Data', 'Reminders, backups, export', ['Backup reminder', 'Your data', 'Google backup (optional)']],
  ['adv', 'Advanced', 'Most people never need these', ['Exchange rates', 'Live exchange rates', 'Coins and tokens: decimals', 'Cloud sync', 'Erase']],
  ['help', 'Help', 'Install on your phone', ['Put it on your phone']],
];
const SET_OPEN = new Set(['look']);
document.addEventListener('toggle', (e) => { const g = e.target.dataset && e.target.dataset.sgroup; if (g) { if (e.target.open) SET_OPEN.add(g); else SET_OPEN.delete(g); } }, true);
const titleCase = (t) => t.split(' ').map((w, i) => (i && ['and', 'or', 'of', 'the', 'to', 'on', 'in'].includes(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
function settingsGrouped(html) {
  const i = html.indexOf('<section'); if (i < 0) return html;
  const head = html.slice(0, i), secs = [...html.slice(i).matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
  const title = (x) => ((x.match(/<h2>([^<]*)<\/h2>/) || [])[1] || '').trim();
  const by = new Map(SET_GROUPS.map((g) => [g[0], []]));
  for (const sec of secs) { const t = title(sec), g = SET_GROUPS.find((x) => x[3].includes(t)) || SET_GROUPS.find((x) => x[0] === 'adv'); by.get(g[0]).push(sec.replace(/<h2>([^<]*)<\/h2>/, (m, h) => '<h2>' + titleCase(h) + '</h2>')); }
  const ver = `<p class="hint verline" id="appver">Sukli version ${versionText()}</p>`;
  return head + SET_GROUPS.filter((g) => by.get(g[0]).length).map(([k, name, desc]) => `<details class="sgroup" data-sgroup="${k}" ${SET_OPEN.has(k) ? 'open' : ''}><summary><b>${name}</b><small>${desc}</small></summary>${by.get(k).join('')}</details>`).join('') + ver;
}

// ---------------- Arrange tabs and Home cards (Settings) ----------------
export const TAB_DEFS = { home: ['Home', 'home'], ledger: ['Entries', 'list'], calendar: ['Calendar', 'calendar'], accounts: ['Accounts', 'wallet'], budget: ['Budget', 'pie'], cashflow: ['Cash flow', 'flow'], outlook: ['Outlook', 'spark'], analytics: ['Analytics', 'chart'], invest: ['Invest', 'spark'] };
export const DEFAULT_TABS = ['home', 'ledger', 'calendar', 'accounts'];
export function tabIds(db) {
  const t = ((db.settings && db.settings.tabs) || []).filter((x, i, a) => TAB_DEFS[x] && a.indexOf(x) === i).slice(0, 4);
  return t.length ? t : DEFAULT_TABS;
}
function arrangeSection(db) {
  const tb = tabIds(db), more = Object.keys(TAB_DEFS).filter((x) => !tb.includes(x)), lay = homeLayout(db);
  const mv = (kind, id, i, n) => `<span class="mv"><button type="button" class="btn sm ghost" data-act="arr-up" data-kind="${kind}" data-id="${id}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn sm ghost" data-act="arr-down" data-kind="${kind}" data-id="${id}" aria-label="Move down" ${i === n - 1 ? 'disabled' : ''}>↓</button></span>`;
  return `<section id="arrange"><h2>Tabs and Home cards</h2>
    <p class="hint">The bottom bar holds up to 4 tabs, with the + button always in the middle. Anything not in the bar is still reachable from Home and the menus.</p>
    <h3>Bottom tabs (${tb.length}/4)</h3>
    ${tb.map((id, i) => `<div class="arow"><span>${ic(TAB_DEFS[id][1])} ${TAB_DEFS[id][0]}</span>${mv('tab', id, i, tb.length)}<button type="button" class="btn sm ghost" data-act="arr-tab-off" data-id="${id}" ${tb.length <= 2 ? 'disabled' : ''}>Remove</button></div>`).join('')}
    ${more.length ? `<p class="hint">Add to the bar${tb.length >= 4 ? ' (remove one first)' : ''}:</p><div class="btnrow left">${more.map((id) => `<button type="button" class="btn sm ghost" data-act="arr-tab-on" data-id="${id}" ${tb.length >= 4 ? 'disabled' : ''}>+ ${TAB_DEFS[id][0]}</button>`).join('')}</div>` : ''}
    <h3>Home cards, top to bottom</h3>
    ${lay.order.map((id, i) => { const nm = (HOME_SECTIONS.find((x) => x[0] === id) || [])[1], off = lay.hidden.includes(id);
      return `<div class="arow ${off ? 'off' : ''}"><label class="check"><input type="checkbox" data-act="arr-show" data-id="${id}" ${off ? '' : 'checked'}> ${esc(nm)}</label>${mv('home', id, i, lay.order.length)}</div>`; }).join('')}
    <button type="button" class="btn ghost wide" data-act="arr-reset">Put tabs and cards back to normal</button></section>`;
}
const moveIn = (arr, id, dir) => { const i = arr.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= arr.length) return arr; const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; };
ACT['arr-up'] = (el) => arrMove(el, -1);
ACT['arr-down'] = (el) => arrMove(el, 1);
function arrMove(el, dir) {
  const db = get(), id = el.dataset.id;
  commit((d) => { d.settings = d.settings || {};
    if (el.dataset.kind === 'tab') d.settings.tabs = moveIn(tabIds(d), id, dir);
    else d.settings.homeLayout = { ...homeLayout(d), order: moveIn(homeLayout(d).order, id, dir) }; });
}
ACT['arr-tab-off'] = (el) => commit((d) => { d.settings.tabs = tabIds(d).filter((x) => x !== el.dataset.id); });
ACT['arr-tab-on'] = (el) => commit((d) => { const t = tabIds(d); if (t.length < 4) d.settings.tabs = [...t, el.dataset.id]; });
ACT['arr-show'] = (el) => commit((d) => { const L = homeLayout(d), id = el.dataset.id; d.settings.homeLayout = { order: L.order, hidden: el.checked ? L.hidden.filter((x) => x !== id) : [...L.hidden, id] }; });
ACT['arr-reset'] = () => commit((d) => { delete d.settings.tabs; delete d.settings.homeLayout; });

// ---------------- Spending against the income you expect this month ----------------
// expected income = what you set yourself, else the middle value of the last 3 months that had income; never less than what already came in
export function projIncome(db, ym) {
  const got = totals(db, ym, 'income').total, own = +((db.settings || {}).projIncome) || 0;
  if (own > 0) return { v: Math.max(own, got), got, own: true };
  const prev = [1, 2, 3, 4, 5, 6].map((i) => totals(db, shiftMonth(ym, -i), 'income').total).filter((x) => x > 0).slice(0, 3).sort((a, b) => a - b);
  const typ = prev.length ? prev[Math.floor(prev.length / 2)] : 0;
  return { v: Math.max(typ, got), got, own: false, typ };
}
function projPie(db) {
  const ym = ui.month, out = totals(db, ym), pi = projIncome(db, ym), inc = pi.v, spent = out.total;
  if (!(inc > 0)) return coll('h-proj', 'Spending vs expected income', `<p class="empty">No income found yet to compare with.</p><button type="button" class="btn ghost" data-act="proj-set">Set my expected monthly income</button>`);
  const all = [...out.by.entries()].sort((a, b) => b[1] - a[1]), top = all.slice(0, 6), rest = all.slice(6).reduce((a, [, v]) => a + v, 0);
  const slices = top.map(([g, v]) => ({ g, v })); if (rest > 0) slices.push({ g: 'Everything else', v: rest, other: true });
  const left = inc - spent, over = left < 0, den = Math.max(inc, spent), C = 2 * Math.PI * 52; let acc = 0;
  const arcs = slices.map((x) => { const len = (x.v / den) * C, d = Math.max(0, len - 1.2);
    const el = `<circle class="slice" ${x.other ? '' : `data-act="grp" data-g="${esc(x.g)}" data-k="expense"`} data-tip="${esc(`${x.g}: ${money(x.v)} (${Math.round((x.v / inc) * 100)}% of expected income)`)}" cx="70" cy="70" r="52" fill="none" stroke="${groupColor(x.other ? 'Others' : x.g)}" stroke-width="26" stroke-dasharray="${d.toFixed(2)} ${(C - d).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 70 70)"></circle>`; acc += len; return el; }).join('');
  const labels = pieLabels(slices.map((x) => x.v / den));
  const track = over ? '' : `<circle cx="70" cy="70" r="52" fill="none" stroke="var(--rule)" stroke-width="26" stroke-dasharray="${Math.max(0, (left / den) * C - 1.2).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 70 70)"></circle>`;
  const pct = Math.round((spent / inc) * 100);
  return coll('h-proj', 'Spending vs expected income', `<div class="wentpie"><svg class="donut sm" viewBox="-30 -12 200 164" role="img" aria-label="${pct}% of expected income spent">${track}${arcs}${labels}<text x="70" y="68" text-anchor="middle" class="dv">${pct}%</text><text x="70" y="85" text-anchor="middle" class="dl">${over ? 'over income' : 'spent'}</text></svg>
    <ul class="pielegend"><li><div class="pj"><span>Expected income</span><b>${money(inc)}</b></div></li><li><div class="pj"><span>Came in so far</span><b>${money(pi.got)}</b></div></li><li><div class="pj"><span>Spent</span><b>${money(spent)}</b></div></li><li><div class="pj ${over ? 'bad' : ''}"><span>${over ? 'Over by' : 'Left'}</span><b>${money(Math.abs(left))}</b></div></li></ul></div>
    <p class="hint">${pi.own ? 'Using the income you set.' : pi.typ ? `Expected income is your usual month (middle of your last ${Math.min(3, [1, 2, 3, 4, 5, 6].filter((i) => totals(db, shiftMonth(ym, -i), 'income').total > 0).length)} months with income)${pi.got > pi.typ ? ', raised to what already came in' : ''}.` : 'No earlier months to go on, so this is what came in so far.'} Tap a slice for what is in it. <button type="button" class="linkbtn" data-act="proj-set">Set my own</button></p>`);
}
ACT['proj-set'] = async () => {
  const cur = (get().settings || {}).projIncome || '';
  const v = await promptDialog('Expected income per month (leave empty to use your usual)', String(cur));
  if (v == null) return; const n = parseFloat(String(v).replace(/,/g, ''));
  commit((d) => { if (n > 0) d.settings.projIncome = n; else delete d.settings.projIncome; });
};

// Shows what an import will add. Existing accounts keep their type; only new ones are listed so each can be checked first.
export function confirmImport(pv) {
  return new Promise((res) => {
    if (!pv.fresh.length) return res({});
    const tn = typeNames;
    const opt = (v) => Object.entries(tn).map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('');
    const rows = pv.fresh.map((f, i) => `<div class="card" style="margin:8px 0"><b>${esc(f.name)}</b> <small class="muted">${esc(f.cur)}</small>
      ${f.like.length ? `<p class="warn" style="margin:6px 0">⚠ Looks like your existing account <b>${esc(f.like[0].name)}</b> (${esc(tn[f.like[0].type] || f.like[0].type)}). Use that one so it stays as it is?</p>
        <label class="row"><input type="radio" name="m${i}" value="use" checked> Use existing "${esc(f.like[0].name)}" (type not changed)</label>
        <label class="row"><input type="radio" name="m${i}" value="new"> Create a new account</label>` : ''}
      <label>Type <select data-t="${i}">${opt(f.type)}</select></label></div>`).join('');
    const sh = sheet(`<p>${pv.fresh.length} new account${pv.fresh.length > 1 ? 's' : ''} would be added. Your ${pv.existing} existing accounts are not changed or re-classified.</p>${rows}
      <div class="btnrow"><button class="btn" data-go>Import</button><button class="btn ghost" data-no>Cancel</button></div>`, { title: 'Check before importing', onClose: () => res(null) });
    sh.el.querySelector('[data-no]').onclick = () => { sh.close(); };
    sh.el.querySelector('[data-go]').onclick = () => {
      const types = {}, into = {};
      pv.fresh.forEach((f, i) => {
        types[f.key] = sh.el.querySelector(`[data-t="${i}"]`).value;
        const r = sh.el.querySelector(`input[name=m${i}]:checked`);
        if (f.like.length && r && r.value === 'use') into[f.key] = f.like[0].name + '|' + f.cur;
      });
      sh.silent = true; sh.dispose(); res({ types, into });
    };
  });
}
