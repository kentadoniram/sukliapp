from tests.invnavhelp import go_invest
# v15.53: smaller account-type tabs, flatter wider crypto card, currency chips in the asset tree
from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); ctx.add_init_script("try{localStorage.setItem('sukli-coll',JSON.stringify({'i-crypto':false}))}catch(e){}"); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome'); pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("""c.commit(d=>{d.settings.mode='advanced';d.settings.invOpen='last';
      const A=(id,name,cur,ex,w,amt)=>{d.accounts.push(c.stamp({id,name,type:'crypto',cur,exchange:ex,wallet:w,include:true,invtab:true}));d.txs.push(c.stamp({id:'t'+id,kind:'income',date:c.nowStamp(),acct:id,cur,fx:1,amount:amt,name:'dep',cat:'',items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,cr:null}))};
      A('b1','Binance BTC','BTC','Binance','Spot',0.12);A('b2','Binance USDT','USDT','Binance','Spot',500);A('y1','Bybit BTC','BTC','Bybit','Spot',0.5);
      d.settings.rates=Object.assign({},d.settings.rates,{BTC:9500000,USDT:56,USD:56})})""")
    go_invest(pg,'Binance')
    h=pg.evaluate("Math.max(...[...document.querySelectorAll('.segm.wsw .segi')].map(e=>e.getBoundingClientRect().height))")
    ok('account-type tabs are small (%s px)'%h, 0<h<=30)
    # v16.6: the one big crypto collapsible was replaced by the Accounts category cards (see ui_test_v16_6_invest_sections)
    pg.evaluate("import('/js/trades.js').then(m=>m.openTrade({}))"); pg.wait_for_timeout(800)
    pg.evaluate("document.querySelectorAll('.pkbtn')[1].click()"); pg.wait_for_timeout(500)
    ok('asset tree has the same currency chips as the account list', pg.locator('.acchips [data-chip]').count()>=3 and 'Search account, type or currency' in pg.evaluate("document.querySelector('.pk-q').placeholder"))
    n0=pg.locator('.pk-gh').count()
    pg.evaluate("document.querySelector('[data-chip=USDT]').click()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelectorAll('.pk-gh').forEach(h=>h.click())"); pg.wait_for_timeout(300)
    t=pg.evaluate("[...document.querySelectorAll('.pk-opt')].map(e=>e.innerText).join(' ')")
    ok('chip USDT hides BTC rows', n0>0 and 'USDT' in t and 'BTC' not in t.replace('BTC/USDT',''))
    ok('no page errors %s'%errs, not errs)
