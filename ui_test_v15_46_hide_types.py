from tests.invnavhelp import go_invest
from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("""c.commit(d=>{d.settings.mode='advanced';d.settings.invOpen='last';
      const A=(id,name,cur,ex,w,amt)=>{d.accounts.push(c.stamp({id,name,type:'crypto',cur,exchange:ex,wallet:w,include:true,invtab:true}));d.txs.push(c.stamp({id:'t'+id,kind:'income',date:c.nowStamp(),acct:id,cur,fx:1,amount:amt,name:'dep',cat:'',items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,createdAt:Date.now()}))};
      A('b1','Binance BTC','BTC','Binance','Spot',1);A('b2','Binance USDT F','USDT','Binance','Futures',500);A('b3','Binance ETH M','ETH','Binance','Margin',2);A('y1','Bybit BTC','BTC','Bybit','Spot',0.5)})""")
    go_invest(pg,'Binance')
    tabs=lambda: pg.evaluate("(()=>{const b=document.querySelector('.wsw');return b?[...b.querySelectorAll('[data-w]')].map(x=>x.dataset.w):[]})()")
    ok('Margin and Futures tabs are there to start', 'Margin' in tabs() and 'Futures' in tabs())
    pg.evaluate("document.querySelector('[data-act=plat-open][data-ex=Binance]').click()"); pg.wait_for_selector('#pset'); pg.wait_for_timeout(300)
    ok('Edit Platform has a chip for each account type', all(pg.locator('#pset [data-p=showtype][data-v=%s]'%w).count()==1 for w in ['Spot','Margin','Futures','Options','Earn']))
    ok('all Selected by default', pg.evaluate("[...document.querySelectorAll('#pset [data-p=showtype]')].every(i=>i.getAttribute('aria-pressed')==='true'&&i.classList.contains('on'))"))
    pg.click('#pset [data-p=showtype][data-v=Margin]'); pg.wait_for_timeout(300)
    pg.click('#pset [data-p=showtype][data-v=Futures]'); pg.wait_for_timeout(300)
    ok('Not selected state kept in the sheet', pg.evaluate("document.querySelector('#pset [data-p=showtype][data-v=Margin]').classList.contains('off') && document.querySelector('#pset [data-p=showtype][data-v=Futures]').classList.contains('off') && document.querySelector('#pset [data-p=showtype][data-v=Spot]').classList.contains('on')"))
    pg.click('#pset [data-p=done]'); pg.wait_for_timeout(500)
    t=tabs(); print(t); ok('Margin and Futures are gone from the Binance tab bar', 'Margin' not in t and 'Futures' not in t)
    ok('their accounts are kept in the system', J("return c.get().accounts.filter(a=>!a.deleted&&['b2','b3'].includes(a.id)).length")==2 or pg.evaluate("(async()=>(await import('/js/core.js')).get().accounts.filter(a=>!a.deleted&&['b2','b3'].includes(a.id)).length)()")==2)
    go_invest(pg,'Bybit'); ok('Bybit is untouched', 'Spot' in pg.inner_text('#view'))
    go_invest(pg,'Binance',sec='overview'); ok('a link brings hidden accounts back (on Overview)', 'idden' in pg.inner_text('#view'))
    go_invest(pg,'Binance')
    # change at any time: tick again
    pg.evaluate("document.querySelector('[data-act=plat-open][data-ex=Binance]').click()"); pg.wait_for_selector('#pset'); pg.wait_for_timeout(300)
    ok('Margin still unticked when reopened', pg.evaluate("document.querySelector('#pset [data-p=showtype][data-v=Margin]').classList.contains('off')"))
    pg.click('#pset [data-p=showtype][data-v=Margin]'); pg.wait_for_timeout(300); pg.click('#pset [data-p=done]'); pg.wait_for_timeout(500)
    t=tabs(); ok('Margin back, Futures still hidden', 'Margin' in t and 'Futures' not in t)
    # recover from the hidden-accounts sheet
    go_invest(pg,'Binance',sec='overview'); pg.evaluate("document.querySelector('[data-act=inv-hidden]').click()"); pg.wait_for_selector('#hl'); pg.wait_for_timeout(300)
    ok('hidden types listed in the sheet', 'Binance · Futures' in pg.inner_text('#hl'))
    pg.click('#hl [data-hx=Binance][data-w=Futures]'); pg.wait_for_timeout(400); pg.click('#hl [data-done]'); pg.wait_for_timeout(500)
    go_invest(pg,'Binance'); ok('Futures shown again', 'Futures' in tabs())
    ok('no errors %s'%errs, not errs)
    b.close()
