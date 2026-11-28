# v16.50: probability distribution in Investments > Prediction and Analytics
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n+('' if c else '  ['+str(x)[:200]+']'))
SEED="""async()=>{const c=await import('/js/core.js');const {stamp,commit}=c;
 commit((d)=>{d.accounts.push(stamp({id:'oc',name:'ZED',cur:'ZED',type:'crypto',open:10,include:true,archived:false,exchange:'Binance',wallet:'Spot'}));
  d.settings.rates=d.settings.rates||{}; d.settings.rates.ZED=100; d.settings.tickers=d.settings.tickers||{};
  let p=100, s=12345; const r=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296};
  const h=[]; for(let i=60;i>=1;i--){p*=Math.exp((r()-0.5)*0.08); const dt=new Date(Date.now()-i*864e5); h.push({date:dt.toISOString().slice(0,10),price:p,ts:1000});}
  d.settings.tickers.ZED=Object.assign(d.settings.tickers.ZED||{},{ticker:'ZED',quote:'USD',price:p,history:h});});}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate(SEED); pg.evaluate("localStorage.setItem('sukli-dpanels','[\"i-pred\"]')")
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(1500)
    t=pg.inner_text('body')
    ok('Possible Outcomes card shows', 'Possible Outcomes' in t)
    ok('has the four readings', all(k in t for k in ('Worst case','Typical','Expected (average)','Best case')))
    ok('has how-often lines', 'Ends lower than today' in t and 'in 100' in t)
    ok('histogram drawn', pg.locator('.oddsvg rect').count()>=10)
    w0=pg.inner_text('.oddswrap')
    pg.click('[data-act="odds-days"][data-v="90"], [data-a="odds-days"][data-v="90"]'); pg.wait_for_timeout(600)
    ok('3 months selected', pg.locator('.oddsctl .segi.on:has-text("3 Months")').count()==1)
    pg.click('.oddsctl .segi:has-text("Past trend")'); pg.wait_for_timeout(500)
    ok('past trend selected', pg.locator('.oddsctl .segi.on:has-text("Past trend")').count()==1)
    ok('no horizontal overflow', pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"))
    pg.locator('.oddswrap').scroll_into_view_if_needed(); pg.screenshot(path='/tmp/claude-0/odds50b.png'); pg.click('button:has-text("How this is worked out")'); pg.wait_for_timeout(400)
    ok('assumptions window opens', 'geometric Brownian motion' in pg.inner_text('body'))
    pg.screenshot(path='/tmp/claude-0/odds50.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # v16.51: price records minutes apart plus one wrong price must not produce absurd or exponent-notation numbers
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(d=>{const h=d.settings.tickers.ZED.history; const day=new Date(Date.now()-5*864e5).toISOString().slice(0,10);
      for(let i=0;i<12;i++) h.push({date:day,price:h[h.length-1].price*(i%2?1.02:0.98),ts:5000+i*60000}); h.push({date:day,price:h[0].price*1e6,ts:900000});});}""")
    pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(300); pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(1500)
    t=pg.inner_text('body'); import re
    ok('no exponent notation in the prediction card', not re.search(r'\de[+-]\d', t), re.findall(r'\S*e[+-]\d+\S*', t)[:2])
    big=pg.evaluate("()=>[...document.querySelectorAll('.calfacts li')].map(l=>l.innerText).filter(x=>/\\d{1,3}(,\\d{3}){4,}/.test(x))")
    ok('no figure with more than 12 digits', not big, big[:2])
    pg.evaluate("location.hash='#/analytics'"); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    t=pg.inner_text('body')
    ok('Analytics shows spending odds', 'Monthly spending' in t and ('Lowest month' in t or 'Needs at least' in t))
    ok('no page errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
