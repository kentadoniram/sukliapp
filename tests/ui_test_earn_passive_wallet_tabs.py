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
    box=pg.locator('.ivplat:has(.segi:has-text("Earn"))').first
    tabs=box.locator('.segi').all_inner_texts()
    ok('one switch per wallet %s'%tabs, {'Spot','Margin','Futures','Earn'}<=set(tabs))
    ok('only the selected wallet (Spot) lists assets', box.locator('.hold').count()==1 and 'Spot' in box.locator('.segi.on').inner_text())
    box.locator('.segi:has-text("Earn")').click(); pg.wait_for_timeout(500)
    box=pg.locator('.ivplat:has(.segi:has-text("Earn"))').first
    ok('Earn switched on (Spot stays on): both blocks list their own assets, and the Earn block has the passive note', box.locator('.wblock[data-w=Spot] .hold').count()==1 and box.locator('.wblock[data-w=Earn] .hold').count()==1 and 'Earn only collects interest' in box.locator('.wblock[data-w=Earn]').text_content())
    pg.reload(); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(500); pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
    ok('switch choice remembered (Spot and Earn both still on)', set(pg.locator('.ivplat:has(.segi:has-text("Earn")) .segi.on').all_inner_texts())=={'Spot','Earn'})
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
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
