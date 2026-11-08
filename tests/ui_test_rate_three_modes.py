# v15.6: Exchange Rate window, three modes; typed boxes vs calculated lines
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const f=await import('/js/fxview.js');window.__s=f.openConverter({from:'USDT',to:'PHP',amount:10,rate:58,onApply:o=>window.__o=o})})()"); pg.wait_for_selector('#cv-manual'); pg.wait_for_timeout(300)
    vis=lambda i: pg.evaluate("i=>{const e=document.querySelector(i);return !!e&&!e.hidden&&e.offsetParent!==null}",i)
    box=lambda i: pg.evaluate("i=>{const r=document.querySelector(i).getBoundingClientRect();return [Math.round(r.top),Math.round(r.height)]}",i)
    # Set Amount
    ok('Set Amount: only the two amounts are boxes', vis('#cv-a') and vis('#cv-b') and not vis('#cv-r') and vis('#cv-cr') and not vis('#cv-ca'))
    h1=box('#cv-a')[1]; hc=box('#cv-cr')[1]
    pg.fill('#cv-a','100'); pg.fill('#cv-b','5000')
    ok('Set Amount: the rate shown follows (50)', '50' in pg.inner_text('#cv-cr') and 'USDT/PHP' in pg.inner_text('#cv-cr'))
    pg.screenshot(path='/tmp/fx_amount.png')
    # Set Rate
    pg.click('#cv-setrate'); pg.wait_for_timeout(200)
    ok('Set Rate: only the rate is a box, the amounts are calculated lines', vis('#cv-r') and not vis('#cv-a') and not vis('#cv-b') and vis('#cv-ca') and vis('#cv-cb'))
    ok('Set Rate: the rate row is first, the amounts second', box('#cv-r')[0] < box('#cv-ca')[0])
    pg.fill('#cv-r','60')
    ok('Set Rate: amounts follow (100 and 6000)', pg.inner_text('#cv-ca')=='100' and pg.inner_text('#cv-cb')=='6000')
    pg.screenshot(path='/tmp/fx_rate.png')
    # Get Latest Rate
    pg.click('#cv-latest'); pg.wait_for_timeout(2500)
    ok('Get Latest Rate: nothing is a box; pair and rate are calculated info', not vis('#cv-a') and not vis('#cv-b') and not vis('#cv-r') and vis('#cv-cr') and 'USDT/PHP' in pg.inner_text('#cv-cr'))
    pg.screenshot(path='/tmp/fx_latest.png')
    # no layout jump between modes: same row positions, same heights
    pos=[]
    for m in ['#cv-manual','#cv-setrate','#cv-latest']:
        pg.click(m); pg.wait_for_timeout(150); pos.append((box('#cv-rowr'),box('#cv-ca' if not vis('#cv-a') else '#cv-a')))
    ok('rows keep the same place and height in every mode %s'%pos, pos[0]==pos[1]==pos[2] or all(abs(x[0][0]-pos[0][0][0])<2 and x[0][1]==pos[0][0][1] and x[1][1]==pos[0][1][1] for x in pos))
    ok('boxes and calculated lines are the same height', h1==hc==46)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
