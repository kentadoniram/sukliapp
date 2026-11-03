# v13.25: read a Pasmo / Suica Wallet screenshot (text is injected: the reading itself is covered by the walletparse test and a real screenshot)
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
    pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer'); ok('menu offers it', 'Scanner' in pg.inner_text('.drawer') and 'Read a Pasmo Screenshot' in pg.inner_text('.drawer', timeout=2000) or 'Read a Pasmo Screenshot' in pg.evaluate("document.querySelector('.drawer').textContent"))
    pg.evaluate("document.querySelector('.drawer [data-act=wallet-scan]').click()"); pg.wait_for_timeout(600); pg.wait_for_selector('#ws-file',state='attached',timeout=5000); pg.set_input_files('#ws-file','/tmp/blank.png'); pg.wait_for_selector('.wslist',timeout=8000)
    t=pg.inner_text('.sheet'); ok('rows listed with stations', 'Kita-Senju to Kawasaki' in t and 'Tobu-nikko to Kita-Senju' in t and 'Purchase: Kawasaki, Kanagawa' in t)
    ok('balance shown', '809' in t); ok('cut-off row reported', '1 row' in t)
    ok('four rows ticked (top-up included)', pg.locator('.wsl input:checked').count()==4 and pg.locator('.wssrc').count()==1)
    ok('offers to set the starting balance', pg.locator('.wsbal').count()==1 and pg.locator('#ws-bal:checked').count()==1)
    pg.click('[data-act=ws-add]'); pg.wait_for_timeout(700)
    bal=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.balances(c.get()).get('pm1')})()"); ok('card ends at the wallet balance 809 (%s)'%bal, abs(bal-809)<0.01)
    tx=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.filter(t=>!t.deleted&&t.notes==='From a Wallet screenshot').map(t=>[t.name,t.amount,t.from||'',t.to||'',t.flag||'',t.acct,t.kind,t.toAcct||''])})()")
    ok('four entries saved %s'%tx, len(tx)==4 and any(x[0].startswith('Pasmo') or '- Pasmo' in x[0] for x in tx) and ['Train: Kita-Senju - Kawasaki',528,'Kita-Senju','Kawasaki','','pm1','expense',''] in tx and any(x[0]=='Purchase: Kawasaki, Kanagawa' and x[4]=='review' for x in tx))
    # a second screenshot of the same rides adds nothing: they are known now
    pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer'); pg.evaluate("document.querySelector('.drawer [data-act=wallet-scan]').click()"); pg.wait_for_timeout(600); pg.wait_for_selector('#ws-file',state='attached',timeout=5000); pg.set_input_files('#ws-file','/tmp/blank.png'); pg.wait_for_selector('.wslist',timeout=8000)
    ok('second time: balance already matches', pg.locator('.wsbal').count()==0 and 'will match the wallet' in pg.inner_text('.sheet'))
    ok('same rides are not offered again', pg.locator('.wsl input:checked').count()==0 and 'already in your entries' in pg.inner_text('.sheet'))
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
