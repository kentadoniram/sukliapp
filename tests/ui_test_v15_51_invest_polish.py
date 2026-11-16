# v15.51: investments polish (row hierarchy, spacing, decimals, chevrons, small buttons, style guide px)
from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); ctx.add_init_script("try{localStorage.setItem('sukli-coll',JSON.stringify({'i-crypto':false}))}catch(e){}"); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome'); pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("""c.commit(d=>{d.settings.mode='advanced';d.settings.invOpen='last';
      const A=(id,name,cur,ex,w,amt)=>{d.accounts.push(c.stamp({id,name,type:'crypto',cur,exchange:ex,wallet:w,include:true,invtab:true}));d.txs.push(c.stamp({id:'t'+id,kind:'income',date:c.nowStamp(),acct:id,cur,fx:1,amount:amt,name:'dep',cat:'',items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,cr:null}))};
      A('b1','Binance BTC','BTC','Binance','Spot',0.12345678);A('b3','Binance XRP','XRP','Binance','Spot',1234.56789);A('b2','Binance USDT','USDT','Binance','Spot',300);
      d.settings.rates=Object.assign({},d.settings.rates,{BTC:9500000,XRP:30,USDT:56,USD:56})})""")
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(1500)
    t=pg.evaluate("[...document.querySelectorAll('.hold2')].map(e=>e.innerText).join(' ')")
    ok('BTC keeps 8 decimals, XRP 2, USDT 2: %s'%t[:160].replace('\n',' '), '0.12345678 BTC' in t and '1,234.57 XRP' in t and '300.00 USDT' in t)
    st=pg.evaluate("""(()=>{const r=document.querySelector('.hold2'),g=s=>getComputedStyle(r.querySelector(s));return {l1:+g('.hl1').fontSize.slice(0,-2),l2:+g('.hl2').fontSize.slice(0,-2),w2:+g('.hl2').fontWeight,wr2:+g('.hr2').fontWeight,bd:getComputedStyle(r).borderBottomWidth}})()""")
    ok('row 2 smaller and not bold %s'%st, st['l2']<st['l1'] and st['w2']<=400 and st['wr2']<=400)
    ok('no separator line', st['bd'] in ('0px',))
    gap=pg.evaluate("(()=>{const a=[...document.querySelectorAll('.hold2')];return a[1].getBoundingClientRect().top-a[0].getBoundingClientRect().bottom})()")
    ok('gap between assets >= 12px (%s)'%gap, gap>=12)
    bh=pg.evaluate("Math.max(...[...document.querySelectorAll('.invact .btn')].map(e=>e.getBoundingClientRect().height))")
    ok('top buttons small (%s px)'%bh, 0<bh<=32)
    xs=pg.evaluate("[...document.querySelectorAll('.collhead .chev')].filter(e=>e.getBoundingClientRect().width).map(e=>{const h=(e.closest('.collrow')||e.closest('.collhead')).getBoundingClientRect();return Math.round(h.right-e.getBoundingClientRect().right)})")
    ok('chevrons at same far-right offset %s'%xs, len(xs)>0 and len(set(xs))==1 and xs[0]<=16)
    pg.goto('http://localhost:8123/#/styleguide'); pg.wait_for_timeout(1200)
    n=pg.locator('.sgpx').count(); tx=pg.evaluate("document.body.textContent")
    ok('style guide has measured px tables (%d)'%n, n>=3 and 'px high' in tx and 'padding' in tx)
    ok('no page errors %s'%errs, not errs)
