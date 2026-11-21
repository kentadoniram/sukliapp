from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for W in (320,360,430):
        pg=b.new_page(viewport={'width':W,'height':800})
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
        pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
        J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
        J("""c.commit(d=>{d.settings.mode='advanced';d.settings.invCur='USD';d.settings.rates={USD:56,BTC:5600000,USDT:56,SHIB:0.0014,PEPE:0.0000004};
          const A=(id,name,cur,ex,w,amt,cost)=>{d.accounts.push(c.stamp({id,name,type:'crypto',cur,exchange:ex,wallet:w,include:true,invtab:true}));d.txs.push(c.stamp({id:'t'+id,kind:'income',date:c.nowStamp(),acct:id,cur,fx:1,amount:amt,name:'dep',cat:'',items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,createdAt:Date.now()}));d.txs.find(t=>t.id==='t'+id).trade={side:'buy',asset:id,qty:amt,valueHome:cost,feeHome:0}};
          A('b1','Binance BTC','BTC','Binance','Spot',0.00512345,31000);A('b4','Binance SHIB','SHIB','Binance','Spot',987654321.12345,1200000);A('p1','Bybit PEPE','PEPE','Bybit Global Exchange','Spot',123456789012.123,60000)})""")
        pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(1200); pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)"); pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('[data-act=inv-dsw][data-v=i-tok]').click()"); pg.wait_for_timeout(600)
        r=pg.evaluate("""[...document.querySelectorAll('.tokrow')].map(h=>{const c=h.getBoundingClientRect();return [...h.querySelectorAll('.rmain,.ramt,.rmain small,.ramt b,.ramt small')].map(e=>{const r=e.getBoundingClientRect();return (r.right>c.right+1||r.left<c.left-1)?e.className+':'+Math.round(r.right-c.right):''}).filter(Boolean)})""")
        _x=(pg.evaluate("[...document.querySelectorAll('#view *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&e.offsetParent).slice(0,6).map(e=>e.tagName+'.'+e.className+':'+Math.round(e.getBoundingClientRect().right))"))
        ok(f'{W}px: 3 rows, every value inside its row', len(r)==3 and all(not x for x in r)); ok(f'{W}px: page does not scroll sideways', pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        pg.close()
    b.close()
