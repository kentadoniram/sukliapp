// The extra windows: menu drawer, Calendar, Budget (donut), Cash flow, Categories, and the detail sheets.
import { softDelete } from './core.js';
import {
  get, commit, stamp, fmt, compact, BASE, HOME, monthParts, dayTotals, daysInMonth, shiftMonth, thisMonth, monthLabel, dayLabel, nowStamp,
  reviewCount, catMap, accountMap, groupColor, groupLetter, sortedTxs,
} from './core.js';
import { pace, totals, trend, baselineMonths } from './insights.js';
import { ui, hdr, monthNav, strip, money, row, gbar, coll, trendChart, budgetOf } from './screens.js';
import { openEntry, openCategoryForm } from './entry.js';
import { forecastNext, behaviorNotes, detectRecurring } from './finance.js';
import { reminderBanner } from './accpage.js';
import { ACT, sheet, ic, esc, confirmDialog, promptDialog, pushOverlay, toast } from './ui.js';

const sum = (a) => a.reduce((x, y) => x + y, 0);
const R = (n) => fmt(n, HOME, { round: true });
const render = () => window.dispatchEvent(new Event('sukli-render'));
const monthStat = (db, ym) => { const i = totals(db, ym, 'income').total, o = totals(db, ym).total; return { income: i, spent: o }; };

// =====================================================================
// Menu drawer (burger)
// =====================================================================
let drawerOpen = null;
ACT.menu = () => {
  if (drawerOpen) { drawerOpen(); return; }
  const n = reviewCount(get());
  const here = location.hash.replace(/^#\/?/, '') || 'home';
  const item = (h, label, icon, badge) => `<li><a href="#/${h}" class="${here === h || (h === 'home' && !location.hash) ? 'on' : ''}">${ic(icon)}<span>${label}</span>${badge ? `<em class="pill">${badge}</em>` : ''}</a></li>`;
  const wrap = document.createElement('div');
  wrap.className = 'drawer-scrim';
  wrap.innerHTML = `<nav class="drawer" aria-label="Menu"><div class="drawer-head"><b>Sukli</b><button type="button" class="iconbtn" data-x aria-label="Close menu">${ic('x')}</button></div>
    <ul>${item('home', 'Home', 'home')}${item('ledger', 'Entries', 'list')}${item('calendar', 'Calendar', 'calendar')}${item('budget', 'Budget', 'pie')}${item('cashflow', 'Cash flow', 'flow')}${item('outlook', 'Outlook', 'spark')}${item('analytics', 'Analytics', 'chart')}${item('accounts', 'Accounts', 'wallet')}${item('review', 'Review', 'check', n)}</ul>
    <h3>Categories</h3>
    <ul>${item('categories?k=expense', 'Expense categories', 'tag')}${item('categories?k=income', 'Income categories', 'tag')}</ul>
    <ul>${'<li><a href="#" data-act="scan">'}${ic('camera')}<span>Scan a receipt</span></a></li><li><a href="#" data-act="loan-plan">${ic('calc')}<span>Loan planner</span></a></li></ul>
    <ul class="last">${item('bin', 'Recycle bin', 'trash')}${item('settings', 'Settings', 'gear')}</ul></nav>`;
  document.body.appendChild(wrap);
  document.body.classList.add('noscroll');
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const ov = pushOverlay(() => { wrap.remove(); document.body.classList.remove('noscroll'); document.removeEventListener('keydown', onKey); drawerOpen = null; });
  const close = () => ov.close();
  drawerOpen = close;
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-x]') || e.target.closest('a, [data-act]')) close(); });
  const first = wrap.querySelector('a'); if (first && matchMedia('(pointer:fine)').matches) first.focus();
};

// =====================================================================
// Detail sheets: cash inflow / outflow / net income, and one month
// =====================================================================
ACT.flow = (el) => openFlowDetail(el.dataset.k, ui.month, false);
ACT.mon = (el) => openFlowDetail('net', el.dataset.m, true);

function groupRows(db, ym, kind, limit = 12) {
  const t = totals(db, ym, kind);
  const rows = [...t.by.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = rows.length ? rows[0][1] : 1;
  return rows.length ? rows.map(([g, v]) => gbar(db, g, v, max, kind, t.total).replace(/data-act="grp"/g, `data-act="grp" data-m="${ym}"`)).join('') : '<p class="empty">Nothing here.</p>';
}

function openFlowDetail(kind, ym, withGo) {
  const db = get();
  const title = { inflow: 'Cash inflow', outflow: 'Cash outflow', net: 'Net income' }[kind];
  const s = sheet('<div id="fd"></div>', { title: `${title} · ${monthLabel(ym)}`, wide: true });
  const root = s.el.querySelector('#fd');
  const cur = monthStat(db, ym), prev = monthStat(db, shiftMonth(ym, -1));
  const net = cur.income - cur.spent, prevNet = prev.income - prev.spent;
  const delta = (a, b, goodUp) => (b !== 0 ? `<small class="${(a >= b) === goodUp ? 'in' : 'neg'}">${a >= b ? '+' : '−'}${Math.round(Math.abs(a - b) / Math.abs(b) * 100)}%</small>` : '');
  if (kind === 'inflow' || kind === 'outflow') {
    const isIn = kind === 'inflow', v = isIn ? cur.income : cur.spent, pv = isIn ? prev.income : prev.spent;
    const bm = baselineMonths(db, ym, 3);
    const usual = bm.length ? sum(bm.map((m) => totals(db, m, isIn ? 'income' : 'expense').total)) / bm.length : 0;
    root.innerHTML = `<div class="gdhead"><b class="big ${isIn ? 'in' : ''}">${money(v)}</b></div>
      <div class="facts"><div><span>Last month</span><b>${money(pv)}</b>${delta(v, pv, isIn)}</div>
        <div><span>Usual (${bm.length} mo avg)</span><b>${bm.length ? money(usual) : '—'}</b>${bm.length ? delta(v, usual, isIn) : ''}</div>
        <div><span>Per day</span><b>${money(v / (pace(db, ym).day || 1))}</b></div></div>
      <h3>${isIn ? 'Where it came from' : 'Where it went'}</h3>${groupRows(db, ym, isIn ? 'income' : 'expense')}
      <p class="hint tap">Tap a group to see what is in it.</p>`;
  } else {
    const rate = cur.income > 0 ? Math.round(net / cur.income * 100) : null;
    const bm = baselineMonths(db, ym, 3);
    const usualNet = bm.length ? sum(bm.map((m) => { const x = monthStat(db, m); return x.income - x.spent; })) / bm.length : null;
    const tr = trend(db, ym, 6);
    root.innerHTML = `<div class="gdhead"><b class="big ${net < 0 ? 'neg' : 'in'}">${money(net)}</b>
      <span class="muted">${money(cur.income)} came in − ${money(cur.spent)} went out</span></div>
      <div class="facts"><div><span>Kept</span><b>${rate === null ? '—' : rate + '%'}</b><small class="muted">of inflow</small></div>
        <div><span>Last month</span><b>${money(prevNet)}</b>${delta(net, prevNet, true)}</div>
        <div><span>Usual (${bm.length} mo)</span><b>${usualNet === null ? '—' : money(usualNet)}</b></div></div>
      ${netChart(tr, ym, false)}
      <h3>Cash inflow</h3>${groupRows(db, ym, 'income', 6)}
      <h3>Cash outflow</h3>${groupRows(db, ym, 'expense', 6)}
      ${withGo ? '<div class="btnrow"><button class="btn" data-go>Open this month</button></div>' : ''}`;
    const go = root.querySelector('[data-go]');
    if (go) go.onclick = () => { ui.month = ym; s.close(); location.hash = '#/home'; render(); };
  }
}

// bars above/below a zero line: green when money was kept, red when more went out than came in
function netChart(list, sel, click = true) {
  const n = list.length, W = 320, H = 140, bw = W / n, mid = 62;
  const nets = list.map((x) => x.income - x.spent);
  const top = Math.max(1, ...nets.map(Math.abs));
  const bars = list.map((x, i) => {
    const v = nets[i], h = Math.abs(v) / top * (mid - 8);
    const lab = new Date(+x.m.slice(0, 4), +x.m.slice(5) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
    return `<g data-tip="${esc(`${monthLabel(x.m)}: net ${money(v)}`)}" ${click ? `data-act="mon" data-m="${x.m}" role="button" tabindex="0" aria-label="${monthLabel(x.m)} details" class="hit"` : ''}><title>${esc(`${monthLabel(x.m)}: net ${money(v)}`)}</title>
      <rect x="${i * bw}" y="0" width="${bw}" height="${H}" fill="transparent"/>
      <rect x="${i * bw + 5}" y="${v >= 0 ? mid - h : mid}" width="${bw - 10}" height="${Math.max(h, 1)}" rx="2" fill="${v >= 0 ? 'var(--in)' : 'var(--bad)'}" opacity="${x.m === sel ? 1 : .55}"/>
      <text x="${i * bw + bw / 2}" y="${H - 4}" text-anchor="middle" class="axis">${n > 8 ? lab.slice(0, 1) : lab}</text></g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Net income by month"><line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="var(--rule)"/>${bars}</svg>`;
}

// =====================================================================
// Cash flow window
// =====================================================================
export function cashflow(db) {
  const ym = ui.month;
  const st = { income: 0, spent: 0 };
  Object.assign(st, monthStat(db, ym));
  const net = st.income - st.spent;
  const dt = dayTotals(db, ym);
  const moved = sum([...dt.values()].map((x) => x.tr));
  const p = pace(db, ym);
  const tr = trend(db, ym, 12);
  const rate = st.income > 0 ? Math.round(net / st.income * 100) : null;
  // per account, in base currency
  const acc = new Map(), am = accountMap(db);
  for (const q of monthParts(db, ym)) { const x = acc.get(q.t.acct) || { i: 0, o: 0 }; if (q.kind === 'income') x.i += q.v; else x.o += q.v; acc.set(q.t.acct, x); }
  const accRows = [...acc.entries()].map(([id, x]) => ({ id, name: (am.get(id) || { name: '?' }).name, ...x })).sort((a, b) => (b.i + b.o) - (a.i + a.o));
  return `${monthNav()}${strip({ income: st.income, spent: st.spent })}
    <section><div class="facts four2">
      <div><span>Kept</span><b>${rate === null ? '—' : rate + '%'}</b></div>
      <div><span>Net per day</span><b>${R(net / (p.day || 1))}</b></div>
      <div><span>Moved between accounts</span><b>${R(moved)}</b></div></div></section>
    ${coll('c-net', 'Net income by month', `${netChart(tr, ym)}<p class="legend"><i class="k inc"></i>Kept <i class="k neg"></i>Overspent · tap a month</p>`)}
    ${coll('c-in', 'Biggest cash inflows', groupRows(db, ym, 'income', 5))}
    ${coll('c-out', 'Biggest cash outflows', groupRows(db, ym, 'expense', 5))}
    ${coll('c-acc', 'By account', accRows.length ? `<div class="rows plain">${accRows.map((r) => `<button class="row acctflow" data-act="acct-flow" data-id="${r.id}"><span class="rmain"><strong>${esc(r.name)}</strong><small><span class="in">+${money(r.i)}</span> · <span class="neg">−${money(r.o)}</span></small></span>
      <span class="ramt"><b class="${r.i - r.o < 0 ? 'neg' : 'in'}">${money(r.i - r.o)}</b></span></button>`).join('')}</div><p class="hint">Entries in each account, valued in ${BASE}. Tap one to see them.</p>` : '<p class="empty">No entries this month.</p>')}`;
}
ACT['acct-flow'] = (el) => { ui.acct = el.dataset.id; ui.filter = 'all'; ui.q = ''; ui.limit = 120; location.hash = '#/ledger'; render(); };

// =====================================================================
// Calendar: tap a day for the details, colour coded
// =====================================================================
export function calendar(db) {
  const ym = ui.month, [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay(), dim = daysInMonth(ym);
  const dt = dayTotals(db, ym), today = nowStamp().slice(0, 10), isNow = ym === today.slice(0, 7), upto = isNow ? +today.slice(8, 10) : (ym < today.slice(0, 7) ? dim : 0);
  const maxOut = Math.max(0, ...[...dt.values()].map((x) => x.out));
  let cells = '<i class="cal-b"></i>'.repeat(first), tOut = 0, tIn = 0, tTr = 0, busy = null, quiet = 0, active = 0;
  const weeks = []; let wk = { from: 1, out: 0 };
  for (let d = 1; d <= dim; d++) {
    const x = dt.get(d) || { out: 0, inc: 0, tr: 0 };
    tOut += x.out; tIn += x.inc; tTr += x.tr; wk.out += x.out;
    if (x.out > 0) { active++; if (!busy || x.out > busy.out) busy = { d, out: x.out }; } else if (d <= upto) quiet++;
    if ((first + d) % 7 === 0 || d === dim) { weeks.push({ ...wk, to: d }); wk = { from: d + 1, out: 0 }; }
    const date = `${ym}-${String(d).padStart(2, '0')}`, heat = maxOut && x.out ? Math.max(0.1, Math.min(0.55, (x.out / maxOut) * 0.55)) : 0;
    const cls = [date === today ? 'today' : '', x.out ? 'o' : '', x.inc ? 'g' : '', x.tr ? 'b' : '', d > upto && upto ? 'later' : ''].join(' ');
    cells += `<button class="cal-d ${cls}" ${heat ? `style="--heat:${heat.toFixed(2)}"` : ''} data-act="day" data-d="${date}" aria-label="${dayLabel(date)}"><span class="n">${d}</span>
      ${x.out ? `<i class="o">−${compact(x.out, '')}</i>` : ''}${x.inc ? `<i class="g">+${compact(x.inc, '')}</i>` : ''}${x.tr ? `<i class="b">⇄${compact(x.tr, '')}</i>` : ''}</button>`;
  }
  const maxW = Math.max(1, ...weeks.map((w) => w.out)), per = upto ? tOut / upto : 0, entries = db.txs.filter((t) => !t.deleted && t.date.startsWith(ym)).length;
  const st = monthStat(db, ym);
  return `${monthNav()}
    ${strip(st)}
    <section class="calwrap"><div class="cal-h">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal">${cells}</div>
      <p class="legend cal-l"><i class="k o"></i>Cash outflow (darker = more) <i class="k g"></i>Cash inflow <i class="k b"></i>Transfer</p>
      ${isNow ? '' : `<div class="btnrow left"><button type="button" class="btn sm ghost" data-act="cal-today">Go to this month</button></div>`}</section>
    <section class="facts three"><div><span>Cash outflow</span><b class="cr">${R(tOut)}</b></div><div><span>Cash inflow</span><b class="cg">${R(tIn)}</b></div><div><span>Transfers</span><b class="cb">${R(tTr)}</b></div></section>
    <section><h2>This month by day</h2>
      <ul class="calfacts">
        <li><span>Average per day${isNow ? ' so far' : ''}</span><b>${upto ? R(per) : '—'}</b></li>
        <li><span>Busiest day</span><b>${busy ? `<button type="button" class="linkbtn" data-act="day" data-d="${ym}-${String(busy.d).padStart(2, '0')}">${dayLabel(`${ym}-${String(busy.d).padStart(2, '0')}`)}</button> · ${R(busy.out)}` : '—'}</b></li>
        <li><span>Days you spent nothing</span><b>${upto ? `${quiet} of ${upto}` : '—'}</b></li>
        <li><span>Entries this month</span><b>${entries}</b></li></ul>
      <h3 class="subh">Spending by week</h3>
      <div class="wkbars">${weeks.map((w) => `<div class="wk"><span>${w.from}–${w.to}</span><i style="width:${Math.max(w.out ? 3 : 0, (w.out / maxW) * 100).toFixed(0)}%"></i><b>${w.out ? R(w.out) : '—'}</b></div>`).join('')}</div></section>
    <p class="hint">Tap a day to see its entries or add one. Amounts are in ${BASE}, shortened (12k = 12,000).</p>`;
}
ACT['cal-today'] = () => { ui.month = thisMonth(); render(); };
ACT.day = (el) => openDay(el.dataset.d);

function openDay(date) {
  const db = get(), ym = date.slice(0, 7), dayN = +date.slice(8, 10);
  const x = dayTotals(db, ym).get(dayN) || { out: 0, inc: 0, tr: 0 };
  const accts = accountMap(db), cats = catMap(db);
  const list = sortedTxs(db).filter((t) => t.date.startsWith(date));
  const s = sheet(`<div class="facts three"><div><span>Cash outflow</span><b class="cr">${money(x.out)}</b></div><div><span>Cash inflow</span><b class="cg">${money(x.inc)}</b></div><div><span>Transfers</span><b class="cb">${money(x.tr)}</b></div></div>
    <div class="gdhead"><span class="muted">Net ${money(x.inc - x.out)} · ${list.length} ${list.length === 1 ? 'entry' : 'entries'}</span></div>
    <div class="rows">${list.map((t) => row(t, accts, cats)).join('') || '<p class="empty">Nothing recorded on this day.</p>'}</div>
    <div class="btnrow"><button class="btn" data-add>+ Add an entry on this day</button></div>`, { title: dayLabel(date), wide: true });
  s.el.addEventListener('click', (e) => { if (e.target.closest('[data-act=edit]')) s.close(); });
  s.el.querySelector('[data-add]').onclick = () => { s.close(); openEntry({ preset: { date: date === nowStamp().slice(0, 10) ? nowStamp() : `${date} 12:00:00` } }); };
}

// =====================================================================
// Budget: interactive donut, percentages, expandable rows, warnings
// =====================================================================
ACT.slice = (el) => { ui.pie = ui.pie === el.dataset.k ? '' : el.dataset.k; render(); };
ACT.pieby = (el) => { ui.pieBy = el.dataset.v; ui.pie = ''; render(); };

export function budget(db) {
  const ym = ui.month, cats = catMap(db);
  const by = ui.pieBy || 'group';
  const out = totals(db, ym), total = out.total;
  const p = pace(db, ym);
  const budgets = db.budgets.filter((b) => !b.deleted && b.amount > 0);
  const budgeted = sum(budgets.map((b) => b.amount));
  const spentIn = sum(budgets.map((b) => out.by.get(b.group) || 0));
  const left = budgeted - spentIn;
  // warnings
  const warns = [];
  for (const b of budgets) {
    const v = out.by.get(b.group) || 0, r = v / b.amount;
    if (r >= 1) warns.push({ tone: 'over', g: b.group, text: `${b.group}: over budget by ${R(v - b.amount)} (${Math.round(r * 100)}% used).` });
    else if (r >= 0.8) warns.push({ tone: 'warn', g: b.group, text: `${b.group}: ${Math.round(r * 100)}% of the budget used, ${R(b.amount - v)} left.` });
    else if (p.live && p.day >= 5 && v / p.day * p.dim > b.amount) {
      const hit = Math.ceil(b.amount / (v / p.day));
      warns.push({ tone: 'warn', g: b.group, text: `${b.group}: at this pace the budget runs out around day ${hit}.` });
    }
  }
  // slices
  let slices;
  if (by === 'category') {
    const m = new Map();
    for (const q of monthParts(db, ym)) if (q.kind === 'expense') m.set(q.cat || 'none', (m.get(q.cat || 'none') || 0) + q.v);
    const all = [...m.entries()].map(([id, v]) => { const c = cats.get(id); return { key: id, label: c ? c.name : 'No category', v, color: c ? c.group : 'Uncategorized' }; }).sort((a, b) => b.v - a.v);
    slices = all.slice(0, 9);
    const rest = sum(all.slice(9).map((x) => x.v));
    if (rest > 0) slices.push({ key: '_other', label: 'Everything else', v: rest, color: 'Others' });
  } else {
    slices = [...out.by.entries()].sort((a, b) => b[1] - a[1]).map(([g, v]) => ({ key: g, label: g, v, color: g }));
  }
  const sel = slices.find((x) => x.key === ui.pie);
  const C = 2 * Math.PI * 64;
  let acc = 0;
  const arcs = slices.map((x) => {
    const len = total ? x.v / total * C : 0, d = Math.max(0, len - 1.6);
    const el = `<circle data-tip="${esc(`${x.label}: ${money(x.v)} (${total ? Math.round(x.v / total * 100) : 0}%)`)}" class="slice ${sel ? (sel === x ? 'sel' : 'dim') : ''}" cx="90" cy="90" r="64" fill="none" stroke="${groupColor(x.color)}" stroke-width="${sel === x ? 34 : 28}" stroke-dasharray="${d} ${C - d}" stroke-dashoffset="${-acc}" transform="rotate(-90 90 90)" data-act="slice" data-k="${esc(x.key)}" role="button" tabindex="0" aria-label="${esc(x.label)} ${total ? Math.round(x.v / total * 100) : 0}%"><title>${esc(x.label)}: ${money(x.v)}</title></circle>`;
    acc += len; return el;
  }).join('');
  const donut = total
    ? `<svg class="donut" viewBox="0 0 180 180" role="img" aria-label="Spending split">${arcs}
        <text x="90" y="84" text-anchor="middle" class="dl">${esc(sel ? sel.label : 'Cash outflow')}</text>
        <text x="90" y="104" text-anchor="middle" class="dv">${sel ? money(sel.v) : money(total)}</text>
        <text x="90" y="121" text-anchor="middle" class="dl">${sel ? Math.round(sel.v / total * 100) + '% of outflow' : monthLabel(ym).split(' ')[0]}</text></svg>`
    : '<p class="empty">Nothing spent in this month yet.</p>';
  // rows
  const rowFor = (x) => {
    const pct = total ? Math.round(x.v / total * 100) : 0;
    const open = ui.pie === x.key ? 'open' : '';
    let chip = '', inner = '';
    if (by === 'group') {
      const b = budgetOf(db, x.key), r = b ? x.v / b : 0;
      chip = b ? `<em class="bchip ${r >= 1 ? 'over' : r >= 0.8 ? 'warn' : 'ok'}">${r >= 1 ? 'Over' : r >= 0.8 ? 'Close' : 'On track'}</em>` : '';
      const subs = [...monthParts(db, ym).filter((q) => q.kind === 'expense' && q.group === x.key).reduce((m, q) => m.set(q.cat || 'none', (m.get(q.cat || 'none') || 0) + q.v), new Map()).entries()].sort((a, b2) => b2[1] - a[1]);
      inner = `${b ? `<div class="bprog"><div class="track"><div class="fill ${r >= 1 ? 'over' : r >= 0.8 ? 'warn' : ''}" style="width:${Math.min(100, r * 100)}%"></div></div>
          <small>${money(x.v)} of ${money(b)} · ${Math.round(r * 100)}% used · ${r >= 1 ? money(x.v - b) + ' over' : money(b - x.v) + ' left'}</small></div>` : '<p class="hint">No budget for this group yet.</p>'}
        <ul class="catlist">${subs.map(([id, v]) => `<li><span>${esc((cats.get(id) || { name: 'No category' }).name)} <small class="pct">${x.v ? Math.round(v / x.v * 100) : 0}%</small></span><b>${money(v)}</b></li>`).join('')}</ul>
        <div class="btnrow left"><button class="btn ghost sm" data-act="grp" data-g="${esc(x.key)}" data-k="expense">See entries</button>
          <button class="btn ghost sm" data-act="budget" data-g="${esc(x.key)}">${b ? 'Change budget' : 'Set a monthly budget'}</button>${b ? `<button class="btn ghost sm" data-act="budget-clear" data-g="${esc(x.key)}">Remove</button>` : ''}</div>`;
    } else {
      inner = `<p class="hint">${pct}% of everything spent this month.</p>`;
    }
    return `<details class="pierow" ${open}><summary><i class="dot2" style="background:${groupColor(x.color)}"></i><span class="pl">${esc(x.label)}</span>${chip}<span class="pp">${pct}%</span><b>${money(x.v)}</b>${ic('down', 'chev')}</summary><div class="pbody">${inner}</div></details>`;
  };
  const sumBlock = budgets.length
    ? `<div class="facts three"><div><span>Budgeted</span><b>${R(budgeted)}</b></div><div><span>Spent in them</span><b>${R(spentIn)}</b></div><div><span>${left >= 0 ? 'Left' : 'Over by'}</span><b class="${left < 0 ? 'neg' : 'in'}">${R(Math.abs(left))}</b></div></div>
       <div class="track tall"><div class="fill ${spentIn > budgeted ? 'over' : spentIn / budgeted >= 0.8 ? 'warn' : ''}" style="width:${Math.min(100, spentIn / budgeted * 100)}%"></div></div>
       <p class="hint">${Math.round(spentIn / budgeted * 100)}% of the total budget used${p.live && p.dim - p.day > 0 && left > 0 ? `, about ${R(left / (p.dim - p.day))} a day for the ${p.dim - p.day} days left` : ''}.</p>`
    : '<p class="hint">No budgets yet. Open a group below and press “Set a monthly budget”.</p>';
  return `${monthNav()}
    ${warns.length ? `<section class="bwarn">${warns.map((w) => `<button class="warnrow ${w.tone}" data-act="slice" data-k="${esc(w.g)}">${ic('check')}<span>${esc(w.text)}</span></button>`).join('')}</section>` : ''}
    ${coll('b-sum', 'Budget summary', sumBlock)}
    <section class="seg-wrap"><div class="seg two" role="group" aria-label="Split by">${[['group', 'By group'], ['category', 'By category']].map(([v, l]) => `<button type="button" data-act="pieby" data-v="${v}" class="${by === v ? 'on' : ''}" aria-pressed="${by === v}">${l}</button>`).join('')}</div>
      ${donut}${total ? '<p class="hint center">Tap a slice or a row for the detail.</p>' : ''}</section>
    <section>${slices.map(rowFor).join('')}</section>`;
}

// =====================================================================
// Categories page (add / edit / delete), reached from the menu
// =====================================================================
export function categories(db) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const kind = q.get('k') === 'income' ? 'income' : 'expense';
  ui.catKind = kind;
  const used = new Map();
  for (const t of db.txs) if (!t.deleted) { used.set(t.cat, (used.get(t.cat) || 0) + 1); for (const i of t.items || []) if (i.cat) used.set(i.cat, (used.get(i.cat) || 0) + 1); }
  const groups = new Map();
  for (const c of db.categories) {
    if (c.deleted || c.group === 'Adjustments' || !(c.kind === kind || c.kind === 'both')) continue;
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  const label = kind === 'income' ? 'income' : 'expense';
  return `${hdr(kind === 'income' ? 'Income categories' : 'Expense categories')}
    <div class="seg two" role="group">${[['expense', 'Expense'], ['income', 'Income']].map(([v, l]) => `<button type="button" data-act="catkind" data-v="${v}" class="${kind === v ? 'on' : ''}" aria-pressed="${kind === v}">${l}</button>`).join('')}</div>
    <button class="btn wide" data-act="cat-new">+ New ${label} category</button>
    ${[...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, cs]) => coll(`cg:${kind}:${g}`,
      `<i class="badge sm" style="background:${groupColor(g)}">${groupLetter(g)}</i> ${esc(g)} <small class="muted">${cs.length}</small>`,
      `<div class="chips">${cs.sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<button type="button" class="chip" data-act="cat-edit" data-id="${c.id}">${esc(c.name)}${c.keywords ? '<small title="has keywords"> ✎</small>' : ''}<small> ${used.get(c.id) || 0}</small></button>`).join('')}
        <button type="button" class="chip more" data-act="cat-new" data-g="${esc(g)}">+ add</button></div>
        <div class="btnrow left"><button class="linkbtn sm" data-act="cat-ren" data-g="${esc(g)}">Rename group</button><button class="linkbtn sm neg" data-act="cat-delgroup" data-g="${esc(g)}">Delete group</button></div>`)).join('') || '<p class="empty">No categories yet.</p>'}
    <p class="hint">The small number is how many entries use a category. Tap one to rename it, move it to another group, edit its keywords or delete it. Keywords make the app guess it as you type.</p>`;
}
ACT.catkind = (el) => { location.hash = `#/categories?k=${el.dataset.v}`; };
ACT['cat-new'] = (el) => openCategoryForm({ kind: ui.catKind || 'expense', group: el.dataset.g || '' });
ACT['cat-edit'] = (el) => openCategoryForm({ id: el.dataset.id, kind: ui.catKind || 'expense' });
ACT['cat-ren'] = async (el) => {
  const old = el.dataset.g, kind = ui.catKind || 'expense', db0 = get();
  const others = [...new Set(db0.categories.filter((c) => !c.deleted && c.group !== old && (c.kind === kind || c.kind === 'both')).map((c) => c.group))];
  const v = (await promptDialog('Rename or merge group', old, { okLabel: 'Save', hint: others.length ? 'To merge, type the name of another group and everything moves into it: ' + others.join(', ') : '' }))?.trim();
  if (!v || v === old) return;
  const merging = others.includes(v);
  commit((d) => {
    for (const c of d.categories) if (!c.deleted && c.group === old && (c.kind === kind || c.kind === 'both')) { c.group = v; stamp(c); }
    if (!d.categories.some((c) => !c.deleted && c.group === old)) {
      const mine = d.budgets.find((b) => !b.deleted && b.group === old), tgt = d.budgets.find((b) => !b.deleted && b.group === v && b !== mine);
      if (mine) { if (tgt) { tgt.amount = (tgt.amount || 0) + (mine.amount || 0); stamp(tgt); mine.deleted = true; stamp(mine); } else { mine.group = v; stamp(mine); } }
      d.settings.excludeGroups = [...new Set(d.settings.excludeGroups.map((x) => (x === old ? v : x)))];
    }
  });
  toast(merging ? `Merged into “${v}”.` : 'Renamed.', { ms: 3500 });
};
ACT['cat-delgroup'] = async (el) => {
  const g = el.dataset.g, kind = ui.catKind || 'expense', db = get();
  const ids = db.categories.filter((c) => !c.deleted && c.group === g && (c.kind === kind || c.kind === 'both')).map((c) => c.id);
  const n = db.txs.filter((t) => !t.deleted && ids.includes(t.cat)).length;
  if (!(await confirmDialog(`Delete the group “${g}” and its ${ids.length} ${ids.length === 1 ? 'category' : 'categories'}? ${n ? n + ' existing entries keep the names, but you will not be able to pick them for new entries.' : ''}`, 'Delete', true))) return;
  commit((d) => { const at = Date.now(); for (const c of d.categories) if (ids.includes(c.id)) { softDelete(c, at); c.delGroup = c.group; } });
};


// =====================================================================
// Outlook: next month's spending forecast, with warnings, tips and rewards
// =====================================================================
const toneIcon = { warn: '⚠', good: '✓', note: '•' };
export function notesList(notes) {
  return `<ul class="ins">${notes.map((x) => `<li class="${x.tone}">${esc(x.text)}</li>`).join('')}</ul>`;
}
export function outlookCard(db) {
  const f = forecastNext(db, thisMonth());
  if (!f.months.length) return '';
  const notes = behaviorNotes(db, thisMonth()).slice(0, 2);
  return coll('h-outlook', 'Next month outlook', `<a class="outlook-card" href="#/outlook"><div><span class="muted">${esc(monthLabel(f.next))} forecast</span><b>${R(f.total)}</b>
    <small class="muted">${f.incomeAvg ? `usual income ${R(f.incomeAvg)}` : 'no usual income yet'}</small></div>${ic('right')}</a>${notes.length ? notesList(notes) : ''}`);
}
export function outlook(db) {
  const ym = thisMonth(), f = forecastNext(db, ym), notes = behaviorNotes(db, ym);
  if (!f.months.length) return `${hdr('Outlook')}<p class="empty">Add a month or two of entries and Sukli will forecast the next one.</p>`;
  const left = f.incomeAvg - f.total;
  const hist = [];
  for (let i = 4; i >= 0; i--) { const m = shiftMonth(ym, -i); hist.push({ m, v: totals(db, m).total, fc: false }); }
  hist.push({ m: f.next, v: f.total, fc: true });
  const W = 320, H = 120, bw = W / hist.length, top = Math.max(1, ...hist.map((x) => x.v), f.incomeAvg);
  const incY = H - 16 - (f.incomeAvg / top) * (H - 26);
  const bars = hist.map((x, i) => {
    const h = x.v / top * (H - 26);
    const tip = x.fc ? `${monthLabel(x.m)} forecast: ${R(x.v)}${f.incomeAvg ? ` (${left >= 0 ? 'leaves' : 'short by'} ${R(Math.abs(left))})` : ''}` : `${monthLabel(x.m)}: ${R(x.v)}${x.m === ym ? ' so far' : ''}`;
    const lab = new Date(+x.m.slice(0, 4), +x.m.slice(5) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
    return `<g data-tip="${esc(tip)}"><rect x="${i * bw}" y="0" width="${bw}" height="${H}" fill="transparent"/>
      <rect x="${i * bw + 6}" y="${H - 16 - h}" width="${bw - 12}" height="${Math.max(h, 1)}" rx="3" fill="${x.fc ? 'var(--tint)' : (x.m === ym ? 'var(--line)' : 'var(--bar)')}" ${x.fc ? 'stroke="var(--line)" stroke-dasharray="4 3" stroke-width="1.6"' : ''}/>
      <text x="${i * bw + bw / 2}" y="${H - 3}" text-anchor="middle" class="axis">${lab}</text></g>`;
  }).join('');
  const inc = f.incomeAvg > 0 ? `<line x1="0" x2="${W}" y1="${incY}" y2="${incY}" stroke="var(--in)" stroke-dasharray="2 3"/>` : '';
  const groups = [...f.by.entries()].sort((a, b) => b[1] - a[1]);
  const gmax = groups.length ? groups[0][1] : 1;
  const sofar = totals(db, ym).by;
  const rows = groups.slice(0, 10).map(([g, v]) => {
    const now = sofar.get(g) || 0, pct = f.total ? Math.round(v / f.total * 100) : 0;
    return `<button class="gbar click" data-act="grp" data-g="${esc(g)}" data-k="expense" data-m="${ym}" data-tip="${esc(`${g}: about ${R(v)} next month; ${R(now)} so far this month`)}">
      <i class="badge sm" style="background:${groupColor(g)}">${groupLetter(g)}</i><div class="gmain"><div class="gtop"><span>${esc(g)}</span><b>${R(v)}</b></div>
      <div class="track"><div class="fill" style="width:${v / gmax * 100}%;background:${groupColor(g)}"></div><div class="mark now" style="left:${Math.min(100, now / gmax * 100)}%"></div></div>
      <small class="muted">${pct}% of forecast · ${R(now)} so far this month</small></div></button>`;
  }).join('');
  return `${hdr('Outlook')}
    ${reminderBanner(db)}
    <section class="outhead"><span class="muted">${esc(monthLabel(f.next))} forecast</span><b class="big">${R(f.total)}</b>
      ${f.method ? `<small class="muted fcmethod">Based on the ${esc(f.method)}${f.low != null ? `. In past months this kind of guess was usually within about ${R(f.high - f.total)} either way (${R(f.low)} to ${R(f.high)}), tested on ${f.tested} months.` : '. Not enough history yet to test how close it usually is.'}</small>` : ''}
      <span class="${left >= 0 ? 'in' : 'neg'}">${f.incomeAvg ? (left >= 0 ? `About ${R(left)} left after the usual ${R(f.incomeAvg)} income` : `About ${R(-left)} more than the usual ${R(f.incomeAvg)} income`) : 'Add income entries to compare against what comes in'}</span>
      <small class="muted">Based on ${f.months.length === 1 ? 'one earlier month' : f.months.length + ' earlier months'} (${f.months.slice().reverse().map((m) => monthLabel(m).split(' ')[0]).join(', ')}). It is a plain average of your own history, not a promise.</small></section>
    ${coll('o-chart', 'Spending by month', `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending in recent months and the forecast">${inc}${bars}</svg><p class="legend"><i class="k bar"></i>Actual <i class="k dash"></i>Forecast${f.incomeAvg ? ' <i class="k inc"></i>Usual income' : ''} · tap a bar</p>`)}
    ${coll('o-notes', 'Warnings, tips and rewards', notesList(notes))}
    ${coll('o-groups', 'Where it will probably go', rows ? `${rows}<p class="hint tap">The tick shows how far this month is. Tap a group for its details.</p>` : '<p class="empty">Nothing to show yet.</p>')}
    ${(() => { const reg = detectRecurring(db); return reg.length ? coll('o-reg', 'Regular payments found', `<p class="hint">Found from how often and how much you pay. About ${R(reg.reduce((n, r) => n + r.monthly, 0))} a month in total.</p><div class="rows plain">${reg.slice(0, 8).map((r) => `<div class="row"><span class="rmain"><strong>${esc(r.name)}</strong><small>${esc(r.every)}${r.steady ? '' : ', amount varies'} · next around ${esc(r.next)}</small></span><span class="ramt"><b>${R(r.amount)}</b></span></div>`).join('')}</div>`) : ''; })()}
    ${f.fixed.length ? coll('o-fixed', 'Repeats every month', `<div class="rows plain">${f.fixed.map((x) => `<div class="row"><span class="rmain"><strong>${esc(x.name)}</strong><small>seen in each of the last ${f.months.length} months</small></span><span class="ramt"><b>${R(x.v)}</b></span></div>`).join('')}</div>`) : ''}`;
}
