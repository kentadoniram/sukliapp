from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("""c.commit(d=>{d.settings.mode='advanced';d.settings.invOpen='spot';d.settings.invCur='USD';d.settings.rates={USD:56,BTC:5600000,USDT:56,SHIB:0.0014};
      const A=(id,name,cur,ex,w,amt)=>{d.accounts.push(c.stamp({id,name,type:'crypto',cur,exchange:ex,wallet:w,include:true,invtab:true}));d.txs.push(c.stamp({id:'t'+id,kind:'income',date:c.nowStamp(),acct:id,cur,fx:1,amount:amt,name:'dep',cat:'',items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,createdAt:Date.now()}))};
      A('b1','Binance BTC','BTC','Binance','Spot',0.005);A('b2','Binance USDT','USDT','Binance','Spot',123456.789);A('b3','Binance BTC Earn','BTC','Binance','Earn',2);A('b4','Binance SHIB','SHIB','Binance','Spot',987654321.12345);d.txs.find(t=>t.id==='tb1').trade={side:'buy',asset:'b1',qty:0.005,valueHome:30000,feeHome:0}})""")
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(1200); pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)"); pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/h2.png',full_page=True)
    r=pg.evaluate("""[...document.querySelectorAll('.hold2')].map(h=>{const g=s=>h.querySelector(s).getBoundingClientRect(),c=h.closest('.wblock').getBoundingClientRect();
      return {name:h.querySelector('.hl1').innerText,qty:h.querySelector('.hr1').innerText,pnl:h.querySelector('.hl2').innerText,val:h.querySelector('.hr2').innerText.replace(/\\n/g,' '),
      row1:Math.abs(g('.hl1').top-g('.hr1').top)<14,row2:Math.abs(g('.hl2').top-g('.hr2').top)<14,order:g('.hl2').top>g('.hl1').top,
      inside:g('.hr1').right<=c.right+1&&g('.hr2').right<=c.right+1,leftAlign:g('.hl1').left<g('.hr1').left&&g('.hl2').left<g('.hr2').left}})""")
    for x in r: print(x)
    btc=[x for x in r if x['name']=='BTC'][0]
    ok('profit or loss row shows a loss in dollars with percent: '+btc['pnl'], btc['pnl'].startswith('−$') and '%' in btc['pnl'] and '6.67' in btc['pnl'])
    ok('3 holdings', len(r)==3)
    ok('row 1 = name left, quantity right on one line', all(x['row1'] and x['leftAlign'] for x in r))
    ok('row 2 = P&L left, value right on one line, below row 1', all(x['row2'] and x['order'] for x in r))
    ok('everything inside the card', all(x['inside'] for x in r))
    ok('quantity shown with the coin', any('0.005 BTC' in x['qty'] for x in r))
    ok('value in the investment currency then the home value in brackets', all(('$' in x['val'] or 'USD' in x['val']) and '(' in x['val'] for x in r))
    ok('page does not scroll sideways', pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"))
    ok('no errors %s'%errs, not errs)
    b.close()
