from tests.invnavhelp import go_invest
# v15.48: platform icons, Buy/Sell/Convert tree laid out like the entry account list, custom logo per platform
import base64
from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
open('/tmp/logo.png','wb').write(PNG)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844}); pg.add_init_script("try{var c=JSON.parse(localStorage.getItem('sukli-coll')||'{}');if(c['i-crypto']===undefined){c['i-crypto']=false;localStorage.setItem('sukli-coll',JSON.stringify(c))}}catch(e){}"); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("""c.commit(d=>{d.settings.mode='advanced';
      const A=(id,name,cur,ex,w,amt,type)=>{d.accounts.push(c.stamp({id,name,type:type||'crypto',cur,exchange:ex,wallet:w,include:true,invtab:!!ex}));d.txs.push(c.stamp({id:'t'+id,kind:'income',date:c.nowStamp(),acct:id,cur,fx:1,amount:amt,name:'dep',cat:'',items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,cr:null}))};
      A('b1','Binance BTC','BTC','Binance','Spot',1);A('b2','Binance USDT','USDT','Binance','Spot',500);A('y1','Bybit BTC','BTC','Bybit','Spot',0.5);A('g1','Bitget USDT','USDT','Bitget','Spot',300);
      A('j1','SMBC Prestia','JPY','','',100000,'bank')})""")
    # distinct symbols
    sy=pg.evaluate("(async()=>{const m=await import('/js/platicons.js');const l=['Binance','Bybit','Bitget','OKX','KuCoin','Coinbase','Kraken','Bitfinex','Gate.io','MEXC','HTX','Crypto.com','Upbit','Bithumb','bitFlyer','Coincheck','bitbank','Gemini','Bitstamp','Moomoo','Tiger Brokers','Interactive Brokers','Webull'];return l.map(x=>{const s=m.platSymbol(x);return x+'|'+s.shape+'|'+s.color})})()")
    pairs=[(x.split('|')[1],x.split('|')[2]) for x in sy]
    ok('every known platform has its own shape and colour pair', len(set(pairs))==len(pairs))
    ok('an unknown platform keeps the same symbol', pg.evaluate("(async()=>{const m=await import('/js/platicons.js');return JSON.stringify(m.platSymbol('Zeta Securities'))===JSON.stringify(m.platSymbol('zeta securities'))})()"))
    go_invest(pg,'Bybit',sec='accounts'); pg.evaluate("async()=>{const m=await import('/js/invnav.js');m.INV.cat='crypto';window.dispatchEvent(new Event('sukli-render'))}"); pg.wait_for_timeout(600)
    ok('Investments platform cards carry an icon', pg.locator('.invplat .pbadge').count()>=3)
    bg=pg.evaluate("[...document.querySelectorAll('.exname .pbadge')].map(e=>e.style.background)")
    ok('icons differ per platform %s'%bg, len(set(bg))==len(bg))
    # tree
    pg.evaluate("(async()=>{const m=await import('/js/trades.js');m.openTrade({side:'buy'})})()"); pg.wait_for_selector('#tr'); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('#tr [name=asset]')._pk.open()"); pg.wait_for_selector('.pk-list'); pg.wait_for_timeout(200)
    ok('tree starts closed', pg.locator('.pk-opt').filter(visible=True).count()==0)
    pg.locator('.pk-gh.pkh0').first.click(); pg.wait_for_timeout(150)
    ok('platform headers in the tree have icons', pg.locator('.pk-gh.pkh1 .pbadge').count()>=2)
    pg.locator('.pk-gh.pkh1').first.click(); pg.wait_for_timeout(150); pg.locator('.pk-gh.pkh2').first.click(); pg.wait_for_timeout(200)
    ok('asset rows look like the entry account rows (badge, name, balance)', pg.locator('.pk-opt.row.cur .badge').count()>=1 and pg.locator('.pk-opt.row.cur .ramt small').first.inner_text()=='balance')
    pg.locator('.pk-opt').filter(visible=True).first.click(); pg.wait_for_timeout(300)
    ok('picking a row fills the field', 'BTC' in pg.evaluate("document.querySelector('#tr [name=asset]').value && document.querySelector('#tr [name=asset]').selectedOptions[0].textContent"))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # entry account picker shows the platform icon on its heading
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({})})()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(400)
    pg.click('[data-e=acctpick]'); pg.wait_for_selector('#aclist'); pg.click('[data-chip=""]'); pg.wait_for_timeout(300)
    ok('entry account list headings for platforms have icons', pg.locator('#aclist h3 .pbadge').count()>=1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # own logo
    pg.evaluate("(async()=>{const m=await import('/js/platform.js');m.openPlatform('Bybit')})()"); pg.wait_for_selector('#pset'); pg.wait_for_timeout(300)
    pg.set_input_files('#pset [data-p=logo]','/tmp/logo.png'); pg.wait_for_timeout(800)
    ok('uploaded logo is kept for the platform', pg.evaluate("!!(window.sukli.get().settings.platformIcons||{}).Bybit") and pg.locator('#pset .platicon img').count()==1)
    pg.click('#pset [data-p=logo-reset]'); pg.wait_for_timeout(300)
    ok('Use symbol goes back to the Sukli symbol', pg.evaluate("!((window.sukli.get().settings.platformIcons||{}).Bybit)") and pg.locator('#pset .platicon svg').count()==1)
    ok('no errors %s'%errs, not errs)
