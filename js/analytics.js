// Analytics dashboard: interactive replacement for Reports. Every number can be tapped to see the entries behind it.
import { get, fmt, HOME, partsBetween, balances, homeFx, live, catMap, accountMap, shiftMonth, groupColor, monthLabel, CUR } from './core.js';
import { today, cardBilling, isLiability, safetyCfg } from './finance.js';
import { esc, ic, ACT, sheet } from './ui.js';
import { hdr, coll, ui } from './screens.js';
import { openDatePicker } from './datepicker.js';

const A = { range: '30d', from: '', to: '', acct: '', cur: '', group: '', cat: '', by: 'group', prev: false };
const money = (n, c = HOME) => fmt(n, c, { round: true });
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const addDays = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

const eom = (ym) => { const [y, m] = ym.split('-').map(Number); return ym + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0'); };   // real last day: 28, 29, 30 or 31
function period() {
  const t = today(), ym = t.slice(0, 7);
  let from, to = t;
  switch (A.range) {
    case '7d': from = addDays(t, -6); break;
    case '30d': from = addDays(t, -29); break;
    case 'm': from = ym + '-01'; to = eom(ym); break;
    case 'pm': { const p = shiftMonth(ym, -1); from = p + '-01'; to = eom(p); break; }
    case '3m': from = shiftMonth(ym, -2) + '-01'; break;
    case '6m': from = shiftMonth(ym, -5) + '-01'; break;
    case 'y': from = ym.slice(0, 4) + '-01-01'; break;
    case 'custom': from = A.from || addDays(t, -29); to = A.to || t; break;
    default: from = addDays(t, -29);
  }
  if (to > t && A.range !== 'm' && A.range !== 'pm') to = t;
  const real = to > t ? t : to;
  const days = Math.max(1, diffDays(from, real > to ? to : real) + 1);
  // the matching earlier period of equal length
  const pTo = addDays(from, -1), pFrom = addDays(from, -days);
  return { from, to, days, pFrom, pTo };
}
function filt(parts) {
  const db = get(), am = accountMap(db);
  return parts.filter((p) => {
    const a = am.get(p.t.acct);
    if (A.acct && p.t.acct !== A.acct && !(p.t.kind === 'transfer' && p.t.toAcct === A.acct)) return false;
    if (A.cur && (!a || a.cur !== A.cur)) return false;
    if (A.group && p.group !== A.group) return false;
    if (A.cat && p.cat !== A.cat) return false;
    return true;
  });
}
const inc = (ps) => sum(ps.filter((p) => p.kind === 'income').map((p) => p.v));
const exp = (ps) => sum(ps.filter((p) => p.kind === 'expense').map((p) => p.v));

// ---- drill-down: the entries behind any number ----
let LAST = [];
export function openTxList(title, parts) {
  const db = get(), cm = catMap(db), am = accountMap(db);
  const rows = parts.slice().sort((a, b) => (a.t.date < b.t.date ? 1 : -1));
  const total = sum(rows.map((p) => (p.kind === 'income' ? p.v : -p.v)));
  const s = sheet(`<p class="hint">${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} · net <b class="${total < 0 ? 'neg' : 'in'}">${money(total)}</b></p>
    <div class="rows plain">${rows.slice(0, 200).map((p) => { const c = cm.get(p.cat), a = am.get(p.t.acct);
      return `<button class="row" data-act="edit" data-id="${p.t.id}"><i class="badge sm" style="background:${groupColor(p.group)}">${esc((p.group || '?')[0])}</i>
        <span class="rmain"><strong>${esc(p.label || p.t.name || (c ? c.name : 'Entry'))}</strong><small>${esc(p.t.date.slice(0, 10))} · ${esc(c ? c.name : '')}${a ? ' · ' + esc(a.name) : ''}</small></span>
        <span class="ramt ${p.kind === 'income' ? 'income' : 'expense'}"><b>${p.kind === 'income' ? '+' : '−'}${money(p.v)}</b></span></button>`; }).join('') || '<p class="empty">Nothing here.</p>'}</div>
    ${rows.length > 200 ? '<p class="hint">Showing the 200 newest.</p>' : ''}`, { title, wide: true });
  return s;
}

function buckets(from, to, days) {
  const out = [];
  if (days <= 45) for (let d = from; d <= to; d = addDays(d, 1)) out.push({ a: d, b: d, l: d.slice(5) });
  else if (days <= 200) for (let d = from; d <= to; d = addDays(d, 7)) out.push({ a: d, b: addDays(d, 6) > to ? to : addDays(d, 6), l: d.slice(5) });
  else { let m = from.slice(0, 7); while (m <= to.slice(0, 7)) { out.push({ a: m + '-01', b: m + '-31', l: m.slice(2) }); m = shiftMonth(m, 1); } }
  return out;
}

function pickerOptions(db) {
  const accts = live(db.accounts).filter((a) => !a.archived);
  const curs = [...new Set(accts.map((a) => a.cur))];
  const groups = [...new Set(db.categories.filter((c) => !c.deleted).map((c) => c.group))].sort();
  return { accts, curs, groups };
}

export function analytics(db) {
  const P = period(), cm = catMap(db), am = accountMap(db);
  const parts = filt(partsBetween(db, P.from, P.to)), prevParts = filt(partsBetween(db, P.pFrom, P.pTo));
  const I = inc(parts), E = exp(parts), pI = inc(prevParts), pE = exp(prevParts);
  const delta = (cur, prev, goodUp) => { if (!prev) return '<small class="muted">no earlier data</small>'; const d = (cur - prev) / prev * 100; const good = goodUp ? d >= 0 : d <= 0; return `<small class="${good ? 'in' : 'neg'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(d))}% vs earlier</small>`; };
  const { accts, curs, groups } = pickerOptions(db);
  const presets = [['7d', '7 days'], ['30d', '30 days'], ['m', 'This month'], ['pm', 'Last month'], ['3m', '3 months'], ['6m', '6 months'], ['y', 'This year'], ['custom', 'Custom']];
  const filters = `<div class="afilters"><div class="seg sm scrollx" role="group" aria-label="Period">${presets.map(([v, l]) => `<button type="button" data-act="an-range" data-v="${v}" class="${A.range === v ? 'on' : ''}" aria-pressed="${A.range === v}">${l}</button>`).join('')}</div>
    ${A.range === 'custom' ? `<div class="two"><button type="button" class="whenbtn" data-act="an-from"><span>${esc(P.from)}</span>${ic('calendar')}</button><button type="button" class="whenbtn" data-act="an-to"><span>${esc(P.to)}</span>${ic('calendar')}</button></div>` : ''}
    <div class="three"><select data-an="acct" aria-label="Account"><option value="">All accounts</option>${accts.map((a) => `<option value="${a.id}" ${A.acct === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
      <select data-an="cur" aria-label="Currency"><option value="">All currencies</option>${curs.map((c) => `<option ${A.cur === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <select data-an="group" aria-label="Category group"><option value="">All categories</option>${groups.map((g) => `<option ${A.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
    <select data-an="cat" aria-label="Category"><option value="">Any category</option>${groups.map((g) => `<optgroup label="${esc(g)}">${db.categories.filter((c) => !c.deleted && c.group === g).map((c) => `<option value="${c.id}" ${A.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('')}</select>
    <small class="muted">${esc(P.from)} to ${esc(P.to > today() ? today() : P.to)} · amounts in ${HOME}. Transfers and card payments are not counted as income or spending.</small></div>`;

  const tile = (k, label, v, d, cls = '') => `<button class="tile" data-act="an-list" data-k="${k}"><span>${label}</span><b class="${cls}">${money(v)}</b>${d}</button>`;
  const rate = I > 0 ? Math.round((I - E) / I * 100) : null;
  const kpis = `<div class="tiles">${tile('inc', 'Income', I, delta(I, pI, true), 'in')}${tile('exp', 'Spending', E, delta(E, pE, false))}${tile('net', 'Net', I - E, delta(I - E, pI - pE, true), I - E < 0 ? 'neg' : 'in')}
    <div class="tile static"><span>Saved</span><b>${rate == null ? '—' : rate + '%'}</b><small class="muted">of income</small></div></div>`;

  // income vs expenses
  const bk = buckets(P.from, P.to > today() ? today() : P.to, P.days);
  const bd = bk.map((b) => { const ps = parts.filter((p) => { const d = p.t.date.slice(0, 10); return d >= b.a && d <= b.b; }); return { ...b, i: inc(ps), e: exp(ps) }; });
  const W = 320, H = 130, top = Math.max(1, ...bd.map((x) => Math.max(x.i, x.e))), bw = W / Math.max(1, bd.length);
  const bars = bd.map((x, n) => { const hi = x.i / top * (H - 26), he = x.e / top * (H - 26), g = Math.min(bw - 2, 14) / 2;
    return `<g data-tip="${esc(`${x.l}: in ${money(x.i)} · out ${money(x.e)}`)}" data-act="an-bucket" data-a="${x.a}" data-b="${x.b}" role="button" tabindex="0"><rect x="${n * bw}" y="0" width="${bw}" height="${H}" fill="transparent"/>
      <rect x="${n * bw + bw / 2 - g * 2}" y="${H - 16 - hi}" width="${g * 2 - 0.5}" height="${hi}" fill="var(--in)"/><rect x="${n * bw + bw / 2 + 0.5}" y="${H - 16 - he}" width="${g * 2 - 0.5}" height="${he}" fill="var(--bad)"/>
      ${bd.length <= 12 || n % Math.ceil(bd.length / 8) === 0 ? `<text x="${n * bw + bw / 2}" y="${H - 3}" text-anchor="middle" class="axis">${x.l}</text>` : ''}</g>`; }).join('');
  const incExp = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and spending over time. Tap a bar to see its entries."><line x1="0" x2="${W}" y1="${H - 16}" y2="${H - 16}" stroke="var(--rule)"/>${bars}</svg>
    <p class="hint"><i class="dot" style="background:var(--in)"></i> Income <i class="dot" style="background:var(--bad)"></i> Spending · tap a bar for its entries</p>`;

  // cash-flow and net worth lines
  const bal0 = (asOf) => { const b = balances(db, asOf + ' 23:59:59'); let nw = 0; for (const a of live(db.accounts)) { if (a.archived && !(b.get(a.id) || 0)) continue; if (A.acct && a.id !== A.acct) continue; if (A.cur && a.cur !== A.cur) continue; nw += (b.get(a.id) || 0) * (homeFx(db, a.cur) || 0); } return nw; };
  let cum = 0;
  const cf = bd.map((x) => { cum += x.i - x.e; return { l: x.l, v: cum }; });
  const nwS = bd.map((x) => ({ l: x.l, v: bal0(x.b > today() ? today() : x.b) }));
  const line = (series, label) => {
    if (!series.length) return '<p class="empty">No data.</p>';
    const lo = Math.min(...series.map((x) => x.v), 0), hi = Math.max(...series.map((x) => x.v), 0.0001), sp = hi - lo || 1;
    const X = (i) => 4 + i / Math.max(1, series.length - 1) * (W - 8), Y = (v) => 110 - 8 - (v - lo) / sp * 90;
    const pts = series.map((x, i) => [+X(i).toFixed(1), +Y(x.v).toFixed(1), x.l, money(x.v)]);
    const path = series.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x.v).toFixed(1)}`).join('');
    return `<svg class="chart scrub" data-pts="${esc(JSON.stringify(pts))}" viewBox="0 0 ${W} 110" role="img" aria-label="${label}. Touch and drag to read."><line x1="0" x2="${W}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="var(--rule)" stroke-dasharray="3 3"/><path d="${path}" fill="none" stroke="var(--line)" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
  };

  // breakdowns
  const exps = parts.filter((p) => p.kind === 'expense');
  const keyOf = { group: (p) => p.group || 'Uncategorized', category: (p) => (cm.get(p.cat) || { name: 'Uncategorized' }).name, account: (p) => (am.get(p.t.acct) || { name: '?' }).name,
    weekday: (p) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(p.t.date.slice(0, 10) + 'T00:00:00Z').getUTCDay()], currency: (p) => (am.get(p.t.acct) || { cur: '?' }).cur }[A.by];
  const m = new Map(); for (const p of exps) { const k = keyOf(p); m.set(k, (m.get(k) || 0) + p.v); }
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12), mx = rows.length ? rows[0][1] : 1;
  const breakdown = `<div class="seg sm scrollx" role="group" aria-label="Group by">${[['group', 'Group'], ['category', 'Category'], ['account', 'Account'], ['weekday', 'Weekday'], ['currency', 'Currency']].map(([v, l]) => `<button type="button" data-act="an-by" data-v="${v}" class="${A.by === v ? 'on' : ''}" aria-pressed="${A.by === v}">${l}</button>`).join('')}</div>
    ${rows.map(([k, v]) => `<button class="gbar" data-act="an-key" data-k="${esc(k)}" data-tip="${esc(`${k}: ${money(v)}`)}"><i class="badge sm" style="background:${groupColor(k)}">${esc(k[0])}</i><div class="gmain"><div class="gtop"><span>${esc(k)} <small class="pct">${E ? Math.round(v / E * 100) : 0}%</small></span><b>${money(v)}</b></div><div class="track"><div class="fill" style="width:${Math.max(2, v / mx * 100)}%;background:${groupColor(k)}"></div></div></div></button>`).join('') || '<p class="empty">No spending in this period.</p>'}`;

  // budgets + spending limit
  const monthKey = (P.to > today() ? today() : P.to).slice(0, 7);
  const monthExp = partsBetween(db, monthKey + '-01', monthKey + '-31').filter((p) => p.kind === 'expense');
  const buds = db.budgets.filter((b) => !b.deleted && b.amount > 0).map((b) => { const sp = sum(monthExp.filter((p) => p.group === b.group).map((p) => p.v)); return { g: b.group, lim: b.amount, sp, pct: sp / b.amount * 100 }; }).sort((a, b) => b.pct - a.pct);
  const cfg = safetyCfg(db);
  const monthTotal = sum(monthExp.map((p) => p.v));
  const gauge = cfg.limit > 0 ? `<div class="gbar static"><div class="gmain"><div class="gtop"><span>Spending limit (${cfg.mode === 'rolling' ? 'last 30 days' : monthLabel(monthKey)})</span><b>${money(monthTotal)} / ${money(cfg.limit)}</b></div><div class="track"><div class="fill" style="width:${Math.min(100, monthTotal / cfg.limit * 100)}%;background:${monthTotal > cfg.limit ? 'var(--bad)' : monthTotal >= cfg.limit * cfg.warnPct / 100 ? 'var(--warn)' : 'var(--in)'}"></div></div></div></div>` : '<p class="hint">Set an overall spending limit in Settings, Spending safety, to track it here.</p>';
  const budgets = `${gauge}${buds.map((b) => `<button class="gbar" data-act="an-key" data-k="${esc(b.g)}"><i class="badge sm" style="background:${groupColor(b.g)}">${esc(b.g[0])}</i><div class="gmain"><div class="gtop"><span>${esc(b.g)} <small class="pct ${b.pct > 100 ? 'neg' : ''}">${Math.round(b.pct)}%</small></span><b>${money(b.sp)} / ${money(b.lim)}</b></div><div class="track"><div class="fill" style="width:${Math.min(100, b.pct)}%;background:${b.pct > 100 ? 'var(--bad)' : b.pct >= 80 ? 'var(--warn)' : 'var(--in)'}"></div></div></div></button>`).join('') || '<p class="hint">No budgets yet. Set them on the Budget page.</p>'}`;

  // credit cards
  const bal = balances(db);
  const cards = live(db.accounts).filter((a) => a.type === 'card' && !a.archived).map((a) => ({ a, c: cardBilling(db, a, bal.get(a.id)) }));
  const owedTotal = sum(cards.map(({ a, c }) => c.owed * (homeFx(db, a.cur) || 0))), dueTotal = sum(cards.map(({ a, c }) => c.dueAmount * (homeFx(db, a.cur) || 0)));
  const cardsHtml = cards.length ? `<div class="facts"><div><span>Total owed</span><b>${money(owedTotal)}</b></div><div><span>Due this cycle</span><b>${money(dueTotal)}</b></div></div>
    ${cards.sort((x, y) => (x.c.days ?? 999) - (y.c.days ?? 999)).map(({ a, c }) => `<button class="row" data-act="acct" data-id="${a.id}"><i class="badge sm" style="background:var(--ink2)">${ic('wallet')}</i><span class="rmain"><strong>${esc(a.name)}</strong><small>${c.due ? (c.overdue ? 'Overdue since ' : c.dueAmount > 0.005 ? 'Due ' : 'Next due ') + c.due : 'No due date set'}${c.used != null ? ' · ' + c.used + '% of limit' : ''}</small></span><span class="ramt"><b>${money(c.dueAmount, a.cur)}</b><small>of ${money(c.owed, a.cur)} owed</small></span></button>`).join('')}` : '<p class="hint">No credit cards yet.</p>';

  // period comparison
  const gm = (ps) => { const mm = new Map(); for (const p of ps.filter((x) => x.kind === 'expense')) mm.set(p.group || 'Uncategorized', (mm.get(p.group || 'Uncategorized') || 0) + p.v); return mm; };
  const now = gm(parts), before = gm(prevParts);
  const keys = [...new Set([...now.keys(), ...before.keys()])].sort((a, b) => (now.get(b) || 0) + (before.get(b) || 0) - (now.get(a) || 0) - (before.get(a) || 0)).slice(0, 8);
  const compare = `<p class="hint">${esc(P.pFrom)} to ${esc(P.pTo)} compared with the period above.</p><table class="cmp"><thead><tr><th></th><th>Earlier</th><th>Now</th><th>Change</th></tr></thead><tbody>
    <tr><td>Income</td><td>${money(pI)}</td><td>${money(I)}</td><td>${pI ? Math.round((I - pI) / pI * 100) + '%' : '—'}</td></tr><tr><td>Spending</td><td>${money(pE)}</td><td>${money(E)}</td><td>${pE ? Math.round((E - pE) / pE * 100) + '%' : '—'}</td></tr>
    ${keys.map((k) => { const a = before.get(k) || 0, b = now.get(k) || 0; return `<tr><td>${esc(k)}</td><td>${money(a)}</td><td>${money(b)}</td><td class="${b > a ? 'neg' : 'in'}">${a ? Math.round((b - a) / a * 100) + '%' : 'new'}</td></tr>`; }).join('')}</tbody></table>`;

  const top5 = exps.slice().sort((a, b) => b.v - a.v).slice(0, 8);
  const topHtml = `<div class="rows plain">${top5.map((p) => `<button class="row" data-act="edit" data-id="${p.t.id}"><i class="badge sm" style="background:${groupColor(p.group)}">${esc((p.group || '?')[0])}</i><span class="rmain"><strong>${esc(p.label || p.t.name || 'Entry')}</strong><small>${esc(p.t.date.slice(0, 10))} · ${esc(p.group)}</small></span><span class="ramt expense"><b>${money(p.v)}</b></span></button>`).join('') || '<p class="empty">Nothing yet.</p>'}</div>`;

  LAST = { parts, P };
  return `${hdr('Analytics')}${filters}${kpis}
    ${coll('an-ie', 'Income vs spending', incExp)}${coll('an-cf', 'Cash flow (running net)', line(cf, 'Running net cash flow'))}${coll('an-nw', 'Net worth', line(nwS, 'Net worth'))}
    ${coll('an-by', 'Where the money went', breakdown)}${coll('an-bud', 'Budgets and limit', budgets)}${coll('an-card', 'Credit cards', cardsHtml)}${coll('an-cmp', 'Compared with the earlier period', compare)}${coll('an-top', 'Biggest expenses', topHtml)}`;
}

const redraw = () => window.dispatchEvent(new Event('sukli-render'));
ACT['an-range'] = (el) => { A.range = el.dataset.v; redraw(); };
ACT['an-by'] = (el) => { A.by = el.dataset.v; redraw(); };
ACT['an-from'] = () => { const P = period(); openDatePicker(P.from + ' 00:00:00', (v) => { A.from = v.slice(0, 10); if (A.to && A.to < A.from) A.to = A.from; redraw(); }, { time: false, title: 'From date' }); };
ACT['an-to'] = () => { const P = period(); openDatePicker(P.to + ' 00:00:00', (v) => { A.to = v.slice(0, 10); if (A.from && A.to < A.from) A.from = A.to; redraw(); }, { time: false, title: 'To date' }); };
ACT['an-list'] = (el) => { const k = el.dataset.k, ps = LAST.parts; openTxList({ inc: 'Income', exp: 'Spending', net: 'Income and spending' }[k], ps.filter((p) => k === 'net' || (k === 'inc' ? p.kind === 'income' : p.kind === 'expense'))); };
ACT['an-bucket'] = (el) => { const a = el.dataset.a, b = el.dataset.b; openTxList(`${a === b ? a : a + ' to ' + b}`, LAST.parts.filter((p) => { const d = p.t.date.slice(0, 10); return d >= a && d <= b; })); };
ACT['an-key'] = (el) => {
  const k = el.dataset.k, db = get(), cm = catMap(db), am = accountMap(db);
  const f = { group: (p) => (p.group || 'Uncategorized') === k, category: (p) => (cm.get(p.cat) || { name: 'Uncategorized' }).name === k, account: (p) => (am.get(p.t.acct) || { name: '?' }).name === k,
    weekday: (p) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(p.t.date.slice(0, 10) + 'T00:00:00Z').getUTCDay()] === k, currency: (p) => (am.get(p.t.acct) || {}).cur === k }[A.by];
  const isBudget = el.closest('.coll') && el.closest('.coll').innerHTML.includes('an-bud');
  openTxList(k, LAST.parts.filter((p) => p.kind === 'expense' && (isBudget ? (p.group || 'Uncategorized') === k : f(p))));
};
document.addEventListener('change', (e) => { const s = e.target.closest && e.target.closest('[data-an]'); if (s) { A[s.dataset.an] = s.value; redraw(); } });
