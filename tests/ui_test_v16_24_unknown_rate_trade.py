# v16.24: a trade whose money has no known rate: warn, suggest a rate, or record it as an asset move (not a trade)
import sys
from playwright.sync_api import sync_playwright
import pkhelp; pkhelp.patch()
from pkhelp import choose
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n+('' if c else '  ['+str(x)[:200]+']'))
SEED="""async()=>{const c=await import('/js/core.js');const {uid,stamp,commit}=c;
 commit((d)=>{d.accounts.push(stamp({id:'qcash',name:'Qcash',cur:'QQQ',type:'cash',open:100000,include:true,archived:false}));
  d.accounts.push(stamp({id:'qcoin',name:'ZED',cur:'ZED',type:'crypto',open:0,include:true,archived:false,exchange:'Binance',wallet:'Spot'}));
  d.settings.rates=d.settings.rates||{}; d.settings.rates.ZED=500; delete d.settings.rates.QQQ;});}"""
def go(pg,total):
    pg.evaluate("async()=>{const m=await import('/js/trades.js');m.openTrade({asset:'qcoin',platform:'Binance'})}"); pg.wait_for_selector('#tr'); pg.wait_for_timeout(400)
    choose(pg,'#tr [name=cash]',text='Qcash')
    pg.fill('#tr [name=qty]','10'); pg.fill('#tr [name=total]',str(total)); pg.dispatch_event('#tr [name=total]','input')
    pg.click('#tr [type=submit]'); pg.wait_for_timeout(600)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate(SEED); pg.wait_for_timeout(300)
    # 1 suggestion path: 10 ZED worth 5000 home, paid 20000 QQQ -> 0.25
    go(pg,20000); txt=pg.inner_text('.confirm-text') if pg.locator('.confirm-text').count() else ''
    ok('warns that there is no rate and suggests one', 'no exchange rate for QQQ' in txt and '0.25' in txt, txt)
    pg.click('[data-yes]'); pg.wait_for_timeout(700)
    t=pg.evaluate("async()=>{const d=(await import('/js/core.js')).get();const x=d.txs.filter(t=>!t.deleted&&/ZED/.test(t.name)).pop();return x&&{name:x.name,trade:!!x.trade,hv:x.trade&&x.trade.valueHome,fx:x.fx}}")
    ok('using the suggestion records a trade worth 5,000 at that rate', t and t['trade'] and abs(t['hv']-5000)<1 and abs(t['fx']-0.25)<1e-6, t)
    ok('the suggestion was not saved as a global rate', not pg.evaluate("async()=>!!(await import('/js/core.js')).get().settings.rates.QQQ"))
    # 2 decline suggestion, accept asset (the first trade made QQQ's rate known from its own entry, so drop it first)
    pg.evaluate("async()=>{const c=await import('/js/core.js');c.commit(d=>{d.txs=d.txs.filter(t=>!/ZED/.test(t.name))})}")
    go(pg,20000); pg.click('[data-no]'); pg.wait_for_timeout(500)
    txt=pg.inner_text('.confirm-text') if pg.locator('.confirm-text').count() else ''
    ok('then offers to record it as an asset, not a trade', 'cannot be a trade' in txt and 'no profit or loss' in txt, txt)
    pg.click('[data-yes]'); pg.wait_for_timeout(700)
    t=pg.evaluate("async()=>{const d=(await import('/js/core.js')).get();const l=d.txs.filter(t=>!t.deleted&&/ZED/.test(t.name));const x=l[l.length-1];return {n:l.length,name:x.name,trade:!!x.trade,kind:x.kind,to:x.toAcct}}")
    ok('recorded as a transfer of the asset (no trade data)', t['n']==1 and not t['trade'] and t['kind']=='transfer' and t['name'].startswith('Add 10 ZED') and t['to']=='qcoin', t)
    # 3 cancel
    go(pg,20000); pg.click('[data-no]'); pg.wait_for_timeout(400); pg.click('[data-no]'); pg.wait_for_timeout(500)
    n=pg.evaluate("async()=>(await import('/js/core.js')).get().txs.filter(t=>!t.deleted&&/ZED/.test(t.name)).length")
    ok('cancelling records nothing', n==1, n)
    # 4 a known rate trades as before, no warning
    pg.evaluate("async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.rates.QQQ=0.25})}")
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    go(pg,20000); w=pg.locator('.confirm-text').count()
    ok('with a known rate there is no warning', w==0, w)
    ok('no errors', not errs, errs[:2]); b.close()
print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
