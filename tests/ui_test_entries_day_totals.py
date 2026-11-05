# v12ae: per-currency day totals in Entries
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for vw,vh in ((390,844),(1100,800)):
        pg=b.new_page(viewport={'width':vw,'height':vh},service_workers='block'); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
        pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
        pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{const cat=(d.categories.find(c=>c.kind==='expense')||{}).id;
          d.accounts.push(m.stamp({id:'ay',name:'Yen T',cur:'JPY',type:'cash',open:50000,include:true,archived:false}),m.stamp({id:'au',name:'Dollar T',cur:'USD',type:'cash',open:500,include:true,archived:false}),m.stamp({id:'ap',name:'Peso T',cur:m.HOME,type:'cash',open:5000,include:true,archived:false}));
          const mk=(id,a,cur,amt,fx,dt)=>d.txs.push(m.stamp({id,kind:'expense',acct:a,amount:amt,cur,fx,date:dt,name:id,cat}));
          mk('c1','ay','JPY',123,0.4,'2024-03-05 10:00:00'); mk('c2','au','USD',123,56,'2024-03-05 11:00:00');
          mk('c3','ay','JPY',500,0.4,'2024-03-06 10:00:00'); mk('c4','ap',m.HOME,300,1,'2024-03-07 10:00:00')})})()""")
        pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(400)
        pg.evaluate("(async()=>{const m=await import('/js/screens.js');m.ui.month='2024-03';m.ui.from='2024-03-05';m.ui.to='2024-03-07';window.dispatchEvent(new Event('sukli-render'))})()"); pg.wait_for_timeout(500)
        heads=pg.evaluate("[...document.querySelectorAll('.day')].map(d=>({l:d.querySelector('.dlabel').textContent,lines:[...d.querySelectorAll('.dtot .dline')].map(x=>x.textContent),eq:(d.querySelector('.dtot .dcur')||{}).textContent||''}))")
        H={h['l'].split(', ')[1]:h for h in heads}; two=[H['Mar 5']]; one=[H['Mar 6']]; hm=[H['Mar 7']]
        ok(f'[{vw}] two currencies listed separately with the home total under them', len(two[0]['lines'])==2 and any('¥' in x for x in two[0]['lines']) and any('$' in x for x in two[0]['lines']) and '₱' in two[0]['eq'] and two[0]['lines'][0][0] in '-−')
        ok(f'[{vw}] one foreign currency shows its amount and the home equivalent', '¥' in one[0]['lines'][0] and '₱' in one[0]['eq'] and len(one[0]['lines'])==1)
        ok(f'[{vw}] home-only day shows the amount once', '₱' in hm[0]['lines'][0] and hm[0]['eq']=='' and len(hm[0]['lines'])==1)
        ok(f'[{vw}] no page errors', not errs)
    b.close()
print('SUMMARY', sum(res), 'passed', len(res)-sum(res), 'failed')
