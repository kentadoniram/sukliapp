// "Compare payment methods" (16.34): for a price in one currency (say ¥1,500), what would it cost through cash, each card, debit card, wallet or exchange account?
// An estimate to help choose the cheaper way to pay. Nothing here is saved as spending; the amount that really posted stays the record.
// Each account can hold its own assumptions (rate markup %, foreign fee %, flat fee, cashback %). Until you set them, a starting guess for the account type is used and labelled as such.
import { get, commit, fmt, HOME, homeFx, live } from './core.js';
import { esc, sheet, ACT, toast } from './ui.js';
import { button, textField, selectField } from './components.js';
import { estimate, profileOf, effective } from './paymath.js';
import { rateSource } from './fxview.js';

const val = (s) => { const x = parseFloat(String(s).replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };
const pct = (x) => `${x > 0 ? '+' : ''}${(Math.round(x * 100) / 100).toLocaleString('en-US')}%`;
const rate4 = (x) => (x >= 100 ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(Number(x.toPrecision(4))));
// the accounts you could pay with (not loans, savings or investments); cash in the shop's own currency is the baseline row
export const payAccounts = (db) => live(db.accounts).filter((a) => !a.archived && ['bank', 'card', 'ewallet', 'ic', 'crypto', 'cash'].includes(a.type));
export const priceCurs = (db) => [...new Set([HOME, 'JPY', ...live(db.accounts).filter((a) => !a.archived).map((a) => a.cur)])].filter(Boolean);
let S = null;   // the open sheet: { cur, amount, posted, acct, onUse, onKeep }

function compute(db) {
  const methods = payAccounts(db).filter((a) => !(a.type === 'cash' && a.cur === S.cur)).map((a) => ({ id: a.id, label: a.name, cur: a.cur, type: a.type, profile: profileOf(a) }));
  // accounts that would cost exactly the same (same currency, type and assumptions) are shown once
  const seen = new Map(); for (const m of methods) { const k = `${m.cur}|${m.type}|${m.profile.markup}|${m.profile.fee}|${m.profile.flat}|${m.profile.cashback}|${m.profile.own}`; if (seen.has(k)) seen.get(k).more++; else seen.set(k, Object.assign(m, { more: 0 })); }
  const uniq = [...seen.values()].map((m) => Object.assign(m, { label: m.more ? `${m.label} and ${m.more} similar` : m.label }));
  return estimate({ amount: S.amount, cur: S.cur, home: HOME, per: (c) => homeFx(db, c), methods: uniq });
}
function rowHtml(db, r, e) {
  const a = db.accounts.find((x) => x.id === r.id), p = r.profile, tag = r.id === e.best && r.costHome < e.cashHome - 0.005 ? '<span class="pctag best">Cheapest</span>' : '';
  if (r.noRate) return `<div class="pcrow"><div class="pchead"><b>${esc(r.label)}</b></div><small class="muted">No exchange rate for ${esc(r.cur)} yet, so it cannot be estimated.</small></div>`;
  const diff = r.diff, same = diff > -0.005 && diff < 0.005;
  const detail = r.same ? `Same currency (${esc(r.cur)}): no conversion, no foreign fee.` : `Rate ${rate4(r.network)} ${esc(r.cur)} per ${esc(S.cur)} (market ${rate4(r.market)})${r.feeAmt ? ` · fee ${esc(fmt(r.feeAmt, r.cur))}` : ''}${r.cashbackAmt ? ` · cashback −${esc(fmt(r.cashbackAmt, r.cur))}` : ''}`;
  return `<div class="pcrow${tag ? ' best' : ''}"><div class="pchead"><b>${esc(r.label)}</b>${tag}<span class="pcamt">${esc(fmt(r.pay, r.cur))}</span></div>
    <div class="pcsub"><span>≈ ${esc(fmt(r.costHome, HOME))} in ${esc(HOME)}</span><b class="${same ? '' : diff > 0 ? 'bad' : 'good'}">${same ? 'same as cash' : `${diff > 0 ? '+' : '−'}${esc(fmt(Math.abs(diff), HOME))} (${pct(r.diffPct)}) vs cash`}</b></div>
    <small class="muted">${detail}</small>
    <div class="btnrow tight">${r.same ? '' : `<small class="muted pcsrc">${p.own ? 'Your assumptions' : 'Starting guess'}: markup ${p.markup}%, fee ${p.fee}%${p.flat ? ` + ${esc(fmt(p.flat, r.cur))}` : ''}, cashback ${p.cashback}%</small>${button({ label: 'Edit', kind: 'link', act: 'pc-edit', attr: { 'data-id': r.id } })}`}${S.onUse && a ? button({ label: 'Pay with this', kind: 'ghost', size: 'sm', act: 'pc-use', attr: { 'data-id': r.id } }) : ''}</div></div>`;
}
function draw(root) {
  const db = get(), out = root.querySelector('#pc-out'); if (!out) return;
  const e = compute(db);
  if (!e.ok) { out.innerHTML = `<p class="hint">${esc(e.why)}</p>`; return; }
  const src = rateSource(db, S.cur, HOME, 0).text, cashBest = e.rows.every((r) => r.noRate || r.costHome >= e.cashHome - 0.005);
  let conf = '';
  if (S.posted > 0 && S.postedCur !== S.cur) { const x = effective(S.posted, e.amount, e.market); if (x) conf = `<div class="pcconf"><b>This entry, posted (confirmed)</b><span>${esc(fmt(S.posted, HOME))} for ${esc(fmt(e.amount, S.cur))} = ${rate4(x.rate)} ${esc(HOME)} per ${esc(S.cur)}</span><small class="muted">Market rate ${rate4(x.mid)}${x.overPct != null ? `, so you paid ${pct(x.overPct)} against the market rate` : ''}. This is what is recorded; the estimates below are not.</small></div>`; }
  out.innerHTML = `${conf}<div class="pcrow base${cashBest ? ' best' : ''}"><div class="pchead"><b>Cash (${esc(S.cur)})</b>${cashBest ? '<span class="pctag best">Cheapest</span>' : ''}<span class="pcamt">${esc(fmt(e.amount, S.cur))}</span></div>
      <div class="pcsub"><span>≈ ${esc(fmt(e.cashHome, HOME))} in ${esc(HOME)}</span><b>baseline</b></div><small class="muted">Market rate 1 ${esc(S.cur)} = ${rate4(e.market)} ${esc(HOME)} · ${esc(src)}</small></div>
    ${e.rows.map((r) => rowHtml(db, r, e)).join('')}`;
}
// openPayCompare({ cur, amount, acct, posted, postedCur, onUse(id), onKeep({cur, amt}|null), kept })
export function openPayCompare(o = {}) {
  const db = get();
  S = { cur: o.cur || 'JPY', amount: o.amount > 0 ? o.amount : 0, posted: o.posted || 0, postedCur: o.postedCur || HOME, onUse: o.onUse, onKeep: o.onKeep, shut: null };
  const s = sheet(`<p class="hint">Estimates to help you pick the cheaper way to pay. Nothing here is recorded as spending: the amount that actually posted on your card or account is what counts.</p>
    <div class="two">${textField({ label: 'Price in the shop', id: 'pc-amt', value: S.amount ? String(S.amount) : '', inputmode: 'decimal', placeholder: 'e.g. 1500' })}${selectField({ label: 'Currency', id: 'pc-cur', value: S.cur, options: priceCurs(db).map((c) => ({ value: c, label: c })) })}</div>
    <div id="pc-out"></div>
    ${o.onKeep ? `<label class="chk"><input type="checkbox" id="pc-keep" ${o.kept ? 'checked' : ''}><span>Keep this shop price with the entry (with the market rate today)</span></label>` : ''}
    <p class="hint">Rates are the app's market rate. Card markups, foreign fees and cashback are your own assumptions per account (tap Edit); a starting guess is used until you set them.</p>
    <div class="btnrow">${button({ label: 'Done', kind: 'primary', id: 'pc-ok' })}</div>`, { title: 'Compare payment methods', cls: 'pcsheet' });
  S.shut = s; const root = s.el || s.root;
  const read = () => { S.amount = val(root.querySelector('#pc-amt').value); const c = root.querySelector('#pc-cur'); S.cur = c ? c.value : S.cur; draw(root); };
  root.addEventListener('input', (e) => { if (e.target.id === 'pc-amt') read(); });
  root.addEventListener('change', (e) => { if (e.target.id === 'pc-cur') read(); });
  root.addEventListener('click', (e) => { const b = e.target.closest('#pc-ok'); if (!b) return; const k = root.querySelector('#pc-keep'); if (S.onKeep) S.onKeep(k && k.checked && S.amount > 0 ? { cur: S.cur, amt: S.amount } : null); s.close(); });
  S.root = root; draw(root);
}
function editAssumptions(id) {
  const db = get(), a = db.accounts.find((x) => x.id === id); if (!a) return;
  const p = profileOf(a), s = sheet(`<form novalidate><p class="hint">What ${esc(a.name)} (${esc(a.cur)}) really charges when you pay in another currency. Check your card's statement or terms.</p>
    <div class="two">${textField({ label: 'Rate markup %', name: 'm', value: String(p.markup), inputmode: 'decimal', hint: 'Added to the market rate by the network or bank' })}${textField({ label: 'Foreign fee %', name: 'f', value: String(p.fee), inputmode: 'decimal' })}</div>
    <div class="two">${textField({ label: `Flat fee (${a.cur})`, name: 'x', value: String(p.flat), inputmode: 'decimal' })}${textField({ label: 'Cashback or rewards %', name: 'c', value: String(p.cashback), inputmode: 'decimal' })}</div>
    <div class="btnrow">${button({ label: 'Save', kind: 'primary', submit: true })}${p.own ? button({ label: 'Use starting guess', kind: 'ghost', id: 'pc-reset' }) : ''}</div></form>`, { title: `${a.name}: assumptions` });
  const root = s.el || s.root, form = root.querySelector('form');
  form.addEventListener('submit', (e) => { e.preventDefault(); const v = (k) => Math.max(0, val(form.elements[k].value)); commit((d) => { const x = d.accounts.find((y) => y.id === id); if (x) x.pay = { markup: v('m'), fee: v('f'), flat: v('x'), cashback: v('c') }; }); s.close(); if (S && S.root) draw(S.root); toast('Saved. These are estimates; the posted amount is what counts.'); });
  const rs = root.querySelector('#pc-reset'); if (rs) rs.addEventListener('click', () => { commit((d) => { const x = d.accounts.find((y) => y.id === id); if (x) delete x.pay; }); s.close(); if (S && S.root) draw(S.root); });
}
ACT['pc-edit'] = (el) => editAssumptions(el.dataset.id);
ACT['pc-use'] = (el) => { const cb = S && S.onUse; if (cb) { const id = el.dataset.id; if (S.shut) S.shut.close(); cb(id); } };
