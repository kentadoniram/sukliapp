// Card conversion check (16.34-16.37): for an expense paid by a card in another currency than the shop's price, compare what the card charged
// (the confirmed, recorded amount) with what the same price comes to at the market rate. The gap is the markup the card or bank added.
// Nothing here changes the record: the amount the card posted stays the amount.
import { get, commit, fmt, HOME, homeFx, homePer, live, stamp, nowStamp } from './core.js';
import { esc } from './ui.js';
import { button, textField, selectField } from './components.js';
import { effective } from './paymath.js';

const pct = (x) => `${x > 0 ? '+' : ''}${(Math.round(x * 100) / 100).toLocaleString('en-US')}%`;
const rate4 = (x) => (x >= 100 ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(Number(x.toPrecision(4))));
export const priceCurs = (db) => [...new Set([HOME, 'JPY', ...live(db.accounts).filter((a) => !a.archived).map((a) => a.cur)])].filter(Boolean);

// the shop price of an entry: the price kept with it (orig), when it was paid in another currency than the price
export function shopPrice(db, t) {
  if (!t || t.kind !== 'expense' || t.lent || t.trade) return null;
  return t.orig && t.orig.amt > 0 && t.orig.cur !== t.cur ? { cur: t.orig.cur, amt: t.orig.amt, mid: t.orig.mid, late: !!t.orig.late } : null;
}
// Card conversion check: the shop's price, what the card really charged (confirmed), and what the same price comes to at the market rate.
// The gap is the markup the card or bank added. Shown in the currency the card uses and in your home currency.
export function whatIfHtml(db, t) {
  const price = shopPrice(db, t); if (!price) return null;
  const k = t.cur, perP = price.mid > 0 ? price.mid : homeFx(db, price.cur), perK = k === HOME ? 1 : homeFx(db, k);
  if (!(perP > 0) || !(perK > 0)) return `<p class="hint">There is no exchange rate for ${esc(!(perP > 0) ? price.cur : k)} yet, so the card cannot be checked.</p>`;
  const eq = price.amt * perP / perK, paid = t.amount, d = paid - eq, dp = eq > 0 ? d / eq * 100 : 0;
  const dh = d * perK, bad = d > 0.005, same = Math.abs(d) <= 0.005;
  const x = effective(paid, price.amt, eq / price.amt), tone = same ? '' : bad ? 'bad' : 'good';
  const rows = [['Shop price', fmt(price.amt, price.cur)], [`Your ${t.cur} card charged (confirmed)`, fmt(paid, k)], [`Same price at the market rate${price.mid > 0 ? (price.late ? ' when you added it' : ' at the time') : ' today'}`, fmt(eq, k)]];
  return `<div class="pcconf">${rows.map(([l, v]) => `<div class="pcline"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}
    <div class="pcline pcgap"><span>Markup the card added</span><b class="${tone}">${same ? 'none' : `${d > 0 ? '+' : '−'}${esc(fmt(Math.abs(d), k))} (${pct(dp)})`}</b></div>
    ${k !== HOME && !same ? `<div class="pcline"><span>In ${esc(HOME)}</span><b class="${tone}">${d > 0 ? '+' : '−'}${esc(fmt(Math.abs(dh), HOME))}</b></div>` : ''}
    <small class="muted">The card turned 1 ${esc(price.cur)} into ${rate4(paid / price.amt)} ${esc(k)}; the market rate is ${rate4(eq / price.amt)}${x ? '' : ''}. An estimate for your information: the amount your card posted is what is recorded.</small></div>`;
}
// the form for an entry that has no shop price yet
export function priceFormHtml(db, t) {
  return `<p class="hint">Paid by card in ${esc(t.cur)} for something priced in another currency? Add the shop price to see what the card's conversion cost against the market rate.</p>
    <div class="two">${textField({ label: 'Price in the shop', id: 'pc-amt', inputmode: 'decimal', placeholder: 'e.g. 1500' })}${selectField({ label: 'Currency', id: 'pc-cur', value: priceCurs(db).find((c) => c !== t.cur) || 'JPY', options: priceCurs(db).filter((c) => c !== t.cur).map((c) => ({ value: c, label: c })) })}</div>
    <div class="btnrow tight">${button({ label: 'Check the card rate', kind: 'primary', size: 'sm', attr: { 'data-ev': 'pc-save' } })}</div>`;
}
// keeps the shop price with the entry: the posted amount stays the amount; the market rate when it was added is saved beside it
export function saveShopPrice(id, cur, amt) {
  const db = get(), t = db.txs.find((x) => x.id === id); if (!t || !(amt > 0) || cur === t.cur) return false;
  const ph = t.cur === HOME ? t.amount : t.amount * homePer(db, t), mid = homeFx(db, cur); if (!(ph > 0)) return false;
  commit((d) => { const x = d.txs.find((y) => y.id === id); if (x) x.orig = { cur, amt, mid: mid > 0 ? mid : undefined, rate: ph / amt, home: ph, at: nowStamp(), late: true }; stamp(x); }); return true;
}
let redraw = null;
export const onPayChange = (fn) => { redraw = fn; };   // kept for the entry view; the summary is redrawn by it after a shop price is saved
