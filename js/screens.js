// The five screens: Home, Ledger, Review, Accounts, Reports, and Settings.
import {
  get, commit, commitQuiet, stamp, uid, fmt, BASE, CUR, balances, sortedTxs, accountMap, catMap, monthStats, monthsPresent,
  monthLabel, shiftMonth, thisMonth, dayLabel, rateFor, reviewCount, groupColor, groupLetter, adjustmentCategory, nowStamp,
  replaceAll, emptyDb, live, monthParts, priv,
} from './core.js';
import { pace, insights, trend, totals, baselineMonths, groupTrend } from './insights.js';
import { importBluecoins, exportCSV, SPENDABLE_TYPES } from './importer.js';
import { predict } from './predict.js';
import { modelFor, openEntry, openBulk, openCategoryForm } from './entry.js';
import { syncNow, status as syncStatus } from './drive.js';
import { cloudSync, cloudStatus, signIn, signUp, signOut, signedIn, session, lastOk, SETUP_SQL } from './cloud.js';
import { esc, ic, ACT, sheet, toast, confirmDialog, promptDialog, download } from './ui.js';

export const ui = { month: thisMonth(), q: '', filter: 'all', acct: '', limit: 120 };

const money = (n, cur = BASE) => fmt(n, cur);
const showHome = () => get().settings.showHome !== false;
// small "≈ ₱…" line for money in another currency, using the rate stored on the entry
const eq = (amount, cur, fx) => (showHome() && cur !== BASE && fx > 0 ? `≈ ${money(amount * fx)}` : '');
const typeNames = { cash: 'Cash', bank: 'Bank', ewallet: 'E-wallet / card balance', card: 'Credit card', crypto: 'Crypto', loan: 'Loan or money owed', asset: 'Asset', other: 'Other' };

function monthNav(title) {
  const isNow = ui.month === thisMonth();
  return `<header class="top"><div class="monthbox"><button class="iconbtn" data-act="month" data-d="-1" aria-label="Previous month">${ic('left')}</button>
    <h1>${esc(title || monthLabel(ui.month))}</h1>
    <button class="iconbtn" data-act="month" data-d="1" aria-label="Next month" ${isNow ? 'disabled' : ''}>${ic('right')}</button></div>
    ${hdrActions()}</header>`;
}
const eyeBtn = () => `<button class="iconbtn" data-act="eye" aria-pressed="${priv.on}" aria-label="${priv.on ? 'Show amounts' : 'Hide amounts'}">${ic(priv.on ? 'eyeoff' : 'eye')}</button>`;
const hdrActions = () => `<div class="hact">${eyeBtn()}<a class="iconbtn" href="#/settings" aria-label="Settings">${ic('gear')}</a></div>`;
ACT.eye = () => { priv.set(!priv.on); document.body.classList.toggle('hide-amts', priv.on); window.dispatchEvent(new Event('sukli-render')); };
ACT.month = (el) => {
  const next = shiftMonth(ui.month, +el.dataset.d);
  if (next > thisMonth()) return;
  ui.month = next; ui.limit = 120; window.dispatchEvent(new Event('sukli-render'));
};

function strip(st) {
  const net = st.income - st.spent;
  return `<section class="strip" aria-label="Month totals">
    <div><span>Came in</span><b class="in">${fmt(st.income, BASE, { round: true })}</b></div>
    <div><span>Went out</span><b>${fmt(st.spent, BASE, { round: true })}</b></div>
    <div><span>Left over</span><b class="${net < 0 ? 'neg' : ''}">${fmt(net, BASE, { round: true })}</b></div></section>`;
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

function row(t, accts, cats) {
  const a = accts.get(t.acct), c = cats.get(t.cat), tr = t.kind === 'transfer';
  const group = tr ? 'Transfer' : (c ? c.group : 'Uncategorized');
  const title = t.name || (c ? c.name : 'Untitled');
  const sub = tr ? `${esc(a ? a.name : '?')} → ${esc((accts.get(t.toAcct) || {}).name || '?')}`
    : `${esc(c ? c.name : 'No category')} · ${esc(a ? a.name : '')}${t.items && t.items.length ? ` · ${t.items.length} items` : ''}`;
  const signed = tr ? money(t.amount, t.cur) : money(t.kind === 'income' ? t.amount : -t.amount, t.cur);
  const base = !tr && eq(t.amount, t.cur, t.fx) ? `<small>${eq(t.amount, t.cur, t.fx)}</small>` : '';
  return `<button class="row" data-act="edit" data-id="${t.id}">
    <i class="badge" style="background:${tr ? 'var(--ink2)' : groupColor(group)}">${groupLetter(group)}</i>
    <span class="rmain"><strong><span class="tt">${esc(title)}</span>${t.flag === 'review' ? '<em class="pill">Check</em>' : ''}</strong><small>${sub}</small></span>
    <span class="ramt ${t.kind}"><b>${t.kind === 'income' ? '+' : ''}${signed}</b>${base}</span></button>`;
}
ACT.edit = (el) => openEntry({ id: el.dataset.id });
ACT.add = () => openEntry();
ACT.bulk = () => openBulk();

// ---------------- Home ----------------
const sum = (a) => a.reduce((x, y) => x + y, 0);
const R = (n) => fmt(n, BASE, { round: true });

export function home(db) {
  const st = monthStats(db, ui.month);
  const accts = accountMap(db), cats = catMap(db);
  const sp = spendable(db);
  const n = reviewCount(db);
  const out = totals(db, ui.month), inc = totals(db, ui.month, 'income');
  const groups = [...out.by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = groups.length ? Math.max(groups[0][1], ...groups.map(([g]) => budgetOf(db, g))) : 1;
  const incGroups = [...inc.by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const recent = sortedTxs(db).filter((t) => t.date.startsWith(ui.month)).slice(0, 6);
  const chips = [...sp.by.entries()].filter(([, v]) => Math.abs(v) >= 0.005).map(([c, v]) => {
    const e = eq(v, c, rateFor(db, c));
    return `<span>${money(v, c)}${e ? `<small> ${e}</small>` : ''}</span>`;
  }).join('');
  const ins = insights(db, ui.month);
  return `${monthNav()}
    ${strip(st)}
    <section class="spendable"><div><span>Spendable now</span><b>${money(sp.total)}</b></div><div class="curs">${chips || '<span class="muted">No balances yet</span>'}</div>
      ${sp.missing.length ? `<p class="hint">Not counted: ${sp.missing.join(', ')} (set a rate in Settings).</p>` : ''}</section>
    ${n ? `<a class="banner" href="#/review"><strong>${n} ${n === 1 ? 'entry needs' : 'entries need'} a quick check</strong><span>Confirm the guessed categories</span>${ic('right')}</a>` : ''}
    ${ins.length ? `<section><h2>Worth knowing</h2><ul class="ins">${ins.map((x) => `<li class="${x.tone}">${x.id ? `<button class="insb" data-act="edit" data-id="${x.id}">${esc(x.text)}</button>` : esc(x.text)}</li>`).join('')}</ul></section>` : ''}
    ${paceCard(db)}
    <section><h2>Where it went</h2>
      ${groups.length ? groups.map(([g, v]) => gbar(db, g, v, max, 'expense')).join('') + '<p class="hint tap">Tap a group to see what is in it.</p>' : `<p class="empty">Nothing spent in ${esc(monthLabel(ui.month))} yet.</p>`}
    </section>
    <section><h2>Where it came from</h2>
      ${incGroups.length ? incGroups.map(([g, v]) => gbar(db, g, v, incGroups[0][1], 'income')).join('') : `<p class="empty">Nothing came in during ${esc(monthLabel(ui.month))} yet.</p>`}
    </section>
    <section><h2>Last 6 months</h2>${trendChart(trend(db, ui.month, 6), ui.month, 6)}
      <p class="legend"><i class="k bar"></i>Spent <i class="k inc"></i>Came in</p></section>
    <section><div class="h2row"><h2>Latest</h2><a href="#/ledger" class="linkbtn">All entries</a></div>
      <div class="rows">${recent.length ? recent.map((t) => row(t, accts, cats)).join('') : '<p class="empty">No entries this month. Tap + to add one.</p>'}</div></section>`;
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
  return `<section><h2>Pace</h2>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending so far this month compared with last month">
      <line x1="0" x2="${W}" y1="${H - 6}" y2="${H - 6}" stroke="var(--rule)"/>
      <path d="${line(p.prev, p.prev.length)}" stroke="var(--bar)" stroke-width="2" fill="none"/>
      ${proj}
      <path d="${line(p.cur, p.day)}" stroke="var(--line)" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${X(last).toFixed(1)}" cy="${Y(p.cur[last]).toFixed(1)}" r="3.5" fill="var(--line)"/></svg>
    <p class="legend"><i class="k lineb"></i>${esc(monthLabel(ui.month).split(' ')[0])} <i class="k bar"></i>${esc(monthLabel(p.prevYm).split(' ')[0])}${p.live ? ' <i class="k dash"></i>at this pace' : ''}</p>
    <div class="facts">
      <div><span>Per day</span><b>${R(p.dailyAvg)}</b></div>
      <div><span>${p.live ? 'By month end' : 'Month total'}</span><b>${R(p.live ? p.projected : p.spent)}</b></div>
      ${cmp || `<div><span>Same day last month</span><b>${R(p.prevSame)}</b></div>`}
    </div></section>`;
}

function trendChart(list, sel, n) {
  const W = 320, H = 120, bw = W / n;
  const top = Math.max(1, ...list.map((x) => Math.max(x.spent, x.income)));
  const bars = list.map((x, i) => {
    const hs = (x.spent / top) * (H - 22), hi = (x.income / top) * (H - 22);
    const lab = new Date(+x.m.slice(0, 4), +x.m.slice(5) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
    return `<g><title>${monthLabel(x.m)}: spent ${money(x.spent)}, came in ${money(x.income)}</title>
      <rect x="${i * bw + 5}" y="${H - 16 - hs}" width="${bw - 10}" height="${Math.max(hs, 0)}" rx="2" fill="${x.m === sel ? 'var(--line)' : 'var(--bar)'}"/>
      <rect x="${i * bw + 5}" y="${H - 18 - hi}" width="${bw - 10}" height="2" fill="var(--in)"/>
      <text x="${i * bw + bw / 2}" y="${H - 3}" text-anchor="middle" class="axis">${n > 8 ? lab.slice(0, 1) : lab}</text></g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spent and came in by month"><line x1="0" x2="${W}" y1="${H - 16}" y2="${H - 16}" stroke="var(--rule)"/>${bars}</svg>`;
}

const budgetOf = (db, g) => { const b = db.budgets.find((x) => !x.deleted && x.group === g); return b ? b.amount : 0; };
function gbar(db, g, v, max, kind) {
  const b = kind === 'income' ? 0 : budgetOf(db, g), over = b && v > b;
  const inner = `<i class="badge sm" style="background:${groupColor(g)}">${groupLetter(g)}</i>
    <div class="gmid"><div class="gtop"><span>${esc(g)}</span><b>${money(v)}${b ? `<small> of ${money(b)}</small>` : ''}</b></div>
    <div class="track"><div class="fill" style="width:${Math.min(100, (v / max) * 100)}%;background:${kind === 'income' ? 'var(--in)' : groupColor(g)}"></div>${b ? `<u style="left:${Math.min(100, (b / max) * 100)}%"></u>` : ''}</div></div>${kind ? ic('right', 'chev') : ''}`;
  return kind
    ? `<button class="gbar click ${over ? 'over' : ''}" data-act="grp" data-g="${esc(g)}" data-k="${kind}" aria-label="${esc(g)} details">${inner}</button>`
    : `<div class="gbar ${over ? 'over' : ''}">${inner}</div>`;
}

// what is inside one group this month: totals, comparison, history, categories and every entry
ACT.grp = (el) => openGroupDetail(el.dataset.g, el.dataset.k, ui.month);
function openGroupDetail(g, kind, ym) {
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
      ${trendChart(tr.map((x) => (isOut ? { m: x.m, spent: x.v, income: 0 } : { m: x.m, spent: 0, income: x.v })), ym, 6)}
      <h3>By category</h3>
      <div class="catbars">${catRows.map(([id, v]) => { const c = cats.get(id); return `<button class="cbar ${pick === id ? 'on' : ''}" data-cat="${id}"><span>${esc(c ? c.name : 'No category')}</span><b>${money(v)}</b><div class="track"><div class="fill" style="width:${Math.max(3, v / cmax * 100)}%;background:${isOut ? groupColor(g) : 'var(--in)'}"></div></div></button>`; }).join('')}</div>
      <div class="h2row"><h3>${pick ? esc((cats.get(pick) || { name: 'No category' }).name) : 'All entries'} · ${money(ctot)}</h3>${pick ? '<button class="linkbtn" data-clear>Show all</button>' : ''}</div>
      <div class="rows plain">${shown.slice(0, 80).map((p) => {
        const t = p.t, c = cats.get(p.cat), a = db.accounts.find((x) => x.id === t.acct);
        const orig = !p.split && t.cur !== BASE ? money(t.amount, t.cur) : '';
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
  if (!q) list = list.filter((t) => t.date.startsWith(ui.month));
  if (ui.filter === 'review') list = list.filter((t) => t.flag === 'review');
  else if (ui.filter !== 'all') list = list.filter((t) => t.kind === ui.filter);
  if (ui.acct) list = list.filter((t) => t.acct === ui.acct || t.toAcct === ui.acct);
  if (q) list = list.filter((t) => {
    const c = cats.get(t.cat), a = accts.get(t.acct);
    return [t.name, t.notes, c && c.name, c && c.group, a && a.name, (t.items || []).map((i) => i.n).join(' ')].join(' ').toLowerCase().includes(q);
  });
  const total = list.length;
  list = list.slice(0, ui.limit);
  let html = '', day = '', dayTotal = 0, buf = '';
  const flush = () => { if (buf) html += `<div class="day"><div class="dayhead"><span>${dayLabel(day)}</span><span>${dayTotal ? money(-dayTotal) : ''}</span></div><div class="rows">${buf}</div></div>`; buf = ''; dayTotal = 0; };
  for (const t of list) {
    const d = t.date.slice(0, 10);
    if (d !== day) { flush(); day = d; }
    buf += row(t, accts, cats);
    if (t.kind === 'expense') dayTotal += t.amount * (t.fx || 1);
    else if (t.kind === 'income') dayTotal -= 0;
  }
  flush();
  if (!html) html = `<p class="empty">${q ? 'No entries match your search.' : 'No entries here.'}</p>`;
  if (total > list.length) html += `<button class="btn ghost wide" data-act="more">Show more (${total - list.length} left)</button>`;
  return html;
}
ACT.more = () => { ui.limit += 150; const el = document.getElementById('ledger-list'); if (el) el.innerHTML = ledgerRows(get()); };

export function ledger(db) {
  const f = [['all', 'All'], ['review', 'Check'], ['expense', 'Spent'], ['income', 'Got'], ['transfer', 'Moved']];
  return `${monthNav()}
    <div class="searchbar">${ic('search')}<input id="q" type="search" placeholder="Search entries, items, notes" value="${esc(ui.q)}" aria-label="Search entries"></div>
    <div class="filters" role="group" aria-label="Filter">${f.map(([v, l]) => `<button class="chip ${ui.filter === v ? 'on' : ''}" data-act="filter" data-v="${v}">${l}</button>`).join('')}
      <select id="acctfilter" aria-label="Account filter"><option value="">All accounts</option>${db.accounts.filter((a) => !a.deleted).sort((a, b) => a.name.localeCompare(b.name)).map((a) => `<option value="${a.id}" ${ui.acct === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
    <div id="ledger-list">${ledgerRows(db)}</div>`;
}
ACT.filter = (el) => { ui.filter = el.dataset.v; ui.limit = 120; window.dispatchEvent(new Event('sukli-render')); };
export function bindLedger() {
  const q = document.getElementById('q');
  if (q) q.oninput = () => { ui.q = q.value; ui.limit = 120; document.getElementById('ledger-list').innerHTML = ledgerRows(get()); };
  const a = document.getElementById('acctfilter');
  if (a) a.onchange = () => { ui.acct = a.value; document.getElementById('ledger-list').innerHTML = ledgerRows(get()); };
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
      <small>${dayLabel(t.date)} · ${esc(a ? a.name : '')}${t.items && t.items.length ? ' · items do not add up to the total' : ''}</small>
      <div class="chips">${opts.map((x) => { const c = cats.get(x.id); return `<button class="chip cat" data-act="confirm" data-id="${t.id}" data-cat="${x.id}"><i style="background:${groupColor(c.group)}">${groupLetter(c.group)}</i>${esc(c.name)} <small>${Math.round(x.p * 100)}%</small></button>`; }).join('')}
      <button class="chip more" data-act="edit" data-id="${t.id}">Edit</button></div></article>`;
  });
  const sure = list.filter((t) => { const p = predict(modelFor(t.kind === 'income' ? 'income' : 'expense'), t.name, t.amount, { acct: t.acct, cur: t.cur, hour: +t.date.slice(11, 13) }); return p.conf >= 0.8 && !(t.items && t.items.length); }).length;
  return `<header class="top"><h1>Review</h1>${hdrActions()}</header>
    <p class="lede">${list.length ? 'Tap the right category to confirm each one. Your choice teaches the guesser.' : 'All caught up. Entries the app is unsure about will show up here.'}</p>
    ${sure ? `<button class="btn wide" data-act="confirm-sure">Confirm the ${sure} I’m sure about (80%+)</button>` : ''}
    <div class="rcards">${cards.join('')}</div>`;
}
ACT.confirm = (el) => commit((d) => { const t = d.txs.find((x) => x.id === el.dataset.id); t.cat = el.dataset.cat; t.flag = null; stamp(t); });
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
export function accounts(db) {
  const bal = balances(db);
  const sp = spendable(db);
  const live2 = db.accounts.filter((a) => !a.deleted);
  const shown = live2.filter((a) => !a.archived);
  const hidden = live2.length - shown.length;
  const byCur = new Map();
  for (const a of shown) { if (!byCur.has(a.cur)) byCur.set(a.cur, []); byCur.get(a.cur).push(a); }
  const sections = [...byCur.entries()].sort((a, b) => (a[0] === BASE ? -1 : b[0] === BASE ? 1 : a[0].localeCompare(b[0]))).map(([cur, list]) => {
    const sum = list.filter((a) => a.include).reduce((s, a) => s + (bal.get(a.id) || 0), 0);
    return `<section><div class="h2row"><h2>${cur}</h2><span class="muted">Spendable ${money(sum, cur)}</span></div><div class="rows plain">${list.sort((a, b) => (b.include - a.include) || a.name.localeCompare(b.name)).map((a) => `
      <button class="row acct" data-act="acct" data-id="${a.id}"><i class="badge sm" style="background:${groupColor(a.type)}">${groupLetter(typeNames[a.type] || a.type)}</i>
      <span class="rmain"><strong>${esc(a.name)}</strong><small>${esc(typeNames[a.type] || a.type)}${a.include ? '' : ' · not in spendable total'}</small></span>
      <span class="ramt"><b class="${(bal.get(a.id) || 0) < 0 ? 'neg' : ''}">${money(bal.get(a.id) || 0, a.cur)}</b>${eq(bal.get(a.id) || 0, a.cur, rateFor(db, a.cur)) ? `<small>${eq(bal.get(a.id) || 0, a.cur, rateFor(db, a.cur))}</small>` : ''}</span></button>`).join('')}</div></section>`;
  }).join('');
  return `<header class="top"><h1>Accounts</h1><div class="hact">${eyeBtn()}<button class="btn sm" data-act="acct-new">Add account</button></div></header>
    <section class="spendable"><div><span>Spendable now</span><b>${money(sp.total)}</b></div>
      <p class="hint">Counts cash, bank, e-wallet and card accounts marked “in spendable total”. Crypto, loans and people are left out unless you include them.</p></section>
    ${sections || '<p class="empty">No accounts yet. Add one, or import your Bluecoins export in Settings.</p>'}
    ${hidden ? `<p class="muted center">${hidden} hidden ${hidden === 1 ? 'account' : 'accounts'} (archived).</p>` : ''}`;
}
ACT['acct-new'] = () => openAccount(null);
ACT.acct = (el) => openAccount(el.dataset.id);

function openAccount(id) {
  const db = get();
  const a = id ? db.accounts.find((x) => x.id === id) : { name: '', cur: BASE, type: 'bank', open: 0, include: true, archived: false };
  const used = id && db.txs.some((t) => !t.deleted && (t.acct === id || t.toAcct === id));
  const bal = id ? (balances(db).get(id) || 0) : 0;
  const curs = [...new Set([...Object.keys(CUR), ...db.accounts.map((x) => x.cur)])];
  const s = sheet(`<form id="acct-form">
    <label class="field"><span>Name</span><input name="name" value="${esc(a.name)}" required ${id ? '' : 'autofocus'}></label>
    <div class="two"><label class="field"><span>Currency</span><select name="cur" ${used ? 'disabled' : ''}>${curs.map((c) => `<option ${c === a.cur ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label class="field"><span>Type</span><select name="type">${Object.entries(typeNames).map(([v, l]) => `<option value="${v}" ${v === a.type ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <label class="field"><span>Opening balance</span><input name="open" inputmode="decimal" value="${a.open || 0}"></label>
    <label class="check"><input type="checkbox" name="include" ${a.include ? 'checked' : ''}> Count in spendable total</label>
    ${id ? `<label class="check"><input type="checkbox" name="archived" ${a.archived ? 'checked' : ''}> Hide this account (archive)</label>` : ''}
    ${used ? '<p class="hint">Currency is locked because this account has entries.</p>' : ''}
    <div class="btnrow">${id && !used ? '<button type="button" class="btn danger ghost" data-del>Delete</button>' : ''}<button class="btn">Save</button></div></form>
    ${id ? `<form id="recon" class="recon"><h3>Does the real balance differ?</h3>
      <p class="hint">App says ${money(bal, a.cur)}. Type what your bank or wallet really shows and the app adds one correcting entry.</p>
      <div class="two"><input name="real" inputmode="decimal" placeholder="Real balance" aria-label="Real balance"><button class="btn ghost">Correct it</button></div></form>` : ''}`,
  { title: id ? 'Account' : 'New account' });
  s.el.querySelector('#acct-form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    const open = parseFloat(String(fd.get('open')).replace(/,/g, '')) || 0;
    commit((d) => {
      if (id) {
        const x = d.accounts.find((q) => q.id === id);
        Object.assign(x, { name, type: fd.get('type'), open, include: fd.has('include'), archived: fd.has('archived'), guessed: false });
        if (!used) x.cur = fd.get('cur');
        stamp(x);
      } else d.accounts.push(stamp({ id: uid(), name, cur: fd.get('cur'), type: fd.get('type'), open, include: fd.has('include'), archived: false }));
    });
    s.close();
  };
  const del = s.el.querySelector('[data-del]');
  if (del) del.onclick = () => { commit((d) => { const x = d.accounts.find((q) => q.id === id); x.deleted = true; stamp(x); }); s.close(); toast('Account deleted'); };
  const rec = s.el.querySelector('#recon');
  if (rec) rec.onsubmit = (e) => {
    e.preventDefault();
    const real = parseFloat(String(new FormData(rec).get('real')).replace(/,/g, ''));
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
export function reports(db) {
  const st = monthStats(db, ui.month);
  const cats = catMap(db);
  const groups = [...st.byGroup.entries()].sort((a, b) => b[1] - a[1]);
  const max = groups.length ? Math.max(groups[0][1], ...groups.map(([g]) => budgetOf(db, g))) : 1;
  const chart = trendChart(trend(db, thisMonth(), 12), ui.month, 12);
  const detail = groups.map(([g, v]) => {
    const inner = [...st.byCat.entries()].filter(([id]) => (cats.get(id) || { group: 'Uncategorized' }).group === g).sort((a, b) => b[1] - a[1]);
    const b = budgetOf(db, g);
    return `<details class="gdet"><summary>${gbar(db, g, v, max)}</summary>
      <ul class="catlist">${inner.map(([id, x]) => `<li><span>${esc((cats.get(id) || { name: 'No category' }).name)}</span><b>${money(x)}</b></li>`).join('')}</ul>
       <div class="btnrow left"><button class="btn ghost sm" data-act="grp" data-g="${esc(g)}" data-k="expense">See entries</button><button class="btn ghost sm" data-act="budget" data-g="${esc(g)}">${b ? 'Change monthly budget' : 'Set a monthly budget'}</button>${b ? `<button class="btn ghost sm" data-act="budget-clear" data-g="${esc(g)}">Remove budget</button>` : ''}</div></details>`;
  }).join('');
  return `${monthNav()}${strip(st)}
    <section><h2>Last 12 months</h2>${chart}
      <p class="legend"><i class="k bar"></i>Spent <i class="k inc"></i>Came in</p></section>
    <section><h2>By group</h2>${detail || '<p class="empty">Nothing spent this month.</p>'}
      <p class="hint">Entries split into items are counted under each item’s own category.</p></section>`;
}
ACT.budget = async (el) => {
  const g = el.dataset.g, cur = budgetOf(get(), g);
  const v = await promptDialog(`Monthly budget for ${g} (${BASE})`, cur || '', { type: 'number', hint: 'You will see a marker on the bar and it turns amber when you pass it.' });
  const n = parseFloat(v);
  if (!(n > 0)) return;
  commit((d) => { let b = d.budgets.find((x) => !x.deleted && x.group === g); if (b) { b.amount = n; stamp(b); } else d.budgets.push(stamp({ id: uid(), group: g, amount: n })); });
};
ACT['budget-clear'] = (el) => commit((d) => { const b = d.budgets.find((x) => !x.deleted && x.group === el.dataset.g); if (b) { b.deleted = true; stamp(b); } });

// ---------------- Settings ----------------
export function settings(db) {
  const s = db.settings;
  const groups = [...new Set(db.categories.filter((c) => !c.deleted && c.kind !== 'income').map((c) => c.group))].sort();
  const curs = [...new Set(db.accounts.filter((a) => !a.deleted).map((a) => a.cur))].filter((c) => c !== BASE);
  const cl = s.cloud || {};
  const me = signedIn() ? (session() || {}).user : null;
  return `<header class="top"><h1>Settings</h1>${eyeBtn()}</header>
    <section><h2>Categories</h2>
      <p class="hint">Add your own spending and income categories, rename them, and give each some keywords so the app can guess it straight away.</p>
      <div class="btnrow left"><button class="btn" data-act="cats" data-k="expense">Spending categories</button><button class="btn ghost" data-act="cats" data-k="income">Income categories</button></div></section>
    <section><h2>Display</h2>
      <label class="check"><input type="checkbox" id="showhome" ${s.showHome === false ? '' : 'checked'}> Show the ${BASE} equivalent next to other currencies</label>
      <p class="hint">For example a ¥1,200 lunch shows a small “≈ ₱…” under it. The eye button at the top hides every amount on screen, handy in public. It is remembered on this device only.</p></section>
    <section><h2>Cloud sync</h2>
      <p class="hint">Keeps your phone and your Mac in step through your own free Supabase project. Only you can read your rows. <a href="#" data-act="cloud-setup" class="linkbtn">Set up Supabase (5 minutes)</a></p>
      <label class="field"><span>Project URL</span><input id="c-url" value="${esc(cl.url || '')}" placeholder="https://abcdxyz.supabase.co" autocomplete="off" spellcheck="false" inputmode="url"></label>
      <label class="field"><span>Public (anon) key</span><input id="c-key" value="${esc(cl.key || '')}" placeholder="eyJ…" autocomplete="off" spellcheck="false"></label>
      ${me ? `<p>Signed in as <b>${esc(me.email || '')}</b></p>
        <label class="check"><input type="checkbox" id="c-auto" ${cl.auto === false ? '' : 'checked'}> Sync automatically</label>
        <div class="btnrow left"><button class="btn" data-act="cloud-sync">Sync now</button><button class="btn ghost" data-act="cloud-signout">Sign out</button></div>`
      : `<label class="field"><span>Email</span><input id="c-email" type="email" value="${esc(cl.email || '')}" autocomplete="username"></label>
        <label class="field"><span>Password</span><input id="c-pass" type="password" autocomplete="current-password"></label>
        <div class="btnrow left"><button class="btn" data-act="cloud-signin">Sign in</button><button class="btn ghost" data-act="cloud-signup">Create account</button></div>`}
      <p class="status" id="cloudstatus" role="status">${esc(cloudStatus.text || (me && lastOk() ? 'Last synced ' + new Date(lastOk()).toLocaleString() : ''))}</p></section>
    <section><h2>Google backup (optional)</h2>
      <p class="hint">Backs up to a private, hidden folder in your own Google Drive and keeps both your phones in step. Nothing else in your Drive is touched. <a href="#" data-act="gsetup" class="linkbtn">How to get a client ID</a></p>
      <label class="field"><span>Google client ID</span><input id="clientid" value="${esc(s.driveClientId)}" placeholder="1234-abc.apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>
      <label class="check"><input type="checkbox" id="autosync" ${s.autoSync ? 'checked' : ''}> Back up automatically after changes</label>
      <div class="btnrow left"><button class="btn" data-act="sync">Back up now</button></div>
      <p class="status" id="syncstatus" role="status">${esc(syncStatus.text || (s.lastSync ? 'Last backup ' + new Date(s.lastSync).toLocaleString() : 'Not backed up yet.'))}</p></section>
    <section><h2>Your data</h2>
      <div class="btnstack">
        <label class="btn ghost filebtn">Import Bluecoins CSV<input type="file" id="file-bc" accept=".csv,text/csv" hidden></label>
        <button class="btn ghost" data-act="export-csv">Export CSV</button>
        <button class="btn ghost" data-act="export-json">Download full backup (JSON)</button>
        <label class="btn ghost filebtn">Restore from backup (JSON)<input type="file" id="file-json" accept=".json,application/json" hidden></label></div>
      <p class="hint">Importing the same file twice is safe: entries already here are skipped.</p></section>
    <section><h2>Left out of “Went out”</h2>
      <p class="hint">Groups ticked here don’t count as spending in totals and charts (for example trading losses).</p>
      <div class="checks">${groups.map((g) => `<label class="check"><input type="checkbox" data-act="exclude" data-g="${esc(g)}" ${s.excludeGroups.includes(g) ? 'checked' : ''}> ${esc(g)}</label>`).join('')}</div></section>
    ${curs.length ? `<section><h2>Exchange rates</h2><p class="hint">What one unit is worth in ${BASE}. New entries start from the last rate you used; this is used for totals.</p>
      ${curs.map((c) => `<label class="field inline"><span>1 ${c} =</span><input data-rate="${c}" inputmode="decimal" value="${rateFor(db, c) ? Number(rateFor(db, c).toPrecision(6)) : ''}"><span>${BASE}</span></label>`).join('')}</section>` : ''}
    <section><h2>Put it on your phone</h2><p class="hint">iPhone: open this page in Safari, tap Share, then Add to Home Screen. Android: open the browser menu and choose Install app. It then works without a connection.</p></section>
    <section><h2>Erase</h2><button class="btn danger ghost" data-act="erase">Erase everything on this device</button>
      <p class="hint">Backups in your Google Drive are not touched.</p></section>`;
}
export function bindSettings() {
  for (const [id, k] of [['c-url', 'url'], ['c-key', 'key'], ['c-email', 'email']]) {
    const el = document.getElementById(id);
    if (el) el.onchange = () => commitQuiet((d) => { d.settings.cloud = { ...(d.settings.cloud || {}), [k]: el.value.trim() }; });
  }
  const sh = document.getElementById('showhome');
  if (sh) sh.onchange = () => commit((d) => { d.settings.showHome = sh.checked; });
  const ca = document.getElementById('c-auto');
  if (ca) ca.onchange = () => commit((d) => { d.settings.cloud = { ...(d.settings.cloud || {}), auto: ca.checked }; });
  const cid = document.getElementById('clientid');
  if (cid) cid.onchange = () => commitQuiet((d) => { d.settings.driveClientId = cid.value.trim(); });
  const as = document.getElementById('autosync');
  if (as) as.onchange = () => commit((d) => { d.settings.autoSync = as.checked; });
  document.querySelectorAll('[data-rate]').forEach((i) => {
    i.onchange = () => { const v = parseFloat(i.value); commitQuiet((d) => { if (v > 0) d.settings.rates[i.dataset.rate] = v; else delete d.settings.rates[i.dataset.rate]; }); };
  });
  const bc = document.getElementById('file-bc');
  if (bc) bc.onchange = async () => {
    const file = bc.files[0]; if (!file) return;
    try {
      const text = await file.text(); let st;
      commit((d) => { st = importBluecoins(d, text); });
      window.dispatchEvent(new Event('sukli-latest'));
      toast(`Imported ${st.added} entries, skipped ${st.skipped} already here. ${st.accounts} new accounts.`, { ms: 7000 });
      openAccountSetup();
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
ACT['export-csv'] = () => download(`sukli-${nowStamp().slice(0, 10)}.csv`, exportCSV(get()));
ACT['export-json'] = () => download(`sukli-backup-${nowStamp().slice(0, 10)}.json`, JSON.stringify({ ...get(), settings: { ...get().settings, driveClientId: '' } }), 'application/json');
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
ACT.cats = (el) => openCategoryManager(el.dataset.k || 'expense');
function openCategoryManager(kind) {
  const s = sheet('<div id="cm"></div>', { title: 'Categories', wide: true });
  const root = s.el.querySelector('#cm');
  const draw = () => {
    const db = get();
    const used = new Map();
    for (const t of db.txs) if (!t.deleted) { used.set(t.cat, (used.get(t.cat) || 0) + 1); for (const i of t.items || []) if (i.cat) used.set(i.cat, (used.get(i.cat) || 0) + 1); }
    const groups = new Map();
    for (const c of db.categories) {
      if (c.deleted || c.group === 'Adjustments' || !(c.kind === kind || c.kind === 'both')) continue;
      if (!groups.has(c.group)) groups.set(c.group, []);
      groups.get(c.group).push(c);
    }
    root.innerHTML = `<div class="seg two" role="group">${[['expense', 'Spending'], ['income', 'Income']].map(([v, l]) => `<button type="button" data-k="${v}" class="${kind === v ? 'on' : ''}" aria-pressed="${kind === v}">${l}</button>`).join('')}</div>
      <button class="btn wide" data-new="">+ New ${kind === 'income' ? 'income' : 'spending'} category</button>
      ${[...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, cs]) => `<div class="catgroup"><h3><i style="background:${groupColor(g)}">${groupLetter(g)}</i>${esc(g)}
        <button type="button" class="linkbtn sm" data-ren="${esc(g)}">Rename</button></h3>
        <div class="chips">${cs.sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<button type="button" class="chip" data-id="${c.id}">${esc(c.name)}${c.keywords ? '<small title="has keywords"> ✎</small>' : ''}<small> ${used.get(c.id) || 0}</small></button>`).join('')}
        <button type="button" class="chip more" data-new="${esc(g)}">+ add</button></div></div>`).join('') || '<p class="empty">No categories yet.</p>'}
      <p class="hint">The small number is how many entries use it. Tap a category to rename it, move it to another group, or edit its keywords.</p>`;
  };
  root.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-k]'); if (k) { kind = k.dataset.k; draw(); return; }
    const n = e.target.closest('[data-new]'); if (n) { openCategoryForm({ kind, group: n.dataset.new, onDone: draw }); return; }
    const c = e.target.closest('[data-id]'); if (c) { openCategoryForm({ id: c.dataset.id, kind, onDone: draw }); return; }
    const r = e.target.closest('[data-ren]');
    if (r) {
      const old = r.dataset.ren;
      const v = (await promptDialog('Rename group', old))?.trim();
      if (!v || v === old) return;
      commit((d) => {
        for (const c2 of d.categories) if (!c2.deleted && c2.group === old && (c2.kind === kind || c2.kind === 'both')) { c2.group = v; stamp(c2); }
        if (!d.categories.some((c2) => !c2.deleted && c2.group === old)) {
          for (const b of d.budgets) if (!b.deleted && b.group === old) { b.group = v; stamp(b); }
          d.settings.excludeGroups = d.settings.excludeGroups.map((x) => (x === old ? v : x));
        }
      });
      draw();
    }
  });
  draw();
}
ACT.gsetup = () => sheet(`<ol class="steps">
  <li>Open <b>console.cloud.google.com</b>, create a project (free, no card needed to my knowledge).</li>
  <li>Search “Google Drive API” and press <b>Enable</b>.</li>
  <li>Go to <b>APIs &amp; Services → OAuth consent screen</b>. Choose External, fill in an app name and your email, and under <b>Test users</b> add your own Google address.</li>
  <li>Go to <b>Credentials → Create credentials → OAuth client ID</b>, type <b>Web application</b>. Under <b>Authorised JavaScript origins</b> add the exact address where this app is hosted (for example <b>https://your-name.netlify.app</b>).</li>
  <li>Copy the client ID it shows and paste it here, then press <b>Back up now</b> and approve access.</li></ol>
  <p class="hint">The app asks only for its own hidden folder (drive.appdata). Google may ask you to sign in again from time to time; if auto-backup stops, tap Back up now.</p>`, { title: 'Get a Google client ID' });
