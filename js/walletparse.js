// Reads the text of a Wallet screenshot of a transit card (Pasmo, Suica...): "Latest Transactions".
// Pure text in, rows out. Each row: the station you tapped OUT at (big line), "From <station> - Transit" (where you tapped in),
// or "Purchase" (a shop or machine: not a ride), and how long ago it was ("2 hours ago", "Yesterday").
// The screenshot has no exact times, so a time is estimated from "N hours ago" and a date from "Yesterday" or a printed date.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const plain = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[|_]+/g, ' ').replace(/\s+/g, ' ').trim();
const Y = '[¥￥\\\\]';                                                // the reader often turns the yen sign into a backslash
const yen = (s) => { const m = String(s).match(new RegExp(Y + '\\s?([\\d][\\d,\\.]*)')); return m ? Math.round(parseFloat(m[1].replace(/,/g, ''))) : null; };
const station = (s) => plain(s).replace(/\s+stat(i(on?)?)?\.{0,3}\s*$/i, '').replace(/[>›»\s]+$/, '').trim();

// "2 hours ago", "17 hours ago", "Yesterday", "3 days ago", "Oct 28", "Oct 28, 2026", "Just now"
export function parseWhen(text, now = new Date()) {
  const t = plain(text).toLowerCase(); if (!t) return null;
  let m = t.match(/(\d+)\s*(min|minute|hour|hr|day)s?\b.*\bago/);
  if (m) { const n = +m[1], ms = /day/.test(m[2]) ? 864e5 : /hour|hr/.test(m[2]) ? 36e5 : 6e4; return { at: new Date(now.getTime() - n * ms), exactTime: !/day/.test(m[2]) }; }
  if (/^(just now|now|a moment ago)$/.test(t)) return { at: new Date(now), exactTime: true };
  if (/^(an?|one)\s+hour ago$/.test(t)) return { at: new Date(now.getTime() - 36e5), exactTime: true };
  if (/^today/.test(t)) { const d = new Date(now); d.setHours(12, 0, 0, 0); return { at: d, exactTime: false }; }
  // older rows show the weekday ("Saturday"): the most recent such day before the screenshot
  m = t.match(/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/);
  if (m) { const want = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1]), d = new Date(now); d.setHours(12, 0, 0, 0); let back = (now.getDay() - want + 7) % 7; if (back === 0) back = 7; d.setDate(d.getDate() - back); return { at: d, exactTime: false }; }
  if (/^yesterday/.test(t)) { const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(12, 0, 0, 0); return { at: d, exactTime: false }; }
  m = t.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (m && MONTHS.includes(m[1])) { const d = new Date(m[3] ? +m[3] : now.getFullYear(), MONTHS.indexOf(m[1]), +m[2], 12, 0, 0); if (!m[3] && d > now) d.setFullYear(d.getFullYear() - 1); return { at: d, exactTime: false }; }
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return { at: new Date(y, +m[1] - 1, +m[2], 12, 0, 0), exactTime: false }; }
  return null;
}

// text: the lines read from the screenshot, one per line. now: when the screenshot was taken (default now).
export function parseWalletText(text, now = new Date()) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const out = { balance: null, rows: [], skipped: 0, clock: null };
  const cm = lines.slice(0, 4).join(' ').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (cm) { out.clock = { h: +cm[1], m: +cm[2] }; }
  const bi = lines.findIndex((l) => /^balance\b/i.test(plain(l)));
  if (bi >= 0) for (const l of lines.slice(bi, bi + 3)) { const v = yen(l); if (v != null) { out.balance = v; break; } }
  const start = lines.findIndex((l) => /latest transactions?/i.test(l)); let i = start >= 0 ? start + 1 : 0;
  const isAmt = (l) => new RegExp(Y + '\\s?\\d').test(l) && (start >= 0 || !/add money|balance/i.test(l));
  for (; i < lines.length; i++) {
    if (!isAmt(lines[i])) continue;
    const amount = yen(lines[i]), title = lines[i].replace(new RegExp(Y + '\\s?[\\d,\\.]+.*$'), '').replace(/^[^A-Za-z぀-ヿ一-鿿]+/, '').trim();
    const sub = lines[i + 1] || '', when = lines[i + 2] || '';
    if (amount == null || !title) continue;
    const fm = plain(sub).match(/^from\s+(.+?)\s*(?:[-–—]+\s*(?:tran\w*|tr\W*)?)?\.{0,3}\s*$/i), pu = /^(purchase|payment|charge)/i.test(plain(sub)), tu = /^(add money|top.?up|credit|added)/i.test(plain(sub)) || /\+\s?[¥￥\\]/.test(lines[i]) || /^(add money|top.?up)/i.test(plain(title));
    const w = parseWhen(when, now);
    if (!w || (!fm && !pu && !tu)) { out.skipped++; continue; }           // a row cut off at the bottom of the screenshot, or something unknown
    const row = { amount, when: w.at, exactTime: w.exactTime, ago: plain(when) };
    if (tu) Object.assign(row, { kind: 'topup', place: plain(title) });
    else if (pu) Object.assign(row, { kind: 'purchase', place: plain(title) });
    else Object.assign(row, { kind: 'transit', to: station(title), from: station(fm[1].replace(/\s*[-–—]+\s*tr.*$/i, '')) });
    out.rows.push(row); i += 2;
  }
  return out;
}
