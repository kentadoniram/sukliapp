# v15.18: Home card "Your Usual Spending" (ordinary day/month from Daily Needs), hidden in Simple mode
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced'})})()")
    pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(1500)
    D=pg.evaluate("(async()=>{const c=await import('/js/core.js'),t=await import('/js/trips.js');return t.dailyNeeds(c.get())})()")
    ok('real data gives an ordinary day %s'%D, D['perDay']>0)
    ok('card shown on Home in Advanced', pg.locator('.usualcard').count()==1 and 'An ordinary month' in pg.inner_text('.usualcard'))
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='simple'})})()")
    pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(1500)
    ok('hidden in Simple mode', pg.locator('.usualcard').count()==0)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
