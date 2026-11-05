# v13.44: review page for trades rebuilt from the Bluecoins import (real CSV: 64 of them)
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    N="(async()=>{const r=await import('/js/tradereview.js'),c=await import('/js/core.js');const d=c.get();return [r.rebuiltList(d).length,r.pendingReview(d).length,d.txs.filter(t=>!t.deleted&&t.trade).length]})()"
    n=pg.evaluate(N); ok('rebuilt trades found %s'%n, n[0]>=1 and n[0]==n[1])
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
    ok('Review trades button with the count', pg.locator('[data-act=trade-review]').count()==1 and str(n[1]) in pg.inner_text('[data-act=trade-review]'))
    pg.evaluate("document.querySelector('[data-act=trade-review]').click()"); pg.wait_for_selector('#trv'); t=pg.inner_text('#trv')
    ok('rows show date, what and value', 'Keep as Trade' in t and ('Sell' in t or 'Buy' in t) and 'Make It a Plain Transfer' in t and 'To Review (%d)'%n[1] in t)
    pg.locator('#trv [data-r=keep]').first.click(); pg.wait_for_timeout(300)
    m=pg.evaluate(N); ok('keep one: it moves to Kept, still a trade %s'%m, m[1]==n[1]-1 and m[2]==n[2])
    pg.locator('#trv [data-r=plain]').first.click(); pg.wait_for_timeout(400)
    m=pg.evaluate(N); ok('plain one: no longer a trade %s'%m, m[2]==n[2]-1 and m[0]==n[0]-1)
    pg.click('#trv [data-r=show][data-v=kept]'); pg.wait_for_timeout(300); ok('Kept tab lists the kept one', 'Back to Review' in pg.inner_text('#trv'))
    pg.click('#trv [data-r=show][data-v=todo]'); pg.wait_for_timeout(300)
    pg.click('#trv [data-r=keepall]'); pg.wait_for_timeout(300)
    pg.locator('.sheet button:has-text("Keep All")').last.click(); pg.wait_for_timeout(500)
    m=pg.evaluate(N); ok('keep all: nothing pending %s'%m, m[1]==0)
    pg.click('#trv [data-r=rebuildon]'); pg.wait_for_timeout(300)
    v=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().settings.rebuildTrades})()"); ok('off switch saved %s'%v, v is False)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
