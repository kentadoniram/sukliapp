// Receipt text -> merchant, date, total, items, with a confidence for each. Pure functions (no browser needed), so they can be tested.
// Input: lines of text as read by OCR: [{text, conf}] (conf 0-100, optional). Written for Japanese supermarket receipts (LIFE, イオン…) and also reads English ones.
//
// The confidence is a rough score of "how much to trust this field": how well the OCR read the line, how well the rules fit,
// and cross-checks (do the items add up to the total?). It is not a calibrated probability.

import { similarity } from './textnorm.js';

const CJK = '\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}ー';
const GAP = new RegExp(`(?<=[${CJK}])\\s+(?=[${CJK}])|(?<=\\d)\\s+(?=[${CJK}])`, 'gu');
// OCR puts spaces between Japanese characters ("ライ フ 塚越 店") and reads ¥ as a backslash: tidy both
const NK = (s) => String(s || '').normalize('NFKC').replace(/[￥円]/g, '¥').replace(/\\(?=\s?\d)/g, '¥').replace(GAP, '')
  .replace(/(?<=[\d¥])[OoQD](?=[\d,.\s¥軽※*外内]|$)/g, '0').replace(/(?<=¥)[OoQ](?=\d)/g, '0').replace(/(?<=\d)[lI|](?=\d|\s|$)/g, '1')
  .replace(/(?<=^|[\s*・.:])[yYvV](?=\d{2,5}(?:\D|$))/g, '¥').replace(/(?<=¥)[Il|](?=\d)/g, '1');   // ¥ read as y, Y or v; ¥I08 is ¥108
// OCR often adds a few junk characters after the price ("¥299 【", "¥754 F ーー"): drop them when nothing numeric follows
const trimTail = (t) => { const re = /(¥\s?-?\d[\d,]*|-?\d[\d,]*)\s*[軽※*外内E]?/g; let last = null, m; while ((m = re.exec(t))) last = m; if (!last) return t; const end = last.index + last[0].length, tail = t.slice(end); return tail && tail.length <= 14 && !/\d/.test(tail) ? t.slice(0, end).trim() : t; };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// shops we can name with certainty (display name is what you probably typed before; history can override it)
export const SHOPS = [
  ['cisca', /c[i1l|]s[ce][a-zq0o]/i],
  ['LIFE', /ライフ|\bLIFE\b/i], ['AEON', /イオン|\bAEON\b/i], ['Maruetsu', /マルエツ/], ['Seiyu', /西友|SEIYU/i], ['Ito-Yokado', /イトーヨーカドー|イトーヨーカ堂/],
  ['Daiei', /ダイエー/], ['OK Store', /オーケー|\bOK\b store/i], ['Maibasket', /まいばすけっと/], ['Summit', /サミット/], ['Gyomu Super', /業務スーパー/],
  ['7-Eleven', /セブン[- ]?イレブン|7[- ]?eleven/i], ['FamilyMart', /ファミリーマート|family ?mart/i], ['Lawson', /ローソン|lawson/i],
  ['Don Quijote', /ドン・?キホーテ|ドンキ/], ['Daiso', /ダイソー|daiso/i], ['Matsumoto Kiyoshi', /マツモトキヨシ|マツキヨ/], ['Uniqlo', /ユニクロ|uniqlo/i],
  ['SM Supermarket', /\bSM (supermarket|hypermarket)/i], ['Puregold', /puregold/i], ['Jollibee', /jollibee/i], ["McDonald's", /mcdonald|マクドナルド/i], ['Starbucks', /starbucks|スターバックス/i],
];
const SKIP_ITEM = /小計|合計|総合計|お買上|お預|おあずかり|お釣|おつり|釣銭|税|対象|計|支払|残高|カード|交通|PayPay|ポイント|現金|クレジット|カード|電話|TEL|登録番号|レジ|担当|責任者|領収|点数|ご利用|ありがとう|ご来店|変更|交換|返品|レシート|No\.?|subtotal|total|change|cash|tax|vat/i;
const TOTAL_KEY = /合[\s。.、]*計|お買上げ?計|総合計|ご請求|お支払い?金額|お会計|total|amount due/i;
const NOT_TOTAL = /小計|内税|外税|消費税|対象|お預|お釣|釣|ポイント|sub ?total|change|tax|vat/i;
const PRICE_END = /(?:^|[\s:*])¥?\s*(-?\s?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|-?\s?\d+(?:\.\d{1,2})?)\s*(軽|※|\*|外|内|[A-Z])?\s*$/;

function money(s) {
  const t = NK(s).replace(/\s/g, '').replace(/[Oo]/g, '0').replace(/[lI|]/g, '1');
  const m = t.match(/^(-?)¥?(\d{1,3}(?:[,.]\d{3})+|\d+)(?:\.(\d{1,2}))?$/); if (!m) return null;
  let whole = m[2].replace(/[,.]/g, ''); const v = +(whole + (m[3] ? '.' + m[3] : ''));
  return m[1] ? -v : v;
}
const amountsIn = (line) => [...NK(line).matchAll(/¥?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g)].map((m) => ({ v: +m[1].replace(/,/g, ''), at: m.index, len: m[0].length }));

export function findDate(lines, today = new Date()) {
  const patterns = [
    [/(20\d{2})\s*[年\/.\-]\s*(\d{1,2})\s*[月\/.\-]\s*(\d{1,2})/, (m) => [+m[1], +m[2], +m[3]]],
    [/令和\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/, (m) => [2018 + +m[1], +m[2], +m[3]]],
    [/(?<!\d)(\d{2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?!\d)/, (m) => [2000 + +m[1], +m[2], +m[3]]],
    [/(20\d{2})[^\d\n]{1,2}(\d{1,2})[^\d\n]{1,2}(\d{1,2})/, (m) => [+m[1], +m[2], +m[3]]],        // 2026生10有19日: the year/month/day marks are misread but the numbers survive
  ];
  const limit = new Date(today.getTime() + 864e5);
  let best = null;
  for (const [i, l] of lines.entries()) {
    const t = NK(l.text);
    for (const [re, f] of patterns) {
      const m = t.match(re); if (!m) continue;
      const [y, mo, d] = f(m), dt = new Date(y, mo - 1, d);
      if (dt.getMonth() !== mo - 1 || dt.getDate() !== d || dt > limit || y < 2015) continue;
      const tm = t.match(/(\d{1,2})\s*[:：]\s*(\d{2})/) || NK((lines[i + 1] || {}).text).match(/^\s*(\d{1,2})\s*[:：]\s*(\d{2})/);
      const age = (today - dt) / 864e5, ocr = (l.conf ?? 80) / 100;
      const c = clamp(0.55 + 0.3 * ocr + (age < 400 ? 0.1 : 0) + (tm ? 0.05 : 0));
      if (!best || c > best.conf) best = { value: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, time: tm ? `${String(+tm[1]).padStart(2, '0')}:${tm[2]}` : '', conf: c, line: i };
      break;
    }
  }
  return best;
}

const letterRatio = (t) => { const n = [...t.replace(/\s/g, '')].length; return n ? [...t.replace(/\s/g, '')].filter((c) => /[\p{L}\p{N}]/u.test(c)).length / n : 0; };
const BRANCH = /[\p{sc=Han}\p{sc=Katakana}ー]{2,8}店|[A-Za-z]{3,}(?: [A-Za-z]{3,})?$/u;
export function findMerchant(lines, known = []) {
  const head = lines.slice(0, 8);
  for (const [i, l] of head.entries()) for (const [name, re] of SHOPS) if (re.test(NK(l.text))) {
    const rest = NK(l.text).replace(re, ' ').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim(), bm = rest.match(BRANCH);
    return { value: name, branch: bm ? bm[0] : '', conf: clamp(0.8 + 0.2 * ((l.conf ?? 80) / 100)), line: i, how: 'known shop' };
  }
  // a name already in your history that appears in the first lines
  for (const [i, l] of head.entries()) { const t = NK(l.text).toLowerCase(); for (const k of known) if (k.length >= 4 && t.includes(k.toLowerCase())) return { value: k, branch: '', conf: 0.75, line: i, how: 'in your history' }; }
  // the shop name usually sits right above its address
  for (const [i, l] of head.entries()) {
    if (i === 0 || !/[都道府県].*[市区町村郡]|〒/.test(NK(l.text))) continue;
    const nm = NK(lines[i - 1].text).replace(/[^\p{L}\p{N}×x&\- ]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (nm.replace(/[^\p{L}]/gu, '').length >= 2 && (lines[i - 1].conf ?? 70) >= 30) return { value: nm.slice(0, 40), branch: '', conf: clamp(0.5 + 0.2 * ((lines[i - 1].conf ?? 70) / 100)), line: i - 1, how: 'above the address' };
  }
  // a brand named on any line (a logo is a picture and cannot be read, but "スマイルライフバラ焼豚" says LIFE)
  for (const [i, l] of lines.entries()) for (const [name, re] of SHOPS) if (re.test(NK(l.text))) return { value: name, branch: '', conf: 0.5, line: i, how: 'brand seen on a line' };
  // otherwise the first line that looks like a name (letters, not a phone, address or date)
  for (const [i, l] of head.entries()) {
    const t = NK(l.text).trim();
    if (t.length < 3 || /\d{3,}|^〒|TEL|電話|領収|レシート|\d+[年\/]\d+|[都道府県市区町村]\s*\S*\d/.test(t) || letterRatio(t) < 0.75 || (l.conf ?? 70) < 40) continue;
    if (!/[\p{L}]{3,}/u.test(t)) continue;
    return { value: t.replace(/\s+/g, ' ').slice(0, 40), branch: '', conf: clamp(0.3 + 0.3 * ((l.conf ?? 70) / 100)), line: i, how: 'first line' };
  }
  return null;
}

// phone and invoice-registration number (T + 13 digits): they identify a shop even when its logo cannot be read
export function findIds(lines) {
  let phone = '', reg = '';
  for (const l of lines) {
    const t = NK(l.text);
    if (!reg && (/登録番号/.test(t) || /T\d{13}/.test(t))) {
      const part = t.replace(/^.*登録番号/, '').replace(/^[\s:：]+/, '');
      const body = part.replace(/^[Tt]/, '').replace(/[tilI|]/g, '1').replace(/[Oo]/g, '0').replace(/[^\d]/g, '');
      if (/^\d{13}$/.test(body)) reg = 'T' + body;
      else if (/^\d{14}$/.test(body) && /^[17]/.test(part)) reg = 'T' + body.slice(1);     // the T was read as 1 or 7
    }
    if (!phone) { const m = t.match(/(0\d{1,4})[-ー−\s](\d{1,4})[-ー−\s](\d{3,4})(?!\d)/); if (m) phone = m[1] + m[2] + m[3]; else { const m2 = t.match(/(?:電話|TEL)[^\d]{0,4}(0\d{9,10})(?!\d)/i); if (m2) phone = m2[1]; } }
  }
  return { phone, reg };
}

const goodName = (n) => { const t = n.replace(/\s/g, ''); const L = [...t].filter((c) => /[\p{L}]/u.test(c)).length; return L >= 1 && (L >= 2 || /^[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]$/u.test(t)) && L / Math.max(1, [...t].length) >= 0.6 && !/[都道府県].*[市区町村]|\d{3}-\d{4}/.test(t); };
// the price on a line: the last amount marked with ¥ or 軽, or a negative number on a discount line; else a plain trailing number
function priceOf(t) {
  const all = [...t.matchAll(/(¥\s?-?\s?\d[\d,]*(?:\.\d{1,2})?|-\s?\d[\d,]*|\d[\d,]*(?:\.\d{1,2})?)\s*([軽※*外内])?/g)].filter((m) => m[1].replace(/\D/g, '').length <= 6).map((m) => ({ txt: m[1], mark: m[2] || '', at: m.index, end: m.index + m[0].length }));
  const disc = /値引|割引|クーポン|引|discount/i.test(t);
  const strong = all.filter((x) => x.txt.startsWith('¥') || x.mark || (disc && x.txt.startsWith('-')));
  let pick = strong[strong.length - 1];
  if (!pick && disc && all.length) pick = all[all.length - 1];                // "100円引 100": the minus sign was lost
  if (pick) { const v = money(pick.txt.replace(/\s/g, '')); return v == null ? null : { v, at: pick.at, mark: pick.mark, strong: true }; }
  const m = /\d{7,}/.test(t.replace(/,/g, '')) ? null : t.match(PRICE_END);       // English-style "Rice 5kg 280.00"
  if (!m) return null; const v = money(m[1].replace(/\s/g, '')); return v == null ? null : { v, at: m.index, mark: m[2] || '', strong: false };
}
export function findItems(lines) {
  const items = []; let tax = 0, taxIncluded = false;
  for (const [i, l] of lines.entries()) {
    const t = trimTail(NK(l.text).trim()); if (!t) continue;
    if (/外税|外\s?\d{1,3}\s?%|消費税|\btax\b|\bvat\b/i.test(t)) {
      const all = amountsIn(t), a = all[all.length - 1]; if (/内|うち/.test(t)) taxIncluded = true;
      if (a && /対象/.test(t) && /外/.test(t) && all.length >= 2 && a.v < all[all.length - 2].v) { tax += a.v; continue; }   // "外税 8%対象 356 28": base and tax on one line
      if (a && /外税|外\s?\d{1,3}\s?%|\btax\b|\bvat\b/i.test(t) && !/内|うち|対象/.test(t)) tax += a.v;     // tax printed on top of the item prices
      continue;
    }
    const q = t.match(/^[@＠]?\s?(\d{1,3})\s*[コ個点本]\s*[x×＊*@]\s*(?:単|@)?\s*¥?(\d{1,5})\s*$/) || t.match(/@\s?\d+\s*[x×]\s*(\d{1,2})\s*[点個コ本]/);
    if (q && items.length) { items[items.length - 1].qty = +q[1]; if (q[2]) items[items.length - 1].unit = +q[2]; continue; }
    if (/20\d{2}[^\d\n]{1,2}\d{1,2}[^\d\n]{1,2}\d{1,2}|\d{1,2}\s*[:：]\s*\d{2}/.test(t) || NOT_AMOUNT.test(t)) continue;   // date, time, phone, card and register lines
    if (SKIP_ITEM.test(t) && !/値引|割引|クーポン/.test(t)) continue;
    const pr = priceOf(t); if (!pr || !pr.v) continue;
    const name = t.slice(0, pr.at).replace(/[¥\s.:*＊]+$/, '').replace(/^[^\p{L}\p{N}-]+/u, '').replace(/^[\d\s]*(?=\D)/, '').replace(/^[*＊\s]+/, '').trim();
    const disc = /値引|割引|クーポン|引|discount/i.test(name) && !/ー$/.test(name);
    if (!pr.strong && !(goodName(name) && pr.v >= 10 && name.replace(/[^\p{L}]/gu, '').length >= (/[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u.test(name) ? 1 : 3))) continue;   // an unmarked number is only a price when the name is clearly a word
    const pm = disc ? name.match(/(\d{1,2})\s?%/) : null, ok = goodName(name);
    items.push({ name: ok ? name : '', raw: name, amt: disc && pr.v > 0 ? -pr.v : pr.v, pct: pm ? +pm[1] : 0, reduced: pr.mark === '軽', conf: clamp((0.35 + 0.65 * ((l.conf ?? 70) / 100)) * (ok ? 1 : 0.7)), line: i });
  }
  return { items, tax, taxIncluded };
}

const NOT_AMOUNT = /残高|カード番号|\*{3,}|登録番号|電話|TEL|レジ|セルフ|\d{2,4}-\d{2,4}-\d{3,4}/i;
const PAY_LINE = /支払|PayPay|ペイ|交通系|nanaco|WAON|Suica|PASMO|QUICPay|クレジット|電子マネー/i;
const PAYTOTAL = /支\s*払\s*(合\s*[。.、]*\s*計|総額|金額合計)|お支払\s*合計/;
export function findTotal(lines, items) {
  const cand = [], T = (l) => trimTail(NK(l.text));
  for (const [i, l] of lines.entries()) {                                   // 0. 支払合計 (total payment): the main reference when it can be read
    const t = T(l); if (!PAYTOTAL.test(t) || NOT_AMOUNT.test(t)) continue;
    let a = amountsIn(t).filter((x) => !/%|点|個/.test(t.slice(x.at + x.len, x.at + x.len + 2))).pop();
    if (!a) { const n = amountsIn((lines[i + 1] || {}).text || '').pop(); if (n) a = n; }
    if (a && a.v > 0 && a.v < 5e5) cand.push({ value: a.v, conf: clamp(0.78 + 0.2 * ((l.conf ?? 75) / 100)), line: i, how: '支払合計 (total payment)', src: 'paytotal' });
  }
  for (const [i, l] of lines.entries()) {                                   // 1. a line labelled total
    const t = T(l); if (PAYTOTAL.test(t) || !TOTAL_KEY.test(t) || NOT_TOTAL.test(t.replace(/合計|total/gi, '')) || NOT_AMOUNT.test(t)) continue;
    let a = amountsIn(t).filter((x) => !/%|点|個/.test(t.slice(x.at + x.len, x.at + x.len + 2))).pop();
    if (!a) { const n = amountsIn((lines[i + 1] || {}).text || '').pop(); if (n) a = n; }
    if (a && a.v > 0 && a.v < 5e5) cand.push({ value: a.v, conf: clamp(0.6 + 0.35 * ((l.conf ?? 75) / 100)), line: i, how: 'labelled total', src: 'label' });
  }
  for (const [i, l] of lines.entries()) {                                   // 2. what was paid by card, IC card or app
    const t = T(l); if (!PAY_LINE.test(t) || PAYTOTAL.test(t) || NOT_AMOUNT.test(t) || /お預|お釣|ポイント/.test(t)) continue;
    const a = amountsIn(t).pop(); if (a && a.v >= 10 && a.v < 5e5) cand.push({ value: a.v, conf: clamp(0.55 + 0.3 * ((l.conf ?? 75) / 100)), line: i, how: 'payment line', src: 'pay' });
  }
  let base = 0, taxSum = 0, seen = false;                                    // 3. taxable amount + tax, per rate
  for (const [i, l] of lines.entries()) {
    const t = T(l); if (!/対象(額|金額)/.test(t)) continue;
    const b = amountsIn(t).pop(); if (!b) continue;
    const next = amountsIn(T(lines[i + 1] || { text: '' })).pop();
    seen = true; base += b.v; if (/外税/.test(t) && next && next.v < b.v) taxSum += next.v;
  }
  if (seen && base > 0) cand.push({ value: base + taxSum, conf: 0.6, line: -1, how: 'taxable amount plus tax', src: 'tax' });
  const ext = findItems(lines).tax;                                          // 4. subtotal plus tax printed on top of it
  if (ext > 0) for (const l of lines) { const t = T(l); if (/小計|sub ?total/i.test(t)) { const a = amountsIn(t).pop(); if (a && a.v > 0 && a.v + ext < 5e5) cand.push({ value: a.v + ext, conf: 0.58, line: -1, how: 'subtotal plus tax', src: 'sub' }); } }
  if (cand.length) {
    const sum = items.reduce((s, x) => s + x.amt, 0);
    for (const c of cand) { c.agree = new Set(cand.filter((o) => Math.abs(o.value - c.value) <= 1).map((o) => o.src)).size; if (items.length && (Math.abs(c.value - sum) <= 1 || (ext && Math.abs(c.value - sum - ext) <= 1))) c.agree++; if (c.src === 'paytotal') c.agree++; }
    cand.sort((a, b) => b.agree - a.agree || b.conf - a.conf);
    const pick = cand[0], how = pick.agree > 1 ? `${pick.agree} readings agree` : pick.how;
    return { value: pick.value, src: pick.src, conf: clamp(pick.conf + 0.15 * (pick.agree - 1)), line: pick.line, how, alternatives: [...new Set(cand.filter((c) => Math.abs(c.value - pick.value) > 1).map((c) => c.value))] };
  }
  // no label found: the biggest amount that is not cash handed over, change, tax or an ID number (amounts with ¥ first)
  let big = null;
  for (const needYen of [true, false]) {
    for (const [i, l] of lines.entries()) { const t = T(l); if (NOT_TOTAL.test(t) || NOT_AMOUNT.test(t) || /お預|現金|cash|\d{4}\s*[年\/.\-]|\d{1,2}\s*[:：]\d{2}/i.test(t)) continue; for (const a of amountsIn(t)) if (a.v < 5e5 && (!needYen || /¥/.test(t.slice(Math.max(0, a.at - 1), a.at + 1))) && (!big || a.v > big.value)) big = { value: a.v, conf: needYen ? 0.35 : 0.3, line: i, how: 'largest amount' }; }
    if (big) break;
  }
  return big;
}

// pre-tax amounts the item lines should add up to: the subtotal line, the taxable base, or total minus tax; or the total itself when tax is included
function findTargets(lines, total, tax) {
  const out = [];
  for (const l of lines) {
    const t = trimTail(NK(l.text));
    if (/小計|sub ?total/i.test(t)) { const a = amountsIn(t).pop(); if (a && a.v > 0) out.push(a.v); }
    else if (/対象(額|金額)?/.test(t) && /外|%/.test(t)) { const a = amountsIn(t); const b = a.find((x) => x.v >= 10 && !/%/.test(t.slice(x.at + x.len, x.at + x.len + 1))); if (b && a.length) out.push(a[a.length - 1].v >= (b.v) ? a[a.length - 1].v : b.v); }
  }
  return [...new Set(out)];
}

export function parseReceipt(lines, { known = [], today = new Date(), settle: doSettle = true } = {}) {
  lines = lines.map((l) => ({ text: String(l.text || '').trim(), conf: l.conf })).filter((l) => l.text);
  const date = findDate(lines, today), merchant = findMerchant(lines, known);
  // items stop at the first subtotal/total line: what comes after is payment, change and tax
  const stop = lines.findIndex((l) => /小計|合計|sub ?total|^total/i.test(NK(l.text)));
  const { items } = findItems(stop > 2 ? lines.slice(0, stop + 1) : lines), { tax, taxIncluded } = findItems(lines);
  let total = findTotal(lines, items);
  const subs = findTargets(lines, total, tax);
  // the "total" that was found is only the subtotal while a tax line sits on top of it: the amount paid is subtotal + tax
  if (total && tax > 0 && !taxIncluded && total.src !== 'paytotal' && subs.some((x) => near(x, total.value))) total = { ...total, value: total.value + tax, how: 'subtotal plus tax', conf: Math.min(total.conf, 0.7) };
  const targets = [...subs, ...(total ? [total.value, ...(tax ? [total.value - tax] : [])] : [])];
  const ids = findIds(lines);
  const sum = items.reduce((s, x) => s + x.amt, 0);
  let check = { ok: null, sum, diff: null };
  if (total && items.length) {
    const d = Math.min(Math.abs(sum - total.value), tax ? Math.abs(sum + tax - total.value) : 1e9);
    check = { ok: d <= 1, sum, diff: Math.round(total.value - sum), tax };
    if (check.ok) { total.conf = clamp(total.conf + 0.15); for (const it of items) it.conf = clamp(it.conf + 0.1); }       // two separate readings agree
    else if (total.how === 'labelled total') total.conf = clamp(total.conf - 0.25);
  }
  // "198軽" is often read as "1988": try dropping that last 8 from some items, and keep it only if the receipt then adds up exactly
  if (total && items.length && check.ok === false && items.length <= 14) {
    const idx = items.map((x, i) => (x.amt >= 100 && x.amt % 10 === 8 ? i : -1)).filter((i) => i >= 0).slice(0, 10);
    const want = total.value, ways = [];
    for (let mask = 1; mask < 1 << idx.length; mask++) {
      let sum2 = items.reduce((s2, x) => s2 + x.amt, 0);
      for (let b = 0; b < idx.length; b++) if (mask >> b & 1) sum2 += Math.floor(items[idx[b]].amt / 10) - items[idx[b]].amt;
      if (Math.abs(sum2 - want) <= 1 || (tax && Math.abs(sum2 + tax - want) <= 1)) ways.push(mask);
    }
    if (ways.length === 1) {
      for (let b = 0; b < idx.length; b++) if (ways[0] >> b & 1) { const it = items[idx[b]]; it.was = it.amt; it.amt = Math.floor(it.amt / 10); it.reduced = true; it.conf = Math.min(it.conf, 0.6); }
      const sum2 = items.reduce((s2, x) => s2 + x.amt, 0);
      check = { ok: true, sum: sum2, diff: Math.round(want - sum2), tax, repaired: true };
      total.conf = clamp(total.conf + 0.2);
    }
  }
  const rawItems = items.map((x) => ({ ...x }));
  // item lines (marked with * or ・) whose price could not be read at all: if exactly one is missing, the subtotal tells its price
  const stopAt = stop > 2 ? stop : lines.length, used = new Set(items.map((x) => x.line));
  const ghosts = lines.filter((l, i) => i < stopAt && !used.has(i) && /^[*＊・]\s*\S{2,}/.test(NK(l.text).trim()) && !SKIP_ITEM.test(NK(l.text)) && !/値引|割引|クーポン/.test(NK(l.text)) && !/\d{2,}/.test(NK(l.text).replace(/\d{4}-\d+|[A-Z]\d{6,}/g, ''))).map((l) => l.text);
  if (total && items.length && check.ok === false && total.conf >= 0.7 && !check.repaired) { items.length = 0; check = { ...check, itemsUnreadable: true }; }   // better one correct line than several wrong ones
  if (total && !items.length) items.push({ name: (merchant && merchant.value) || 'Receipt', amt: total.value, reduced: false, conf: 0.4, line: -1, whole: true });
  const res = { merchant, date, total, items, rawItems, tax, taxIncluded, check, targets, subs, ids, ghosts, lineCount: lines.length };
  return doSettle ? settle(res) : res;
}

// split an amount over weights so the parts add up exactly (largest remainder); works in yen or in centavos
function apportion(total, w) {
  const k = Number.isInteger(total) ? 1 : 100, sg = total < 0 ? -1 : 1, T = Math.round(Math.abs(total) * k), W = w.reduce((a, b) => a + Math.max(0, b), 0);
  if (!W || !T) return w.map(() => 0);
  const raw = w.map((x) => (T * Math.max(0, x)) / W), out = raw.map(Math.floor);
  let left = T - out.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, left).forEach(([, i]) => { out[i]++; });
  return out.map((x) => (sg * x) / k);
}
// What was really paid for each item. A discount line belongs to the item above it (a store-wide one is spread over all items),
// and tax printed on top of the prices is shared out by rate (軽 = 8%, otherwise 10%) so the items add up to the amount paid.
export function settle(r) {
  const raw = (r.items || []).filter((x) => !x.whole);
  if (!raw.length || (r.items || []).some((x) => x.whole)) return r;
  const rows = [], wide = [];
  for (const it of raw) {
    if (it.amt < 0) {
      const prev = rows[rows.length - 1], store = /全体|お会計|店内|合計|小計|ポイント|point|total/i.test(it.raw || it.name || '');
      if (prev && !store) { prev.disc += it.amt; prev.discNote = (prev.discNote ? prev.discNote + ', ' : '') + ((it.raw || '').replace(/\s+/g, ' ').trim() || 'discount'); continue; }
      wide.push(it.amt); continue;
    }
    rows.push({ ...it, gross: it.amt, disc: 0, taxShare: 0 });
  }
  if (!rows.length) return r;
  const wd = wide.reduce((a, b) => a + b, 0);
  if (wd) apportion(wd, rows.map((x) => x.gross)).forEach((v, i) => { rows[i].disc += v; rows[i].discNote = rows[i].discNote || 'store discount'; });
  const net = rows.map((x) => x.gross + x.disc), sumNet = net.reduce((a, b) => a + b, 0);
  const T = r.total ? r.total.value : 0, ext = r.taxIncluded ? 0 : r.tax || 0;
  let tax = 0;
  if (ext > 0 && (!T || Math.abs(sumNet + ext - T) <= 1)) {                       // tax on top of the prices
    tax = T ? T - sumNet : ext;
    apportion(tax, rows.map((x, i) => net[i] * (x.reduced ? 0.08 : 0.1))).forEach((v, i) => { rows[i].taxShare = v; });
  }
  else if (T && T > sumNet + 1 && T <= sumNet * 1.1 + 1.5 && T >= sumNet * 1.08 - 1.5) {   // prices before tax and no tax line was read: the gap is 8% / 10% tax
    tax = T - sumNet;
    apportion(tax, rows.map((x, i) => net[i] * (x.reduced ? 0.08 : 0.1))).forEach((v, i) => { rows[i].taxShare = v; });
  }
  const f2 = (x) => Math.round(x * 100) / 100;
  for (const [i, x] of rows.entries()) {
    x.net = net[i]; x.amt = f2(net[i] + x.taxShare);
    const bits = [`¥${x.gross}`]; if (x.disc) bits.push(`${x.disc < 0 ? '−' : '+'} ¥${Math.abs(x.disc)} ${x.discNote || 'discount'}`); if (x.taxShare) bits.push(`+ ¥${x.taxShare} tax`);
    x.note = bits.length > 1 ? bits.join(' ') : '';
  }
  const final = rows.reduce((a, x) => a + x.amt, 0), gross = rows.reduce((a, x) => a + x.gross, 0);
  const ok = T ? Math.abs(final - T) <= 1 : null;
  const check = { ...(r.check || {}), ok: T ? ok : (r.check || {}).ok, sum: f2(final), diff: T ? Math.round(T - final) : null, tax };
  return { ...r, items: rows, check, settled: { gross, discount: gross - sumNet, net: sumNet, tax, paid: T || final } };
}

// lines out of a Tesseract result (v5 gives blocks, older gives lines)
export function linesFromOcr(data) {
  const yOf = (l) => (l.bbox ? { y: (l.bbox.y0 + l.bbox.y1) / 2, h: l.bbox.y1 - l.bbox.y0 } : {});
  if (data && Array.isArray(data.lines) && data.lines.length) return data.lines.map((l) => ({ text: l.text, conf: l.confidence, ...yOf(l) }));
  const out = [];
  for (const b of (data && data.blocks) || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) out.push({ text: l.text, conf: l.confidence, ...yOf(l) });
  return out.length ? out : String((data && data.text) || '').split('\n').map((t) => ({ text: t, conf: undefined }));
}

// ---- two readings of one photo: fix each item line by arithmetic ----
const near = (a, b) => Math.abs(a - b) <= 1;
const fits = (sum, targets, tax) => targets.some((t) => near(sum, t) || (tax && near(sum + tax, t)));
function mergeItems(A0, B0, targets, tax) {
  const [A, B] = A0.length >= B0.length ? [A0, B0] : [B0, A0];     // the longer reading is the frame; the other is lined up against it
  const rows = A.map((a) => ({ c: [a] })), used = new Set();
  A.forEach((a, i) => {
    for (const j of [i, i - 1, i + 1, i - 2, i + 2]) {
      const b = B[j]; if (!b || used.has(j)) continue;
      if (a.amt === b.amt || (a.name && b.name && similarity(a.name, b.name) >= 0.5) || (a.pct && b.pct && a.pct === b.pct)) { rows[i].c.push(b); used.add(j); break; }
    }
  });
  B.forEach((b, j) => { if (!used.has(j) && A.length === 0) rows.push({ c: [b] }); });
  // a discount with a percent tells the price above it: 30% off = ¥57 means ¥190
  rows.forEach((r, i) => { const nx = rows[i + 1]; if (!nx) return; const d = nx.c.find((x) => x.pct && x.amt < 0); if (d && !r.c[0].pct) { const p = Math.round((-d.amt * 100) / d.pct); if (p > 0 && !r.c.some((x) => near(x.amt, p))) r.c.push({ ...r.c[0], amt: p, conf: 0.5, viaPct: true }); } });
  const var_ = rows.map((r, i) => (new Set(r.c.map((x) => x.amt)).size > 1 ? i : -1)).filter((i) => i >= 0).slice(0, 10);
  const build = (mask, drop) => rows.map((r, i) => { if (i === drop) return null; const k = var_.indexOf(i); const pick = k >= 0 && (mask >> k & 1) ? r.c.find((x) => x.amt !== r.c[0].amt) : r.c[0]; return pick; }).filter(Boolean);
  const tries = [-1, ...rows.map((r, i) => i).filter((i) => rows[i].c[0].conf < 0.6 || !rows[i].c[0].name)];
  for (const drop of tries) {                                                    // first try as read, then without one doubtful line
    const hits = [];
    for (let mask = 0; mask < 1 << var_.length; mask++) { const its = build(mask, drop); if (its.length && fits(its.reduce((s2, x) => s2 + x.amt, 0), targets, tax)) hits.push(its); }
    if (hits.length) {
      hits.sort((x, y) => x.reduce((s2, it) => s2 + (it.viaPct ? 1 : 0), 0) - y.reduce((s2, it) => s2 + (it.viaPct ? 1 : 0), 0));
      const best = hits[0];
      return { items: best.map((it) => { const r = rows.find((rr) => rr.c.includes(it)) || { c: [it] }, nm = r.c.map((x) => x.name).filter(Boolean).sort((x, y) => y.length - x.length)[0]; return { ...it, name: it.name || nm || '', conf: it.viaPct ? 0.55 : Math.min(1, it.conf + 0.1) }; }), ok: true, dropped: drop >= 0, unique: hits.length === 1 };
    }
  }
  // last resort: a thin leading 1 is often lost ("¥90" for ¥190, "¥08" for ¥108): try putting it back on up to 8 lines
  const thin = rows.map((r, i) => (r.c[0].amt > 0 && r.c[0].amt < 1000 ? i : -1)).filter((i) => i >= 0).slice(0, 8), found = [];
  for (let mask = 1; mask < 1 << thin.length; mask++) {
    const its = rows.map((r, i) => { const k = thin.indexOf(i); return k >= 0 && (mask >> k & 1) ? { ...r.c[0], amt: Number('1' + String(r.c[0].amt).replace(/^0+/, '')), viaDigit: true, conf: 0.5 } : r.c[0]; });
    if (fits(its.reduce((s2, x) => s2 + x.amt, 0), targets, tax)) found.push(its);
  }
  if (found.length === 1) return { items: found[0], ok: true, unique: true };
  return { items: rows.map((r) => r.c[0]), ok: false };
}
export function parseBoth(a, b, opts = {}) {
  const pa = parseReceipt(a, { ...opts, settle: false }); if (!b) return settle(pa);
  const pb = parseReceipt(b, { ...opts, settle: false }), pick = (x, y, f) => { const u = f(x), v = f(y); return !u ? v : !v ? u : (v.conf > u.conf ? v : u); };
  const out = { ...pa };
  out.date = pick(pa, pb, (r) => r.date); out.merchant = pick(pa, pb, (r) => r.merchant);
  if (pa.merchant && pb.merchant && pa.merchant.value === pb.merchant.value) out.merchant = { ...out.merchant, conf: clamp(out.merchant.conf + 0.05) };
  out.ids = { phone: pa.ids.phone || pb.ids.phone, reg: pa.ids.reg || pb.ids.reg };
  // totals: two readings that agree beat one; a total that fits the other reading's subtotal beats one that does not
  const targets = [...new Set([...pa.subs, ...pb.subs])], taxes = [pa.tax, pb.tax].filter(Boolean);
  const cands = [pa.total, pb.total].filter((t) => t && t.value >= 10);
  for (const c of cands) { c.support = (c.src === 'paytotal' ? 1 : 0) + cands.filter((o) => near(o.value, c.value)).length + (targets.some((t) => near(t, c.value)) ? 1 : 0) + (taxes.some((x) => targets.some((t) => near(t + x, c.value))) ? 1 : 0); }
  cands.sort((x, y) => y.support - x.support || y.conf - x.conf);
  if (cands[0]) out.total = { ...cands[0], conf: clamp(cands[0].conf + 0.1 * (cands[0].support - 1)), how: cands[0].support > 1 ? 'both readings agree' : cands[0].how };
  else out.total = pa.total || pb.total;
  const tax = taxes.length ? Math.max(...taxes) : 0, T0 = out.total ? out.total.value : 0;
  // pre-tax amount implied by the total: Japan's 8% and 10% rates (tax is rounded down per rate, so allow a yen either way)
  const tg = T0 ? [...new Set([...targets, T0, ...(tax ? [T0 - tax] : []), Math.round(T0 / 1.08), Math.round(T0 / 1.1)])] : targets;
  // items: line up both readings and keep the combination that adds up to the subtotal or total
  const m = mergeItems(pa.rawItems.filter((x) => !x.whole), pb.rawItems.filter((x) => !x.whole), tg, tax);
  out.tax = tax; out.targets = tg;
  let sum = m.items.reduce((s2, x) => s2 + x.amt, 0);
  if (!m.ok && m.items.length >= 2) {                                              // one price is wrong or missing in both readings: the subtotal tells what it must be
    const gaps = [...new Set([...pa.subs, ...pb.subs, ...(tax && T0 ? [T0 - tax] : [])])];
    const fixes = [];
    m.items.forEach((it, i) => { if (it.amt > 0 && (!it.name || it.conf < 0.5)) for (const t of gaps) { const v = t - (sum - it.amt); if (v >= 10 && v <= 30000 && v !== it.amt) fixes.push({ i, v }); } });
    if (fixes.length && new Set(fixes.map((f) => f.i)).size === 1 && new Set(fixes.map((f) => f.v)).size === 1) {
      const f = fixes[0]; m.items = m.items.map((it, i) => (i === f.i ? { ...it, was: it.amt, amt: f.v, conf: 0.45, implied: true } : it)); m.ok = true; sum += f.v - m.items[f.i].was;
    } else if (Math.max((pa.ghosts || []).length, (pb.ghosts || []).length) === 1) {          // a line whose price vanished completely
      const g = gaps.map((t) => t - sum).filter((x) => x >= 10 && x <= 30000);
      if (new Set(g).size === 1) { m.items = [...m.items, { name: '', raw: (pa.ghosts[0] || pb.ghosts[0] || ''), amt: g[0], reduced: false, conf: 0.45, line: 9999, implied: true }]; m.ok = true; sum += g[0]; }
    }
  }
  if (m.ok && out.total) { out.items = m.items; out.check = { ok: true, sum, diff: Math.round(out.total.value - sum), tax, merged: true, dropped: m.dropped }; out.total.conf = clamp(out.total.conf + 0.1); }
  else if (out.total && m.items.length) { out.items = []; out.check = { ok: false, sum, diff: Math.round(out.total.value - sum), tax, itemsUnreadable: true }; }
  else { out.items = pa.items.length ? pa.items : pb.items; out.check = pa.check; }
  if (out.total && !out.items.length) out.items = [{ name: (out.merchant && out.merchant.value) || 'Receipt', amt: out.total.value, reduced: false, conf: 0.4, line: -1, whole: true }];
  out.rawItems = out.items.map((x) => ({ ...x }));
  return settle(out);
}

// kept for older callers
export function bestLines(a, b, opts = {}) {
  const score = (lines) => { const r = parseReceipt(lines, opts); return (r.total ? 2 * r.total.conf : 0) + (r.date ? r.date.conf : 0) + (r.merchant ? r.merchant.conf : 0) + (r.check && r.check.ok ? 0.5 : 0) + (r.check && r.check.ok === false ? -0.3 : 0); };
  return score(b) > score(a) ? b : a;
}

// Two photos of one long receipt, top part then next part, overlapping by a few lines: drop the lines that are read twice.
export function joinLines(A, B, maxOverlap = 18) {
  if (!A.length) return B.slice(); if (!B.length) return A.slice();
  const key = (l) => NK(l.text).replace(/[\s¥,.\-*]/g, '').toLowerCase();
  const same = (x, y) => { const a = key(x), b = key(y); return a.length >= 3 && b.length >= 3 && (a === b || similarity(a, b) >= 0.8); };
  for (let k = Math.min(maxOverlap, A.length, B.length); k >= 1; k--) {
    let ok = 0; for (let i = 0; i < k; i++) if (same(A[A.length - k + i], B[i])) ok++;
    if (ok >= Math.max(1, Math.ceil(k * 0.6)) && (k > 1 || key(B[0]).length >= 6)) return [...A, ...B.slice(k)];
  }
  return [...A, ...B];
}
