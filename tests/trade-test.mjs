import { tradeBook } from '../js/tradecalc.js';
let bad=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c) bad++;};
const T=(id,date,trade)=>({id,date,trade});
// buy 1 BTC for 1000, buy 1 more for 3000 -> avg 2000; sell 1 for 2500 with fee 20 -> gain 480
const b=tradeBook([T('1','2026-01-01',{side:'buy',asset:'btc',qty:1,valueHome:1000}),T('2','2026-02-01',{side:'buy',asset:'btc',qty:1,valueHome:3000}),T('3','2026-03-01',{side:'sell',asset:'btc',qty:1,valueHome:2500,feeHome:20})]);
ok('average cost gain', Math.abs(b.total-480)<1e-9); ok('remaining position', b.pos.get('btc').qty===1 && b.pos.get('btc').cost===2000);
// sell more than the known quantity: only the known part counts
const c=tradeBook([T('1','2026-01-01',{side:'buy',asset:'sol',qty:1,valueHome:100}),T('2','2026-02-01',{side:'sell',asset:'sol',qty:4,valueHome:800,feeHome:8})]);
ok('unknown-cost units do not inflate the gain', Math.abs(c.realized[0].gain-(200-100-2))<1e-9);
// convert BTC->SOL worth 3000 with 1 btc at cost 2000: gain 1000, SOL cost 3000
const d=tradeBook([T('1','2026-01-01',{side:'buy',asset:'btc',qty:1,valueHome:2000}),T('2','2026-02-01',{side:'convert',asset:'btc',qty:1,asset2:'sol',qty2:30,valueHome:3000})]);
ok('conversion realizes gain and sets new cost', Math.abs(d.total-1000)<1e-9 && d.pos.get('sol').cost===3000 && d.pos.get('btc').qty===0);
ok('loss is negative', tradeBook([T('1','2026-01-01',{side:'buy',asset:'x',qty:2,valueHome:200}),T('2','2026-01-02',{side:'sell',asset:'x',qty:2,valueHome:150})]).total===-50);
process.exit(bad?1:0);
