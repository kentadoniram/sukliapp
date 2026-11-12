# v15.16: per-token performance: one line per token across platforms, cost, paper profit, sold profit, earned, fees, total return
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');const H=c.HOME;c.commit(d=>{
      d.txs=[];d.settings.tickers={ZZA:{ticker:'ZZA',name:'',assetType:'crypto',quote:H,price:150000,live:false},ZZB:{ticker:'ZZB',name:'',assetType:'crypto',quote:H,price:10,live:false}};
      const A=(id,cur,ex,t)=>d.accounts.push(c.stamp({id,name:ex+' '+cur,wallet:'Spot',cur,type:'crypto',assetType:'crypto',exchange:ex,open:0,include:false,archived:false,invtab:true}));
      d.accounts.push(c.stamp({id:'cj',name:'Cash JP',cur:H,type:'cash',open:1000000,include:true,archived:false}));
      A('z1','ZZA','Bitget');A('z2','ZZA','Binance');A('z3','ZZB','Bitget');d.accounts.find(a=>a.id==='z3').open=2;
      const D=(n)=>'2026-0'+n+'-10 12:00:00';
      const buy=(id,acct,q,v,fee,date)=>d.txs.push(c.stamp({id,kind:'transfer',date,acct:'cj',toAcct:acct,cur:H,amount:v,fx:1,toAmount:q,name:'Buy',fee:fee||0,feeCur:H,feeBy:'from',trade:{side:'buy',asset:acct,qty:q,valueHome:v,feeHome:fee||0}}));
      buy('b1','z1',1,100000,500,D(1));buy('b2','z2',1,140000,0,D(2));
      d.txs.push(c.stamp({id:'s1',kind:'transfer',date:D(3),acct:'z1',toAcct:'cj',cur:'ZZA',amount:0.5,fx:150000,toAmount:80000,name:'Sell',trade:{side:'sell',asset:'z1',qty:0.5,valueHome:80000,feeHome:0}}));
      d.txs.push(c.stamp({id:'e1',kind:'income',date:D(4),acct:'z1',cur:'ZZA',amount:0.01,fx:150000,hfx:150000,name:'Interest Earned',earnDay:D(4).slice(0,10),earnAcct:'z1'}));
    });})()""")
    R=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),t=await import('/js/tokenperf.js'),b=await import('/js/tradecalc.js'),i=await import('/js/invest.js');const d=c.get();
      const r=t.tokenPerformance(d,b.tradeBook(d.txs),d.accounts.filter(a=>i.inInvest(a)&&(a.assetType||a.type==='crypto')),c.HOME);return r.map(x=>({cur:x.cur,value:x.value,cost:x.cost,unreal:x.unreal,realized:x.realized,earned:x.earned,fees:x.fees,gain:x.gain,pct:x.pct,pl:x.platforms}))})()""")
    A=[x for x in R if x['cur']=='ZZA'][0]; B=[x for x in R if x['cur']=='ZZB'][0]
    ok('two platforms add up into one token %s'%A, A['pl']==['Binance','Bitget'] and abs(A['value']-226500)<1 and abs(A['cost']-190000)<1)
    ok('paper profit 35000, sold profit 30000', abs(A['unreal']-35000)<1 and abs(A['realized']-30000)<1)
    ok('earned counted (0.01 x 150000 = 1500), fee 500', abs(A['earned']-1500)<1 and abs(A['fees']-500)<1)
    ok('total return and percent of what was put in (240000)', abs(A['gain']-66500)<1 and abs(A['pct']-66500/240000*100)<1e-6)
    ok('token with no known cost shows no percent and no made-up profit %s'%B, abs(B['value']-20)<1e-6 and B['pct'] is None and B['gain']==0)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(600)
    if pg.locator('[data-act=tok-open]').count()==0 and pg.locator('.dashcard .segi:has-text("Per-Token Performance")').count():
        pg.click('.dashcard .segi:has-text("Per-Token Performance")'); pg.wait_for_timeout(400)
    if pg.locator('[data-act=tok-open]').count()==0:
        pg.evaluate("[...document.querySelectorAll('summary,.collh,[data-coll]')].find(e=>/Per-Token/.test(e.textContent))?.click()"); pg.wait_for_timeout(300)
    ok('Per-Token Performance card lists both tokens', pg.locator('[data-act=tok-open]').count()>=2 and 'ZZA' in pg.inner_text('body'))
    cut=pg.evaluate("[...document.querySelectorAll('.tokrow small')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)")
    ok('v15.27: Per-Token rows say "Value now ..." and "On ..." in full, nothing cut off %s'%cut, not cut and 'Value now' in pg.inner_text('.tokrows') and 'On Binance, Bitget' in pg.inner_text('.tokrows'))
    lx=pg.evaluate("(()=>{const r=document.querySelector('.tokrow .rmain').getBoundingClientRect(),w=document.querySelector('.tokrow').getBoundingClientRect();return [r.width,w.width]})()")
    ok('v15.27: name column is wide, not squeezed into an icon slot %s'%lx, lx[0]>lx[1]*0.4)
    pg.evaluate("document.querySelector('[data-act=tok-open][data-cur=ZZA]').click()"); pg.wait_for_selector('.calfacts',timeout=3000); pg.wait_for_timeout(200)
    t=pg.evaluate("[...document.querySelectorAll('.sheet, .scrim')].map(e=>e.innerText).join(' ')")
    ok('detail shows the breakdown', 'Total return' in t and 'Trading fees paid' in t and 'Profit from selling' in t and 'Earned' in t)
    ok('no errors %s'%[e for e in errs if 'Tunnel' not in e], not [e for e in errs if 'Tunnel' not in e])
print('fails',res.count(False))
