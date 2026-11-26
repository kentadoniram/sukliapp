# v16.37: tax/fee rows, Pasmo reader sticky Add + suggestions, bell Budget as one card, app-styled suggestion list
import base64
from playwright.sync_api import sync_playwright
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==')
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
Shibuya, Tokyo ¥300 >
Purchase
Yesterday
Kawasaki Station ¥341 >
From Shibuya Station — Tran...
Saturday
Kawasaki Station ¥341 >
From Shibuya Station — Tran...
Saturday
Kawasaki Station ¥341 >
From Shibuya Station — Tran..."""
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
def clear(pg): pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_timeout(1500); clear(pg)
    # ---- 1 tax / discount / fee: switch and value on one row
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(db=>{db.accounts.push({id:'t-card',name:'T Card',cur:'JPY',type:'card',open:0,include:true,archived:false})});const m=await import('/js/entry.js');m.openEntry({preset:{acct:'t-card'}})}""")
    pg.wait_for_selector('#f-amount'); pg.fill('#f-amount','1000'); pg.wait_for_timeout(300); pg.click('.adjlink'); pg.wait_for_selector('#aj-base'); pg.wait_for_timeout(300)
    for sid,iid in [('aj-dseg','aj-d'),('aj-tseg','aj-t'),('aj-xseg','aj-x')]:
        same=pg.evaluate("([a,b])=>{const x=document.getElementById(a).getBoundingClientRect(),y=document.getElementById(b).getBoundingClientRect();return Math.abs((x.top+x.bottom)/2-(y.top+y.bottom)/2)<6 && y.left>=x.right-1}",[sid,iid])
        ok('%s and %s on one row'%(sid,iid), same)
    ok('value box is not squeezed', pg.evaluate("document.getElementById('aj-t').getBoundingClientRect().width")>90)
    pg.screenshot(path='/tmp/v37_tax.png'); clear(pg)
    # ---- 2 Pasmo reader
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'pm1',name:'Pasmo',cur:'JPY',type:'cash',open:1000,include:true,archived:false}));const cat=d.categories.find(x=>!x.deleted&&x.kind==='expense').id;d.txs.push(c.stamp({id:'mm1',kind:'expense',date:'2026-11-01 10:00:00',acct:'pm1',cur:'JPY',amount:200,fx:1,name:'Snack',cat,merchant:'7-Eleven',branch:'Shinjuku Nishiguchi'}))})}""")
    pg.evaluate("window.__walletText="+__import__('json').dumps(TXT))
    pg.evaluate("async()=>{const m=await import('/js/walletscan.js');m.openWalletScan()}"); pg.wait_for_selector('#ws-file',state='attached')
    pg.set_input_files('#ws-file',{'name':'a.png','mimeType':'image/png','buffer':PNG}); pg.wait_for_selector('.wsrow',timeout=20000); pg.wait_for_timeout(500)
    ok('reader rows shown', pg.locator('.wsrow').count()>=3)
    vis=pg.evaluate("(()=>{const b=document.querySelector('[data-act=ws-add]').getBoundingClientRect();return b.bottom<=innerHeight+1&&b.top>0})()")
    ok('Add entries button is on screen without scrolling', vis)
    pg.evaluate("document.querySelector('.wsrow:last-of-type').scrollIntoView()"); pg.wait_for_timeout(200)
    ok('and still on screen after scrolling to the last row', pg.evaluate("(()=>{const b=document.querySelector('[data-act=ws-add]').getBoundingClientRect();return b.bottom<=innerHeight+1&&b.top>0})()"))
    # merchant suggestions
    mer=pg.locator('input.wsmer[data-k=merchant]').first
    if mer.count():
        mer.click(); pg.fill('input.wsmer[data-k=merchant] >> nth=0','7'); pg.wait_for_timeout(250)
        ok('merchant suggestions show in the app list', pg.locator('.sgpop .sgopt', has_text='7-Eleven').count()==1)
        pg.mouse.move(5,5); pg.evaluate("document.querySelector('.sgopt').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))"); pg.wait_for_timeout(250)
        ok('picking fills the box and closes the list', pg.input_value('input.wsmer[data-k=merchant] >> nth=0')=='7-Eleven' and pg.locator('.sgpop').count()==0)
    else: ok('a purchase row with merchant box exists', False)
    pg.screenshot(path='/tmp/v37_pasmo.png'); clear(pg)
    # ---- 5 item name suggestions use the app list, not the phone's
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(d=>{const a=d.accounts.find(x=>x.id==='pm1');const cat=d.categories.find(x=>!x.deleted&&x.kind==='expense').id;for(const n of ['Rice ball','Rice cracker','Green tea'])d.txs.push(c.stamp({id:'it'+n,kind:'expense',date:'2026-11-02 10:00:00',acct:'pm1',cur:'JPY',amount:300,fx:1,name:'Shop',cat,items:[{n,a:300,q:1}]}))});const m=await import('/js/entry.js');m.openEntry({preset:{acct:'pm1'}})}""")
    pg.wait_for_selector('#itemsrow'); pg.click('[data-e=items-on]'); pg.wait_for_timeout(300)
    pg.click('.item .in-n'); pg.fill('.item .in-n','ric'); pg.wait_for_timeout(300)
    ok('native list switched off', pg.get_attribute('.item .in-n','list') is None)
    opts=pg.locator('.sgpop .sgopt').all_inner_texts(); print(opts)
    ok('app suggestion list shows matches', len(opts)>=1 and all('ric' in o.lower() for o in opts))
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    ok('keyboard pick fills the item', 'rice' in pg.input_value('.item .in-n').lower())
    pg.fill('.item .in-n','ric'); pg.wait_for_timeout(250); pg.screenshot(path='/tmp/v37_sugg.png'); clear(pg)
    # ---- 3 bell: Budget is one card
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(db=>{const cat=db.categories.filter(x=>!x.deleted&&x.kind==='expense').slice(0,3);const a=db.accounts.find(x=>x.id==='pm1');
      for(const [i,ct] of cat.entries()){db.budgets=db.budgets.filter(x=>x.cat!==ct.id);db.budgets.push({id:'tbb'+i,cat:ct.id,amount:10,off:false});db.txs.push({id:'tbt'+i,kind:'expense',amount:500,cur:a.cur,acct:a.id,cat:ct.id,date:c.nowStamp(),name:'over test'});}})}""")
    pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(700); pg.evaluate("localStorage.removeItem('sukli-nf-budget-closed')")
    pg.locator('[data-act=notifbell]').first.click(); pg.wait_for_selector('.nfgroup'); pg.wait_for_timeout(300)
    ok('budget alerts sit inside one card', pg.locator('.nfgroup .nf').count()>=2 and pg.evaluate("(()=>{const g=document.querySelector('.nfgroup'),n=g.querySelector('.nf');return getComputedStyle(n).borderRadius==='0px'&&getComputedStyle(g).borderRadius!=='0px'})()"))
    ok('rows are divided, not separate cards', pg.evaluate("getComputedStyle(document.querySelector('.nfgroup .nf')).borderTopWidth")=='1px')
    pg.screenshot(path='/tmp/v37_bell.png')
    pg.click('.nfghead'); pg.wait_for_timeout(200); ok('still folds', pg.evaluate("document.getElementById('nf-budget-body').hidden"))
    ok('no page errors %s'%errs, not errs)
    b.close()
print('\n%d/%d passed'%(sum(res),len(res))); raise SystemExit(0 if all(res) else 1)
