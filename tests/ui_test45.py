# v12ag: tabs stay at the bottom around Settings fields (iPhone); promo lock terms on the account page and form
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':402,'height':874},device_scale_factor=3,is_mobile=True,has_touch=True,user_agent=UA,service_workers='block')
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(600)
    bottom=lambda: pg.evaluate("(()=>{const r=document.querySelector('.tabs').getBoundingClientRect();return [Math.round(r.bottom),innerHeight,getComputedStyle(document.querySelector('.tabs')).display]})()")
    t0=bottom(); ok(f'tabs sit on the bottom edge to start: {t0}', t0[0]==t0[1] and t0[2]!='none')
    inp=pg.locator('#view input[type=text], #view input:not([type]), #view input[inputmode]').first
    inp.tap(); pg.wait_for_timeout(300)
    ok('tabs are hidden while a field on the page has the keyboard', pg.evaluate("document.documentElement.classList.contains('typing')") and bottom()[2]=='none')
    pg.evaluate("document.activeElement.blur()"); pg.wait_for_timeout(600)
    t1=bottom(); ok(f'tabs come back at the bottom after the keyboard closes: {t1}', t1[0]==t1[1] and t1[2]!='none')
    # promo lock
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');const t=new Date().toISOString().slice(0,10);c.commit(d=>{d.accounts.push({id:'lk1',name:'Lock Savings',type:'bank',cur:c.HOME,openBal:0,created:1,updated:1,apy:1,promos:[{depFrom:t,depTo:t,rate:5,until:'',lockDays:30,lockEnd:''}]});d.txs.push({id:'lkdep',kind:'income',acct:'lk1',amount:1000,cur:c.HOME,fx:1,date:t+' 09:00:00',name:'Deposit',created:1,updated:1});});})()""")
    pg.wait_for_timeout(300)
    pg.evaluate("(async()=>{const a=await import('/js/accpage.js');a.openAccountDetail('lk1')})()"); pg.wait_for_selector('.cardbox')
    txt=pg.inner_text('.sheet-body')
    ok('account page shows locked money', 'Locked:' in txt and 'free to take out' in txt and 'unlocks' in txt)
    ok('promo row says it is locked', 'Locked 30 days after each deposit' in txt)
    pg.click('[data-ad=edit]'); pg.wait_for_selector('[name=pr-lock]')
    ok('promo form has the lock fields', pg.locator('[name=pr-lock]').count()==1 and pg.locator('[name=pr-lockend]').count()==1 and pg.input_value('[name=pr-lock]')=='30')
    ok('no script errors', not errs)
print('SUMMARY',sum(res),'/',len(res))
