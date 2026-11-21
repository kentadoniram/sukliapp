# v15.12: Set Rate with both directions, cashback default, item discount and tax, visible +/- in dark mode
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
def boot(b,scheme):
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,color_scheme=scheme,service_workers='block'); pg=ctx.new_page(); pg.errs=[]
    pg.on('pageerror',lambda e:pg.errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900); return pg
with sync_playwright() as p:
    b=p.chromium.launch(); pg=boot(b,'light')
    # ---- Set Rate ----
    pg.evaluate("(async()=>{const f=await import('/js/fxview.js');f.openConverter({from:'USDT',to:'PHP',amount:10,rate:62,onApply:o=>window.__o=o})})()"); pg.wait_for_selector('#cv-setrate'); pg.click('#cv-setrate'); pg.wait_for_timeout(200)
    t=pg.inner_text('#cv-p-rate')
    ok('Set Rate: direction named PHP/USDT, both directions shown %s'%t.replace('\n',' | '), 'PHP/USDT' in t and '1 USDT = 62 PHP' in t and '1 PHP = 0.0161 USDT' in t)
    pg.click('#cv-dirswap'); pg.wait_for_timeout(150)
    t=pg.inner_text('#cv-p-rate'); v=float(pg.input_value('#cv-r'))
    ok('Swap Direction: now USDT/PHP, input shows 0.0161 %s'%v, 'USDT/PHP' in t and abs(v-1/62)<1e-6)
    pg.fill('#cv-r','0.02'); pg.dispatch_event('#cv-r','input'); pg.wait_for_timeout(100)
    t=pg.inner_text('#cv-inv'); ok('typing 0.02 USDT/PHP gives 1 USDT = 50 PHP %s'%t.replace('\n',' | '), '1 USDT = 50 PHP' in t and '1 PHP = 0.02 USDT' in t)
    pg.click('#cv-dirswap'); pg.wait_for_timeout(100)
    ok('swap back shows 50', abs(float(pg.input_value('#cv-r'))-50)<1e-6)
    pg.screenshot(path='/tmp/setrate2.png')
    pg.evaluate("document.querySelector('[data-x],#cv-x,.btn.ghost[data-x]')?.click()")
    ok('no errors Set Rate %s'%pg.errs, not pg.errs); pg.context.close()
    # ---- entry: cashback and items ----
    pg=boot(b,'dark')
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(200)
    pg.fill('#f-amount','1080'); pg.dispatch_event('#f-amount','input')
    pg.evaluate("document.querySelector('[data-e=cb-on]').click()"); pg.wait_for_timeout(150)
    md=pg.evaluate("[...document.querySelectorAll('[data-e=cb-mode]')].map(b=>[b.textContent.trim(),b.classList.contains('on'),Math.round(b.getBoundingClientRect().width),getComputedStyle(b).textAlign])")
    ok('cashback: Fixed Amount is the default, equal widths, centred %s'%md, md[0][0]=='Fixed Amount' and md[0][1] and not md[1][1] and abs(md[0][2]-md[1][2])<=1 and all(x[3]=='center' for x in md))
    pg.evaluate("document.querySelector('[data-e=items-on]').click()"); pg.wait_for_selector('.itembox'); pg.wait_for_timeout(200)
    pg.fill('.item .in-n','Bento'); pg.fill('.item .in-a','500'); pg.dispatch_event('.item .in-a','input')
    pg.evaluate("document.querySelector('[data-e=item-q][data-v=\"0:1\"]').click()"); pg.wait_for_timeout(150)   # quantity 2 = 1000
    pg.evaluate("document.querySelector('[data-e=item-disc]').click()"); pg.wait_for_selector('.in-d'); pg.fill('.in-d','100'); pg.dispatch_event('.in-d','input'); pg.wait_for_timeout(100)
    ok('item discount: 2 x 500 minus 100 = 900 %s'%pg.inner_text('.iline'), '900' in pg.inner_text('.iline') and 'discount' in pg.inner_text('.iline'))
    pg.evaluate("document.querySelector('[data-e=tax-toggle]').click()"); pg.wait_for_selector('#f-taxv'); pg.evaluate("document.querySelector('[data-e=tax-set][data-v=\"10\"]').click()"); pg.wait_for_timeout(150)
    tx=pg.inner_text('#taxcalc'); ok('tax 10 percent of 900 = 90 %s'%tx, '90' in tx)
    left=pg.inner_text('#itemleft'); ok('items plus tax = 990, so 90 not assigned of 1080 %s'%left, '90' in left)
    pg.fill('#f-amount','990'); pg.dispatch_event('#f-amount','input'); pg.wait_for_timeout(150)
    ok('items and tax add up to the total', 'add up' in pg.inner_text('#itemleft'))
    # +/- visible in dark: contrast of the button background against the box
    c=pg.evaluate("(()=>{const b=document.querySelector('.qty button'),bx=document.querySelector('.itembox');const p=s=>getComputedStyle(s).backgroundColor.match(/\\d+/g).slice(0,3).map(Number);return [p(b),p(bx),getComputedStyle(b).borderTopWidth,getComputedStyle(b).borderTopColor]})()")
    d=sum(abs(x-y) for x,y in zip(c[0],c[1])); ok('dark: +/- stand out from the box %s'%c, d>=40 and c[2]!='0px')
    pg.locator('.itembox').scroll_into_view_if_needed(); pg.locator('.itembox').screenshot(path='/tmp/items_dark.png')
    # save and reopen
    pg.fill('#f-what','Lunch bento'); pg.dispatch_event('#f-what','input'); pg.evaluate("document.querySelector('[data-e=save]').click()"); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.filter(x=>!x.deleted&&(x.name||'').toLowerCase()==='lunch bento')[0];return t&&{amt:t.amount,items:t.items}})()")
    ok('saved: items net of discount plus a Tax line adding up to 990 %s'%r, r and r['amt']==990 and r['items'][0]['amt']==900 and r['items'][0]['d']==100 and r['items'][1]['tax'] and r['items'][1]['amt']==90)
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');const c=await import('/js/core.js');const t=c.get().txs.find(x=>!x.deleted&&(x.name||'').toLowerCase()==='lunch bento');m.openEntry({id:t.id})})()")
    pg.wait_for_selector('.itembox',timeout=4000); pg.wait_for_timeout(300)
    ok('reopened: discount and tax are back as typed', pg.input_value('.in-d')=='100' and pg.input_value('#f-taxv')=='10' and pg.locator('.item').count()==1)
    ok('no errors entry %s'%[e for e in pg.errs if 'Tunnel' not in e], not [e for e in pg.errs if 'Tunnel' not in e])
print('fails',res.count(False))
