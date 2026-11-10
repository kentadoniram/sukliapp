# v15.21: Bluecoins import: unmatched investment accounts become wallet "Other" (never guessed Spot), with an empty USDT line
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    G=pg.evaluate("""(async()=>{const m=await import('/js/importer.js');return ['Bybit Personal','Bybit Earn','Binance Margin','KuCoin Futures','Bitget Spot','OKX Funding','Bitget Wallet'].map(n=>m.guessWallet(n))})()""")
    ok('wallet read from the name, else Other %s'%G, G==['Other','Earn','Margin','Futures','Spot','Funding','Other'])
    R=pg.evaluate("""(async()=>{const c=await import('/js/core.js');const d=c.get();const cr=d.accounts.filter(a=>!a.deleted&&a.type==='crypto'&&a.baseName);
      return {n:cr.length,noWallet:cr.filter(a=>!a.wallet).map(a=>a.name),byw:Object.fromEntries(['Other','Spot','Earn'].map(w=>[w,cr.filter(a=>a.wallet===w).length])),
        bybit:cr.filter(a=>a.exchange==='Bybit').map(a=>a.name+'|'+a.wallet),
        usdtOther:d.accounts.filter(a=>!a.deleted&&a.cur==='USDT'&&a.wallet==='Other'&&a.exchange).map(a=>a.exchange),
        orphans:d.txs.filter(t=>!t.deleted&&!d.accounts.some(a=>a.id===t.acct)).length,txs:d.txs.length}})()""")
    ok('imported crypto accounts exist %s'%R, R['n']>5)
    ok('every imported crypto account has a wallet %s'%R['noWallet'], not R['noWallet'])
    ok('unmatched ones are Other, not Spot %s'%R['byw'], R['byw']['Other']>=3 and R['byw']['Spot']==0)
    ok('Bybit accounts keep their names and are Other %s'%R['bybit'], len(R['bybit'])>=1 and all(x.endswith('|Other') for x in R['bybit']))
    ok('each platform with an Other wallet has a USDT line %s'%R['usdtOther'], 'Bybit' in R['usdtOther'] and 'OKX' in R['usdtOther'])
    ok('all entries still belong to an account (%s txs)'%R['txs'], R['orphans']==0 and R['txs']>1000)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(600); pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
    ok('Other tab is shown on Investments', pg.locator('.wtab:has-text("Other")').count()>=1)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
