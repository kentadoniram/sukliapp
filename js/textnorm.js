// Name cleaning and fuzzy matching, so "ファミリーマート 渋谷店", "ﾌｧﾐﾘｰﾏｰﾄ" and "FamilyMart" can be recognised as the same place.
// Plain functions, no downloads. Used by the guesser (predict.js), recurring payments and habits.

const HIRA = /[ぁ-ゖ]/g;
const toKata = (s) => s.replace(HIRA, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
const RECEIPT_PREFIX = /^(sq|tst|sp|pp|paypal|pay|stripe|amzn|amazon mktp|gcash|maya|ec|web|pos)\s*[*＊#]\s*/i;
const BRANCH_JA = /\s*[　 ]*([^\s]{0,12}?(?:店|支店|本店|営業所|出張所|センター店|駅前店|[0-9０-９]+号店))$/;
const BRANCH_EN = /\s+(?:branch|store|shop|outlet|mall|station|#\s*\d+|no\.?\s*\d+)\b.*$/i;

// the cleaned form: same text for the same place, whatever the width, kana type, case or branch label
export function canon(name) {
  let s = String(name || '');
  try { s = s.normalize('NFKC'); } catch { /* old browser */ }   // full-width to half-width, ﾊﾝｶｸ to ハンカク, ① to 1
  s = s.toLowerCase().replace(/[　\s]+/g, ' ').trim();
  s = s.replace(RECEIPT_PREFIX, '');
  s = toKata(s);                                             // しんじゅく and シンジュク are one word
  s = s.replace(/[ー－―‐-]/g, (c) => (c === 'ー' ? 'ー' : '-'));
  const before = s;
  s = s.replace(BRANCH_JA, (m, b) => (before.length - m.length >= 2 ? '' : m));   // keep it if nothing would be left
  s = s.replace(BRANCH_EN, '');
  s = s.replace(/\b\d{4,}\b/g, ' ');                         // long codes and card numbers
  s = s.replace(/[*＊#"'`´~^|\\/<>()[\]{}【】「」『』（）［］・、。,.:;!?！？]+/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

// edit distance, capped: returns max+1 as soon as the strings are further apart than max
export function distance(a, b, max = 99) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev = Array.from({ length: lb + 1 }, (_, i) => i), cur = new Array(lb + 1);
  for (let i = 1; i <= la; i++) {
    cur[0] = i; let rowMin = cur[0];
    for (let j = 1; j <= lb; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[lb];
}

// 0..1, 1 = same. Works on cleaned names; spaces are ignored so "family mart" matches "familymart".
export function similarity(a, b) {
  const x = a.replace(/ /g, ''), y = b.replace(/ /g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  const len = Math.max(x.length, y.length);
  const maxEdits = Math.max(1, Math.floor(len * 0.3));
  const d = distance(x, y, maxEdits);
  return d > maxEdits ? 0 : 1 - d / len;
}

// the closest known name to `name` (both already cleaned), or null. Short names must match exactly.
export function nearest(name, keys, min = 0.8) {
  const q = String(name || '').replace(/ /g, '');
  if (q.length < 4) return null;
  let best = null, bs = 0;
  for (const k of keys) {
    if (Math.abs(k.length - name.length) > Math.max(2, name.length * 0.3)) continue;
    const s = similarity(name, k);
    if (s > bs) { bs = s; best = k; }
  }
  return bs >= min ? { key: best, score: bs } : null;
}
