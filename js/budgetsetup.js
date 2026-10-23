// Budget setup: tick expense categories on or off, give each a monthly amount, tell Sukli which are needs, wants or luxury,
// and choose when to be warned (default 80%). Category budgets are budget records with `cat`; the older group budgets (`group`) keep working.
import { get, commit, uid, stamp, softDelete, monthParts, catMap, fmt, HOME, thisMonth } from './core.js';
import { ACT, sheet, esc, toast } from './ui.js';

export const CLASSES = { need: 'Need', want: 'Want', luxury: 'Luxury' };
const NEED = /grocer|food at home|household|utilit|rent|mortgage|electric|water|gas bill|internet|phone|mobile|transport|commute|fare|train|bus|fuel|health|medic|doctor|pharmac|insur|tax|education|school|tuition|loan|debt|child|bills?\b|fees?\b|supplies/i;
const LUXURY = /travel|vacation|trip|hotel|flight|gadget|luxur|jewel|beauty|salon|spa\b|gift|hobby|gaming|designer|watch|electronics|furniture|decor/i;
// a first guess from the names; the user can change any of them
export const guessClass = (c) => { const n = `${c.group || ''} ${c.name || ''}`; if (LUXURY.test(n)) return 'luxury'; if (NEED.test(n)) return 'need'; return 'want'; };
export const classOf = (c) => (c && CLASSES[c.need] ? c.need : c ? guessClass(c) : 'want');
export const alertPct = (db) => { const n = Number(db.settings.budgetAlertPct); return n >= 1 && n <= 150 ? n : 80; };
const money = (n) => fmt(n, HOME);

export function expenseCats(db) { return db.categories.filter((c) => !c.deleted && c.group !== 'Adjustments' && (c.kind === 'expense' || c.kind === 'both')); }
export function budgetStatus(db, ym = thisMonth()) {
  const parts = monthParts(db, ym).filter((p) => p.kind === 'expense'), cm = catMap(db);
  const byCat = new Map(), byGroup = new Map();
  for (const p of parts) { byCat.set(p.cat, (byCat.get(p.cat) || 0) + p.v); byGroup.set(p.group, (byGroup.get(p.group) || 0) + p.v); }
  const out = [];
  for (const b of db.budgets) {
    if (b.deleted || !(b.amount > 0) || b.off) continue;
    if (b.cat) { const c = cm.get(b.cat); if (!c || c.deleted) continue; const s = byCat.get(b.cat) || 0; out.push({ key: 'c:' + b.cat, label: c.name, group: c.group, kind: 'cat', budget: b.amount, spent: s, pct: s / b.amount * 100, cls: classOf(c) }); }
    else if (b.group) { const cs = expenseCats(db).filter((c) => c.group === b.group), cl = new Map(); for (const c of cs) cl.set(classOf(c), (cl.get(classOf(c)) || 0) + 1);
      const s = byGroup.get(b.group) || 0; out.push({ key: 'g:' + b.group, label: b.group, group: b.group, kind: 'group', budget: b.amount, spent: s, pct: s / b.amount * 100, cls: [...cl.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || 'want' }); }
  }
  return out;
}
// what to warn about now: everything at or past the alert percentage. Needs get a gentler message, so overspending on essentials is not made to feel like a fault.
export function budgetAlerts(db, ym = thisMonth()) {
  const lim = alertPct(db);
  return budgetStatus(db, ym).filter((x) => x.pct >= lim).sort((a, b) => b.pct - a.pct).map((x) => {
    const over = x.pct >= 100, p = Math.round(x.pct), left = x.budget - x.spent;
    const text = x.cls === 'need'
      ? (over ? `${x.label} is ${p}% of its budget. It is a need, so this is not overspending on wants; consider raising the budget to ${money(Math.ceil(x.spent / 100) * 100)}.` : `${x.label} (need) is at ${p}% of its budget, ${money(left)} left.`)
      : (over ? `${x.label} (${CLASSES[x.cls].toLowerCase()}) is over budget by ${money(-left)} (${p}% used).` : `${x.label} (${CLASSES[x.cls].toLowerCase()}) is at ${p}%: ${money(left)} left of ${money(x.budget)}.`);
    return { ...x, over, tone: x.cls === 'need' ? 'info' : over ? 'over' : 'warn', text };
  });
}
export function budgetBanner(db) {
  const a = budgetAlerts(db).filter((x) => x.kind === 'cat' || x.kind === 'group').slice(0, 2); if (!a.length) return '';
  return `<a class="banner" href="#/budget"><strong>Budget alert</strong><span>${a.map((x) => esc(x.text)).join(' ')}</span></a>`;
}
// what you spent this month by need / want / luxury, next to what you budgeted for each
export function classSplit(db, ym = thisMonth()) {
  const cm = catMap(db), spent = { need: 0, want: 0, luxury: 0 }, bud = { need: 0, want: 0, luxury: 0 };
  for (const p of monthParts(db, ym)) if (p.kind === 'expense') spent[classOf(cm.get(p.cat))] += p.v;
  for (const x of budgetStatus(db, ym)) if (x.kind === 'cat') bud[x.cls] += x.budget;
  const total = spent.need + spent.want + spent.luxury;
  return { spent, bud, total };
}
export function classCard(db, ym) {
  const s = classSplit(db, ym); if (!s.total) return '';
  const row = (k) => `<li><span>${CLASSES[k]}s</span><b>${money(s.spent[k])} <small class="muted">${Math.round(s.spent[k] / s.total * 100)}%${s.bud[k] ? ` · budget ${money(s.bud[k])}` : ''}</small></b></li>`;
  return `<ul class="calfacts">${['need', 'want', 'luxury'].map(row).join('')}</ul><p class="hint">Needs are essentials (food at home, bills, transport, health). Wants and luxury are the ones to watch. Change a category's kind in Budget setup.</p>`;
}
// after saving an entry: say so if it just pushed something past the warning line
export function newAlertsSince(before, after) { const had = new Set(before.map((x) => x.key)); return after.filter((x) => !had.has(x.key)); }

export function openBudgetSetup() {
  const db = get(), cats = expenseCats(db), spent = new Map();
  for (const p of monthParts(db, thisMonth())) if (p.kind === 'expense') spent.set(p.cat, (spent.get(p.cat) || 0) + p.v);
  const cb = new Map(db.budgets.filter((b) => !b.deleted && b.cat).map((b) => [b.cat, b]));
  const groups = new Map(); for (const c of cats) { if (!groups.has(c.group)) groups.set(c.group, []); groups.get(c.group).push(c); }
  const rowOf = (c) => { const b = cb.get(c.id), on = !!b && !b.off, cls = classOf(c);
    return `<div class="bsrow" data-cat="${c.id}"><label class="bson"><input type="checkbox" data-on ${on ? 'checked' : ''} aria-label="Budget for ${esc(c.name)}"><span>${esc(c.name)}${spent.get(c.id) ? ` <small class="muted">${money(spent.get(c.id))} this month</small>` : ''}</span></label>
      <div class="bscls" role="group" aria-label="Kind">${Object.entries(CLASSES).map(([k, l]) => `<button type="button" data-cls="${k}" class="${cls === k ? 'on' : ''}" aria-pressed="${cls === k}">${l[0]}<span>${l.slice(1)}</span></button>`).join('')}</div>
      <input class="bsamt" data-amt inputmode="decimal" placeholder="Monthly ${HOME}" value="${b && b.amount ? b.amount : ''}" ${on ? '' : 'disabled'} aria-label="Monthly budget for ${esc(c.name)}"></div>`; };
  const html = `<form id="bs" novalidate><div class="bsalert"><label class="field"><span>Warn me when a budget reaches (%)</span><input name="alert" inputmode="numeric" value="${alertPct(db)}"></label>
      <p class="hint">You will see an alert on Home and the Budget tab, and a message when an entry pushes you past this line. Needs get a gentler message.</p></div>
    <p class="hint">Tick the categories to budget, choose Need / Want / Luxury (a first guess is made from the name), and type the monthly amount.</p>
    ${[...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, l]) => { const n = l.filter((c) => cb.get(c.id) && !cb.get(c.id).off).length, open = n || l.some((c) => spent.get(c.id)); return `<details class="bsgrp" ${open ? 'open' : ''}><summary><b>${esc(g)}</b> <small class="muted">${n ? n + ' budgeted' : l.length + (l.length === 1 ? ' category' : ' categories')}</small></summary>${l.sort((a, b) => a.name.localeCompare(b.name)).map(rowOf).join('')}</details>`; }).join('')}
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save budget</button></div></form>`;
  const s = sheet(html, { title: 'Budget setup', wide: true });
  const f = s.el.querySelector('#bs');
  f.addEventListener('change', (e) => { if (e.target.matches('[data-on]')) { const r = e.target.closest('.bsrow'), a = r.querySelector('[data-amt]'); a.disabled = !e.target.checked; if (e.target.checked) a.focus(); } });
  f.addEventListener('click', (e) => { const b = e.target.closest('[data-cls]'); if (!b) return; b.parentNode.querySelectorAll('[data-cls]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); });
  s.el.querySelector('[data-x]').onclick = () => s.close();
  f.onsubmit = (e) => { e.preventDefault();
    const pct = Math.round(Number(String(f.alert.value).replace(/[^\d.]/g, '')) || 80);
    const rows = [...f.querySelectorAll('.bsrow')].map((r) => ({ id: r.dataset.cat, on: r.querySelector('[data-on]').checked, amt: parseFloat(String(r.querySelector('[data-amt]').value).replace(/,/g, '')) || 0, cls: (r.querySelector('[data-cls].on') || {}).dataset?.cls }));
    let n = 0;
    commit((d) => { d.settings.budgetAlertPct = Math.min(150, Math.max(1, pct));
      for (const r of rows) { const c = d.categories.find((x) => x.id === r.id); if (c && r.cls && c.need !== r.cls && !(r.cls === guessClass(c) && !c.need)) { c.need = r.cls; stamp(c); }
        const b = d.budgets.find((x) => !x.deleted && x.cat === r.id);
        if (r.on && r.amt > 0) { n++; if (b) { b.amount = r.amt; delete b.off; stamp(b); } else d.budgets.push(stamp({ id: uid(), cat: r.id, amount: r.amt })); }
        else if (b) softDelete(b); } });
    s.close(); toast(n ? `Budget saved for ${n} ${n === 1 ? 'category' : 'categories'}. Warning at ${pct}%.` : 'Budget saved. No categories are ticked.'); };
}
ACT['budget-setup'] = () => openBudgetSetup();
