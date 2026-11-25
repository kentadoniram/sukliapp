// "If you had paid another way" (16.34/16.35): a summary on a finished expense that has a price in another currency.
// It estimates what the same purchase would have cost with cash and with your other cards, debit cards, wallets and exchange accounts, against what you really paid.
// The posted amount stays the record; every figure here is an estimate and is never saved as spending.
// Each account can hold its own assumptions (rate markup %, foreign fee %, flat fee, cashback %). Until you set them, a starting guess for the account type is used and labelled as such.
import { get, commit, fmt, HOME, homeFx, homePer, live, stamp, nowStamp } from './core.js';
import { esc, sheet, ACT, toast } from './ui.js';
import { button, textField, selectField } from './components.js';
import { estimate, profileOf, effective } from './paymath.js';
import { rateSource } from './fxview.js';

const val = (s) => { const x = parseFloat(String(s).replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };
const pct = (x) => `${x > 0 ? '+' : ''}${(Math.round(x * 100) / 100).toLocaleString('en-US')}%`;
const rate4 = (x) => (x >= 100 ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(Number(x.toPrecision(4))));
// the accounts you could have paid with (not loans, savings or investments); cash in the shop's own currency is the baseline row
export const payAccounts = (db) => live(db.accounts).filter((a) => !a.archived && ['bank', 'card', 'ewallet', 'ic', 'crypto', 'cash'].includes(a.type));
export const priceCurs = (db) => [...new Set([HOME, 'JPY', ...live(db.accounts).filter((a) => !a.archived).map((a) => a.cur)])].filter(Boolean);

// the shop price of an entry: kept with it (orig), or the entry itself when it was paid from a foreign-currency account
export function shopPrice(db, t) {
  if (!t || t.kind !== 'expense' || t.lent || t.trade) return null;
  if (t.orig && t.orig.amt > 0) return { cur: t.orig.cur, amt: t.orig.amt, mid: t.orig.mid, kept: true };
  if (t.cur && t.cur !== HOME && t.amount > 0) return { cur: t.cur, amt: t.amount, mid: t.hfx > 0 ? t.hfx : undefined, kept: false };
  return null;
}
// what really posted, in the home currency
const postedHome = (db, t) => (t.orig && t.orig.home > 0 ? t.orig.home : t.cur === HOME ? t.amount : t.amount * homePer(db, t));
function compute(db, t, price) {
  // the market rate recorded with the entry is used for the shop's currency; every other rate is today's
  const per = (c) => (c === price.cur && price.mid > 0 ? price.mid : homeFx(db, c));
  const methods = payAccounts(db).filter((a) => a.id !== t.acct && !(a.type === 'cash' && a.cur === price.cur)).map((a) => ({ id: a.id, label: a.name, cur: a.cur, type: a.type, profile: profileOf(a) }));
  // accounts that would cost exactly the same (same currency, type and assumptions) are shown once
  const seen = new Map(); for (const m of methods) { const k = `${m.cur}|${m.type}|${m.profile.markup}|${m.profile.fee}|${m.profile.flat}|${m.profile.cashback}|${m.profile.own}`; if (seen.has(k)) seen.get(k).more++; else seen.set(k, Object.assign(m, { more: 0 })); }
  const uniq = [...seen.values()].map((m) => Object.assign(m, { label: m.more ? `${m.label} and ${m.more} similar` : m.label }));
  return estimate({ amount: price.amt, cur: price.cur, home: HOME, per, methods: uniq });
}
const vs = (d, pc, what) => { const same = Math.abs(d) < 0.005; return `<b class="${same ? '' : d > 0 ? 'bad' : 'good'}">${same ? `same as ${what}` : `${fmt(Math.abs(d), HOME)} ${d > 0 ? 'more' : 'less'} (${pct(pc)}) than ${what}`}</b>`; };
function rowHtml(r, e, paid) {
  if (r.noRate) return `<div class="pcrow"><div class="pchead"><b>${esc(r.label)}</b></div><small class="muted">No exchange rate for ${esc(r.cur)} yet, so it cannot be estimated.</small></div>`;
  const p = r.profile, dActual = r.costHome - paid, tag = r.id === e.best && r.costHome < Math.min(e.cashHome, paid) - 0.005 ? '<span class="pctag best">Cheapest</span>' : '';
  const detail = r.same ? `Same currency (${esc(r.cur)}): no conversion, no foreign fee.` : `Rate ${rate4(r.network)} ${esc(r.cur)} per ${esc(e.cur)} (market ${rate4(r.market)})${r.feeAmt ? ` · fee ${esc(fmt(r.feeAmt, r.cur))}` : ''}${r.cashbackAmt ? ` · cashback −${esc(fmt(r.cashbackAmt, r.cur))}` : ''}`;
  return `<div class="pcrow${tag ? ' best' : ''}"><div class="pchead"><b>${esc(r.label)}</b>${tag}<span class="pcamt">${esc(fmt(r.pay, r.cur))}</span></div>
    <div class="pcsub"><span>≈ ${esc(fmt(r.costHome, HOME))}</span>${vs(dActual, paid > 0 ? dActual / paid * 100 : 0, 'you paid')}</div>
    <small class="muted">${detail}</small>
    ${r.same ? '' : `<div class="btnrow tight"><small class="muted pcsrc">${p.own ? 'Your assumptions' : 'Starting guess'}: markup ${p.markup}%, fee ${p.fee}%${p.flat ? ` + ${esc(fmt(p.flat, r.cur))}` : ''}, cashback ${p.cashback}%</small>${button({ label: 'Edit', kind: 'link', act: 'pc-edit', attr: { 'data-id': r.id } })}</div>`}</div>`;
}
// the whole summary for one entry; null when the entry has no shop price in another currency (then the entry view offers to add one)
export function whatIfHtml(db, t) {
  const price = shopPrice(db, t); if (!price) return null;
  const e = compute(db, t, price); if (!e.ok) return `<p class="hint">${esc(e.why)}</p>`;
  const paid = postedHome(db, t), a = db.accounts.find((x) => x.id === t.acct), x = t.cur === HOME || t.orig ? effective(paid, e.amount, e.market) : null;
  const src = price.kept && price.mid ? 'The market rate saved with this entry' : price.mid ? 'The rate saved with this entry' : rateSource(db, price.cur, HOME, 0).text;
  return `<div class="pcconf"><b>What you paid (confirmed)</b><span>${esc(fmt(t.amount, t.cur))}${t.cur !== HOME ? ` ≈ ${esc(fmt(paid, HOME))}` : ''} with ${esc(a ? a.name : 'this account')} for a price of ${esc(fmt(e.amount, e.cur))}</span>
      ${x ? `<small class="muted">That worked out to ${rate4(x.rate)} ${esc(HOME)} per ${esc(e.cur)}${x.mid > 0 && x.overPct != null ? `, ${pct(x.overPct)} against the market rate of ${rate4(x.mid)}` : ''}.</small>` : ''}</div>
    <div class="pcrow base"><div class="pchead"><b>Cash (${esc(e.cur)})</b><span class="pcamt">${esc(fmt(e.amount, e.cur))}</span></div>
      <div class="pcsub"><span>≈ ${esc(fmt(e.cashHome, HOME))}</span>${vs(e.cashHome - paid, paid > 0 ? (e.cashHome - paid) / paid * 100 : 0, 'you paid')}</div><small class="muted">Market rate 1 ${esc(e.cur)} = ${rate4(e.market)} ${esc(HOME)} · ${esc(src)}</small></div>
    ${e.rows.map((r) => rowHtml(r, e, paid)).join('')}
    <p class="hint">Estimates only, using your assumptions per account. They are not extra spending and change nothing in your records.</p>`;
}
// the form for an entry that has no shop price yet
export function priceFormHtml(db, t) {
  return `<p class="hint">Paid in ${esc(t.cur)} for something priced in another currency? Add the shop price to see what other ways of paying would have cost.</p>
    <div class="two">${textField({ label: 'Price in the shop', id: 'pc-amt', inputmode: 'decimal', placeholder: 'e.g. 1500' })}${selectField({ label: 'Currency', id: 'pc-cur', value: priceCurs(db).find((c) => c !== t.cur) || 'JPY', options: priceCurs(db).filter((c) => c !== t.cur).map((c) => ({ value: c, label: c })) })}</div>
    <div class="btnrow tight">${button({ label: 'Show comparison', kind: 'primary', size: 'sm', attr: { 'data-ev': 'pc-save' } })}</div>`;
}
// keeps the shop price with the entry: the posted amount stays the amount; the market rate when it was added is saved beside it
export function saveShopPrice(id, cur, amt) {
  const db = get(), t = db.txs.find((x) => x.id === id); if (!t || !(amt > 0) || cur === t.cur) return false;
  const ph = postedHome(db, t), mid = homeFx(db, cur); if (!(ph > 0)) return false;
  commit((d) => { const x = d.txs.find((y) => y.id === id); if (x) x.orig = { cur, amt, mid: mid > 0 ? mid : undefined, rate: ph / amt, home: ph, at: nowStamp(), late: true }; stamp(x); }); return true;
}
let redraw = null;   // set by the entry view so a saved assumption refreshes the summary
export const onPayChange = (fn) => { redraw = fn; };
function editAssumptions(id) {
  const db = get(), a = db.accounts.find((x) => x.id === id); if (!a) return;
  const p = profileOf(a), s = sheet(`<form novalidate><p class="hint">What ${esc(a.name)} (${esc(a.cur)}) really charges when you pay in another currency. Check your card's statement or terms.</p>
    <div class="two">${textField({ label: 'Rate markup %', name: 'm', value: String(p.markup), inputmode: 'decimal', hint: 'Added to the market rate by the network or bank' })}${textField({ label: 'Foreign fee %', name: 'f', value: String(p.fee), inputmode: 'decimal' })}</div>
    <div class="two">${textField({ label: `Flat fee (${a.cur})`, name: 'x', value: String(p.flat), inputmode: 'decimal' })}${textField({ label: 'Cashback or rewards %', name: 'c', value: String(p.cashback), inputmode: 'decimal' })}</div>
    <div class="btnrow">${button({ label: 'Save', kind: 'primary', submit: true })}${p.own ? button({ label: 'Use starting guess', kind: 'ghost', id: 'pc-reset' }) : ''}</div></form>`, { title: `${a.name}: assumptions` });
  const root = s.el || s.root, form = root.querySelector('form');
  form.addEventListener('submit', (e) => { e.preventDefault(); const v = (k) => Math.max(0, val(form.elements[k].value)); commit((d) => { const x = d.accounts.find((y) => y.id === id); if (x) x.pay = { markup: v('m'), fee: v('f'), flat: v('x'), cashback: v('c') }; }); s.close(); if (redraw) redraw(); toast('Saved. These are estimates; the posted amount is what counts.'); });
  const rs = root.querySelector('#pc-reset'); if (rs) rs.addEventListener('click', () => { commit((d) => { const x = d.accounts.find((y) => y.id === id); if (x) delete x.pay; }); s.close(); if (redraw) redraw(); });
}
ACT['pc-edit'] = (el) => editAssumptions(el.dataset.id);
