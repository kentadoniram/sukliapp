# v12y: rename a platform from the Accounts page, rename a ticker's display name
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(700)
    pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{d.accounts.push(m.stamp({id:'rx1',name:'Maya Wallet',cur:m.HOME,type:'ewallet',open:0,include:true,archived:false,exchange:'Maya'}),m.stamp({id:'rx2',name:'Maya Savings',cur:m.HOME,type:'bank',open:0,include:true,archived:false,exchange:'maya'}),m.stamp({id:'rx3',name:'Zed NVDA',cur:'NVDA',type:'invest',assetType:'stock',open:2,include:false,archived:false,exchange:'Zed',invtab:true}));d.settings.tickers=d.settings.tickers||{};d.settings.tickers.NVDA={ticker:'NVDA',name:'Nvidia',assetType:'stock',quote:'USD',price:120}})})()""")
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(600)
    pg.select_option('[data-aview=group]','exchange'); pg.wait_for_timeout(400)
    btn=pg.locator('[data-act=inv-rename][data-ex=Maya]')
    ok('exchange groups on Accounts have Rename', btn.count()==1)
    ok('no Rename on "No exchange"', pg.locator('[data-act=inv-rename][data-ex="No exchange"]').count()==0)
    btn.click(); pg.wait_for_selector('.sheet input'); pg.fill('.sheet input','Maya Bank'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    r=pg.evaluate("window.sukli.get().accounts.filter(x=>x.id==='rx1'||x.id==='rx2').map(x=>x.exchange)")
    ok('all accounts of the platform moved (Maya and maya are one)', r==['Maya Bank','Maya Bank'])
    ok('Accounts page shows the new name', 'Maya Bank' in pg.inner_text('#view'))
    # ticker rename
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(600)
    pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
    pg.evaluate("""(async()=>{const m=await import('/js/invest.js');m.ACT?0:0;})()""")
    pg.evaluate("window.sukli_open=1")
    t=pg.locator('[data-act=inv-ticker][data-sym=NVDA]')
    if t.count()==0:
        pg.evaluate("""(async()=>{const u=await import('/js/ui.js');u.ACT['inv-ticker']({dataset:{sym:'NVDA'}})})()""")
    else: t.first.evaluate("e=>e.click()")
    pg.wait_for_selector('[data-rn]'); pg.click('[data-rn]'); pg.wait_for_selector('#tkrn')
    pg.fill('#tkrn [name=t]','nvda.x'); pg.fill('#tkrn [name=n]','Nvidia Corp'); pg.click('#tkrn .btn:not(.ghost)'); pg.wait_for_timeout(500)
    tk=pg.evaluate("window.sukli.get().settings.tickers.NVDA")
    ok('ticker label and full name changed', tk['ticker']=='NVDA.X' and tk['name']=='Nvidia Corp')
    a=pg.evaluate("window.sukli.get().accounts.find(x=>x.id==='rx3')")
    ok('account name followed the label, balance and currency kept', a['name']=='Zed NVDA.X' and a['cur']=='NVDA' and a['open']==2)
    ok('no page errors', not errs); print(errs[:2])
    b.close()
print('SUMMARY', sum(res), '/', len(res)); raise SystemExit(0 if all(res) else 1)
