# v13.30: fare suggestions with confidence on the Pasmo reader ( text injected)
from playwright.sync_api import sync_playwright
import os
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
TXT="""23:28
Balance
¥809 Add Money
Latest Transactions
Kawasaki Station ¥528 >
From Kita-Senju Station — Tran...
2 hours ago
Kita-Senju Station ¥1,393 >
From Tobu-nikko Station — Tr...
3 hours ago
Kawasaki, Kanagawa ¥494 >
Purchase
Yesterday
Shibuya, Tokyo +¥5,000 >
Credit
Saturday
Kawasaki Station ¥341 >"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'pm1',name:'Pasmo',cur:'JPY',type:'cash',open:1000,include:true,archived:false}))})})()")
    pg.evaluate("window.__walletText="+__import__('json').dumps(TXT))
    open('/tmp/blank.png','wb').write(bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300050001a5f645400000000049454e44ae426082'))
    # three earlier rides on the same pair (opposite direction) at 483
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{const cat=d.categories.find(x=>!x.deleted).id;for(let i=0;i<3;i++)d.txs.push(c.stamp({id:'f'+i,kind:'expense',amount:483,cur:'JPY',fx:1,date:'2026-10-1'+i+' 08:00:00',name:'Train: Kawasaki - Kita-Senju',from:'Kawasaki',to:'Kita-Senju',cat,acct:'pm1'}))})})()""")
    pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer')
    pg.evaluate("document.querySelector('.drawer [data-act=wallet-scan]').click()"); pg.wait_for_timeout(600); pg.wait_for_selector('#ws-file',state='attached',timeout=5000); pg.set_input_files('#ws-file','/tmp/blank.png'); pg.wait_for_selector('.wslist',timeout=15000)
    t=pg.inner_text('.sheet')
    ok('note shows the usual fare with confidence', 'Usually' in t and '483' in t and 'always the same' in t and 'Worth a check' in t)
    ok('only the differing pair is flagged', pg.locator('.wsfare').count()==1)
    pg.evaluate("document.querySelector('[data-act=ws-fare]').click()"); pg.wait_for_timeout(300)
    ok('Use the usual fare changes the row', '483' in pg.inner_text('.wslist') and pg.locator('.wsfare').count()==0)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
