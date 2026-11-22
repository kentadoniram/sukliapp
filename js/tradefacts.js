// What a recorded trade was, worked out only from the numbers saved with it (the price, the quantities, the value in HOME at that time and the
// fee), so a trade always reads the same later, whatever today's rates are. Used by the trade detail window and the one-line summary in lists.
import { fmt, HOME } from './core.js';

const qty = (n, cur) => `${(+n || 0).toLocaleString('en-US', { maximumFractionDigits: 8 })} ${cur}`;
const unit = (n) => (+n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: Math.abs(n) < 1 ? 8 : 2 });
export function tradeFacts(db, t) {
  const x = t && t.trade; if (!x) return null;
  const A = new Map(db.accounts.map((a) => [a.id, a])), a = A.get(x.asset), b = x.asset2 ? A.get(x.asset2) : null, ac = a ? a.cur : '?', bc = b ? b.cur : '';
  const conv = x.side === 'convert', buy = x.side === 'buy', paidCur = x.paidCur || ac, paidAmt = x.paidAmt != null ? x.paidAmt : 0;
  const side = conv ? 'Convert' : buy ? 'Buy' : 'Sell';
  // filled price: what one unit of the asset cost or sold for (for a convert: how much of the other coin one unit bought)
  const price = conv ? (x.qty > 0 ? x.qty2 / x.qty : 0) : (x.qty > 0 ? paidAmt / x.qty : 0);
  const priceText = conv ? `1 ${ac} = ${unit(price)} ${bc}` : `1 ${ac} = ${unit(price)} ${paidCur}`;
  const qtyText = conv ? `${qty(x.qty, ac)} → ${qty(x.qty2, bc)}` : `${buy ? '+' : '−'}${qty(x.qty, ac)}`;
  const valueCur = conv ? ac : paidCur, valueAmt = conv ? x.qty : paidAmt, home = +x.valueHome || 0;
  const rate = valueAmt > 0 ? home / valueAmt : 0;   // HOME per one unit of the currency the value is in, as saved with the trade
  const fee = x.feeAmt != null ? x.feeAmt : (t.fee > 0 ? t.fee : 0), feeCur = x.feeCur || t.feeCur || valueCur, feeHome = x.feeHome != null ? x.feeHome : 0;
  const feePct = home > 0 && feeHome > 0 ? feeHome / home * 100 : (valueAmt > 0 && feeCur === valueCur && fee > 0 ? fee / valueAmt * 100 : null);
  return { side, priceText, qtyText, valueText: qty(valueAmt, valueCur), homeText: valueCur === HOME ? '' : home > 0 ? `≈ ${fmt(home, HOME)}` : '', rateText: valueCur !== HOME && rate > 0 ? `@ ${fmt(rate, HOME)}` : '', fee, feeCur, feeText: fee > 0 ? qty(fee, feeCur) : 'No fee', feePct, price, priceCur: conv ? bc : paidCur, date: String(t.date || '').slice(0, 16), ac };
}
// the short line shown under a trade in lists
export const tradeLine = (db, t) => { const f = tradeFacts(db, t); return f ? `${f.side} filled at ${f.priceText.replace(/^1 /, '1 ')}` : 'Trade'; };
