import * as P from '../js/prob.js';
let bad=0; const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' '+x)); if(!c)bad++;};
// synthetic geometric random walk: mu=0.001/day, sigma=0.03/day, 200 daily points
const r=P.rng(7), gauss=()=>{let u=0,v=0;while(!u)u=r();v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
let p=100; const s=[{t:0,p}]; for(let i=1;i<=400;i++){p*=Math.exp(0.001+0.03*gauss()); s.push({t:i,p});}
const st=P.stepsOf(s), f=P.fit(st);
ok('fit sigma near 0.03', Math.abs(f.sd[0]-0.03)<0.004, f.sd[0]);
ok('fit mu near 0.001', Math.abs(f.mu[0]-0.001)<0.0015, f.mu[0]);
const sim=P.simulate(st,[1000],30,{drift:'none'}), sm=P.summarize(sim);
const sig30=f.sd[0]*Math.sqrt(30);
ok('median about start with no trend', Math.abs(sm.median/1000-1)<0.04, sm.median);
ok('5th pct near lognormal theory', Math.abs(Math.log(sm.p05/1000)-(-1.645*sig30))<0.05, [Math.log(sm.p05/1000),-1.645*sig30]);
ok('95th pct near lognormal theory', Math.abs(Math.log(sm.p95/1000)-(1.645*sig30))<0.05);
ok('probability of loss about half', Math.abs(sm.loss-0.5)<0.04, sm.loss);
ok('probabilities in the histogram add to ~1', Math.abs(sm.bins.reduce((a,b)=>a+b.p,0)-0.98)<0.03, sm.bins.reduce((a,b)=>a+b.p,0));
ok('deterministic', JSON.stringify(P.summarize(P.simulate(st,[1000],30)).median)===JSON.stringify(P.summarize(P.simulate(st,[1000],30)).median));
const up=P.summarize(P.simulate(st,[1000],30,{drift:'past'}));
ok('past trend shifts the middle up (mu>0)', f.mu[0]>0 ? up.median>sm.median : up.median<=sm.median);
ok('wider horizon is wider', P.summarize(P.simulate(st,[1000],120)).p95-P.summarize(P.simulate(st,[1000],120)).p05 > sm.p95-sm.p05);
// two coins keep their joint movement: identical series -> sum behaves like one coin with total value
const j=P.jointSteps([s,s]), sj=P.summarize(P.simulate(j,[500,500],30));
ok('two identical coins = one coin', Math.abs(sj.p05-sm.p05)/sm.p05<0.03, [sj.p05,sm.p05]);
ok('lack of data is reported', P.lacks(P.stepsOf(s.slice(0,5)))!=='' && P.lacks(st)==='');
const e=P.empirical([100,120,90,200,110,95],{target:115});
ok('empirical: median and share above', e.median===105 && Math.abs(e.above-2/6)<1e-9, e);
console.log(bad?'FAILED':'ALL PASS'); process.exit(bad?1:0);
