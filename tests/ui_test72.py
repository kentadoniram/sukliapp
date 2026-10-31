# v13.13: mode switch animation, mode-matched look
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
BG="getComputedStyle(document.body).getPropertyValue('--paper').trim()"
LN="getComputedStyle(document.documentElement).getPropertyValue('--line').trim()"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',color_scheme='light'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    adv_bg=pg.evaluate(BG); adv_ln=pg.evaluate(LN)
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelectorAll('details.sgroup,details.ssub').forEach(d=>d.open=true)")
    pg.click('[data-act=set-mode][data-v=simple]'); pg.wait_for_selector('.modeswitch'); ok('curtain appears with Simple mode', pg.get_attribute('.modeswitch b','aria-label')=='Simple mode')
    pg.wait_for_timeout(800); ok('mode changed behind the curtain', pg.evaluate("document.body.classList.contains('simple')"))
    pg.wait_for_timeout(2300); ok('curtain gone afterwards', pg.locator('.modeswitch').count()==0)
    s_bg=pg.evaluate(BG); s_ln=pg.evaluate(LN)
    ok('Simple has its own background and accent (%s %s vs %s %s)'%(s_bg,s_ln,adv_bg,adv_ln), s_bg!=adv_bg and s_ln!=adv_ln and s_ln=='#0F6E6E' and adv_ln=='#1D4E89')
    pg.click('[data-act=look][data-k=accent][data-v=rose]'); pg.wait_for_timeout(200); ok('a picked colour wins over the mode', pg.evaluate(LN)=='#B03A5B')
    pg.click('[data-act=look][data-k=accent][data-v=auto]'); pg.wait_for_timeout(200); ok('Match the mode returns', pg.evaluate(LN)=='#0F6E6E')
    pg.click('[data-act=set-mode][data-v=advanced]'); pg.wait_for_selector('.modeswitch'); pg.wait_for_timeout(3000)
    ok('back to Advanced look', pg.evaluate(LN)=='#1D4E89' and pg.evaluate(BG)==adv_bg and not pg.evaluate("document.body.classList.contains('simple')"))
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
