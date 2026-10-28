import { planMonth, cashRoom, habit, suggestCuts, learnMonths, DEBT_SHARE } from '../js/debtplan.js';
let f=0; const ok=(n,c)=>{ if(!c) f++; console.log((c?'PASS ':'FAIL ')+n); };
// cash room: income 60000, spends 50000 -> safe 10000, cap 24000 -> 10000
let r=cashRoom({income:60000,spend:50000}); ok('room is income minus living minus a 10% cushion',Math.abs(r.room-4000)<1e-6 && Math.abs(r.safe-10000)<1e-6);
r=cashRoom({income:60000,spend:20000}); ok('capped at 40% of income',Math.abs(r.room-24000)<1e-6 && DEBT_SHARE===0.4);
r=cashRoom({income:60000,spend:20000,typed:54000}); ok('typed 90% is cut to the room',Math.abs(r.use-24000)<1e-6 && r.typedCapped);
r=cashRoom({income:60000,spend:20000,typed:54000,force:true}); ok('force keeps typed',r.use===54000);
// plan: due soon first, shortfall flagged
const D=(o)=>Object.assign({owed:50000,rate:20,min:2000,paid:0,usual:0,days:20,overdue:false},o);
let p=planMonth([D({id:'a',days:20,rate:36}),D({id:'b',days:3,rate:10}),D({id:'c',days:12,rate:24})],4500);
ok('nearest due is paid first',p.rows[0].id==='b' && p.rows[0].pay===2000);
ok('shortfall flagged on the farthest due',p.rows[2].id==='a' && Math.abs(p.rows[2].short-1500)<1e-6 && Math.abs(p.shortTotal-1500)<1e-6);
ok('never more than funds',p.payTotal<=4500+1e-6);
// habit top-up and extra
p=planMonth([D({id:'a',rate:36,days:20,usual:5000}),D({id:'b',rate:10,days:10,usual:0})],12000);
const pa=p.rows.find(x=>x.id==='a'),pb=p.rows.find(x=>x.id==='b');
ok('pays usual amount when funds allow',pa.pay>=5000 && pb.pay>=2000);
ok('amounts differ by debt',Math.abs(pa.pay-pb.pay)>1);
ok('total equals funds when owed is large',Math.abs(p.payTotal-12000)<1e-6);
// already paid this month
p=planMonth([D({id:'a',paid:2000})],5000); ok('paid this month counts',p.rows[0].need===0);
// overdue beats later due
p=planMonth([D({id:'a',days:1,rate:50}),D({id:'b',days:-4,overdue:true,rate:5})],2000); ok('overdue first',p.rows[0].id==='b');
// owed less than min
p=planMonth([D({id:'a',owed:800,min:2000})],5000); ok('not more than owed',p.rows[0].pay===800);
// habit
const h=habit([{date:'2026-08-05',amount:3000},{date:'2026-09-05',amount:5000},{date:'2026-10-05',amount:4000},{date:'2025-01-01',amount:99999}],'2026-10-28');
ok('habit median over last 6 months',h.usual===4000 && h.months===3 && h.n===3);
ok('single payment is no pattern',habit([{date:'2026-10-05',amount:4000}],'2026-10-28').usual===0);
// cuts
const c=suggestCuts([{name:'Rent',cls:'need',avg:20000},{name:'Eating out',cls:'want',avg:8000},{name:'Games',cls:'luxury',avg:3000}],2000);
ok('cuts skip needs, trim wants',c.rows.length>=1 && c.rows[0].name==='Eating out' && c.enough);
// learn
const tx=[];for(const m of ['2026-07','2026-08','2026-09']){tx.push({kind:'income',amount:50000,fx:1,date:m+'-25'});tx.push({kind:'expense',amount:30000,fx:1,date:m+'-10',cat:'x'});}
tx.push({kind:'income',amount:5000,fx:1,date:'2026-09-26'});
const L=learnMonths(tx,(t)=>t.amount*t.fx,'2026-10',(ym,n)=>{const[y,m]=ym.split('-').map(Number);const d=new Date(y,m-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')},()=>({name:'Food',cls:'need'}));
ok('learn months',L.months===3 && Math.abs(L.spend-30000)<1e-6 && L.needs===30000 && L.cats[0].name==='Food');
console.log(f?'FAILED '+f:'ALL OK'); process.exit(f?1:0);
