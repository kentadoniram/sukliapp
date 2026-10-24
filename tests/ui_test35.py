# v12z: Platform > wallet > asset; the transfer "To" list never loses an account
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(700)
    pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{const A=(id,name,cur,wallet,open)=>d.accounts.push(m.stamp({id,name,cur,type:'crypto',open,include:false,archived:false,exchange:'KuCoin',wallet,invtab:true}));A('k1','USDT','USDT','Spot',500);A('k2','USDT','USDT','Earn',200);A('k3','KuCoin BTC','BTC','Spot',0.01);A('k4','SOL','SOL','Futures',3);d.settings.tickers=d.settings.tickers||{};d.settings.tickers.USDT={ticker:'USDT',assetType:'crypto',quote:'USD',price:56};})})()""")
    # Investments tab shows wallets under the platform
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(700)
    pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
    h=pg.evaluate("[...document.querySelectorAll('.wlt')].map(e=>e.textContent.trim().split(' ')[0])")
    ok('platform card lists wallets (Spot, Futures, Earn)', {'Spot','Futures','Earn'}<=set(h))
    # transfer from KuCoin: From = USDT spot, To list still shows the other USDT and every wallet
    pg.evaluate("""(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',acct:'k1'}})})()""")
    pg.wait_for_selector('[data-which=to]'); pg.click('[data-which=to]'); pg.wait_for_selector('#aclist .row')
    names=pg.evaluate("[...document.querySelectorAll('#aclist .row')].map(r=>[r.dataset.id,r.disabled])")
    ids=[i for i,_ in names]
    ok('the other USDT (Earn) is offered as a destination', 'k2' in ids and dict(names)['k2'] is False)
    ok('the From account stays visible but greyed (never "missing")', 'k1' in ids and dict(names)['k1'] is True)
    heads=pg.evaluate("[...document.querySelectorAll('#aclist h3')].map(h=>h.textContent)")
    ok('picker is grouped Platform · wallet', 'KuCoin · Earn' in heads and 'KuCoin · Spot' in heads and 'KuCoin · Futures' in heads)
    pg.fill('#acq','kucoin earn'); pg.wait_for_timeout(300)
    ok('search "kucoin earn" finds the Earn USDT even though it is named USDT', pg.locator('#aclist .row:not([disabled])').count()==1)
    pg.click('#aclist .row:not([disabled])'); pg.wait_for_timeout(300)
    ok('To button says where it is', 'KuCoin' in pg.inner_text('[data-which=to]') and 'Earn' in pg.inner_text('[data-which=to]'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # account form: wallet field
    pg.evaluate("""(async()=>{const u=await import('/js/ui.js');u.ACT.acct({dataset:{id:'k2'}})})()""")
    pg.wait_for_selector('[data-ad=edit]'); pg.click('[data-ad=edit]'); pg.wait_for_selector('#acct-form')
    ok('edit form has a Wallet field showing Earn', pg.locator('#walletf').is_visible() and pg.evaluate("document.querySelector('#acct-form [name=wallet]').value")=='Earn')
    pg.evaluate("(()=>{const s=document.querySelector('#acct-form [name=wallet]');s.value='Funding';s.dispatchEvent(new Event('change',{bubbles:true}))})()")
    pg.click('#acct-form .btn:not(.ghost):not(.danger)'); pg.wait_for_timeout(500)
    a=pg.evaluate("window.sukli.get().accounts.find(x=>x.id==='k2')")
    ok('wallet saved, name and balance untouched', a['wallet']=='Funding' and a['name']=='USDT' and a['open']==200)
    # add asset: same coin in another wallet is allowed, same wallet is not
    pg.evaluate("""(async()=>{const m=await import('/js/invest.js');m.addAsset({platform:'KuCoin',wallet:'Margin'})})()""")
    pg.wait_for_selector('#ic'); pg.fill('#ic [name=coin]','USDT'); pg.click('#ic .btn:not(.ghost)'); pg.wait_for_timeout(500)
    n=pg.evaluate("window.sukli.get().accounts.filter(x=>!x.deleted&&x.exchange==='KuCoin'&&x.cur==='USDT').map(x=>x.wallet).sort()")
    ok('a third USDT in Margin was created', n==['Funding','Margin','Spot'])
    pg.evaluate("""(async()=>{const m=await import('/js/invest.js');m.addAsset({platform:'KuCoin',wallet:'Margin'})})()""")
    pg.wait_for_selector('#ic'); pg.fill('#ic [name=coin]','USDT'); pg.click('#ic .btn:not(.ghost)'); pg.wait_for_timeout(400)
    ok('same coin twice in one wallet is refused', pg.evaluate("window.sukli.get().accounts.filter(x=>!x.deleted&&x.exchange==='KuCoin'&&x.cur==='USDT').length")==3)
    ok('no page errors', not errs); print(errs[:2])
    b.close()
print('SUMMARY', sum(res), '/', len(res)); raise SystemExit(0 if all(res) else 1)
