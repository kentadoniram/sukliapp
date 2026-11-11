// Borrowing report, income check and buying check. Plain sums of your own entries; nothing here tells you to buy or sell.
import { get, commit, homeFx, fmt, HOME, thisMonth, shiftMonth, catMap, balances } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { textField, button } from './components.js';
import { learnMonths } from './debtplan.js';
import { tradeBook } from './tradecalc.js';
import { tokenPerformance } from './tokenperf.js';

const live = (l) => l.filter((x) => !x.deleted);
const money = (n) => fmt(n, HOME);
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ym) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;

// ---------- borrowed vs paid vs interest, month by month ----------
export function borrowReport(db, months = 6, nowYm = thisMonth()) {
  const cm = catMap(db), rows = [];
  for (let i = months - 1; i >= 0; i--) rows.push({ ym: shiftMonth(nowYm, -i), borrowed: 0, paid: 0, interest: 0 });
  const by = new Map(rows.map((r) => [r.ym, r]));
  for (const t of live(db.txs)) {
    const r = by.get(String(t.date).slice(0, 7)); if (!r) continue;
    if (t.kind === 'transfer' && t.debtBorrow) r.borrowed += t.amount * (homeFx(db, t.cur) || 1);
    else if (t.kind === 'transfer' && t.debtPay) r.paid += t.amount * (homeFx(db, t.cur) || 1);
    else if (t.kind === 'expense') { const c = cm.get(t.cat); if (c && c.group === 'Financial loss' && /^Charged on /.test(t.notes || '')) r.interest += t.amount * (t.fx || 1); }
  }
  // a month is flagged when you borrowed about as much as you paid back in the same month (the new loan may be paying the old one)
  for (const r of rows) r.flag = r.borrowed > 0 && r.paid > 0 && r.borrowed >= r.paid * 0.5;
  const flagged = rows.filter((r) => r.flag).length, recent = rows.slice(-3).filter((r) => r.flag).length;
  const any = rows.some((r) => r.borrowed || r.paid || r.interest);
  return { rows, any, flagged, repeated: recent >= 2, totals: { borrowed: sum(rows, 'borrowed'), paid: sum(rows, 'paid'), interest: sum(rows, 'interest') } };
}
const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0);

export function borrowCard(db) {
  const rep = borrowReport(db); if (!rep.any) return '';
  const body = [...rep.rows].reverse().map((r) => `<li class="${r.flag ? 'cr' : ''}"><span>${monthName(r.ym)}</span><b>Borrowed ${money(r.borrowed)} · Paid ${money(r.paid)} · Interest ${money(r.interest)}</b></li>`).join('');
  const note = rep.repeated
    ? '<p class="lpwarn" data-borrow-flag>In 2 or more of the last 3 months you borrowed about as much as you paid back. That can mean new borrowing is covering old payments. It is only a pattern in your entries, not a judgement. If it is true, it may help to talk with your lender about easier terms.</p>'
    : '<p class="hint">Borrowed and paid are the entries you marked as Borrow and Pay debt. Interest is the charges you saved as Financial loss on a loan or card.</p>';
  return `<section class="cardbox" data-borrow><h3>Borrowed, Paid and Interest</h3><ul class="calfacts">${body}</ul>${note}</section>`;
}

// ---------- income: typed vs what your entries show ----------
export function incomeCheck(db, learned) {
  const typed = +db.settings.incomeTyped > 0 ? +db.settings.incomeTyped : null;
  const seen = learned && learned.income > 0 ? learned : null;
  const thin = !!seen && seen.months < 2;
  let state = 'none', diff = 0;
  if (typed && seen) { diff = (seen.income - typed) / typed; state = Math.abs(diff) <= 0.2 ? 'match' : 'differs'; }
  else if (typed) state = 'typed';
  else if (seen) state = 'seen';
  return { typed, seen: seen ? seen.income : null, months: seen ? seen.months : 0, thin, state, diff };
}
export function incomeCard(db, learned) {
  const c = incomeCheck(db, learned);
  const line = {
    none: 'Sukli has no income to plan with yet. Add income entries, or type your usual monthly income.',
    typed: `You typed ${money(c.typed)} a month. Sukli has no income entries from the last 3 months yet, so it plans with your figure.`,
    seen: `From your entries, about ${money(c.seen)} comes in each month (${c.months} month${c.months > 1 ? 's' : ''} seen).${c.thin ? ' That is not many months, so treat it as a rough guess.' : ''}`,
    match: `You typed ${money(c.typed)} and your entries show about ${money(c.seen)}. They agree well.`,
    differs: `You typed ${money(c.typed)}, but your entries show about ${money(c.seen)} a month${c.thin ? ' (only a short history, so less sure)' : ''}. Sukli plans with what it sees in your entries. If your entries are missing some income, add it or change your figure.`,
  }[c.state];
  return `<section class="cardbox" data-income><h3>Your Income</h3><p>${line}</p><div class="btnrow tight">${button({ label: c.typed ? 'Change' : 'Type Your Income', kind: 'secondary', size: 'sm', act: 'income-set' })}${c.typed ? button({ label: 'Remove', kind: 'secondary', size: 'sm', act: 'income-clear' }) : ''}</div></section>`;
}
ACT['income-set'] = () => {
  const db = get(), cur = db.settings.incomeTyped || '';
  const s = sheet(`<form novalidate><p class="hint">Your usual income each month, in ${HOME}. Sukli only uses it when your entries do not show income, and always shows both figures side by side.</p>${textField({ label: `Each month (${HOME})`, name: 'v', value: cur, placeholder: 'e.g. 60000', inputmode: 'decimal' })}<div class="btnrow">${button({ label: 'Cancel', kind: 'ghost', id: 'in-no' })}${button({ label: 'Save', kind: 'primary', id: 'in-ok' })}</div></form>`, { title: 'Your Income' });
  s.el.querySelector('#in-no').onclick = () => s.close();
  s.el.querySelector('#in-ok').onclick = () => s.el.querySelector('form').requestSubmit();
  s.el.querySelector('form').onsubmit = (e) => { e.preventDefault(); const n = num(e.target.v.value); s.close(); commit((d) => { if (n > 0) d.settings.incomeTyped = n; else delete d.settings.incomeTyped; }); toast(n > 0 ? 'Saved.' : 'Removed.'); };
};
ACT['income-clear'] = async () => { if (!(await confirmDialog('Remove the income you typed? Sukli will use your entries only.', 'Remove', true))) return; commit((d) => { delete d.settings.incomeTyped; }); toast('Removed.'); };
export const learnedFor = (db, txs, toHome, classify) => learnMonths(txs, toHome, thisMonth(), shiftMonth, classify);

// ---------- buying check: looks at YOU, never says buy or sell ----------
export function buyCheck(db, amount, debtRows = []) {
  const bal = balances(db), amt = +amount > 0 ? +amount : 0, cm = catMap(db);
  let liquid = 0;
  for (const a of live(db.accounts)) if (!a.archived && a.include !== false && ['cash', 'bank', 'ewallet', 'ic'].includes(a.type)) { const b = bal.get(a.id) || 0; if (b > 0) liquid += b * (homeFx(db, a.cur) || 1); }
  const L = learnMonths(live(db.txs), (t) => t.amount * (t.fx || 1), thisMonth(), shiftMonth, (t) => { const c = cm.get(t.cat); return { name: c ? c.name : 'Other', cls: 'want' }; });
  const spend = L ? L.spend : null, income = L && L.income > 0 ? L.income : (+db.settings.incomeTyped > 0 ? +db.settings.incomeTyped : null);
  const items = [];
  // 1 emergency money: 3 months of usual spending should stay in cash after buying
  if (spend != null) { const need = spend * 3, left = liquid - amt; items.push({ key: 'emergency', ok: left >= need, text: `Cash you hold: ${money(liquid)}. After this purchase: ${money(Math.max(0, left))}. Three months of your usual spending is about ${money(need)}. ${left >= need ? 'The cushion stays.' : 'The cushion would be smaller than that.'}` }); }
  else items.push({ key: 'emergency', ok: null, text: `Cash you hold: ${money(liquid)}. Sukli cannot tell your usual spending yet (no entries in the last 3 months), so it cannot compare.` });
  // 2 higher-interest debt
  const costly = debtRows.filter((d) => d.rate != null && d.rate >= 10 && d.owed > 0).sort((a, b) => b.rate - a.rate);
  items.push({ key: 'debt', ok: !costly.length, text: costly.length ? `You still owe on ${costly.map((d) => `${esc(d.name)} (${d.rate}% a year, ${money(d.owed)})`).join(', ')}. Paying that down saves a sure amount of interest.` : 'No debt with a high interest rate is recorded.' });
  // 3 size of the purchase
  if (amt > 0) { const ofCash = liquid > 0 ? amt / liquid : null, ofInc = income ? amt / income : null; items.push({ key: 'size', ok: (ofCash == null || ofCash <= 0.25) && (ofInc == null || ofInc <= 1), text: `This is ${ofCash != null ? Math.round(ofCash * 100) + '% of your cash' : 'more than your cash'}${ofInc != null ? ` and ${ofInc.toFixed(1)} times a month of income` : ''}.` }); }
  // 4 past swings: your own sells and what is below cost now
  let swing = { loss: 0, lossN: 0, gain: 0, below: 0 };
  try {
    const book = tradeBook(db.txs), accts = live(db.accounts);
    for (const x of book.realized) { if (x.gain < 0) { swing.loss += -x.gain * (homeFx(db, 'USD') ? 1 : 1); swing.lossN++; } else swing.gain += x.gain; }
    const rows = tokenPerformance(db, book, accts, HOME) || [];
    swing.below = rows.filter((r) => r.unreal < 0).reduce((s, r) => s - r.unreal, 0);
  } catch { /* no trades */ }
  items.push({ key: 'swings', ok: null, text: swing.lossN || swing.below ? `Your own history: ${swing.lossN} sale${swing.lossN === 1 ? '' : 's'} at a loss${swing.below > 0 ? `, and holdings now about ${money(swing.below)} below what you paid` : ''}. Ask yourself if you could hold through a drop like that.` : 'No sales at a loss or holdings below cost are recorded yet, so there is no past swing to look at.' });
  return { amt, liquid, items };
}
ACT['buy-check'] = async () => {
  const { debtList } = await import('./debts.js'), db = get();
  const s = sheet(`<form novalidate><p class="hint">This looks at your own money before you buy. It does not say whether to buy or sell.</p>${textField({ label: `How much will you put in (${HOME})`, name: 'v', placeholder: 'e.g. 20000', inputmode: 'decimal' })}<div class="btnrow">${button({ label: 'Close', kind: 'ghost', id: 'bc-no' })}${button({ label: 'Check', kind: 'primary', id: 'bc-ok' })}</div><div id="bcout"></div></form>`, { title: 'Buying Check' });
  s.el.querySelector('#bc-no').onclick = () => s.close();
  s.el.querySelector('#bc-ok').onclick = () => s.el.querySelector('form').requestSubmit();
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault(); const r = buyCheck(db, num(e.target.v.value), debtList(db));
    s.el.querySelector('#bcout').innerHTML = `<ul class="calfacts">${r.items.map((i) => `<li data-bc="${i.key}"><span>${{ emergency: 'Emergency money', debt: 'Higher-interest debt', size: 'Size of the purchase', swings: 'Past swings' }[i.key]}</span><b class="${i.ok === false ? 'cr' : ''}">${i.text}</b></li>`).join('')}</ul><p class="hint">Prices can go up and down, and you can lose money. Only you can decide.</p>`;
  };
};
