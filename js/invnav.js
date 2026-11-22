// Investments: the four sections (Overview, the chosen platform, Calendar, Accounts), their bottom bar, the two-level Accounts list,
// the investment-only calendar and the per-platform transaction list.
import { ACT, sheet, esc, ic } from './ui.js';
import { button } from './components.js';
import { inInvest } from './invest.js';
import { get, factorFor, thisMonth, shiftMonth, daysInMonth, compact, accountMap, catMap, dayLabel, fmt, HOME } from './core.js';
import { row } from './screens.js';

const rd = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } };
export const SECTIONS = ['overview', 'platform', 'calendar', 'accounts'];
export const INV = { sec: SECTIONS.includes(rd('sukli-invsec', '')) ? rd('sukli-invsec', '') : 'overview', plat: rd('sukli-invplat', ''), cat: rd('sukli-invcat', ''), month: '', rg: 'All' };
const rerender = () => window.dispatchEvent(new Event('sukli-render'));
export const setSec = (s) => { INV.sec = s; wr('sukli-invsec', s); };
export const selectPlatform = (name) => { INV.plat = name; wr('sukli-invplat', name); setSec('platform'); };
// Every move inside Investments (section, category, platform) is a step in the browser history, so the back arrow and a right swipe go to the screen you were just on,
// not out to Accounts. Each history entry remembers {sec, plat, cat}.
const snap = () => ({ sec: INV.sec, plat: INV.plat, cat: INV.cat });
const apply = (v) => { INV.sec = v.sec; INV.plat = v.plat; INV.cat = v.cat; wr('sukli-invsec', v.sec); wr('sukli-invplat', v.plat); wr('sukli-invcat', v.cat); };
const same = (a, b) => a.sec === b.sec && a.plat === b.plat && a.cat === b.cat;
function go(change) {
  const before = snap();
  try { if (!(history.state && history.state.inv)) history.replaceState({ ...(history.state || {}), inv: before }, ''); } catch { /* ignore */ }
  change();
  const after = snap();
  if (!same(before, after)) { try { history.pushState({ inv: after }, ''); } catch { /* ignore */ } }
  INV.fresh = true; window.scrollTo(0, 0); rerender();
}
window.addEventListener('popstate', (e) => { const v = e.state && e.state.inv; if (v && /^#\/invest/.test(location.hash)) { apply(v); rerender(); } });
ACT['inv-sec'] = (el) => go(() => { setSec(el.dataset.v); if (el.dataset.v === 'accounts') { INV.cat = ''; wr('sukli-invcat', ''); } });
ACT['inv-cat'] = (el) => go(() => { INV.cat = el.dataset.v || ''; wr('sukli-invcat', INV.cat); });
ACT['inv-plat'] = (el) => {
  // from Accounts (another page) open the platform in Investments; inside Investments just switch
  if (!/^#\/invest/.test(location.hash)) { INV.keep = true; selectPlatform(el.dataset.ex); location.hash = '#/invest'; return; }
  go(() => selectPlatform(el.dataset.ex));
};
ACT['inv-month'] = (el) => { INV.month = shiftMonth(INV.month || thisMonth(), +el.dataset.d); rerender(); };
ACT['inv-range'] = (el) => { INV.rg = el.dataset.v; rerender(); };

// the bottom bar of the Investments page: two sections, the + button, two sections
export function invTabs(plat) {
  const item = (id, label, icon) => `<a href="#/invest" class="${INV.sec === id ? 'on' : ''}" data-act="inv-sec" data-v="${id}" ${INV.sec === id ? 'aria-current="page"' : ''}>${ic(icon)}<span class="invlab">${esc(label)}</span></a>`;
  return [item('overview', 'Overview', 'pie'), item('platform', plat || 'Platform', 'spark'), null, item('calendar', 'Calendar', 'calendar'), item('accounts', 'Accounts', 'wallet')];
}

export const CATS = [['crypto', 'Crypto', 'Exchanges and wallets'], ['stock', 'Stock Market', 'Stocks, ETFs and funds'], ['gov', 'Government Bonds', 'MP2, bonds and government savings'], ['other', 'Other Investments', 'Anything else you invest in']];

// level 1: four category cards (same card design as Home)
export function categoryCards(cats) {
  return `<div class="invcats">${cats.map((c) => button({ html: `<span class="ic-t">${esc(c.title)}</span><b class="ic-v">${esc(c.total)}</b><small class="ic-s">${c.count ? `${c.count} ${esc(c.count === 1 ? c.one : c.many)}` : 'Nothing here yet'}</small>${ic('right', 'chev')}`, kind: 'plain', cls: `invcat ui-card ${c.count ? '' : 'empty'}`, act: 'inv-cat', attr: { 'data-v': c.id }, aria: `${c.title}, ${c.total}` })).join('')}</div>`;
}
// level 2: what sits under one category (platform cards show only their total)
export function levelTwo(cat, items, back) {
  return `<div class="invl2"><div class="invback">${button({ html: `${ic('left')}<span>Investment Categories</span>`, kind: 'plain', cls: 'linkbtn invbackbtn', act: 'inv-cat', attr: { 'data-v': '' }, aria: 'Back to investment categories' })}</div><h2 class="invh">${esc(cat[1])}</h2>
    ${items.length ? `<div class="invcats l2">${items.join('')}</div>` : `<p class="empty invemp">Nothing here yet.</p>`}</div>`;
}
// level 2 cards: logo and name on the left, the total (and, when Investments uses another currency, the total in your home currency) on the right; everything centred on one line
const l2 = (left, total, conv, act, attr, aria) => button({ html: `<span class="pl-l">${left}</span><span class="pl-r"><b class="ic-v">${esc(total)}</b>${conv ? `<small class="ic-c">${esc(conv)}</small>` : ''}</span>${ic('right', 'chev')}`, kind: 'plain', cls: 'invcat invplat ui-card', act, attr, aria });
// meta = a short line under the name (for example "3 assets · 2 wallets"): the platform's facts sit in this one card
export const platformCard = (name, total, icon, conv = '', meta = '') => l2(`${icon}<span class="pl-n"><span class="ic-t">${esc(name)}</span>${meta ? `<small class="ic-m">${esc(meta)}</small>` : ''}</span>`, total, conv, 'inv-plat', { 'data-ex': name }, `${name}, ${total}${meta ? `, ${meta}` : ''}`);
export const productCard = (a, total, conv = '') => l2(`<span class="ic-t">${esc(a.name)}</span>`, total, conv, 'acct', { 'data-id': a.id }, `${a.name}, ${total}`);

// an investment transaction = one that touches an investment account. Regular income and spending never do.
export const isInvTx = (t, ids) => !t.deleted && (ids.has(t.acct) || ids.has(t.toAcct));
export function invTxs(db, ids) { return db.txs.filter((t) => isInvTx(t, ids)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); }

// transaction list for one platform (newest first, in steps)
export function txList(db, ids, key, step = 25) {
  const all = invTxs(db, ids), n = Math.max(step, +(rd('sukli-invtx-' + key, '') || step)), accts = accountMap(db), cats = catMap(db);
  if (!all.length) return '<p class="empty">No transactions on this platform yet.</p>';
  return `<div class="rows invtx">${all.slice(0, n).map((t) => row(t, accts, cats)).join('')}</div>${all.length > n ? `<div class="btnrow left">${button({ label: `Show more (${all.length - n} left)`, kind: 'ghost', size: 'sm', act: 'inv-more', attr: { 'data-k': key, 'data-n': n + step } })}</div>` : ''}`;
}
ACT['inv-more'] = (el) => { wr('sukli-invtx-' + el.dataset.k, el.dataset.n); rerender(); };

// investment-only calendar
export function invCalendar(db, ids, money) {
  const ym = INV.month || thisMonth(), [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1).getDay(), dim = daysInMonth(ym), isNow = ym === thisMonth();
  const days = new Map(); let n = 0, tIn = 0, tOut = 0, tTr = 0;
  for (const t of db.txs) {
    if (!isInvTx(t, ids) || !String(t.date).startsWith(ym)) continue;
    const d = +String(t.date).slice(8, 10), x = days.get(d) || { in: 0, out: 0, tr: 0, n: 0 }, v = t.amount * factorFor(db, t);
    x.n++; n++;
    if (t.kind === 'transfer') { x.tr += v; tTr += v; } else if (t.kind === 'income') { x.in += v; tIn += v; } else { x.out += v; tOut += v; }
    days.set(d, x);
  }
  let cells = '<i class="cal-b"></i>'.repeat(first);
  for (let d = 1; d <= dim; d++) {
    const x = days.get(d), date = `${ym}-${String(d).padStart(2, '0')}`;
    cells += button({ html: `<span class="n">${d}</span>${x && x.out ? `<i class="o">−${compact(x.out, '')}</i>` : ''}${x && x.in ? `<i class="g">+${compact(x.in, '')}</i>` : ''}${x && x.tr ? `<i class="b">⇄${compact(x.tr, '')}</i>` : ''}`, kind: 'plain', cls: `cal-d ${x && x.out ? 'o' : ''} ${x && x.in ? 'g' : ''} ${x && x.tr ? 'b' : ''}`, act: 'inv-day', attr: { 'data-d': date }, aria: `${dayLabel(date)}${x ? `, ${x.n} investment ${x.n === 1 ? 'entry' : 'entries'}` : ''}` });
  }
  const [yy, mm] = [y, m], label = new Date(yy, mm - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  return `<div class="invcal"><div class="invmonth">${button({ html: ic('left'), kind: 'plain', cls: 'iconbtn', act: 'inv-month', aria: 'Previous month', attr: { 'data-d': '-1' } })}<h2>${esc(label)}</h2>${button({ html: ic('right'), kind: 'plain', cls: 'iconbtn', act: 'inv-month', aria: 'Next month', attr: { 'data-d': '1' }, ...(isNow ? { disabled: true } : {}) })}</div>
    <section class="t1-card ui-card invsum"><div><span>Investment entries</span><b>${n}</b></div><div><span>Inflow</span><b class="in">${esc(money(tIn))}</b></div><div><span>Outflow</span><b>${esc(money(tOut))}</b></div><div><span>Transfer</span><b class="cb">${esc(money(tTr))}</b></div></section>
    <p class="legend cal-l"><i class="k o"></i>Outflow <i class="k g"></i>Inflow <i class="k b"></i>Transfer</p>
    <section class="calwrap"><div class="cal-h">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span>${d}</span>`).join('')}</div><div class="cal">${cells}</div></section>
    <p class="hint">Only entries that touch an investment account are shown here. Regular income and spending stay in the main Calendar. Tap a day to see its entries.</p></div>`;
}
ACT['inv-day'] = (el) => {
  const db = get(), date = el.dataset.d, ids = new Set(db.accounts.filter((a) => !a.deleted && inInvest(a)).map((a) => a.id)), accts = accountMap(db), cats = catMap(db);
  const list = db.txs.filter((t) => isInvTx(t, ids) && String(t.date).startsWith(date));
  sheet(list.length ? `<div class="rows">${list.map((t) => row(t, accts, cats)).join('')}</div>` : '<p class="empty">No investment entries on this day.</p>', { title: dayLabel(date) });
};
