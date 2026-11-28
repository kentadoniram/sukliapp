# v16.50: swap button in Buy/Sell/Convert (Theme 1 and legacy)
import sys
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n+('' if c else '  ['+str(x)[:200]+']'))
SEED="""async()=>{const c=await import('/js/core.js');const {stamp,commit}=c;
 commit((d)=>{for(const [id,cur] of [['wA','AAA'],['wB','BBB']]) d.accounts.push(stamp({id,name:cur,cur,type:'crypto',open:100,include:true,archived:false,exchange:'Binance',wallet:'Spot'}));
  d.accounts.push(stamp({id:'wc',name:'Wcash',cur:'JPY',type:'cash',open:100000,include:true,archived:false}));
  d.settings.rates=d.settings.rates||{}; d.settings.rates.AAA=10; d.settings.rates.BBB=20;});}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate(SEED); pg.wait_for_timeout(300)
    for theme in ('t1','legacy'):
        pg.evaluate("t=>{try{const l=JSON.parse(localStorage.getItem('sukli-look')||'{}');l.design=t==='t1'?'theme1':'legacy';localStorage.setItem('sukli-look',JSON.stringify(l))}catch(e){}}",theme)
        pg.reload(); pg.wait_for_timeout(1500)
        pg.evaluate("async()=>{const m=await import('/js/trades.js');m.openTrade({asset:'wA',platform:'Binance',side:'convert'})}"); pg.wait_for_selector('#tr'); pg.wait_for_timeout(500)
        sw=pg.locator('#tr .tr-swap:visible')
        ok(theme+': a swap button is shown', sw.count()>=1)
        pg.evaluate("document.querySelector('#tr [name=asset2]').value='wB'; document.querySelector('#tr [name=asset2]').dispatchEvent(new Event('change',{bubbles:true}))"); a0=pg.evaluate("document.querySelector('#tr [name=asset]').value"); b0=pg.evaluate("document.querySelector('#tr [name=asset2]').value")
        sw.first.click(); pg.wait_for_timeout(300)
        a1=pg.evaluate("document.querySelector('#tr [name=asset]').value"); b1=pg.evaluate("document.querySelector('#tr [name=asset2]').value")
        ok(theme+': convert swaps From and Into', a1==b0 and b1==a0 and a0!=b0, (a0,b0,a1,b1))
        sw.first.click(); pg.wait_for_timeout(300)
        ok(theme+': swapping twice restores them', pg.evaluate("document.querySelector('#tr [name=asset]').value")==a0)
        pg.evaluate("document.querySelector('#tr [data-side=buy]').click()"); pg.wait_for_timeout(300)
        sw.first.click(); pg.wait_for_timeout(300)
        ok(theme+': Buy becomes Sell', pg.evaluate("document.querySelector('#tr').dataset.side")=='sell' or pg.evaluate("document.querySelector('#tr [data-side=sell]').classList.contains('on')"))
        pg.evaluate("document.querySelector('#tr [data-x]')?.click()"); pg.wait_for_timeout(300)
    ok('no page errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
