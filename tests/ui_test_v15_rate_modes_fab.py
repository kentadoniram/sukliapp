# v15.3: rate window modes, left-aligned currency list, round + button
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    d=pg.evaluate("(()=>{const f=document.querySelector('.tabs .fab').getBoundingClientRect();return [Math.round(f.width*10)/10,Math.round(f.height*10)/10]})()")
    ok('+ button is a circle %s'%d, abs(d[0]-d[1])<0.6)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.accounts.push(c.stamp({id:'wu',name:'USD Wallet',cur:'USD',type:'cash',open:100,include:true,archived:false}))})})()")
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(400)
    pg.evaluate("(()=>{const e=document.querySelector('#f-acct');e.value='wu';e.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=fxopen]').click()"); pg.wait_for_selector('#cv-a'); pg.wait_for_timeout(300)
    la=pg.inner_text('#cv-la'); lb=pg.inner_text('#cv-lb')
    pg.fill('#cv-r','50') if False else None
    pg.fill('#cv-a','2'); pg.dispatch_event('#cv-a','input'); pg.fill('#cv-b','100'); pg.dispatch_event('#cv-b','input')
    ok('Set Amount: editing the pair, the rate follows (50), rate box not editable', abs(float(pg.input_value('#cv-r'))-50)<1e-9 and pg.evaluate("(document.querySelector('#cv-r').offsetParent===null)"))
    pg.evaluate("document.querySelector('#cv-rev').click()"); pg.wait_for_timeout(150)
    ok('swap: only the values trade, currencies stay, rate follows (1/50)', pg.inner_text('#cv-la')==la and pg.inner_text('#cv-lb')==lb and abs(float(pg.input_value('#cv-a'))-100)<1e-6 and abs(float(pg.input_value('#cv-b'))-2)<1e-6 and abs(float(pg.input_value('#cv-r'))-0.02)<1e-9)
    pg.evaluate("document.querySelector('#cv-setrate').click()"); pg.fill('#cv-r','55'); pg.dispatch_event('#cv-r','input')
    ok('Set Rate: amounts not editable, they follow the rate', pg.evaluate("(document.querySelector('#cv-a').offsetParent===null)&&(document.querySelector('#cv-b').offsetParent===null)") and abs(float(pg.input_value('#cv-a'))-100)<1e-6 and abs(float(pg.input_value('#cv-b'))-5500)<1e-6)
    pg.evaluate("document.querySelector('#cv-rev').click()"); pg.wait_for_timeout(150)
    ok('swap in rate mode: values trade, rate stays 55', abs(float(pg.input_value('#cv-a'))-5500)<1e-6 and abs(float(pg.input_value('#cv-r'))-55)<1e-9 and abs(float(pg.input_value('#cv-b'))-302500)<1e-3)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=acctpick]').click()"); pg.wait_for_selector('.pickfix .row.cur'); pg.wait_for_timeout(300)
    t=pg.evaluate("(()=>{const r=document.querySelector('.pickfix .row.cur'),m=r.querySelector('.rmain');return [getComputedStyle(r).justifyContent,getComputedStyle(m).textAlign]})()")
    ok('account and currency lists are left aligned %s'%t, t[0] in ('flex-start','start') and t[1] in ('left','start'))
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
