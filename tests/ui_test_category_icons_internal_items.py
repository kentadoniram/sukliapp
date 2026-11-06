# v13.52: category pictures + library, clock first, item buttons/calculator/placeholder, Internal option, coin icons in Investments
import re
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("c.commit(d=>{d.settings.mode='advanced';d.accounts.push(c.stamp({id:'wy',name:'Yen Wallet',cur:'JPY',type:'cash',open:50000,include:true,archived:false}));d.accounts.push(c.stamp({id:'wt',name:'Wallet USDT',cur:'USDT',type:'crypto',open:500,include:true,archived:false}));})")
    # entry form: tiles with pictures
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(400)
    pg.evaluate("(()=>{const e=document.querySelector('#f-acct');e.value='wy';e.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(200)
    pg.fill('#f-what','Bus fare'); pg.wait_for_timeout(700)
    ok('category tiles show a picture and the name as caption', pg.locator('.cattile > i svg.cico').count()>=1 and pg.locator('.cattile > span').count()>=1)
    ok('Internal option is in the kind row', pg.locator('[data-e=internal]').count()==1)
    # items: placeholder follows the currency, smaller buttons, calculator
    pg.fill('#f-amount','1000'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('[data-e=items-on]')?.click()"); pg.wait_for_timeout(300)
    if pg.locator('.in-a').count()==0: pg.evaluate("document.querySelector('[data-e=itemadd]')?.click()"); pg.wait_for_timeout(300)
    if pg.locator('.in-a').count():
        ph=pg.get_attribute('.in-a','placeholder'); ok('item price placeholder is yen style (%s)'%ph, ph and '0.0' not in ph and ('¥' in ph or '￥' in ph or 'JP' in ph))
        pg.fill('.in-a','120+45*2'); pg.dispatch_event('.in-a','input'); pg.evaluate("document.querySelector('[data-e=item-calc]').click()"); pg.wait_for_timeout(200)
        ok('calculator inside the item amount gives 210', pg.input_value('.in-a')=='210')
        h=pg.evaluate("Math.round(document.querySelector('.item .qty button')?.getBoundingClientRect().height||0)"); ok('plus/minus buttons are small (%s)'%h, 0<h<=30)
    else: ok('items editor reachable',False)
    # internal option opens the Internal Transfer window
    pg.evaluate("document.querySelector('[data-e=internal]').click()"); pg.wait_for_timeout(700)
    ok('Internal Transfer window opens', 'Internal Transfer' in pg.inner_text('body'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # category editor: pick a picture from the library, kept everywhere
    pg.evaluate("location.hash='#/categories'"); pg.wait_for_timeout(600)
    ok('Categories page uses picture tiles', pg.locator('.cattile > i svg.cico').count()>3)
    cid=pg.evaluate("document.querySelector('[data-act=cat-edit]').dataset.id")
    pg.evaluate("document.querySelector('[data-act=cat-edit]').click()"); pg.wait_for_selector('#icopick'); pg.evaluate("document.querySelector('#icopick').click()"); pg.wait_for_selector('.icogrid')
    n=pg.locator('.icocell').count(); ok('icon library has many pictures (%d)'%n, n>=50)
    pg.evaluate("document.querySelector('.icocell[data-ico=paw]').click()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#catform').requestSubmit()"); pg.wait_for_timeout(500)
    ok('chosen picture saved on the category', J("return c.get().categories.find(x=>x.id==='%s').icon"%cid)=='paw' if False else pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().categories.find(x=>x.id==='%s').icon})()"%cid)=='paw')
    # Investments: coin badge
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
    ok('Investments rows show the coin badge', pg.locator('.row.acct .coin').count()>=1)
    # clock is visible without scrolling
    pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300)
    pg.evaluate("import('/js/datepicker.js').then(m=>m.openDatePicker('2026-11-06 10:20:00',()=>{}))"); pg.wait_for_selector('#dp'); pg.evaluate("document.querySelector('#dp [data-clock]').click()"); pg.wait_for_selector('#dp .dpface'); pg.wait_for_timeout(300)
    r=pg.evaluate("(()=>{const f=document.querySelector('#dp .dpface').getBoundingClientRect();return [Math.round(f.top),Math.round(f.bottom),innerHeight]})()")
    ok('analog clock fully inside the screen without scrolling %s'%r, r[0]>=0 and r[1]<=r[2])
    ok('no errors %s'%errs[:2], not errs)
    b.close()
print('SUMMARY',sum(res),'passed',len(res)-sum(res),'failed')
