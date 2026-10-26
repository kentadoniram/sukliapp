// Japanese item names: romaji and English readings (v12an)
import { kanaToRomaji, describeJa, hasJapanese } from '../js/jpgloss.js';
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n); };
const k = (s, e) => ok(`${s} -> ${kanaToRomaji(s)} (want ${e})`, kanaToRomaji(s) === e);
k('いか', 'ika'); k('かんじ', 'kanji'); k('しんいち', "shin'ichi"); k('ざっし', 'zasshi'); k('ちょっと', 'chotto'); k('らーめん', 'raamen'); k('ラーメン', 'raamen');
k('ティー', 'tii'); k('ファミリーマート', 'famiriimaato'); k('じゃがいも', 'jagaimo'); k('きゃべつ', 'kyabetsu'); k('コーヒー', 'koohii'); k('ヴァイオリン', "vaiorin"); k('マッチャ', 'matcha'); k('ぎゅうにゅう', 'gyuunyuu');
const d = (s) => describeJa(s);
ok('milk', d('牛乳').romaji === 'gyuunyuu' && d('牛乳').english === 'milk');
ok('longest word wins (サラダ油 is oil, not salad)', d('サラダ油').english === 'cooking oil');
ok('two words', d('国産豚バラ').romaji === 'kokusan butabara' && /domestic/.test(d('国産豚バラ').english) && /pork belly/.test(d('国産豚バラ').english));
ok('unknown katakana keeps its romaji, no English', d('サントリークラフトボス').romaji === 'santoriikurafutobosu' && d('サントリークラフトボス').english === '');
ok('unknown kanji stay and are listed', d('碧身フライ').unknown.join('') === '碧身' && /^碧身 furai$/.test(d('碧身フライ').romaji));
ok('digits and units stay', /tamago 10/.test(d('卵 10個入').romaji));
ok('full-width characters are normalised', d('ＬＩＦＥ ミルク').romaji.includes('miruku'));
ok('no Japanese -> null', d('Milk 1L') === null && !hasJapanese('Milk 1L') && hasJapanese('卵'));
ok('receipt words', d('合計').english === 'total' && d('値引').english === 'discount' && d('レジ袋').english === 'checkout bag');
console.log(`${pass}/${pass + fail} passed`); if (fail) process.exit(1);
