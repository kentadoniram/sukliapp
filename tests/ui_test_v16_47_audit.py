# v16.47: Investments "Earned" totals agree with the per-platform chips, and update when interest / income arrives
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874},service_workers='block'); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(1000)
    def earned():
        pg.evaluate("localStorage.setItem('sukli-dpanels','[\"i-gain\"]')"); pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(200); pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
        pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
        return pg.evaluate("""()=>{const g=t=>{const l=[...document.querySelectorAll('.calfacts li')].find(x=>x.textContent.trim().startsWith(t));return l?l.querySelector('b').textContent.replace(/[^0-9.\\-−+]/g,'').replace('−','-'):null};return {yr:g('Earned, this year'),all:g('Earned, all time')}}""")
    setup="""async()=>{const c=await import('/js/core.js');c.commit(d=>{
      const home=d.settings.homeCurrency||'PHP';
      d.accounts.push(c.stamp({id:'t-ea',name:'Zq Earn Wallet',cur:'USDT',type:'crypto',exchange:'Binance',open:0,include:true,archived:false}));
      d.accounts.push(c.stamp({id:'t-ebank',name:'Zq Plain Bank',cur:home,type:'bank',open:0,include:true,archived:false}));
    })}"""
    pg.evaluate(setup)
    base=earned(); print('base',base)
    add="""async(a)=>{const c=await import('/js/core.js');c.commit(d=>{
      const cat=d.categories.find(x=>x.group==='Earn'&&!x.deleted);
      const y=new Date().getFullYear();
      for(const [id,acct,date,extra] of a) d.txs.push(c.stamp(Object.assign({id,kind:'income',amount:10,cur:acct==='t-ea'?'USDT':(d.settings.homeCurrency||'PHP'),fx:acct==='t-ea'?1:1,acct,date,name:'Zq '+id,cat:cat?cat.id:undefined},extra)));
    })}"""
    y=pg.evaluate("new Date().getFullYear()")
    pg.evaluate(add,[['zq-auto','t-ea',f'{y}-03-01 12:00:00',{'auto':True}],['zq-old','t-ea',f'{y-1}-03-01 12:00:00',{'auto':True}]])
    e=earned(); print('after auto',e)
    ok('automatic interest on an investment account moves Earned, this year', e['yr']!=base['yr'])
    ok('Earned all time counts both years', e['all']!=e['yr'])
    pg.evaluate(add,[['zq-plain','t-ebank',f'{y}-03-02 12:00:00',{'auto':True}]])
    e2=earned(); ok('interest on a non-investment account is not counted', e2==e)
    pg.evaluate(add,[['zq-inv','t-ea',f'{y}-04-01 12:00:00',{'invIncome':{'type':'Staking','asset':'t-ea'}}]])
    e3=earned(); ok('recorded asset income moves it too', e3['yr']!=e['yr'])
    # ---- interest on a normal bank / wallet account (Maya) is shown, apart from Earned
    pg.evaluate("localStorage.setItem('sukli-dpanels','[\"i-gain\"]')"); pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(200); pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
    sv=pg.evaluate("[...document.querySelectorAll('h3.subh')].some(x=>/Savings interest/.test(x.textContent))")
    ok('bank interest is not shown in Investments (v16.53)', sv==False)
    pg.evaluate("async()=>{const c=await import('/js/core.js');c.commit(d=>{const a=d.accounts.find(x=>x.id==='t-ebank');a.apy=5;a.interestFrom='2099-01-01'})}")
    pg.evaluate("async()=>{const m=await import('/js/accpage.js');m.openAccountDetail('t-ebank')}"); pg.wait_for_timeout(900)
    ok('account page shows Earned this year', 'Earned this year' in pg.inner_text('body'))
    # ---- pop-ups are centred, unchecked box is light
    pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(300)
    pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openEntry({})}"); pg.wait_for_selector('#f-amount'); pg.fill('#f-amount','500'); pg.click('.adjlink'); pg.wait_for_selector('#adjf'); pg.wait_for_timeout(400)
    r=pg.evaluate("(()=>{const e=document.querySelectorAll('.sheet'),s=e[e.length-1].getBoundingClientRect();return {top:s.top,bottom:innerHeight-s.bottom,left:s.left,right:innerWidth-s.right}})()")
    ok('tax / discount sheet floats in the middle %s'%r, r['top']>8 and r['bottom']>8 and abs(r['top']-r['bottom'])<60)
    bc=pg.evaluate("getComputedStyle(document.querySelector('#adjf input[type=checkbox]')).borderTopColor")
    import re
    v=[float(x)*(255 if 'srgb' in bc else 1) for x in re.findall(r'[\d.]+',bc.split('(')[1])[:3]]
    ok('unchecked box border is light %s'%bc, min(v)>150)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openEntry({})}"); pg.wait_for_selector('#f-amount'); pg.fill('#f-amount','500'); pg.click('[data-e=items-on]'); pg.wait_for_selector('#itembox'); pg.wait_for_timeout(300)
    r=pg.evaluate("(()=>{const s=document.querySelector('#itembox').getBoundingClientRect();return {top:s.top,bottom:innerHeight-s.bottom}})()")
    ok('large Items pop-up stays attached to the bottom %s'%r, r['bottom']<=1)
    ok('no errors %s'%errs, not errs)
print('%d/%d passed'%(sum(res),len(res)))
