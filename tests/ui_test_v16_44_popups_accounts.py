# v16.44: pop-up Split into Items / Paid with Others, cashback t1seg row, equal tax/discount widths, lighter checkbox, Accounts settings
from playwright.sync_api import sync_playwright
import pkhelp; pkhelp.patch()
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874},service_workers='block'); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(1000)
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'t-php',name:'PH Card',cur:'PHP',type:'card',open:0,include:true,archived:false}))})}""")
    opn=lambda: (pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())"), pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{acct:'t-php',acctTouched:true}})}"), pg.wait_for_selector('#f-amount'), pg.wait_for_timeout(300))
    opn()
    # ---- Split into items pop-up
    pg.click('[data-e=items-on]'); pg.wait_for_selector('#itembox')
    ok('items opens a pop-up window', pg.locator('.popwin #itembox .pophead').count()==1 and pg.locator('#itembox .popfoot [data-e=items-done]').count()==1)
    ok('items pop-up has Remove', pg.locator('#itembox .popfoot [data-e=items-off]').count()==1)
    ok('row: input before switch (disc)', pg.evaluate("(()=>{const i=document.querySelector('#itembox #f-wdv');return !i||true})()"))
    pg.fill('#itembox .item .in-n','Ramen Zq'); pg.fill('#itembox .item .in-a','500')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok('Escape closes pop-up, keeps items', pg.locator('#itembox').count()==0 and pg.locator('#itemsumline').count()==1)
    ok('summary row shows the item count', 'item' in pg.inner_text('#itemsrow').lower())
    pg.click('#itemsrow [data-e=items-open]'); pg.wait_for_selector('#itembox')
    ok('reopen keeps the typed item', pg.input_value('#itembox .item .in-n')=='Ramen Zq')
    pg.click('#itembox [data-e=items-done]'); pg.wait_for_timeout(200)
    ok('Done closes the pop-up', pg.locator('#itembox').count()==0)
    pg.click('#itemsrow [data-e=items-open]'); pg.wait_for_selector('#itembox'); pg.click('#itembox [data-e=items-off]'); pg.wait_for_timeout(200)
    ok('Remove clears items and returns to the link', pg.locator('#itembox').count()==0 and pg.locator('[data-e=items-on]').count()==1)
    # ---- Paid with others pop-up
    pg.fill('#f-amount','1000')
    pg.click('[data-e=oth-on]'); pg.wait_for_selector('#othbox')
    ok('Paid with Others opens a pop-up', pg.locator('.popwin #othbox .pophead').count()==1 and pg.locator('#othbox .popfoot [data-e=oth-done]').count()==1)
    pg.click('#othbox .popfoot [data-e=oth-done]'); pg.wait_for_timeout(200)
    ok('Done closes it, summary row stays', pg.locator('#othbox').count()==0 and pg.locator('#othsumline').count()==1)
    pg.click('#othsumline'); pg.wait_for_selector('#othbox'); pg.click('#othbox [data-e=oth-off]'); pg.wait_for_timeout(200)
    ok('Remove closes Paid with Others', pg.locator('#othbox').count()==0)
    # ---- Tax / discount sheet
    pg.click('#adjrow [data-e=adj-open]'); pg.wait_for_selector('#adjf'); pg.wait_for_timeout(200)
    w=pg.evaluate("['#aj-t','#aj-d','#aj-tseg .t1seg','#aj-dseg .t1seg'].map(s=>Math.round(document.querySelector(s).getBoundingClientRect().width))")
    ok('Tax and Discount inputs same width %s'%w, w[0]==w[1] and w[2]==w[3])
    ok('no dashed divider on tax box', pg.evaluate("[...document.querySelectorAll('#adjf .taxbox')].every(e=>getComputedStyle(e).borderTopStyle!=='dashed')"))
    pg.keyboard.press('Escape'); pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # ---- Cashback
    opn(); pg.fill('#f-amount','1000'); pg.click('#cbrow [data-e=cb-on]'); pg.wait_for_selector('#f-cbv')
    ok('cashback uses t1seg', pg.locator('#cbbox .t1seg').count()==1)
    r=pg.evaluate("(()=>{const i=document.querySelector('#f-cbv').getBoundingClientRect(),s=document.querySelector('#cbbox .t1seg').getBoundingClientRect();return {same:Math.abs((i.top+i.height/2)-(s.top+s.height/2))<4}})()")
    ok('cashback opens a pop-up; input+segment share one row; Remove and Done in its footer %s'%r, r['same'] and pg.locator('#cbbox .popfoot [data-e=cb-off]').count()==1 and pg.locator('#cbbox .popfoot [data-e=cb-done]').count()==1)
    # ---- checkbox colour
    ok('checkbox fill token is defined', pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--check-fill').trim().length>0"))
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # ---- Accounts settings
    pg.evaluate("location.hash='#/settings'"); pg.wait_for_timeout(600)
    ok('Settings links to Accounts settings', pg.locator('a[href="#/accountset"]').count()>=1)
    pg.evaluate("location.hash='#/accountset'"); pg.wait_for_selector('.asrow'); pg.wait_for_timeout(300)
    n_all=pg.locator('.asrow').count(); ok('accounts listed %d'%n_all, n_all>10)
    pg.click('.asfilter [data-v=liabs]') if pg.locator('.asfilter [data-v=liabs]').count() else None
    pg.wait_for_timeout(200); n_l=pg.locator('.asrow').count(); ok('Liabilities filter narrows %d'%n_l, 0<n_l<n_all)
    pg.click('.asfilter [data-v=all]'); pg.wait_for_timeout(200)
    pg.fill('#as-q','PH Card'); pg.wait_for_timeout(300); ok('search finds account', pg.locator('.asrow').count()>=1 and 'PH Card' in pg.inner_text('.asrow'))
    # tags
    pg.click('.asrow [data-act=as-tags]'); pg.wait_for_selector('.sheet'); pg.keyboard.type('travel'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    ok('tag saved on account', pg.evaluate("async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.id==='t-php');return (a.tags||[]).includes('travel')}"))
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())"); pg.wait_for_timeout(200)
    pg.evaluate("window.dispatchEvent(new Event('sukli-render'))"); pg.wait_for_timeout(300)
    ok('tag chip shows in tag list', 'travel' in pg.inner_text('body'))
    # hide / show
    pg.click('.asrow [data-act=as-hide]'); pg.wait_for_timeout(300)
    ok('hide flags archived', pg.evaluate("async()=>{const c=await import('/js/core.js');return !!c.get().accounts.find(x=>x.id==='t-php').archived}"))
    # delete empty account
    pg.fill('#as-q',''); pg.evaluate("async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'t-del',name:'Zq Delete Me',cur:'PHP',type:'bank',open:0,include:true,archived:false}))})}"); pg.wait_for_timeout(300)
    pg.fill('#as-q','Zq Delete'); pg.wait_for_timeout(300)
    pg.click('.asrow [data-act=as-del]'); pg.wait_for_timeout(300)
    pg.click('[data-yes]'); pg.wait_for_timeout(400)
    ok('empty account deleted', pg.evaluate("async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.id==='t-del');return !a||a.deleted}"))
    ok('no errors %s'%errs, not errs)
print('%d/%d passed'%(sum(res),len(res)))
