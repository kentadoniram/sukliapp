# v16.34: Compare payment methods (estimates), shop price kept with the posted entry and the market rate at recording time
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    ids=pg.evaluate("""async()=>{const c=await import('/js/core.js');
      c.commit(db=>{db.settings.rates=Object.assign({},db.settings.rates,{JPY:0.4});
        db.accounts.push({id:'t-card',name:'Test Card',cur:c.HOME,type:'card',open:0,include:true,archived:false,pay:{markup:0.3,fee:2.5,flat:0,cashback:0.5}},{id:'t-deb',name:'Test Debit',cur:c.HOME,type:'bank',open:50000,include:true,archived:false,pay:{markup:0,fee:1,flat:0,cashback:0}})});
      return [c.HOME,c.homeFx(c.get(),'JPY')]}""")
    print(ids)
    pg.evaluate("""async()=>{const m=await import('/js/entry.js');m.openEntry({});return true}"""); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(400)
    ok('compare link on an expense', pg.locator('#paycmp .paylink').count()==1)
    ok('link sits under the amount, not at the top', pg.evaluate("(()=>{const a=document.getElementById('f-amount'),l=document.getElementById('paycmp');return !!(a.compareDocumentPosition(l)&4)})()"))
    pg.click('#paycmp .paylink'); pg.wait_for_selector('#pc-amt'); pg.fill('#pc-amt','1500'); pg.wait_for_timeout(300)
    ok('cash baseline row', 'Cash (JPY)' in pg.inner_text('#pc-out'))
    ok('card and debit rows', 'Test Card' in pg.inner_text('#pc-out') and 'Test Debit' in pg.inner_text('#pc-out'))
    ok('rows say estimate/not recorded', 'Nothing here is recorded' in pg.inner_text('.pcsheet'))
    t=pg.inner_text('#pc-out'); print(t[:600])
    ok('accounts without settings show a starting guess', 'Starting guess' in t); ok('debit shows your assumptions', 'Your assumptions' in t)
    ok('difference vs cash shown', 'vs cash' in t)
    # edit assumptions
    pg.locator('.pcrow', has_text='Test Card').locator('[data-act=pc-edit]').click(); pg.wait_for_selector('input[name=m]')
    pg.fill('input[name=f]','3'); pg.fill('input[name=c]','1'); pg.click('button[type=submit]:visible'); pg.wait_for_timeout(400)
    pg.wait_for_timeout(300)
    ok('assumptions saved on the account', pg.evaluate("(async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.id==='t-card');return a.pay&&a.pay.fee===3&&a.pay.cashback===1})()"))
    ok('row now uses your assumptions', 'fee 3%' in pg.locator('.pcrow',has_text='Test Card').inner_text())
    pg.check('#pc-keep'); pg.click('#pc-ok'); pg.wait_for_timeout(300)
    ok('shop price kept link', 'Shop price' in pg.inner_text('#paycmp'))
    # record on the card with the posted amount
    pg.evaluate("(()=>{const s=document.getElementById('f-acct');s.value='t-card';s.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(400)
    pg.fill('#f-amount','612.5'); pg.wait_for_timeout(200)
    pg.evaluate("document.getElementById('f-what').value='Lunch test'; document.getElementById('f-what').dispatchEvent(new Event('input',{bubbles:true}))"); pg.wait_for_timeout(400)
    pg.evaluate("(()=>{const c=document.querySelector('#catrow [data-e=cat]');if(c)c.click()})()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=save]').click()"); pg.wait_for_timeout(800)
    t=pg.evaluate("""(async()=>{const c=await import('/js/core.js');return c.get().txs.filter(x=>!x.deleted&&x.orig).slice(-1)[0]||null})()""")
    print(t)
    ok('entry saved with posted amount as the amount', t and t['amount']==612.5 and t['cur']==ids[0])
    ok('shop price and market rate at recording saved', t and t['orig']['cur']=='JPY' and t['orig']['amt']==1500 and abs(t['orig']['mid']-0.4)<1e-9)
    ok('effective rate from posted amount', t and abs(t['orig']['rate']-612.5/1500)<1e-9)
    pg.evaluate("""async(id)=>{const v=await import('/js/entryview.js');v.openEntryView(id)}""", t['id'] if t else '')
    pg.wait_for_timeout(400); tx=pg.inner_text('.evw')
    ok('entry view shows shop price and posted rate', 'Shop price' in tx and 'Posted rate' in tx and 'market then' in tx)
    ok('no page errors %s'%errs, not errs)
    pg.screenshot(path='/tmp/v34.png'); b.close()
print('\n%d/%d passed'%(sum(res),len(res))); raise SystemExit(0 if all(res) else 1)
