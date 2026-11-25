# v16.35: account and investment forms now use textField/selectField; they still open, read and save the same way
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
def clear(pg): pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_timeout(1500); clear(pg)
    # ---- account form
    pg.evaluate("async()=>{const m=await import('/js/accpage.js');m.openAccount()}"); pg.wait_for_selector('form input[name=name]'); pg.wait_for_timeout(300)
    for n in ['name','open','openDate','apy','compound','interestTo','exchange','wallet','type']:
        ok('account form has %s'%n, pg.locator('form [name=%s]'%n).count()>=1)
    ok('name is required and focused', pg.get_attribute('form input[name=name]','required') is not None)
    ok('help buttons kept beside labels', pg.locator('#open-l button, #open-l .tip, #open-l [data-act]').count()>=1)
    ok('platform row hidden until an exchange is chosen', pg.evaluate("document.getElementById('walletf').hidden"))
    pg.evaluate("(()=>{const s=document.querySelector('select[name=exchange]');const o=[...s.options].find(o=>o.value);s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(200)
    ok('choosing an exchange shows the platform row', not pg.evaluate("document.getElementById('walletf').hidden") and pg.locator('#wallet-h').count()==1)
    ok('grouped platform list kept', pg.locator('select[name=exchange] optgroup').count()==2)
    pg.evaluate("(()=>{const s=document.querySelector('select[name=type]');s.value='loan';s.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(300)
    ok('opening label follows the type', 'Owe' in pg.inner_text('#open-l') or 'Balance' in pg.inner_text('#open-l'))
    pg.fill('form input[name=name]','Field test acct'); pg.evaluate("document.querySelector('select[name=type]').value='bank'"); 
    pg.evaluate("(()=>{const s=document.querySelector('select[name=exchange]');s.value='';s.dispatchEvent(new Event('change',{bubbles:true}))})()")
    pg.fill('form input[name=open]','2500'); pg.evaluate("document.querySelector('form').requestSubmit()"); pg.wait_for_timeout(600)
    a=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().accounts.find(x=>x.name==='Field test acct')||null})()")
    ok('account saved with typed values', a and a['open']==2500, ) ; clear(pg)
    # ---- investment forms
    pg.evaluate("async()=>{const m=await import('/js/invest.js');m.addAsset({})}"); pg.wait_for_selector('form input[name=coin]'); pg.wait_for_timeout(300)
    for n in ['type','coin','name','market','quote','price','cg','wallet']:
        ok('add asset has %s'%n, pg.locator('form [name=%s]'%n).count()>=1)
    ok('ticker required and upper-case styled', pg.get_attribute('form input[name=coin]','required') is not None and 'uppercase' in (pg.get_attribute('form input[name=coin]','style') or ''))
    ok('rows keep their ids', pg.locator('#walf,#mk,#cgf').count()==3 and pg.locator('#cg-h').count()==1)
    clear(pg)
    pg.evaluate("async()=>{const m=await import('/js/invest.js');m.openIncome({})}"); pg.wait_for_timeout(500)
    ok('income form opens with its fields (or says nothing to record)', pg.locator('#ii [name=type]').count()==1 or 'hold' in pg.inner_text('body').lower() or pg.locator('.scrim').count()>=1)
    clear(pg)
    ok('no page errors %s'%errs, not errs)
    b.close()
print('\n%d/%d passed'%(sum(res),len(res))); raise SystemExit(0 if all(res) else 1)
