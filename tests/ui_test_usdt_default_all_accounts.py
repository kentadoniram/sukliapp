# v15.27: every trading account type of a crypto exchange (Spot, Margin, Futures, Options, Other) has a USDT line, so it can be picked before any other asset is added
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    R=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),t=await import('/js/tokens.js');
      c.commit(d=>{d.accounts=d.accounts.filter(a=>!a.exchange);
        const A=(id,name,ex,wallet,cur)=>d.accounts.push(c.stamp({id,name,cur,type:'crypto',assetType:'crypto',exchange:ex,wallet,open:0,include:false,archived:false,invtab:true}));
        A('q1','Binance BTC','Binance','Spot','BTC');            // Binance offers Spot, Margin, Futures, Options, Earn, Funding, ETF
        A('q2','Zed Oth','ZedEx','Other','BTC');                  // an exchange we do not know, only an Other account
        A('q3','Zed Earn','ZedEx','Earn','ETH');});
      t.ensureUsdt();
      const d=c.get();const has=(ex,w)=>d.accounts.some(a=>!a.deleted&&a.cur==='USDT'&&a.exchange===ex&&c.walletOf(a)===w);
      return {bn:['Spot','Margin','Futures','Options'].map(w=>has('Binance',w)),bnEarn:has('Binance','Earn'),zOther:has('ZedEx','Other'),zSpot:has('ZedEx','Spot'),zEarn:has('ZedEx','Earn'),n:d.accounts.filter(a=>a.cur==='USDT').length}})()""")
    ok('Binance: USDT in Spot, Margin, Futures and Options %s'%R, R['bn']==[True]*4)
    ok('Earn gets no USDT line (passive)', R['bnEarn'] is False and R['zEarn'] is False)
    ok('unknown exchange: Other and Spot both have USDT', R['zOther'] and R['zSpot'])
    R2=pg.evaluate("(async()=>{const t=await import('/js/tokens.js');return t.ensureUsdt()})()")
    ok('running it again makes nothing new', R2==0)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{const a=d.accounts.find(x=>x.exchange==='Binance'&&x.cur==='USDT'&&c.walletOf(x)==='Margin');a.deleted=true})})()")
    pg.evaluate("(async()=>{(await import('/js/tokens.js')).ensureUsdt()})()")
    ok('a USDT line you deleted yourself is not brought back', pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().accounts.some(a=>!a.deleted&&a.exchange==='Binance'&&a.cur==='USDT'&&c.walletOf(a)==='Margin')})()") is False)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(500)
    pg.evaluate("(async()=>{const m=await import('/js/internal.js');m.openInternal({platform:'ZedEx'})})()"); pg.wait_for_selector('.sheet [name=from]',timeout=4000); pg.wait_for_timeout(300)
    pg.select_option('.sheet [name=from]','Other'); pg.wait_for_timeout(300)
    txt=pg.inner_text('.sheet')
    ok('Internal Transfer: Other is not "(empty)" and USDT can be picked there', '(empty)' not in pg.evaluate("[...document.querySelectorAll('.sheet [name=from] option')].find(o=>o.value==='Other').textContent") and 'USDT' in pg.inner_text('.sheet [name=cur]'))
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
