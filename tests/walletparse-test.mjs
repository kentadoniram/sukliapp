import { parseWalletText, parseWhen } from '../js/walletparse.js';
let fails = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
const OCR = `23:28 am ua > &
Balance
¥809 Add Money
Tap and Go with 4
Express Mode
Hold iPhone near a reader to
ride without double-clicking.
Latest Transactions
Kawasaki Station ¥528 >
From Kita-Senju Station — Tran...
2 hours ago
Kita-Senju Station ¥1,393 >
From Tobu-nikko Station — Tr...
3 hours ago
Tobu-nikko Station ¥1,393 >
From Kita-Senju Station — Tr...
15 hours ago
Kita-Senju Station ¥616 >
From Yako Station — Transit
17 hours ago
Kawasaki, Kanagawa ¥494 >
Purchase
Yesterday
(ea) Kawasaki Station ¥341 >`;
const now = new Date(2026, 10, 1, 23, 29);
const r = parseWalletText(OCR, now);
ok('balance 809', r.balance === 809); ok('clock 23:28', r.clock && r.clock.h === 23 && r.clock.m === 28);
ok('5 full rows, cut-off row skipped', r.rows.length === 5 && r.skipped === 1);
const [a, b, c, d, e] = r.rows;
ok('first ride Kita-Senju to Kawasaki 528', a.kind === 'transit' && a.from === 'Kita-Senju' && a.to === 'Kawasaki' && a.amount === 528);
ok('second ride Tobu-nikko to Kita-Senju 1393', b.from === 'Tobu-nikko' && b.to === 'Kita-Senju' && b.amount === 1393);
ok('return ride the other way', c.from === 'Kita-Senju' && c.to === 'Tobu-nikko');
ok('short From line without ellipsis', d.from === 'Yako' && d.to === 'Kita-Senju' && d.amount === 616);
ok('purchase is not a ride', e.kind === 'purchase' && e.place === 'Kawasaki, Kanagawa' && e.amount === 494);
ok('2 hours ago at 21:29', a.when.getHours() === 21 && a.when.getMinutes() === 29 && a.exactTime);
ok('yesterday is 31 Oct, time unknown', e.when.getDate() === 31 && !e.exactTime);
ok('days ago', parseWhen('3 days ago', now).at.getDate() === 29);
ok('printed date', parseWhen('Oct 28', now).at.getMonth() === 9);
ok('top-up recognised', parseWalletText('Latest Transactions\nAdd Money ¥3,000\nTop-up\n2 days ago', now).rows[0].kind === 'topup');
ok('rubbish gives no rows', parseWalletText('hello\nworld', now).rows.length === 0);
ok('backslash read for the yen sign', parseWalletText('Latest Transactions\nKawasaki Station           \\528 >\nFrom Kita-Senju Station - Tran...\n2 hours ago', now).rows[0].amount === 528);
const LONG = `Kawasaki, Kanagawa ¥494 >
Purchase
Saturday
Kawasaki Station ¥341 >
From Shibuya Station — Transit
Saturday
iy Shibuya, Tokyo +¥5,000 >
\\ ©) Credit
Saturday
Shibuya Station ¥341 >
From Kawasaki Station — Transit
Friday
Keikyu Kawasaki Station ¥416 >
From Nihombashi Station -— Tra...
Thursday
Nihombashi Station ¥178 >
From Minami-sunamachi Statio...
Thursday`;
const mon = new Date(2026, 10, 2, 7, 12);
const L = parseWalletText(LONG, mon);
ok('weekday rows all read: %d' .replace('%d', L.rows.length), L.rows.length === 6);
ok('Saturday on a Monday is 31 Oct', L.rows[0].when.getDate() === 31);
ok('Friday is 30 Oct, Thursday 29 Oct', L.rows[3].when.getDate() === 30 && L.rows[4].when.getDate() === 29);
ok('Credit row is a top-up of 5,000', L.rows[2].kind === 'topup' && L.rows[2].amount === 5000);
ok('long station names kept', L.rows[4].from === 'Nihombashi' && L.rows[4].to === 'Keikyu Kawasaki');
ok('truncated From name kept as read', L.rows[5].from.startsWith('Minami-sunamachi'));
console.log('fails', fails); process.exit(fails ? 1 : 0);
