# v12af: balances in transfer From/To, one-tap wallet move, Earn per wallet, scope filter in Budget
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874},service_workers='block'); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    # platform account with two wallets
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push({id:'wx1',name:'TestEx USDT',type:'crypto',cur:'USDT',exchange:'TestEx',wallet:'Spot',openBal:5,created:1,updated:1});});})()""")
    pg.wait_for_timeout(300)
    pg.evaluate("(async()=>{const a=await import('/js/accpage.js');a.openAccountDetail('wx1')})()"); pg.wait_for_selector('[data-act=wallet-move]')
    ok('wallet chips shown for a platform asset', pg.locator('[data-act=wallet-move]').count()>=5)
    pg.click('[data-act=wallet-move][data-w=Earn]'); pg.wait_for_timeout(400)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.id==='wx1');return [a.wallet,a.name]})()")
    ok(f'one tap moves the asset to Earn and the name follows: {r}', r[0]=='Earn' and r[1]=='TestEx Earn USDT')
    # transfer form shows balances
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry()})()"); pg.wait_for_selector('#f-amount')
    ok('no script errors', not errs)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(600); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    ok('wallet heading renders', pg.locator('h4.wlt').count()>=1)
    pg.goto('http://localhost:8123/#/budget'); pg.wait_for_timeout(500)
    ok('budget has Spending from select', pg.locator('[data-bscope]').count()==1)
    ok('still no script errors', not errs)
print('SUMMARY',sum(res),'/',len(res))
