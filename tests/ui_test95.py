# v13.41: exchange settings, internal transfer assets, subscription switch outside, layouts
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;const mk=(id,w,cur,o)=>d.accounts.push(c.stamp({id,name:'Wx '+w+' '+cur,wallet:w,cur,type:'crypto',assetType:'crypto',exchange:'Wx',open:o,include:false,archived:false,invtab:true}));mk('w1','Spot','SOL',3);mk('w2','Earn','USDT',50);
      d.accounts.push(c.stamp({id:'op1',name:'Pay Pal Person',type:'owed',cur:'PHP',open:0,include:false}))})})()""")
    # internal sheet: same assets for every wallet, defaults, new asset, alignment
    pg.evaluate("(async()=>{const m=await import('/js/internal.js');m.openInternal({platform:'Wx'})})()"); pg.wait_for_selector('#itf')
    cs=pg.eval_on_selector_all('#itf [name=cur] option','o=>o.map(x=>x.value)'); ok('assets of every wallet offered %s'%cs, 'SOL' in cs and 'USDT' in cs and '__new' in cs)
    ok('defaults Spot -> Earn', pg.input_value('#itf [name=from]')=='Spot' and pg.input_value('#itf [name=to]')=='Earn')
    tops=pg.evaluate("['#itf [name=from]','#it-rev','#itf [name=to]'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [Math.round(r.top),Math.round(r.height)]})"); ok('From, Reverse, To aligned %s'%tops, tops[0]==tops[1]==tops[2] or (tops[0]==tops[1] and tops[1]==tops[2]))
    ok('Reverse shows only the symbol', pg.inner_text('#it-rev').strip()=='⇄')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # exchange settings sheet
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(800)
    ok('exchange name is tappable', pg.locator('.exname[data-act=plat-open][data-ex=Wx]').count()==1)
    pg.evaluate("document.querySelector('.exname[data-act=plat-open][data-ex=Wx]').click()"); pg.wait_for_selector('#pset'); t=pg.inner_text('#pset')
    ok('settings for the whole exchange %s'%t[:60].replace('\\n',' '), 'Timezone of Wx' in t and 'Internal Transfer' in t and 'Earn Products' in t and 'Rename' in t)
    pg.select_option('#pset [data-p=tz]','9'); pg.wait_for_timeout(300); z=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().settings.platformTz.Wx})()"); ok('timezone saved %s'%z, z==9)
    pg.click('#pset [data-p=done]'); pg.wait_for_timeout(300)
    # account page: no Move to Spot, switch beside Subscription Settings
    pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccountDetail('w2')})()"); pg.wait_for_timeout(900); t=pg.inner_text('body')
    ok('no Move to Spot', 'Move to Spot' not in t)
    ok('switch beside Subscription Settings', pg.locator('.subbtn .switch input[data-act=earn-toggle]').count()==1)
    pg.evaluate("document.querySelector('.subbtn .switch input').click()"); pg.wait_for_timeout(500)
    on=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().accounts.find(x=>x.id==='w2').earn.on})()"); ok('switch turns tracking on %s'%on, on is True)
    # earn window: timezone and yearly rate same size
    pg.evaluate("(async()=>{const m=await import('/js/earnui.js');m.openEarn('w2')})()"); pg.wait_for_selector('#ew')
    h=pg.evaluate("['#ew [data-ew=tz]','#ew [data-ew=apy]'].map(s=>document.querySelector(s).getBoundingClientRect().height)"); ok('Timezone and Yearly Rate same size %s'%h, h[0]==h[1])
    ok('no switch inside the settings', pg.locator('#ew .switch').count()==0)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
