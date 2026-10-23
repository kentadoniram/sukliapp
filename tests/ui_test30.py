# Budget setup + alerts, input history, transfer form layout, opening balance in history, card toggle without redraw
from playwright.sync_api import sync_playwright
from pkhelp import choose, open_menu
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    # --- budget setup
    pg.goto('http://localhost:8123/#/budget'); pg.wait_for_timeout(600)
    pg.click('[data-act=budget-setup]'); pg.wait_for_selector('#bs')
    ok('setup lists categories with kinds', pg.locator('#bs .bsrow').count()>10 and pg.locator('#bs [data-cls].on').count()>10)
    pg.fill('#bs [name=alert]','50')
    row=pg.locator('#bs .bsrow:has(span:text-is("Dining Out"))').first if pg.locator('#bs .bsrow:has(span:text-is("Dining Out"))').count() else pg.locator('#bs .bsrow:has-text("Dining Out")').first
    pg.evaluate("document.querySelectorAll('#bs details').forEach(d=>d.open=true)")
    row.locator('[data-on]').check(); row.locator('[data-amt]').fill('100'); row.locator('[data-cls=want]').click()
    gro=pg.locator('#bs .bsrow:has-text("Grocery")').first; gro.locator('[data-on]').check(); gro.locator('[data-amt]').fill('100000'); gro.locator('[data-cls=need]').click()
    pg.click('#bs .btn:not(.ghost)'); pg.wait_for_timeout(600)
    pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{const c=d.categories.find(x=>!x.deleted&&x.name==='Dining Out'),a=d.accounts.find(x=>!x.deleted&&x.cur===m.HOME);d.txs.push(m.stamp({id:'dine1',kind:'expense',date:m.nowStamp(),name:'Test dinner',amount:500,cur:a.cur,fx:1,acct:a.id,cat:c.id,createdAt:Date.now()}));});})()""")
    pg.goto('http://localhost:8123/#/budget'); pg.wait_for_timeout(500)
    while pg.locator('[data-act=month][data-d="1"]:not([disabled])').count(): pg.click('[data-act=month][data-d="1"]'); pg.wait_for_timeout(200)
    pg.wait_for_timeout(500); t=pg.inner_text('#view')
    ok('budget tab warns about the over-budget want', 'Dining Out' in t and 'want' in t and 'over budget' in t)
    ok('needs, wants, luxury card', 'Needs, wants and luxury' in t and 'Wants' in t and 'Needs' in t)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(700)
    while pg.locator('[data-act=month][data-d="1"]:not([disabled])').count(): pg.click('[data-act=month][data-d="1"]'); pg.wait_for_timeout(250)
    pg.wait_for_timeout(600); ok('home shows a budget alert', 'Budget alert' in pg.inner_text('#view'))
    # --- opening balance in account history
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(500)
    pg.locator('.row.acct:has(strong:text-is("Wallet"))').first.click(); pg.wait_for_selector('#ad'); pg.wait_for_timeout(300)
    ad=pg.inner_text('#ad'); ok('opening balance shown with its date', 'Opening balance' in ad and 'Oct 18' in ad)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # --- transfer form layout
    pg.click('[data-act=add]'); pg.wait_for_selector('#f-amount'); pg.click('.seg button:has-text("Transfer")'); pg.wait_for_timeout(400)
    g=pg.evaluate("(()=>{const s=document.querySelector('.swapbtn').getBoundingClientRect(),a=document.querySelector('.two.sw .acctbtn').getBoundingClientRect();return [Math.abs((s.top+s.height/2)-(a.top+a.height/2)), document.querySelector('.chips.qpone')? getComputedStyle(document.querySelector('.chips.qpone')).flexWrap:'none']})()")
    ok('swap button centred on the account row', g[0]<=1.5); ok('usual routes in one scrolling line', g[1]=='nowrap')
    # save a transfer with a far-away date through the app model then find it in input history
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{const a=d.accounts.find(x=>!x.deleted);d.txs.push(m.stamp({id:'odd1',kind:'expense',date:'2024-01-05 12:00:00',name:'Typo year',amount:123,cur:a.cur,fx:1,acct:a.id,cat:'',createdAt:Date.now()}));});})()""")
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(500); pg.click('[data-act=ih-open]'); pg.wait_for_selector('#ihlist')
    ok('input history lists newest typed first', 'Typo year' in pg.inner_text('#ihlist').split('\n')[1:6].__str__() or 'Typo year' in pg.inner_text('#ihlist')[:400])
    pg.click('[data-act=ih-filter][data-v=odd]'); pg.wait_for_timeout(300); ok('odd dates filter flags it', 'Unusual date' in pg.inner_text('#ihlist') and 'Typo year' in pg.inner_text('#ihlist'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # --- card toggle must not redraw the page (no flicker)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(800)
    pg.evaluate("window.__mark = document.querySelector('#view').firstElementChild")
    pg.click('.collhead >> nth=0'); pg.wait_for_timeout(300)
    same=pg.evaluate("window.__mark === document.querySelector('#view').firstElementChild && window.__mark.isConnected")
    ok('toggling a card keeps the page in place', same)
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
