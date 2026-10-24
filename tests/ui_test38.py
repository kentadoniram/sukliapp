# v12ab batch A: entries filters, totals, collapse, transfer names and amounts
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
        # transfer rename + differing amounts
        pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{d.accounts.push(m.stamp({id:'sm',name:'SMBC',cur:'JPY',type:'bank',open:100000,include:true,archived:false}),m.stamp({id:'yc',name:'Japanese Currency 2',cur:'JPY',type:'cash',open:0,include:true,archived:false}));
          d.txs.push(m.stamp({id:'tt1',kind:'transfer',date:'2026-09-20 10:00:00',name:'SMBC to Japanese Currency 2',amount:30000,cur:'JPY',fx:1,acct:'sm',toAcct:'yc',toAmount:29356,toFx:1,autoRoute:true}))});
          m.commit(d=>{d.accounts.find(a=>a.id==='yc').name='Yen Cash'})})()""")
        nm=pg.evaluate("(async()=>{const m=await import('/js/core.js');return m.get().txs.find(t=>t.id==='tt1').name})()")
        ok(f'[{vw}] transfer name follows the renamed account', nm=='SMBC to Yen Cash')
        pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(500)
        pg.evaluate("(async()=>{const m=await import('/js/screens.js');m.ui.month='2026-09';window.dispatchEvent(new Event('sukli-render'))})()"); pg.wait_for_timeout(500)
        ok(f'[{vw}] row shows what arrived', pg.locator('.arrived').count()>=1 and '29,356' in pg.inner_text('.arrived'))
        pg.select_option('#lf-cat', index=1); pg.wait_for_timeout(300)
        ok(f'[{vw}] category filter shows a summary', pg.locator('#lsum').count()==1)
        pg.fill('#lf-from','2026-09-08'); pg.fill('#lf-to','2026-09-08'); pg.dispatch_event('#lf-to','change'); pg.wait_for_timeout(300)
        days=pg.evaluate("[...document.querySelectorAll('.dayhead .dlabel')].length")
        ok(f'[{vw}] date range limits days', days<=1)
        pg.click('[data-act=f-clear]'); pg.wait_for_timeout(500)
        pg.evaluate("(async()=>{const m=await import('/js/screens.js');m.ui.month='2026-09';window.dispatchEvent(new Event('sukli-render'))})()"); pg.wait_for_timeout(400)
        h=pg.locator('.dayhead').first; h.click(); pg.wait_for_timeout(150)
        ok(f'[{vw}] day collapses', pg.locator('.day.off .rows[hidden]').count()==1)
        h.click(); pg.wait_for_timeout(150)
        ok(f'[{vw}] day expands again', pg.locator('.day.off').count()==0)
        ok(f'[{vw}] Entries days are not coloured', pg.locator('.dtot[style*=hsl]').count()==0)
        ok(f'[{vw}] no page errors', not errs)
    b.close()
print('SUMMARY', sum(res), 'passed', len(res)-sum(res), 'failed')
