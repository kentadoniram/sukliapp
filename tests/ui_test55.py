# v12ar: Sukli CSV round trip keeps posted date, tags, fee, items, card details
import json
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate("""(()=>{const s=window.sukli;s.commit(d=>{const id='cardq';d.accounts.push({id,name:'Q Card',cur:'PHP',type:'card',open:0,include:true,archived:false,stmtDay:11,dueDay:1,limit:50000,exchange:'',updatedAt:Date.now()});
      const c=d.categories.find(x=>x.kind==='expense'&&!x.deleted).id,src=d.accounts.find(a=>a.type==='bank'&&a.cur==='PHP'&&!a.deleted).id;
      d.txs.push({id:'qa',kind:'expense',amount:300,cur:'PHP',fx:1,date:'2026-10-11 20:00:00',name:'Late, "quoted" charge',cat:c,acct:id,posted:'2026-10-12',labels:'Okinawa trip',notes:'n1',items:[{n:'milk',amt:100,cat:c},{n:'rice',amt:200,cat:''}],updatedAt:Date.now()});
      d.txs.push({id:'qb',kind:'transfer',amount:500,toAmount:500,cur:'PHP',fx:1,toFx:1,date:'2026-10-15 09:00:00',name:'Pay card',cat:'',acct:src,toAcct:id,fee:15,feeBy:'to',feeCat:'',weird:{x:1},updatedAt:Date.now()});});})()""")
    csv=pg.evaluate("import('/js/sukliCsv.js').then(m=>m.exportSukliCSV(window.sukli.get()))")
    ok('has Record and Posted Date headers', csv.split('\r\n')[0].startswith('﻿"Record"') and 'Posted Date' in csv.split('\r\n')[0])
    ok('billing period column filled', '2026-10-12..2026-11-11' in csv)
    n=pg.evaluate("window.sukli.get().txs.filter(t=>!t.deleted).length")
    # re-import into a fresh app
    pg.evaluate("localStorage.clear(); indexedDB.databases().then(l=>l.forEach(d=>indexedDB.deleteDatabase(d.name)))"); pg.wait_for_timeout(500)
    pg.goto('http://localhost:8123/'); pg.reload(); pg.wait_for_selector('#first-file',state='attached')
    open('/tmp/sukli_full.csv','w',encoding='utf-8').write(csv)
    pg.set_input_files('#first-file','/tmp/sukli_full.csv'); pg.wait_for_timeout(2500)
    if pg.locator('#setup .btn').count(): pg.click('#setup .btn'); pg.wait_for_timeout(800)
    r=pg.evaluate("""(()=>{const d=window.sukli.get();const a=d.txs.find(t=>t.id==='qa'),b=d.txs.find(t=>t.id==='qb'),c=d.accounts.find(x=>x.name==='Q Card');
      return {n:d.txs.filter(t=>!t.deleted).length,a:a&&[a.posted,a.labels,a.notes,a.name,(a.items||[]).length,a.amount],b:b&&[b.fee,b.feeBy,b.weird&&b.weird.x,b.toAmount],c:c&&[c.stmtDay,c.dueDay,c.limit,c.type]}})()""")
    print(r)
    ok('same number of entries', r['n']==n)
    ok('posted, tags, notes, quoted name, items kept', r['a']==['2026-10-12','Okinawa trip','n1','Late, "quoted" charge',2,300])
    ok('transfer fee and extra field kept', r['b']==[15,'to',1,500])
    ok('card details kept', r['c']==[11,1,50000,'card'])
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
