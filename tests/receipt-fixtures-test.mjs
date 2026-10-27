// Real OCR output (both readings) of four phone photos: LIFE and three cisca receipts, two of them sideways, one crumpled.
import fs from 'node:fs';
import { parseBoth, joinLines } from '../js/receipt.js';
let bad = 0; const t = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
const want = {
  life: { date: '2026-10-19', time: '20:31', total: 754, amts: [299, -90, 190, -57, 249, 108], phone: '0445443721', reg: 'T9010001060208' },
  life2: { today: '2026-10-26', date: '2026-10-25', time: '19:20', total: 2227, amts: [5, 199, 109, 108, 324, 229, -69, 219, -66, 1675, -670], phone: '0445443721', reg: 'T9010001060208' },
  cisca1: { date: '2026-10-19', time: '16:31', total: 419, amts: [238, 150], reg: 'T4010001030181' },
  cisca2: { date: '2026-10-19', time: '16:29', total: 190, amts: [276, -100] },
  cisca3: { date: '2026-10-19', time: '16:31', total: 155, amts: [144], reg: 'T4010001030181' },
};
for (const [n, w] of Object.entries(want)) {
  const j = JSON.parse(fs.readFileSync(new URL('./fixtures/' + n + '.json', import.meta.url), 'utf8'));
  const r = parseBoth(j.first, j.second, { today: new Date(w.today || '2026-10-20'), known: [] });
  t(n + ' date/time', r.date && r.date.value === w.date && r.date.time === w.time);
  t(n + ' total', r.total && r.total.value === w.total);
  t(n + ' items add up and match', r.check.ok && JSON.stringify(r.rawItems.map((i) => i.amt)) === JSON.stringify(w.amts));
  t(n + ' final prices add up to the amount paid', Math.abs(r.items.reduce((a, i) => a + i.amt, 0) - r.total.value) < 0.5);
  if (n === 'life') { t('life: discounts attach to items (4 items)', r.items.length === 4); t('life: final prices', JSON.stringify(r.items.map((i) => i.amt)) === '[225,143,269,117]'); t('life: tax and discount summary', r.settled.tax === 55 && r.settled.discount === 147 && r.settled.paid === 754); }
  if (n === 'life2') { t('life2: 8 items with discounts attached', r.items.length === 8); t('life2: the 3-pack keeps its name and count', r.items.some((i) => /クラフトボス/.test(i.name) && i.qty === 3)); t('life2: 5 yen is the bag', r.items.some((i) => i.name === 'レジ袋' && i.amt === 5)); t('life2: grade 5 keeps its 5', r.items.some((i) => /^5等級/.test(i.name))); }
  if (w.phone) t(n + ' phone', r.ids.phone === w.phone);
  if (w.reg) t(n + ' invoice no.', r.ids.reg === w.reg);
}
{ // a long receipt read from two photos (synthetic: 24 items, one price unreadable in both readings)
  const j = JSON.parse(fs.readFileSync(new URL('./fixtures/long_multi.json', import.meta.url), 'utf8')), r = parseBoth(j.first, j.second, { today: new Date('2026-10-21'), known: [] });
  t('long: 24 items, paid 5971', r.items.length === 24 && r.total.value === 5971 && Math.abs(r.items.reduce((a, i) => a + i.amt, 0) - 5971) < 0.5);
  t('long: the unreadable price is worked out and flagged', r.items.some((i) => i.implied && i.gross === 328));
  const A = [{ text: 'a' }, { text: 'ミルク ¥198' }, { text: 'パン ¥128' }], B = [{ text: 'ミルク ¥198' }, { text: 'パン ¥128' }, { text: 'バナナ ¥238' }];
  t('joinLines drops the lines read twice', joinLines(A, B).length === 4);
}
process.exit(bad ? 1 : 0);
