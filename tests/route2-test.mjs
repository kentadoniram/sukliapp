import { parseRoute, modeOf, tripLabel, bareMode } from '../js/route.js';
let bad=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c) bad++;};
ok('mode from word', modeOf('bus')==='Bus' && modeOf('Train: A - B')==='Train' && modeOf('lunch','Bus Expenses')==='Bus' && modeOf('lunch')==='');
ok('label with stops', tripLabel('Bus','One Ayala','San Pedro')==='Bus: One Ayala - San Pedro');
ok('label without stops', tripLabel('Train','','')==='Train Commute');
const r=parseRoute('Bus: One Ayala - San Pedro'); ok('prefixed label still parses', r && r.from==='One Ayala' && r.to==='San Pedro');
ok('bare', bareMode('bus') && bareMode('Train') && bareMode('Bus Commute') && !bareMode('Bus: A - B') && !bareMode('bus to work stop'));
process.exit(bad?1:0);
