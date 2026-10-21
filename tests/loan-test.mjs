import { loanCalc, smartKind } from '../js/loancalc.js';
let bad=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c) bad++;};
const c=loanCalc({principal:1200000,rate:6,months:120,fees:12000,lateFee:3});
ok('monthly ~13322', Math.abs(c.monthly-13322.0)<5); ok('interest ~398,6xx', Math.abs(c.interest-398640)<500);
ok('net received', c.net===1188000); ok('late each 3%', Math.abs(c.lateEach-c.monthly*0.03)<1e-6);
ok('zero rate divides', Math.abs(loanCalc({principal:1200,rate:0,months:12}).monthly-100)<1e-9);
ok('smart labels', smartKind('Credit to Cash')==='cash' && smartKind('Loan Payment')==='loanpay' && smartKind('credit card payment')==='cardpay' && smartKind('Loan')==='loan' && smartKind('lunch')==='');
process.exit(bad?1:0);
