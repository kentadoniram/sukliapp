# v15.19: Earn is passive (no trade/hand-made entries/form transfers; Internal Transfer + Interest only); Investments shows one wallet at a time as tabs
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
      const A=(id,name,wallet,open)=>d.accounts.push(c.stamp({id,name,cur:'USDT',type:'crypto',open,include:false,archived:false,exchange:'ZzEx',wallet,invtab:true}));
      A('zs','ZzEx Spot USDT','Spot',100);A('ze','ZzEx Earn USDT','Earn',50);A('zf','ZzEx Fut USDT','Futures',30);A('zm','ZzEx Margin USDT','Margin',20);})})()""")
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
    box=pg.locator('.ivplat:has(.wtab:has-text("Earn"))').first
    tabs=box.locator('.wtab').all_inner_texts()
    ok('one tab per wallet %s'%tabs, {'Spot','Margin','Futures','Earn'}<=set(tabs))
    ok('only the selected wallet (Spot) lists assets', box.locator('.hold').count()==1 and 'Spot' in box.locator('.wtab.on').inner_text())
    box.locator('.wtab:has-text("Earn")').click(); pg.wait_for_timeout(500)
    box=pg.locator('.ivplat:has(.wtab:has-text("Earn"))').first
    ok('Earn tab shows Earn assets and the passive note', box.locator('.hold').count()==1 and 'Earn only collects interest' in box.inner_text())
    pg.reload(); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(500); pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
    ok('tab choice remembered', 'Earn' in pg.locator('.ivplat:has(.wtab:has-text("Earn")) .wtab.on').first.inner_text())
    # form refuses entries on Earn
    R=pg.evaluate("""(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'expense',acct:'ze'}});return 1})()""")
    pg.wait_for_selector('#f-amount'); pg.evaluate("document.querySelector('#f-amount').focus()")
    pg.keyboard.type('5'); pg.evaluate("document.querySelector('[data-e=save]')?.click()"); pg.wait_for_timeout(500)
    n=pg.evaluate("(async()=>(await import('/js/core.js')).get().txs.filter(t=>!t.deleted&&t.acct==='ze').length)()")
    ok('no hand-made expense saved on Earn (%s) and the reason is told'%n, n==0 and 'Earn only collects' in pg.evaluate("document.body.innerText"))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # transfer from Spot to Earn through the form is refused as well
    pg.evaluate("""(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',acct:'zs',toAcct:'ze'}})})()""")
    pg.wait_for_selector('#f-amount'); pg.evaluate("document.querySelector('#f-amount').focus()"); pg.keyboard.type('5'); pg.evaluate("document.querySelector('[data-e=save]')?.click()"); pg.wait_for_timeout(500)
    n=pg.evaluate("(async()=>(await import('/js/core.js')).get().txs.filter(t=>!t.deleted&&(t.acct==='ze'||t.toAcct==='ze')).length)()")
    ok('no form transfer into Earn (%s)'%n, n==0)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # Internal Transfer still works
    m=pg.evaluate("""(async()=>{const i=await import('/js/internal.js'),c=await import('/js/core.js');i.internalMove({platform:'ZzEx',cur:'USDT',from:'Spot',to:'Earn',amount:10,when:c.nowStamp()});const b=c.balances(c.get());return [b.get('zs'),b.get('ze')]})()""")
    ok('Internal Transfer Spot to Earn still works %s'%m, abs(m[0]-90)<1e-6 and abs(m[1]-60)<1e-6)
    # Earn account page: no Add entry, menu only Internal
    pg.evaluate("""(async()=>{const u=await import('/js/ui.js');u.ACT.acct({dataset:{id:'ze'}})})()""")
    pg.wait_for_selector('[data-ad=edit]'); pg.wait_for_timeout(300)
    ok('Earn page has no Add entry button', pg.locator('[data-ad=add]').count()==0)
    pg.click('[data-ad=fab]'); pg.wait_for_timeout(200)
    items=pg.locator('.adfab-menu button').all_inner_texts()
    ok('Earn + menu is Internal Transfer only %s'%items, items==['Internal Transfer'])
    # trade lists leave Earn out
    pg.keyboard.press('Escape')
    L=pg.evaluate("""(async()=>{const t=await import('/js/trades.js');t.openTrade({platform:'ZzEx'});return [...document.querySelectorAll('#tr select[name=asset] option, #tr select[name=cash] option')].map(o=>o.textContent)})()""")
    ok('Earn account not offered in Trade %s'%[x for x in L if 'Earn' in x], not [x for x in L if 'Earn' in x])
    # 15.20: compact tabs, small corners, theme colours in light and dark, USDT in every trading wallet
    g=pg.evaluate("""(()=>{const t=document.querySelector('.wtab:not(.on)'),o=document.querySelector('.wtab.on'),cs=getComputedStyle(t),co=getComputedStyle(o);return {h:t.getBoundingClientRect().height,r:parseFloat(cs.borderRadius),c1:cs.color,c2:co.color,ink:getComputedStyle(document.body).color}})()""")
    ok('tabs are compact (<=34px) with small corners (<=10px) %s'%g, g['h']<=34 and g['r']<=10)
    ok('selected text is the body text colour', g['c2']==g['ink'] and g['c1']!=g['c2'])
    pg.emulate_media(color_scheme='dark'); pg.wait_for_timeout(200)
    g2=pg.evaluate("""(()=>{const o=document.querySelector('.wtab.on'),t=document.querySelector('.wtab:not(.on)');const lum=(c)=>{const m=c.match(/[\\d.]+/g).map(Number);return .2126*m[0]+.7152*m[1]+.0722*m[2]};return {sel:lum(getComputedStyle(o).color),uns:lum(getComputedStyle(t).color),bg:lum(getComputedStyle(t).backgroundColor)}})()""")
    ok('dark mode: tab text lighter than its background %s'%g2, g2['sel']>g2['bg']+60 and g2['uns']>g2['bg']+40)
    pg.emulate_media(color_scheme='light')
    U=pg.evaluate("""(async()=>{const t=await import('/js/tokens.js'),c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'qq1',name:'QqEx SOL',cur:'SOL',type:'crypto',open:1,include:false,archived:false,exchange:'QqEx',wallet:'Futures',invtab:true}))});const n=t.ensureUsdt();return [n,c.get().accounts.filter(a=>!a.deleted&&a.exchange==='QqEx'&&a.cur==='USDT').map(a=>a.wallet).sort(),c.get().accounts.some(a=>a.exchange==='ZzEx'&&a.wallet==='Earn'&&a.cur==='USDT'&&a.id!=='ze')]})()""")
    ok('USDT made in Spot and Futures of a platform (not Earn) %s'%U, U[1]==['Futures','Spot'] and U[2]==False)
    ok('running it again makes nothing', pg.evaluate("(async()=>(await import('/js/tokens.js')).ensureUsdt())()")==0)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(600); pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
    ok('empty USDT of QqEx Spot is listed', pg.locator('.ivplat:has(.exname:text-is("QqEx")) .hold:has-text("USDT")').count()>=1)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
