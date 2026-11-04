# v13.40: Subscription Settings, Internal Transfer From list
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;const mk=(id,w,cur,o)=>d.accounts.push(c.stamp({id,name:'Qx '+w+' '+cur,wallet:w,cur,type:'crypto',assetType:'crypto',exchange:'Qx',open:o,include:false,archived:false,invtab:true}));mk('q1','Spot','USDT',500);mk('q2','Earn','USDT',0);mk('q3','Margin','USDT',0)})})()""")
    # internal: From can be any wallet
    pg.evaluate("(async()=>{const m=await import('/js/internal.js');m.openInternal({platform:'Qx'})})()"); pg.wait_for_selector('#itf')
    ws=pg.eval_on_selector_all('#itf [name=from] option','o=>o.map(x=>x.value)'); ok('From lists every wallet %s'%ws, 'Spot' in ws and 'Earn' in ws and 'Margin' in ws)
    pg.select_option('#itf [name=from]','Earn'); ok('From can be changed to Earn', pg.input_value('#itf [name=from]')=='Earn')
    h=pg.evaluate("[document.querySelector('#itf [name=from]').offsetHeight,document.querySelector('#it-rev').offsetHeight]"); ok('From and Reverse same height %s'%h, h[0]==h[1])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.evaluate("(async()=>{const m=await import('/js/earnui.js');m.openEarn('q2')})()"); pg.wait_for_selector('#ew')
    t=pg.inner_text('#ew'); ok('named Subscription Settings with a switch', 'Subscription Settings' in t and pg.locator('#ew .switch input').count()==1)
    pg.click('#ew .switch'); pg.wait_for_timeout(400)
    t=pg.inner_text('#ew'); ok('turned on: APY beside Timezone, explanations, no amount field', 'Yearly Rate' in t and 'What These Mean' in t and 'Deposit Time' in t and 'Amount (Type All' not in t and 'Extra Hours' not in t)
    ok('Timezone and Yearly Rate share a row', pg.evaluate("(()=>{const a=document.querySelector('#ew [data-ew=tz]').getBoundingClientRect(),b=document.querySelector('#ew [data-ew=apy]').getBoundingClientRect();return Math.abs(a.top-b.top)<4})()"))
    pg.click('#ew [data-ew=suby]'); pg.wait_for_timeout(400)
    v=pg.input_value('#ew [data-ew=from]'); ok('Move From pre-filled with Spot %s'%v, v=='q1')
    ok('Add Time box is small', pg.evaluate("document.querySelector('#ew [data-ew=pickslot]').offsetWidth")<150)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.id==='q2');return [a.earn.from,a.earn.subOn]})()"); ok('saved %s'%r, r==['q1',True])
    pg.click('#ew [data-ew=done]'); pg.wait_for_timeout(500); ok('Done closes', pg.locator('#ew').count()==0)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
