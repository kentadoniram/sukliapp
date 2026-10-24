import { suggestTrips, rankRouteNames } from '../js/route.js';
let f=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c) f++;};
const tx=[]; let id=0;
for(let d=1;d<=10;d++){ const dd=String(d).padStart(2,'0');
 tx.push({id:id++,kind:'expense',name:'Bus: Home to Office',cat:'t',amount:200,date:`2026-09-${dd}T08:00`});
 tx.push({id:id++,kind:'expense',name:'Bus: Office to Home',cat:'t',amount:200,date:`2026-09-${dd}T19:00`});
 tx.push({id:id++,kind:'expense',name:'Bus: Home to Mall',cat:'t',amount:100,date:`2026-09-${dd}T08:30`}); }
const db={txs:tx,settings:{homePlace:'Home',workPlace:'Office'}};
const t=()=>true;
const am=suggestTrips(db,t,{hour:8,weekday:true,limit:2}), pm=suggestTrips(db,t,{hour:19,weekday:true,limit:1});
ok('weekday morning: home to work first', am[0] && /office/i.test(am[0].to));
ok('weekday evening: work to home first', pm[0] && /home/i.test(pm[0].to));
const r=rankRouteNames(db,t,['Bus: Office to Home','Bus: Home to Office'],8,undefined,true);
ok('quick picks morning: home to office first', r[0]==='Bus: Home to Office');
process.exit(f?1:0);
