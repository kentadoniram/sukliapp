// Analytics dashboard: income vs expenses, where the money went, net worth, budgets, period comparison.
// Every figure comes from monthParts(), so it matches the rest of the app (transfers and left-out groups are not double counted).
import { get, monthParts, shiftMonth, latestMonth, balances, rateFor, accountMap, catMap, BASE, CUR } from './core.js';
import { hdr, money, row } from './screens.js';
import { cardInfo } from './finance.js';
import { ACT, esc, sheet } from './ui.js';

const A = { n: 6, acct: '', cur: '', group: '' };      // n = months shown, ending at the latest month with data
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mlabel = (ym) => MON[+ym.slice(5, 7) - 1] + (ym.slice(5, 7) === '01' ? ' ' + ym.slice(2, 4) : '');
const months = (db, n = A.n, end = latestMonth(db)) => Array.from({ length: n }, (_, i) => shiftMonth(end, i - n + 1));
const keep = (p) => (!A.acct || (p.acct || p.t.acct) === A.acct) && (!A.cur || p.t.cur === A.cur) && (!A.group || p.group === A.group);
const parts = (db, ms) => ms.flatMap((m) => monthParts(db, m).filter(keep).map((p) => ({ ...p, m })));
const sum = (l) => l.reduce((s, p) => s + p.v, 0);
const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

function bars(db, ms, ps) {
  const data = ms.map((m) => ({ m, inc: sum(ps.filter((p) => p.m === m && p.kind === 'income')), out: sum(ps.filter((p) => p.m === m && p.kind !== 'income')) }));
  const max = Math.max(1, ...data.flatMap((d) => [d.inc, d.out])), W = 340, H = 140, bw = Math.min(16, W / data.length / 2.6);
  return `<svg viewBox="0 0 ${W} ${H + 22}" class="chart" role="img" aria-label="Income and expenses by month">${data.map((d, i) => {
    const x = (i + 0.5) * (W / data.length), hi = (d.inc / max) * H, ho = (d.out / max) * H;
    return `<g><rect data-act="an-drill" data-k="income" data-m="${d.m}" x="${x - bw - 1}" y="${H - hi}" width="${bw}" height="${hi}" rx="3" fill="var(--good, #2e9e6b)"><title>${esc(d.m)} income ${esc(money(d.inc))}</title></rect>
      <rect data-act="an-drill" data-k="expense" data-m="${d.m}" x="${x + 1}" y="${H - ho}" width="${bw}" height="${ho}" rx="3" fill="var(--bad, #d9534f)"><title>${esc(d.m)} spent ${esc(money(d.out))}</title></rect>
      <text x="${x}" y="${H + 14}" text-anchor="middle" font-size="10" fill="currentColor">${mlabel(d.m)}</text></g>`;
  }).join('')}</svg>`;
}
function hbars(list, attr, total) {
  const max = Math.max(1, ...list.map((x) => x.v));
  return list.map((x) => `<button type="button" class="hbar" data-act="an-drill" ${attr}="${esc(x.k)}"><span class="hl">${esc(x.k)}</span><span class="hb"><i style="width:${Math.max(2, (x.v / max) * 100)}%"></i></span><span class="hv">${money(x.v)} <small>${total ? Math.round((x.v / total) * 100) : 0}%</small></span></button>`).join('');
}
function group(ps, f) { const m = new Map(); for (const p of ps) m.set(f(p), (m.get(f(p)) || 0) + p.v); return [...m].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v); }

function netline(db, ms) {
  const accts = db.accounts.filter((a) => !a.deleted && (!A.acct || a.id === A.acct) && (!A.cur || a.cur === A.cur));
  const pts = ms.map((m) => { const b = balances(db, m + '-31 23:59:59'); return accts.reduce((s, a) => s + (b.get(a.id) || 0) * (rateFor(db, a.cur) || 1), 0); });
  const lo = Math.min(...pts), hi = Math.max(...pts), W = 340, H = 90, y = (v) => H - ((v - lo) / ((hi - lo) || 1)) * (H - 10) - 5;
  const xy = pts.map((v, i) => `${(i + 0.5) * (W / pts.length)},${y(v)}`).join(' ');
  return { pts, svg: `<svg viewBox="0 0 ${W} ${H + 18}" class="chart" role="img" aria-label="Net worth by month"><polyline points="${xy}" fill="none" stroke="var(--line, #4a7)" stroke-width="2.5"/>${pts.map((v, i) => `<circle cx="${(i + 0.5) * (W / pts.length)}" cy="${y(v)}" r="3.5" fill="var(--line, #4a7)"><title>${esc(ms[i])} ${esc(money(v))}</title></circle><text x="${(i + 0.5) * (W / pts.length)}" y="${H + 14}" text-anchor="middle" font-size="10" fill="currentColor">${mlabel(ms[i])}</text>`).join('')}</svg>` };
}

export function analytics(db) {
  const ms = months(db), prev = months(db, A.n, shiftMonth(ms[0], -1));
  const ps = parts(db, ms), pp = parts(db, prev);
  const inc = sum(ps.filter((p) => p.kind === 'income')), out = sum(ps.filter((p) => p.kind !== 'income'));
  const pInc = sum(pp.filter((p) => p.kind === 'income')), pOut = sum(pp.filter((p) => p.kind !== 'income'));
  const ex = ps.filter((p) => p.kind !== 'income'), nw = netline(db, ms);
  const dl = (a, b, bad) => { const d = pct(a, b); return d == null ? '' : `<small class="${(d > 0) === !!bad ? 'neg' : 'pos'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}% vs previous ${A.n} mo</small>`; };
  const ids = [...new Set(db.accounts.filter((a) => !a.deleted).map((a) => a.cur))], groups = [...new Set(db.categories.filter((c) => !c.deleted && c.kind !== 'income').map((c) => c.group))].sort();
  const sel = (k, label, opts) => `<label class="field"><span>${label}</span><select data-an="${k}"><option value="">All</option>${opts.map(([v, t]) => `<option value="${esc(v)}" ${A[k] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const lastM = ms[ms.length - 1], bud = db.budgets.filter((b) => !b.deleted && b.amount > 0).map((b) => ({ g: b.group, lim: b.amount, v: sum(monthParts(db, lastM).filter((p) => p.kind !== 'income' && p.group === b.group)) })).sort((a, b) => b.v / b.lim - a.v / a.lim);
  return `${hdr('Analytics')}
  <div class="rangebar seg sm" role="group" aria-label="Period">${[3, 6, 12].map((n) => `<button type="button" data-act="an-range" data-n="${n}" class="${A.n === n ? 'on' : ''}" aria-pressed="${A.n === n}">${n} months</button>`).join('')}</div>
  <div class="two">${sel('acct', 'Account', db.accounts.filter((a) => !a.deleted).map((a) => [a.id, a.name]))}${sel('cur', 'Currency', ids.map((c) => [c, c]))}</div>
  ${sel('group', 'Category group', groups.map((g) => [g, g]))}
  <div class="facts"><div><span>Income</span><b class="in">${money(inc)}</b>${dl(inc, pInc, false)}</div><div><span>Spent</span><b>${money(out)}</b>${dl(out, pOut, true)}</div><div><span>Net</span><b>${money(inc - out)}</b><small>${inc > 0 ? Math.round(((inc - out) / inc) * 100) + '% saved' : ''}</small></div></div>
  <section><h2>Income vs expenses</h2><p class="hint">Tap a bar to see its entries.</p>${bars(db, ms, ps)}</section>
  <section><h2>Where it went</h2>${ex.length ? hbars(group(ex, (p) => p.group).slice(0, 8).map((x) => ({ ...x })), 'data-g', out) : '<p class="empty">No spending in this period.</p>'}</section>
  <section><h2>By account</h2>${ex.length ? hbars(group(ex, (p) => (accountMap(db).get(p.acct || p.t.acct) || { name: 'Unknown' }).name).map((x) => ({ ...x })), 'data-a', out) : ''}</section>
  <section><h2>Net worth</h2><p class="hint">Month-end balances at today's rates. Now: ${money(nw.pts[nw.pts.length - 1])}</p>${nw.svg}</section>
  ${(() => { const cards = db.accounts.filter((a) => !a.deleted && !a.archived && a.type === 'card').map((a) => ({ a, c: cardInfo(db, a) })).filter((x) => x.c.owed > 0 || (x.c.cycle && x.c.cycle.amountDue > 0)); if (!cards.length) return ''; return `<section><h2>Credit cards</h2><p class="hint">Owed now: ${money(cards.reduce((n, x) => n + x.c.owed * (rateFor(db, x.a.cur) || 1), 0))}</p>${cards.map(({ a, c }) => `<button type="button" class="hbar cardrow" data-act="acct" data-id="${a.id}"><span class="hl">${esc(a.name)}</span><span class="hb"><i style="width:${c.used == null ? 0 : c.used}%"></i></span><span class="hv">${money(c.owed, a.cur)}<small>${c.cycle && c.cycle.amountDue > 0 ? ' · pay ' + money(c.cycle.amountDue, a.cur) + ' by ' + c.cycle.dueDate.slice(5) : ''}</small></span></button>`).join('')}</section>`; })()}
  ${bud.length ? `<section><h2>Budgets, ${mlabel(lastM)}</h2>${bud.map((b) => `<div class="bud"><span>${esc(b.g)}</span><span class="hb"><i style="width:${Math.min(100, (b.v / b.lim) * 100)}%;${b.v > b.lim ? 'background:var(--bad,#d9534f)' : ''}"></i></span><small>${money(b.v)} / ${money(b.lim)}</small></div>`).join('')}</section>` : ''}`;
}

ACT['an-range'] = (el) => { A.n = +el.dataset.n; window.dispatchEvent(new Event('sukli-render')); };
document.addEventListener('change', (e) => { const k = e.target.dataset && e.target.dataset.an; if (k) { A[k] = e.target.value; window.dispatchEvent(new Event('sukli-render')); } });
ACT['an-drill'] = (el) => {
  const db = get(), ms = el.dataset.m ? [el.dataset.m] : months(db);
  let ps = parts(db, ms);
  const d = el.dataset;
  if (d.k) ps = ps.filter((p) => (d.k === 'income') === (p.kind === 'income'));
  else ps = ps.filter((p) => p.kind !== 'income');
  if (d.g) ps = ps.filter((p) => p.group === d.g);
  if (d.a) ps = ps.filter((p) => (accountMap(db).get(p.acct || p.t.acct) || { name: 'Unknown' }).name === d.a);
  const txs = [...new Map(ps.map((p) => [p.t.id, p.t])).values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const am = accountMap(db), cm = catMap(db), title = [d.m, d.g, d.a, d.k === 'income' ? 'Income' : ''].filter(Boolean).join(' · ') || 'Entries';
  sheet(`<p class="hint">${txs.length} entries · ${money(sum(ps))}</p><div class="rows plain">${txs.slice(0, 60).map((t) => row(t, am, cm)).join('') || '<p class="empty">Nothing here.</p>'}</div>${txs.length > 60 ? '<p class="hint">Showing the latest 60.</p>' : ''}`, { title });
};
