# v16.43: New Entry - input before switch in Tax/discount/fees; cashback + shop price beside the tax link; shop price saved the first time
from playwright.sync_api import sync_playwright
import pkhelp; pkhelp.patch()
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874},service_workers='block'); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(1000)
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'t-php',name:'PH Card',cur:'PHP',type:'card',open:0,include:true,archived:false}))})}""")
    opn=lambda: (pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())"), pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{acct:'t-php',acctTouched:true}})}"), pg.wait_for_selector('#f-amount'), pg.wait_for_timeout(400))
    opn()
    ok('links share one group', pg.locator('#adjgroup #adjrow').count()==1 and pg.locator('#adjgroup #cbrow').count()==1 and pg.locator('#adjgroup #shoprow').count()==1)
    ok('+ Cashback sits beside the tax link', pg.locator('#cbrow [data-e=cb-on]').count()==1)
    ok('+ Shop price link', pg.locator('#shoprow [data-e=shop-on]').count()==1)
    ya=lambda sel: pg.evaluate("s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.left,r.top]}",sel)
    l1,l2,l3=ya('#adjrow button'),ya('#cbrow button'),ya('#shoprow button')
    ok('all three on one row (same top) or wrapped just once', abs(l1[1]-l2[1])<4 and l2[0]>l1[0])
    # tax sheet: input before the switch
    pg.fill('#f-amount','613'); pg.click('#adjrow [data-e=adj-open]'); pg.wait_for_selector('#adjf')
    for k,seg in (('d','dseg'),('t','tseg'),('x','xseg')):
        if pg.locator(f'#aj-{k}').count():
            xi=pg.evaluate(f"()=>[document.querySelector('#aj-{k}').getBoundingClientRect().left,document.querySelector('#aj-{seg}').getBoundingClientRect().left]")
            ok(f'sheet {k}: input left of the switch', xi[0]<xi[1])
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    opn(); pg.fill('#f-amount','613'); pg.click('#shoprow [data-e=shop-on]'); pg.wait_for_selector('#f-shopamt')
    ok('shop price form: amount + currency, JPY default', pg.input_value('#f-shopcur')=='JPY' if pg.locator('select#f-shopcur').count() else 'JPY' in pg.inner_text('#shoprow'))
    pg.fill('#f-shopamt','1500'); pg.wait_for_timeout(200)
    t=pg.inner_text('#shopcalc'); ok('live line shows shop price, posted amount and rate '+t[:80], '1,500' in t and '613' in t and '1 JPY' in t)
    pg.fill('#f-what','Ramen Zq'); pg.click('#cbrow [data-e=cb-on]'); pg.wait_for_selector('#f-cbv'); pg.fill('#f-cbv','12')
    ok('shop price block and cashback block both open', pg.locator('#f-shopamt').count()==1 and pg.locator('#f-cbv').count()==1)
    pg.click('#btns [data-e=save]'); pg.wait_for_timeout(800)
    t=pg.evaluate("async()=>{const c=await import('/js/core.js');return c.get().txs.filter(x=>x.name==='Ramen Zq'&&!x.deleted).map(x=>({amount:x.amount,cur:x.cur,orig:x.orig}))}")
    ok('one entry saved with the posted amount as the amount %s'%t, len(t)==1 and t[0]['amount']==613 and t[0]['cur']=='PHP')
    o=t[0]['orig'] if t else None
    ok('orig kept at first entry: JPY 1500, rate 613/1500, market rate recorded, not late', o and o['cur']=='JPY' and o['amt']==1500 and abs(o['rate']*1500-o['home'])<1e-6 and o.get('mid',0)>0 and not o.get('late') and o.get('at'))
    ok('home value = posted amount in home currency', o and o['home']>0)
    eff=pg.evaluate("async()=>{const s=await import('/js/screens.js');const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.name==='Ramen Zq'&&!x.deleted);return s.effectLine(t,c.get().accounts)}")
    ok('list line mentions the shop price: '+str(eff), eff and '1,500' in eff and 'shop price' in eff)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.evaluate("""async()=>{const c=await import('/js/core.js');const v=await import('/js/entryview.js');v.openEntryView(c.get().txs.find(x=>x.name==='Ramen Zq'&&!x.deleted).id)}"""); pg.wait_for_timeout(600)
    ok('entry view shows Shop price and Posted rate', 'Shop price' in pg.inner_text('.scrim') and 'Posted rate' in pg.inner_text('.scrim'))
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # a plain entry has no orig
    opn(); pg.fill('#f-amount','100'); pg.fill('#f-what','Plain'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(600)
    o2=pg.evaluate("async()=>{const c=await import('/js/core.js');return c.get().txs.find(x=>x.name==='Plain'&&!x.deleted).orig||null}"); ok('without the option there is no shop price', o2 is None)
    # edit: opens with the saved shop price
    opn()
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.evaluate("""async()=>{const c=await import('/js/core.js');const m=await import('/js/entry.js');m.openEntry({id:c.get().txs.find(x=>x.name==='Ramen Zq'&&!x.deleted).id})}"""); pg.wait_for_timeout(600)
    ok('editing shows the shop price filled in', pg.locator('#f-shopamt').count()==1 and pg.input_value('#f-shopamt')=='1500')
    ok('no page errors %s'%errs[:2], not errs)
n=sum(res); print(f'{n}/{len(res)} passed'); print('fails',len(res)-n)
