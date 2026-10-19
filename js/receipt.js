// Receipt text -> merchant, date, total, items, with a confidence for each. Pure functions (no browser needed), so they can be tested.
// Input: lines of text as read by OCR: [{text, conf}] (conf 0-100, optional). Written for Japanese supermarket receipts (LIFE, イオン…) and also reads English ones.
//
// The confidence is a rough score of "how much to trust this field": how well the OCR read the line, how well the rules fit,
// and cross-checks (do the items add up to the total?). It is not a calibrated probability.

const CJK = '\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}ー';
const GAP = new RegExp(`(?<=[${CJK}])\\s+(?=[${CJK}])|(?<=\\d)\\s+(?=[${CJK}])`, 'gu');
// OCR puts spaces between Japanese characters ("ライ フ 塚越 店") and reads ¥ as a backslash: tidy both
const NK = (s) => String(s || '').normalize('NFKC').replace(/[￥円]/g, '¥').replace(/\\(?=\s?\d)/g, '¥').replace(GAP, '');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// shops we can name with certainty (display name is what you probably typed before; history can override it)
export const SHOPS = [
  ['LIFE', /ライフ|\bLIFE\b/i], ['AEON', /イオン|\bAEON\b/i], ['Maruetsu', /マルエツ/], ['Seiyu', /西友|SEIYU/i], ['Ito-Yokado', /イトーヨーカドー|イトーヨーカ堂/],
  ['Daiei', /ダイエー/], ['OK Store', /オーケー|\bOK\b store/i], ['Maibasket', /まいばすけっと/], ['Summit', /サミット/], ['Gyomu Super', /業務スーパー/],
  ['7-Eleven', /セブン[- ]?イレブン|7[- ]?eleven/i], ['FamilyMart', /ファミリーマート|family ?mart/i], ['Lawson', /ローソン|lawson/i],
  ['Don Quijote', /ドン・?キホーテ|ドンキ/], ['Daiso', /ダイソー|daiso/i], ['Matsumoto Kiyoshi', /マツモトキヨシ|マツキヨ/], ['Uniqlo', /ユニクロ|uniqlo/i],
  ['SM Supermarket', /\bSM (supermarket|hypermarket)/i], ['Puregold', /puregold/i], ['Jollibee', /jollibee/i], ["McDonald's", /mcdonald|マクドナルド/i], ['Starbucks', /starbucks|スターバックス/i],
];
const SKIP_ITEM = /小計|合計|総合計|お買上|お預|おあずかり|お釣|おつり|釣銭|税|対象|ポイント|現金|クレジット|カード|電話|TEL|登録番号|レジ|担当|責任者|領収|点数|ご利用|ありがとう|ご来店|変更|交換|返品|レシート|No\.?|subtotal|total|change|cash|tax|vat/i;
const TOTAL_KEY = /合計|お買上げ?計|総合計|ご請求|お支払い?金額|お会計|total|amount due/i;
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

export function findMerchant(lines, known = []) {
  const head = lines.slice(0, 8);
  for (const [i, l] of head.entries()) for (const [name, re] of SHOPS) if (re.test(NK(l.text))) {
    const branch = NK(l.text).replace(re, ' ').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
    return { value: name, branch: branch.length >= 2 && branch.length <= 14 ? branch : '', conf: clamp(0.8 + 0.2 * ((l.conf ?? 80) / 100)), line: i, how: 'known shop' };
  }
  // a name already in your history that appears in the first lines
  for (const [i, l] of head.entries()) { const t = NK(l.text).toLowerCase(); for (const k of known) if (k.length >= 4 && t.includes(k.toLowerCase())) return { value: k, branch: '', conf: 0.75, line: i, how: 'in your history' }; }
  // otherwise the first line that looks like a name (letters, not a phone, address or date)
  for (const [i, l] of head.entries()) {
    const t = NK(l.text).trim();
    if (t.length < 3 || /\d{3,}|^〒|TEL|電話|領収|レシート|\d+[年\/]\d+|[都道府県市区町村]\s*\S*\d/.test(t)) continue;
    if (!/[\p{L}]{3,}/u.test(t)) continue;
    return { value: t.replace(/\s+/g, ' ').slice(0, 40), branch: '', conf: clamp(0.3 + 0.3 * ((l.conf ?? 70) / 100)), line: i, how: 'first line' };
  }
  return null;
}

export function findItems(lines) {
  const items = []; let tax = 0, taxIncluded = false;
  for (const [i, l] of lines.entries()) {
    const t = NK(l.text).trim(); if (!t) continue;
    if (/外税|消費税|\btax\b|\bvat\b/i.test(t)) {
      const a = amountsIn(t).pop(); if (/内/.test(t)) taxIncluded = true;
      if (a && /外税|\btax\b|\bvat\b/i.test(t) && !/内/.test(t)) tax += a.v;     // tax printed on top of the item prices
      continue;
    }
    const q = t.match(/^(\d{1,3})\s*[コ個点]\s*[x×＊*@]\s*(?:単|@)?\s*¥?(\d{1,5})\s*$/);
    if (q && items.length) { items[items.length - 1].qty = +q[1]; items[items.length - 1].unit = +q[2]; continue; }
    if (SKIP_ITEM.test(t) && !/値引|割引|クーポン/.test(t)) continue;
    const m = t.match(PRICE_END); if (!m) continue;
    const name = t.slice(0, m.index).replace(/[¥\s.:*]+$/, '').replace(/^[\d\s]*(?=\D)/, '').trim();
    const amt = money(m[1].replace(/\s/g, '')); if (amt == null || !name || name.length < 1) continue;
    const disc = /値引|割引|クーポン|discount/i.test(name);
    items.push({ name, amt: disc && amt > 0 ? -amt : amt, reduced: m[2] === '軽', conf: clamp(0.35 + 0.65 * ((l.conf ?? 70) / 100)), line: i });
  }
  return { items, tax, taxIncluded };
}

export function findTotal(lines, items) {
  const cand = [];
  for (const [i, l] of lines.entries()) {
    const t = NK(l.text); if (!TOTAL_KEY.test(t) || NOT_TOTAL.test(t.replace(/合計|total/gi, ''))) continue;
    let a = amountsIn(t).filter((x) => !/%|点|個/.test(t.slice(x.at + x.len, x.at + x.len + 2))).pop();
    if (!a) { const n = amountsIn((lines[i + 1] || {}).text || '').pop(); if (n) a = n; }
    if (a && a.v > 0) cand.push({ value: a.v, conf: clamp(0.6 + 0.35 * ((l.conf ?? 75) / 100)), line: i, how: 'labelled total' });
  }
  const sum = items.reduce((s, x) => s + x.amt, 0);
  if (cand.length) { cand.sort((a, b) => b.value - a.value); const pick = cand.find((c) => items.length && Math.abs(c.value - sum) <= 1) || cand[cand.length - 1]; return { ...pick, alternatives: cand.filter((c) => c !== pick).map((c) => c.value) }; }
  // no label found: the biggest amount that is not cash handed over, change or tax
  let big = null;
  for (const [i, l] of lines.entries()) { const t = NK(l.text); if (NOT_TOTAL.test(t) || /お預|現金|cash|\d{4}\s*[年\/.\-]|\d{1,2}\s*[:：]\d{2}|TEL|電話|\d{2,4}-\d{2,4}-\d{3,4}|登録番号/i.test(t)) continue; for (const a of amountsIn(t)) if (a.v < 1e6 && (!big || a.v > big.value)) big = { value: a.v, conf: 0.3, line: i, how: 'largest amount' }; }
  return big;
}

export function parseReceipt(lines, { known = [], today = new Date() } = {}) {
  lines = lines.map((l) => ({ text: String(l.text || '').trim(), conf: l.conf })).filter((l) => l.text);
  const date = findDate(lines, today), merchant = findMerchant(lines, known);
  // items stop at the first subtotal/total line: what comes after is payment, change and tax
  const stop = lines.findIndex((l) => /小計|合計|sub ?total|^total/i.test(NK(l.text)));
  const { items } = findItems(stop > 2 ? lines.slice(0, stop + 1) : lines), { tax, taxIncluded } = findItems(lines);
  const total = findTotal(lines, items);
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
      if (Math.abs(sum2 - want) <= 1) ways.push(mask);
    }
    if (ways.length === 1) {
      for (let b = 0; b < idx.length; b++) if (ways[0] >> b & 1) { const it = items[idx[b]]; it.was = it.amt; it.amt = Math.floor(it.amt / 10); it.reduced = true; it.conf = Math.min(it.conf, 0.6); }
      const sum2 = items.reduce((s2, x) => s2 + x.amt, 0);
      check = { ok: true, sum: sum2, diff: Math.round(want - sum2), tax, repaired: true };
      total.conf = clamp(total.conf + 0.2);
    }
  }
  return { merchant, date, total, items, tax, taxIncluded, check, lineCount: lines.length };
}

// lines out of a Tesseract result (v5 gives blocks, older gives lines)
export function linesFromOcr(data) {
  if (data && Array.isArray(data.lines) && data.lines.length) return data.lines.map((l) => ({ text: l.text, conf: l.confidence }));
  const out = [];
  for (const b of (data && data.blocks) || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) out.push({ text: l.text, conf: l.confidence });
  return out.length ? out : String((data && data.text) || '').split('\n').map((t) => ({ text: t, conf: undefined }));
}
