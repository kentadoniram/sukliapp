# v13.50: rate window (type the rate OR both amounts), smart branch suggestion, smaller Paid-for-Others boxes, coin icons
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("c.commit(d=>{d.settings.mode='advanced';const a=d.accounts.find(x=>!x.deleted&&x.cur===(d.settings.homeCur||'PHP'))||d.accounts[0];"
      "d.accounts.push(c.stamp({id:'wt',name:'Wallet USDT',cur:'USDT',type:'cash',open:500,include:true,archived:false}));"
      "d.txs.push(c.stamp({id:'b1',kind:'expense',date:'2026-09-01',name:'Zebra Mart Run',amount:100,cur:a.cur,fx:1,acct:a.id,merchant:'Zebra Mart',branch:'North',loc:{la:35.50,lo:139.70}}));"
      "d.txs.push(c.stamp({id:'b2',kind:'expense',date:'2026-10-01',name:'Zebra Mart Run',amount:100,cur:a.cur,fx:1,acct:a.id,merchant:'Zebra Mart',branch:'Station',loc:{la:35.60,lo:139.80}}));})")
    # rate window: two amounts -> rate, nothing divided again
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(400)
    pg.evaluate("(()=>{const e=document.querySelector('#f-acct');e.value='wt';e.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=fxopen]').click()"); pg.wait_for_selector('#cv-a'); pg.wait_for_timeout(300)
    pg.fill('#cv-a','10'); pg.dispatch_event('#cv-a','input'); pg.fill('#cv-b','580'); pg.dispatch_event('#cv-b','input'); pg.wait_for_timeout(200)
    ok('typing both amounts gives the rate (58), amounts untouched', abs(float(pg.input_value('#cv-r'))-58)<1e-6 and float(pg.input_value('#cv-a'))==10 and float(pg.input_value('#cv-b'))==580)
    ok('pair label shows USDT/', 'USDT/' in pg.inner_text('#cv-rl'))
    pg.evaluate("document.querySelector('#cv-setrate').click()"); pg.fill('#cv-r','60'); pg.dispatch_event('#cv-r','input'); pg.wait_for_timeout(150)
    ok('typing the rate still works (10 x 60 = 600)', float(pg.input_value('#cv-b'))==600)
    ok('coin icon in the converter', pg.locator('#cv-la .coin').count()==1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok('coin icon on the entry currency button', pg.locator('[data-e=curpick] .coin').count()==1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # branch suggestion
    pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(400)
    pg.fill('#f-what','Zebra Mart Run'); pg.wait_for_timeout(800)
    txt=pg.inner_text('#branchcell')
    ok('merchant suggested, branch = the one used last (%s)'%txt.replace('\n',' '), 'Station' in txt and 'used last' in txt)
    # Paid for others boxes
    pg.fill('#f-amount','500'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=oth-mode][data-v=amount]').click()"); pg.wait_for_selector('.oth-n',state='attached'); h=pg.evaluate("Math.round(document.querySelector('.oth-n').getBoundingClientRect().height)")
    ok('person and amount boxes are smaller (%spx)'%h, 0<h<=50)
    ok('no page errors %s'%errs[:1], not errs)
    b.close()
print('SUMMARY',sum(res),'passed',len(res)-sum(res),'failed')
