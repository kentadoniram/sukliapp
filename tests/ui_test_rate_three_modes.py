# v15.7: Exchange Rate window, three separate layouts
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const f=await import('/js/fxview.js');window.__s=f.openConverter({from:'USDT',to:'PHP',amount:1,rate:63.06,onApply:o=>window.__o=o})})()"); pg.wait_for_selector('#cv-manual'); pg.wait_for_timeout(300)
    vis=lambda i: pg.evaluate("i=>{const e=document.querySelector(i);return !!e&&e.offsetParent!==null}",i)
    lines=lambda i: [x.strip() for x in pg.inner_text(i).split('\n') if x.strip()]
    # Set Amount
    ok('Set Amount: two amount boxes, swap button, info lines; no rate box', vis('#cv-a') and vis('#cv-b') and vis('#cv-rev') and not vis('#cv-r') and not vis('#cv-sum'))
    L=lines('#cv-sum2'); ok('Set Amount: three info lines %s'%L, len(L)==3 and L[0].count('=')==1 and 'USDT' in L[0] and 'PHP' in L[0] and L[1].startswith('1 USDT =') and L[2].startswith('1 PHP ='))
    pg.fill('#cv-a','100'); pg.fill('#cv-b','5000')
    L=lines('#cv-sum2'); ok('Set Amount: the lines follow the amounts (50) %s'%L, '50' in L[1] and '0.02' in L[2])
    pg.screenshot(path='/tmp/fx_amount.png')
    # Set Rate
    pg.click('#cv-setrate'); pg.wait_for_timeout(200)
    ok('Set Rate: only the rate box; no pair, no swap, no amounts, no info lines', vis('#cv-r') and not vis('#cv-a') and not vis('#cv-b') and not vis('#cv-rev') and not vis('#cv-la') and not vis('#cv-sum') and not vis('#cv-sum2'))
    pg.fill('#cv-r','60'); pg.dispatch_event('#cv-r','input')
    pg.screenshot(path='/tmp/fx_rate.png')
    # Get Live Rate
    pg.click('#cv-latest'); pg.wait_for_timeout(2500)
    ok('Get Live Rate: no boxes, only information', vis('#cv-sum') and not vis('#cv-a') and not vis('#cv-b') and not vis('#cv-r') and not vis('#cv-rev') and pg.locator('#cv-p-live input').count()==0)
    L=lines('#cv-sum'); ok('Get Live Rate: three lines %s'%L, len(L)==3 and L[1].startswith('1 USDT =') and L[2].startswith('1 PHP ='))
    pg.screenshot(path='/tmp/fx_latest.png')
    ok('the three panels are different structures', pg.locator('#cv-p-live input').count()==0 and pg.locator('#cv-p-amount input').count()==2 and pg.locator('#cv-p-rate input').count()==1)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
