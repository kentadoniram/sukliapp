from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
U='http://localhost:8123/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
    pg.goto(U); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    # typed transport word
    pg.goto(U+'#/home'); pg.wait_for_timeout(600); pg.click('.fab'); pg.wait_for_selector('#entry')
    pg.fill('#f-name','bus'); pg.wait_for_timeout(500)
    ok('From/To appear when typing bus', pg.locator('#triprow input, #triprow [id*=from]').count()>0)
    ok('category moved to transport', 'ransport' in pg.inner_text('#entry') or pg.locator('#triprow').inner_text()!='')
    pg.fill('#f-name','lunch'); pg.wait_for_timeout(500)
    ok('From/To hidden again for lunch', pg.locator('#triprow input').count()==0)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # multi select
    pg.goto(U+'#/ledger'); pg.wait_for_selector('#ledger-list .row')
    n0=pg.locator('#ledger-list .row').count()
    pg.click('[data-act=sel-start]'); pg.wait_for_timeout(200)
    pg.click('#ledger-list .row >> nth=0'); pg.click('#ledger-list .row >> nth=1')
    ok('two selected', '2 selected' in pg.inner_text('.selbar'))
    pg.click('[data-act=sel-all]'); ok('select all', f'{n0} selected' in pg.inner_text('.selbar'))
    pg.click('[data-act=sel-all]'); pg.click('#ledger-list .row >> nth=0'); pg.click('#ledger-list .row >> nth=1')
    pg.click('[data-act=sel-del]'); pg.wait_for_timeout(300); pg.click('.sheet .btn:not(.ghost)'); pg.wait_for_timeout(600)
    ok('two deleted', pg.locator('#ledger-list .row').count()==n0-2)
    pg.click('.toast .linkbtn'); pg.wait_for_timeout(600)
    ok('undo restores', pg.locator('#ledger-list .row').count()==n0)
    # calendar
    pg.goto(U+'#/calendar'); pg.wait_for_selector('.cal'); pg.wait_for_timeout(300)
    t=pg.inner_text('#view'); ok('calendar richer', 'Busiest day' in t and 'Spending by week' in t and 'Cash outflow' in t)
    ok('heat shading present', pg.locator('.cal-d[style*=heat]').count()>0)
    # account detail fab
    pg.goto(U+'#/accounts'); pg.wait_for_timeout(500)
    pg.locator('#view button.row, #view .acct, #view [data-act=acct]').first.click(); pg.wait_for_selector('#ad'); pg.wait_for_timeout(300)
    ok('fab present', pg.locator('.adfab-btn').count()==1)
    pg.click('.adfab-btn'); pg.click('[data-ad=fab-new][data-v=transfer]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    ok('transfer prefilled', pg.locator('.swapbtn').count()==1)
    f1=pg.inner_text('.two.sw .field >> nth=0'); t1=pg.inner_text('.two.sw .field >> nth=1')
    pg.click('.swapbtn'); pg.wait_for_timeout(300)
    f2=pg.inner_text('.two.sw .field >> nth=0'); t2=pg.inner_text('.two.sw .field >> nth=1')
    ok('swap swaps', f1.replace('From','')==t2.replace('To','') and t1.replace('To','')==f2.replace('From',''))
    ok('no errors', not errs); print(errs[:5])
    b.close()
print(sum(res),'/',len(res))
