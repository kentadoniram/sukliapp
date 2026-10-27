# v12ap: equal Account/When columns, All inside amount box, currency height, platform case setting, value graph
import json
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.click('[data-act=add]'); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(500)
    r=pg.evaluate("(()=>{const a=document.querySelector('#acctrow').getBoundingClientRect(),w=document.querySelector('#whenrow').getBoundingClientRect();return [a.width,w.width]})()")
    ok('Account and When equal width %s'%r, abs(r[0]-r[1])<2)
    inbox=pg.evaluate("!!document.querySelector('.amtwrap #f-all')"); ok('All button lives inside the amount box', inbox)
    h=pg.evaluate("(()=>{const a=document.querySelector('.amtwrap').getBoundingClientRect(),c=document.querySelector('#curwrap .curbtn').getBoundingClientRect();return [a.height,c.height]})()")
    ok('currency height matches amount box %s'%h, abs(h[0]-h[1])<2)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(700)
    ok('Market value card has graph button', pg.locator('[data-act=inv-graph]').count()==1)
    ok('FAB tinted on Investments', pg.evaluate("document.querySelector('.fab').classList.contains('inv')"))
    pg.click('[data-act=inv-graph]'); pg.wait_for_selector('#ivg'); pg.wait_for_timeout(300)
    t=pg.inner_text('#ivg'); ok('graph sheet opens with text', len(t)>20); print(t[:160].replace('\n',' | '))
    if pg.locator('#ivsvg').count():
        ok('range chips work', (pg.click('[data-rg="1M"]'), pg.locator('#ivsvg').count())[1]==1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # setting
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(800)
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    pg.click('[data-act=look][data-k=pcase][data-v=title]'); pg.wait_for_timeout(300)
    ok('pcase title applied', pg.evaluate("document.documentElement.dataset.pcase")=='title')
    pg.click('[data-act=look][data-k=pcase][data-v=lower]'); pg.wait_for_timeout(300)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(500)
    s=pg.evaluate("(()=>{const e=document.querySelector('.exname');return e?[getComputedStyle(e).textTransform,getComputedStyle(e).fontWeight]:null})()")
    ok('platform name lowercase and bold %s'%s, s and s[0]=='lowercase' and int(s[1])>=700)
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
