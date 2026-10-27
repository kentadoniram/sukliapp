import { parseReceipt } from '../js/receipt.js';
const L = (s) => s.trim().split('\n').map((text) => ({ text }));
const today = new Date('2026-10-19'); let bad = 0;
const t = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
// tax added on top (外税)
let r = parseReceipt(L(`ライフ 西新井店
2026/10/12 19:03 レジ02
卵 10個 258軽
納豆 3P 98軽
洗剤 328
小計 684
外税 8%対象 356 28
外税 10%対象 328 32
合計 744
お預り 1000
お釣り 256`), { today });
t('LIFE, tax on top: total 744', r.total.value === 744); t('items add up with tax', r.check.ok && r.items.length === 3); t('date', r.date.value === '2026-10-12');
// English receipt, no 合計 label
r = parseReceipt(L(`Puregold Antipolo
10/05/2026
Rice 5kg 280.00
Eggs 12s 96.50
TOTAL 376.50
CASH 400.00
CHANGE 23.50`), { today });
t('English total 376.50', r.total.value === 376.5); t('merchant Puregold', r.merchant.value === 'Puregold');
// no total label at all: falls back with low confidence
r = parseReceipt(L(`谷中商店
2026年10月1日
パン 150
牛乳 200
350
お預り 500`), { today });
t('fallback total is flagged low', r.total && r.total.value === 350 && r.total.conf <= 0.5);
// future / impossible dates are rejected
r = parseReceipt(L(`ライフ
2027/01/05
合計 100`), { today }); t('future date rejected', !r.date);
r = parseReceipt(L(`ライフ\n2026/02/30\n合計 100`), { today }); t('impossible date rejected', !r.date);
// 軽 misread as 8 is repaired only when it makes the receipt add up
r = parseReceipt(L(`ライフ\n2026/10/12\n牛乳 1988\n卵 2588\n合計 456`), { today });
t('8 repair', r.check.repaired && r.items[0].amt === 198 && r.items[1].amt === 258);
r = parseReceipt(L(`ライフ\n2026/10/12\n牛乳 1988\n卵 2588\n合計 999`), { today });
t('no repair when it would not fit', !r.check.repaired && r.check.ok === false);
// ---- v11: 支払合計, subtotal + tax, discounts on the item above
{
  const L = (a) => a.map((text) => ({ text }));
  const base = ['ライフ川崎店', '2026年10月19日 20:31', '*白身フライ ¥299', 'シール割引 30% -90', '*サントリー ¥108', '小計 ¥317', '外8% ¥25'];
  const a = parseReceipt(L([...base, '合計 ¥317', '支払合計 ¥342']), { today: new Date('2026-10-20') });
  t('支払合計 is the main total', a.total.value === 342 && a.total.src === 'paytotal');
  const b = parseReceipt(L([...base, '合計 ¥317']), { today: new Date('2026-10-20') });
  t('a total equal to the subtotal becomes subtotal + tax', b.total.value === 342);
  t('discount attaches to the item above (2 items, final prices add up)', a.items.length === 2 && Math.abs(a.items.reduce((s, i) => s + i.amt, 0) - 342) < 0.5 && a.items[0].disc === -90);
}
process.exit(bad ? 1 : 0);
// thousands marks mangled by the reader (v12an): "¥2, 227", "¥2.,227", "\1.675", "\2.063"
{
  const { parseReceipt } = await import('../js/receipt.js');
  const mk = (...l) => l.map((text) => ({ text }));
  const a = parseReceipt(mk('ライフ', '2026年10月25日(日)19:20', '*牛乳 ¥1.675', '小計 \\1.675', '合計 ¥1, 675', '支払合計 ¥1.,675'), { today: new Date('2026-10-26') });
  console.log((a.total && a.total.value === 1675 ? 'PASS ' : 'FAIL ') + 'amount with space, dot-comma or dot as thousands mark reads as 1675 (got ' + (a.total && a.total.value) + ')');
  const b = parseReceipt(mk('*牛乳 ¥198', '合計 ¥2,227'), { today: new Date('2026-10-26') });
  console.log((b.total && b.total.value === 2227 ? 'PASS ' : 'FAIL ') + 'normal 2,227 unchanged');
  const c = parseReceipt(mk('*うどん ¥198', 'お預り ¥1, 000', 'お釣り ¥802', '合計 ¥198'), { today: new Date('2026-10-26') });
  console.log((c.total && c.total.value === 198 ? 'PASS ' : 'FAIL ') + 'tendered cash with a space is not the total (got ' + (c.total && c.total.value) + ')');
}
