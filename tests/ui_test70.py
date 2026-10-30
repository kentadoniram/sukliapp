# v13.10: beginner help "?" on a few pages
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    for r,w in [('home','Home'),('ledger','Entries'),('calendar','Calendar'),('budget','Budget'),('accounts','Accounts'),('debts','Debts'),('owed','Owed to you')]:
        pg.goto('http://localhost:8123/#/'+r); pg.wait_for_timeout(500)
        ok(r+' has a help button', pg.locator('header .helpbtn').count()==1)
        pg.click('header .helpbtn'); pg.wait_for_selector('.sheet'); t=pg.inner_text('.sheet'); ok(r+' help opens: '+w, w in t and 'Tip' in t)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(400); ok('no help button on Settings', pg.locator('header .helpbtn').count()==0)
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_timeout(400); pg.click('header .helpbtn'); pg.wait_for_selector('.sheet'); pg.click('.sheet [data-act=glossary]'); pg.wait_for_timeout(500); ok('Words explained opens glossary', 'Account' in pg.inner_text('body'))
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
