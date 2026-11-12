# v15.30: segmented controls select ONE option; one Transfer In/Out in Earn; + Asset only in Platform Settings and it reaches every trading account
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
      A('zs','ZzEx Spot USDT','Spot',100);A('ze','ZzEx Earn USDT','Earn',50);A('zm','ZzEx Margin USDT','Margin',20);})})()""")
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
    box=pg.locator('.ivplat:has(.segi:has-text("Earn"))').first
    ok('exchange card: exactly one segment selected', box.locator('.segi.on').count()==1)
    box.locator('.segi:has-text("Margin")').click(); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)"); box=pg.locator('.ivplat:has(.segi:has-text("Earn"))').first
    ok('choosing Margin replaces the old choice', box.locator('.segi.on').all_inner_texts()==['Margin'] and box.locator('.wblock').count()==1)
    ok('no + Asset button on any account type tab', box.locator('[data-act=inv-coin]').count()==0)
    pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)"); box.locator('.segi:has-text("Earn")').click(); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)"); box=pg.locator('.ivplat:has(.segi:has-text("Earn"))').first
    ok('Earn: a single Transfer In/Out, in the bottom row', box.locator('[data-act=inv-internal]').count()==1 and box.locator('.btnrow.oneline [data-act=inv-internal]').count()==1 and 'Transfer In/Out' in box.inner_text())
    ok('the link says Platform Settings only', box.locator('.platbar').inner_text().strip()=='Platform Settings' and 'Rename Platform' not in box.locator('.platbar').inner_text())
    pg.evaluate("(async()=>{const m=await import('/js/invest.js');m.addAsset({platform:'ZzEx'})})()"); pg.wait_for_selector('#ic'); pg.wait_for_timeout(300)
    ok('the Add Asset sheet has no trading-account choice and says every account gets it', not pg.locator('#walf').is_visible() and 'every trading account' in pg.inner_text('#ic'))
    pg.fill('#ic [name=coin]','BONK'); pg.click('#ic .btn:not(.ghost)'); pg.wait_for_timeout(800)
    w=pg.evaluate("window.sukli.get().accounts.filter(x=>!x.deleted&&x.exchange==='ZzEx'&&x.cur==='BONK').map(x=>x.wallet).sort()")
    ok('BONK exists in Spot, Earn and Margin and every other trading account (%s)'%w, {'Spot','Earn','Margin'}<=set(w) and len(w)==len(set(w)))
    pg.evaluate("(async()=>{const m=await import('/js/platform.js');m.openPlatform('ZzEx')})()"); pg.wait_for_selector('.platset'); 
    ok('Platform Settings has + Asset (Add Asset) and Rename Platform stays here', pg.locator('.platset [data-do=inv-coin]').count()==1 and pg.locator('.platset [data-do=inv-rename]').count()==1)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.dashcard',timeout=8000); pg.wait_for_timeout(300)
    labs=pg.locator('.dashcard .segi').all_inner_texts()
    ok('all five dashboard sections are always listed %s'%labs, {'Performance','Per-Token Performance','Fees and Losses','Prediction','Realized Gains'}<=set(labs))
    pg.click('.dashcard .segi:has-text("Realized Gains")'); pg.wait_for_timeout(300)
    ok('a section without data shows a plain message, not nothing', pg.locator('.dashcard .dashbody').count()==1 and 'Realized Gains' in pg.inner_text('.dashcard .dashbody'))
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
