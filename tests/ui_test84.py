# v13.31: clearer account and investment wording, shared coins, live price id suggestion, buy/sell/convert labels
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced'})})()")
    # 1-2 account form wording
    pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccount(null,{})})()"); pg.wait_for_selector('#acct-form')
    t=pg.inner_text('#acct-form'); ok('bank: balance on the opening date explained', 'Balance on the Opening Date' in t and 'Starting today?' in t)
    pg.select_option('#acct-form select[name=type]','card'); pg.wait_for_timeout(200)
    t=pg.inner_text('#acct-form'); ok('card: amount you owe now, not limit or available credit', 'Amount You Owe Now' in t and 'not your credit limit' in t)
    pg.fill('#acct-form [name=name]','Owe Card'); pg.fill('#acct-form [name=open]','45000'); pg.evaluate("document.querySelector('#acct-form').requestSubmit()"); pg.wait_for_timeout(800)
    op=pg.evaluate("(async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.name==='Owe Card');return a&&a.open})()"); ok('owed 45000 kept as a negative balance (%s)'%op, op==-45000)
    # 3-6 add asset
    pg.evaluate("(async()=>{const m=await import('/js/invest.js');m.addAsset({platform:'Zed',wallet:'Spot'})})()"); pg.wait_for_selector('#ic')
    t=pg.inner_text('#ic'); ok('trading account wording and explanation', 'Trading Account Inside the Platform' in t and 'buy and sell coins directly' in pg.inner_text('#wal-h').lower())
    pg.select_option('#ic select[name=wallet]','Futures'); pg.wait_for_timeout(100); ok('Futures explains leverage and risk', 'higher risk' in pg.inner_text('#wal-h'))
    ok('tooltips on Ticker, Name, Price Currency, Live Price ID', pg.locator('#ic .tipbtn').count()>=4)
    pg.fill('#ic [name=coin]','usdc'); pg.wait_for_timeout(200); ok('USDC suggests usd-coin', pg.input_value('#ic [name=cg]')=='usd-coin' and 'usd-coin' in pg.inner_text('#cg-h'))
    pg.fill('#ic [name=coin]','btc'); pg.wait_for_timeout(200); ok('changing the ticker changes the suggestion', pg.input_value('#ic [name=cg]')=='bitcoin')
    pg.fill('#ic [name=cg]','my-own'); pg.fill('#ic [name=coin]','eth'); pg.wait_for_timeout(200); ok('a typed id is not overwritten', pg.input_value('#ic [name=cg]')=='my-own')
    pg.fill('#ic [name=cg]',''); pg.fill('#ic [name=coin]','usdt'); pg.select_option('#ic select[name=wallet]','Spot'); pg.evaluate("document.querySelector('#ic').requestSubmit()"); pg.wait_for_timeout(900)
    # same coin in another trading account of the same platform: offered in one tap, shares details
    pg.evaluate("(async()=>{const m=await import('/js/invest.js');m.addAsset({platform:'Zed',wallet:'Earn'})})()"); pg.wait_for_selector('#ic'); pg.wait_for_timeout(200)
    ok('coin already on the platform offered as a chip', pg.locator('#tkchips [data-tk=USDT]').count()==1)
    pg.evaluate("document.querySelector('#tkchips [data-tk=USDT]').click()"); pg.wait_for_timeout(200)
    ok('shared coin note, cg id filled', 'already set up' in pg.inner_text('#tk-note') and pg.input_value('#ic [name=cg]')=='tether')
    pg.evaluate("document.querySelector('#ic').requestSubmit()"); pg.wait_for_timeout(900)
    n=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().accounts.filter(a=>!a.deleted&&a.exchange==='Zed'&&a.cur==='USDT').map(a=>a.wallet)})()"); ok('one USDT balance per trading account %s'%n, sorted(n)==['Earn','Spot'])
    # 7-8 trade labels
    pg.evaluate("(async()=>{const m=await import('/js/trades.js');m.openTrade({side:'buy'})})()"); pg.wait_for_selector('#tr'); pg.wait_for_timeout(300)
    t=pg.inner_text('#tr'); ok('quantity and price show the coin and currency', 'Quantity (' in t and 'Price (' in t and 'Units' not in t and 'per unit' not in t)
    ok('pair is shown', '/' in pg.inner_text('#pair') and 'buying' in pg.inner_text('#pair'))
    pg.click('[data-side=convert]'); pg.wait_for_timeout(300)
    t=pg.inner_text('#tr'); ok('convert wording', 'Quantity (' in t and 'Value in' in t and 'Amount you' not in t and 'Worth in' not in t)
    order=pg.evaluate("[...document.querySelectorAll('#tr .field > span, #tr label > span')].filter(x=>x.offsetParent).map(x=>x.textContent.trim())")
    i=[k for k,x in enumerate(order) if x.startswith('Pay the Fee From')]; j=[k for k,x in enumerate(order) if x.startswith('Fee Amount')]; q=[k for k,x in enumerate(order) if x.startswith('Quantity')]
    ok('Pay the Fee From comes after the quantities and the fee %s'%order, i and j and q and i[0]>j[0] and i[0]>q[0])
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
