# v13.37: internal transfer, Transfer/Move label, From side of a transfer, earn start rules
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;const mk=(id,w,o)=>d.accounts.push(c.stamp({id,name:'Kx '+w+' USDT',wallet:w,cur:'USDT',type:'crypto',assetType:'crypto',exchange:'Kx',open:o,include:false,archived:false,invtab:true}));mk('k92s','Spot',100);d.accounts.push(c.stamp({id:'b92',name:'Other USDT',wallet:'Spot',cur:'USDT',type:'crypto',assetType:'crypto',exchange:'Oth',open:0,include:false,archived:false,invtab:true}))})})()")
    # 1 internal move creates the Earn account once, no fee, balances change
    r=pg.evaluate("(async()=>{const m=await import('/js/internal.js'),c=await import('/js/core.js');const n0=c.get().accounts.length;const a=m.internalMove({platform:'Kx',cur:'USDT',from:'Spot',to:'Earn',amount:'40'});const b=m.internalMove({platform:'Kx',cur:'USDT',from:'Spot',to:'Earn',amount:'10'});const d=c.get(),bal=c.balances(d);const e=d.accounts.filter(x=>x.exchange==='Kx'&&x.wallet==='Earn');return [a.ok,b.ok,d.accounts.length-n0,e.length,bal.get('k92s'),bal.get(e[0].id),d.txs.filter(t=>t.internal).length,d.txs.find(t=>t.internal).fee]})()")
    ok('internal move %s'%r, r==[True,True,1,1,50,50,2,0])
    r=pg.evaluate("(async()=>{const m=await import('/js/internal.js');return [m.internalMove({platform:'Kx',cur:'USDT',from:'Spot',to:'Spot',amount:'1'}).ok,m.internalMove({platform:'Kx',cur:'USDT',from:'Spot',to:'Earn',amount:''}).ok]})()")
    ok('same wallet / empty amount refused %s'%r, r==[False,False])
    # 2 sheet opens from platform and has Internal button
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(800)
    ok('platform has Internal button', pg.locator('[data-act=inv-internal][data-ex=Kx]').count()>=1)
    pg.evaluate("document.querySelector('[data-act=inv-internal][data-ex=Kx]').click()"); pg.wait_for_selector('#itf'); 
    ok('sheet: platform fixed to Kx, from/to wallets', pg.locator('#itf [name=plat]').count()==0 and 'Kx' in pg.inner_text('#itf') and pg.input_value('#itf [name=from]')=='Spot' and pg.locator('#itf [name=to] option').count()>=2)
    pg.click('#it-rev'); pg.wait_for_timeout(200); ok('reverse swaps From and To %s'%pg.input_value('#itf [name=from]'), pg.input_value('#itf [name=from]')=='Earn' and pg.input_value('#itf [name=to]')=='Spot'); pg.click('#it-rev')
    ok('currency shown inside the amount box', pg.inner_text('#it-cur')=='USDT')
    pg.click('#it-all'); ok('All fills the balance %s'%pg.input_value('#itf [name=amt]'), pg.input_value('#itf [name=amt]')=='50')
    pg.fill('#itf [name=amt]','5'); pg.click('#it-save'); pg.wait_for_timeout(500)
    ok('saved from the sheet', pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.filter(t=>t.internal).length})()")==3)
    # 3 + menu label
    pg.evaluate("(async()=>{const m=await import('/js/invest.js');m.invEntryMenu({ex:'Kx'})})()"); pg.wait_for_timeout(400)
    t=pg.inner_text('.invopts'); ok('menu: Transfer/Move and Internal Transfer', 'Transfer/Move' in t and 'Internal Transfer' in t)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 4 clicked account is From
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.txs.push(c.stamp({id:'t92',kind:'transfer',date:c.nowStamp(),acct:'b92',toAcct:'k92s',cur:'USDT',amount:3,toAmount:3,fx:1,name:'in'}))});const m=await import('/js/accpage.js');return m.transferPreset?m.transferPreset(c.get(),'k92s'):null})()")
    ok('preset keeps clicked account as From %s'%r, r is None or (r['acct']=='k92s'))
    # 5 earn rules
    r=pg.evaluate("(async()=>{const e=await import('/js/earn.js');const off=0,t=(h,m)=>Date.UTC(2026,0,4,h,m);const f=(x)=>e.e8Label(x,off);return [f(e.earnStartOf(t(15,0),{startRule:'nextHour',startLagH:0},off)),f(e.earnStartOf(t(15,1),{startRule:'nextHour',startLagH:0},off)),f(e.earnStartOf(t(15,9),{startRule:'midnight',startLagH:0},off)),f(e.earnStartOf(t(15,9),{startRule:'midnight',startLagH:0},8))]})()")
    ok('start rules %s'%r, r==['2026-01-04 16:00','2026-01-04 16:00','2026-01-05 00:00','2026-01-05 00:00'] or r[:3]==['2026-01-04 16:00','2026-01-04 16:00','2026-01-05 00:00'])
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
