# v12v: first-run guide, 7-day bars, invest + menu, investments block on Accounts, fee rows in Expense filter, Check hint,
# burger Categories fold, tab re-tap scroll, budget pie updates in place, group suggestions in the entry form
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    t=pg.inner_text('#view')
    ok('first screen explains accounts and entries', 'Welcome to Sukli' in t and 'account' in t and 'entry' in t and 'empty ledger' not in t)
    ok('first screen has a primary start button', pg.locator('[data-act=start-empty]').count()==1)
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{const a=d.accounts.find(x=>!x.deleted&&x.cur===m.HOME),c=d.categories.find(x=>!x.deleted&&x.kind==='expense');d.txs.push(m.stamp({id:'wk1',kind:'expense',acct:a.id,cat:c.id,amount:123,cur:m.HOME,date:m.nowStamp(),name:'week test'}))})})()""")
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(900)
    ok('home shows last 7 days bars', (pg.locator('.week .wk').count()==7 or pg.locator('.week .wc').count()==7))
    ok('week rows do not overlap', pg.evaluate("""()=>[...document.querySelectorAll('.week .wk')].every(r=>{const d=r.querySelector('.wd').getBoundingClientRect(),t=r.querySelector('.wtrack').getBoundingClientRect(),v=r.querySelector('.wv').getBoundingClientRect();return d.right<=t.left+1&&t.right<=v.left+1})"""))
    # burger categories fold
    pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer')
    h=pg.locator('.drawer [data-dtoggle]'); first=h.get_attribute('aria-expanded')
    h.click(); second=h.get_attribute('aria-expanded'); vis=pg.locator('.drawer .dsub').is_visible()
    ok('burger Categories folds and unfolds', first!=second and vis==(second=='true'))
    h.click(); ok('burger Categories folds back', pg.locator('.drawer .dsub').is_visible()==(h.get_attribute('aria-expanded')=='true'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # tab re-tap scrolls to top
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(700)
    pg.evaluate("window.scrollTo(0,1500)"); pg.wait_for_timeout(200); y0=pg.evaluate("window.scrollY")
    pg.click('#tabs a[href="#/ledger"]'); pg.wait_for_timeout(900)
    ok('re-tapping the open tab scrolls to top', y0>300 and pg.evaluate("window.scrollY")<5)
    # ledger filters: a transfer with a fee
    pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{const a=d.accounts.filter(x=>!x.deleted&&x.cur===m.HOME);d.txs.push(m.stamp({id:'fee1',kind:'transfer',acct:a[0].id,toAcct:a[1].id,amount:500,cur:m.HOME,date:m.nowStamp(),name:'FeeTest move',fee:15,feeBy:'from',feeCur:m.HOME}))})})()""")
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(600)
    while pg.locator('[data-act=month][data-d="1"]:not([disabled])').count(): pg.click('[data-act=month][data-d="1"]'); pg.wait_for_timeout(150)
    pg.fill('#q','FeeTest'); pg.wait_for_timeout(300)
    ok('All: transfer and its fee are one row', pg.locator('#ledger-list .row').count()==1 and 'fee' in pg.inner_text('#ledger-list').lower())
    pg.click('[data-act=filter][data-v=expense]'); pg.wait_for_timeout(600); pg.fill('#q','FeeTest'); pg.wait_for_timeout(300)
    ok('Expense filter lists the fee as an expense', pg.locator('#ledger-list .row').count()==1 and 'Fee · FeeTest move' in pg.inner_text('#ledger-list'))
    pg.click('[data-act=filter][data-v=transfer]'); pg.wait_for_timeout(600); pg.fill('#q','FeeTest'); pg.wait_for_timeout(300)
    ok('Transfer filter shows only the transfer', pg.locator('#ledger-list .row').count()==1 and 'Fee · ' not in pg.inner_text('#ledger-list'))
    pg.click('[data-act=filter][data-v=review]'); pg.wait_for_timeout(500)
    ok('Check explains itself', 'Check means' in pg.inner_text('#filterhint'))
    # accounts: investments are a separate block
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(700)
    ok('accounts page keeps investments in their own block', pg.locator('.invblock').count()==1 and pg.locator('.invblock a[href="#/invest"]').count()==1)
    # invest + menu
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(700)
    ok('invest header wording is clear', 'Record activity' in pg.inner_text('#view') and 'Add asset' in pg.inner_text('#view'))
    pg.click('#tabs .fab'); pg.wait_for_selector('.sheet .invopts')
    ok('middle + on Invest asks account first, then 4 kinds', pg.locator('.sheet select[name=acc]').count()==1 and pg.locator('.sheet .invopt').count()==4)
    ok('option title and note do not overlap', pg.evaluate("""()=>[...document.querySelectorAll('.invopt')].every(o=>{const b=o.querySelector('b').getBoundingClientRect(),s=o.querySelector('small').getBoundingClientRect();return b.bottom<=s.top+1})"""))
    pg.click('.sheet [data-close]'); pg.wait_for_timeout(300)
    # budget pie: no redraw on tap
    pg.goto('http://localhost:8123/#/budget'); pg.wait_for_timeout(600)
    while pg.locator('[data-act=month][data-d="-1"]:not([disabled])').count() and pg.locator('svg.donut .slice').count()==0: pg.click('[data-act=month][data-d="-1"]'); pg.wait_for_timeout(250)
    if pg.locator('svg.donut .slice').count()==0: ok('(no month with spending found)', False)
    else:
        pg.evaluate("document.querySelector('svg.donut').__mark=1")
        pg.locator('svg.donut .slice').first.dispatch_event('click'); pg.wait_for_timeout(300)
        ok('tapping a slice keeps the same chart element (no redraw)', pg.evaluate("document.querySelector('svg.donut').__mark===1"))
        ok('slice tap highlights and opens its row', pg.locator('svg.donut .slice.sel').count()==1 and pg.locator('details.pierow[open]').count()==1)
        pg.locator('svg.donut .slice').first.dispatch_event('click'); pg.wait_for_timeout(300)
        ok('tapping again clears it', pg.locator('svg.donut .slice.sel').count()==0 and pg.locator('details.pierow[open]').count()==0)
    # entry form: group suggestions when no category
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(500); pg.click('#tabs .fab'); pg.wait_for_selector('#f-name')
    pg.fill('#f-name','zzqx unknown thing'); pg.wait_for_timeout(500)
    ok('entry offers existing groups when no category fits', pg.locator('#catrow .chips.grp .chip').count()>=3)
    pg.locator('#catrow .chips.grp .chip').first.click(); pg.wait_for_selector('.pk-list .pk-opt')
    ok('a group opens its categories with add-new', pg.locator('.pk-add').count()==1)
    ok('no page errors', not errs); print(errs[:3])
    b.close()
print('SUMMARY', sum(res), '/', len(res)); raise SystemExit(0 if all(res) else 1)
