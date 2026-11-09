# v15.11: fee control (0 Fee / Fixed Amount / % of the Trade) in trades and transfers; three sections share one box style
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    # ---- transfer ----
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.click('[data-e=kind][data-v=transfer]'); pg.wait_for_timeout(200)
    ok('transfer: 0 Fee is the default, three options, no amount row', pg.locator('[data-e=feemode]').count()==3 and pg.locator('[data-e=feemode][data-v=none].on').count()==1 and pg.locator('#f-fee').count()==0)
    labs=pg.evaluate("[...document.querySelectorAll('[data-e=feemode]')].map(x=>x.textContent.trim())")
    ok('transfer: labels %s'%labs, labs==['0 Fee','Fixed Amount','% of the Transfer'])
    pg.click('[data-e=feemode][data-v=fixed]'); pg.wait_for_timeout(150)
    ok('transfer: Fixed Amount shows Fee Amount (cur) and Maker/Taker', pg.locator('#f-fee').count()==1 and 'Fee Amount (' in pg.inner_text('.feedet') and 'Fee Responsibility' in pg.inner_text('.feedet') and 'Taken from Maker' in pg.inner_text('.feedet') and 'Taken from Taker' in pg.inner_text('.feedet'))
    pg.fill('#f-amount','2000'); pg.dispatch_event('#f-amount','input'); pg.click('[data-e=feemode][data-v=pct]'); pg.wait_for_timeout(150); pg.fill('#f-fee','1.5'); pg.dispatch_event('#f-fee','input'); pg.wait_for_timeout(100)
    ok('transfer: % of the transfer works out 30', '30' in pg.inner_text('#feecalc') and pg.evaluate("document.querySelector('#f-fee').value")=='1.5')
    pg.fill('#f-amount','4000'); pg.dispatch_event('#f-amount','input'); pg.wait_for_timeout(100)
    ok('transfer: the fee follows the amount (60)', '60' in pg.inner_text('#feecalc'))
    pg.click('[data-e=feemode][data-v=none]'); pg.wait_for_timeout(150)
    ok('transfer: back to 0 Fee hides the row', pg.locator('#f-fee').count()==0)
    pg.click('[data-e=feemode][data-v=fixed]'); pg.wait_for_timeout(100); pg.locator('.feebox').scroll_into_view_if_needed(); pg.locator('.feebox').screenshot(path='/tmp/fee_transfer.png')
    # ---- the three boxes look the same ----
    pg.click('[data-e=kind][data-v=expense]'); pg.wait_for_timeout(200)
    pg.evaluate("[...document.querySelectorAll('[data-e=items-on],[data-e=counts-on]')].forEach(b=>b.click())"); pg.wait_for_timeout(300)
    st=pg.evaluate("""()=>{const g=s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);return [c.backgroundColor,c.borderTopColor,c.borderTopWidth,c.borderRadius]};return {items:g('.itembox'),counts:g('.countbox'),hasCancel:!!document.querySelector('.countbox [data-e=counts-off]')}}""")
    print(st)
    ok('Count by Group has the same box style as Split into Items', st['items'] and st['items']==st['counts'] and st['hasCancel'])
    pg.evaluate("document.querySelector('.countbox').scrollIntoView()"); pg.screenshot(path='/tmp/boxes.png')
    pg.evaluate("document.querySelector('[data-e=counts-off]').click()"); pg.wait_for_timeout(200)
    ok('Cancel closes Count by Group', pg.locator('.countbox').count()==0)
    ok('no errors %s'%[e for e in errs if 'Tunnel' not in e], not [e for e in errs if 'Tunnel' not in e])
print('fails',res.count(False))
