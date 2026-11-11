# v15.26: an account cannot be changed to Earn (edit form and wallet-move); Earn tab has "+ Transfer In/Out" at the top and no + Asset / Internal at the bottom
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
    box=pg.locator('.ivplat:has(.wtab:has-text("Earn"))').first
    ok('Spot tab: no top transfer button, bottom row has + Asset and Internal', box.locator('.earntop').count()==0 and box.locator('[data-act=inv-coin]').count()==1 and box.locator('[data-act=inv-internal]').count()==1)
    box.locator('.wtab:has-text("Earn")').click(); pg.wait_for_timeout(500)
    box=pg.locator('.ivplat:has(.wtab:has-text("Earn"))').first
    ok('Earn tab: "+ Transfer In/Out" at the top', box.locator('.earntop [data-act=inv-internal]').count()==1 and 'Transfer In/Out' in box.locator('.earntop').inner_text())
    ok('Earn tab: no + Asset and no bottom Internal', box.locator('[data-act=inv-coin]').count()==0 and box.locator('[data-act=inv-internal]').count()==1)
    ok('Earn tab: Record and Rename still there', box.locator('[data-act=inv-add]').count()==1 and box.locator('[data-act=inv-rename]').count()==1)
    pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)"); box.locator('.earntop [data-act=inv-internal]').click(); pg.wait_for_selector('.sheet',timeout=4000); pg.wait_for_timeout(400)
    ok('top button opens Internal Transfer', 'Internal' in pg.inner_text('.sheet'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    # wallet-move to Earn is blocked
    pg.evaluate("(async()=>{const u=await import('/js/ui.js');u.ACT['wallet-move']({dataset:{id:'zm',w:'Earn'}})})()"); pg.wait_for_timeout(500)
    w=pg.evaluate("(async()=>(await import('/js/core.js')).get().accounts.find(a=>a.id==='zm').wallet)()")
    ok('wallet-move Margin to Earn refused (%s) with the Internal Transfer message'%w, w=='Margin' and 'Internal Transfer' in pg.inner_text('body'))
    # edit form: choose Earn on a Spot account and save
    pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccount('zs')})()"); pg.wait_for_selector('select[name=wallet]',state='attached',timeout=4000)
    ok('edit form is open', pg.locator('select[name=wallet]').count()==1)
    pg.evaluate("(()=>{const s=document.querySelector('select[name=wallet]');s.value='Earn';s.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(300)
    v=pg.evaluate("document.querySelector('select[name=wallet]').value")
    ok('choosing Earn in the form is undone (%s) and told'%v, v=='Spot' and 'Internal Transfer' in pg.inner_text('body'))
    pg.evaluate("(()=>{const s=document.querySelector('select[name=wallet]');s.value='Earn';document.querySelector('select[name=wallet]').form.requestSubmit()})()"); pg.wait_for_timeout(600)
    w=pg.evaluate("(async()=>(await import('/js/core.js')).get().accounts.find(a=>a.id==='zs').wallet)()")
    ok('saving with Earn does not change it (%s)'%w, w=='Spot')
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
