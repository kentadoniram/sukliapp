# v12aj: suggestions chosen by touch, steady taps, floating small Save row, x inside the field's parent
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':402,'height':874},device_scale_factor=3,is_mobile=True,has_touch=True,user_agent=UA,service_workers='block')
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry()})()"); pg.wait_for_selector('#f-what')
    ok('text box is not called "name" (iOS reads the id)', 'name' not in pg.evaluate("document.querySelector('#f-what').id+document.querySelector('#f-what').name"))
    pg.tap('#f-what'); pg.keyboard.type('sta'); pg.wait_for_timeout(450)
    n=pg.locator('#sugg button').count(); ok(f'suggestions appear: {n}', n>=2)
    vals=pg.eval_on_selector_all('#sugg button','bs=>bs.map(b=>b.dataset.v)')
    # tap the SECOND row: it must pick the second row
    pg.locator('#sugg button').nth(1).tap(); pg.wait_for_timeout(300)
    ok(f'second row picks the second name: {vals[1]!r} -> {pg.input_value("#f-what")!r}', pg.input_value('#f-what')==vals[1])
    pg.fill('#f-what',''); pg.dispatch_event('#f-what','input'); pg.tap('#f-what'); pg.keyboard.type('sta'); pg.wait_for_timeout(450)
    vals=pg.eval_on_selector_all('#sugg button','bs=>bs.map(b=>b.dataset.v)')
    pg.locator('#sugg button').first.tap(); pg.wait_for_timeout(300)
    ok(f'first tap on the first row works at once: {vals[0]!r} -> {pg.input_value("#f-what")!r}', pg.input_value('#f-what')==vals[0])
    ok('picking once does not pick twice or leave the list open', pg.locator('#sugg button').count()==0 or pg.evaluate("document.querySelector('#sugg').hidden"))
    # x lives in the field's parent, absolutely placed
    pg.tap('#f-what'); pg.wait_for_timeout(250)
    z=pg.evaluate("(()=>{const b=document.querySelector('.clearx'),f=document.querySelector('#f-what');return [b.parentElement===f.parentElement,getComputedStyle(b).position]})()")
    ok(f'x sits inside the field parent and is absolute: {z}', z[0] and z[1]=='absolute')
    # Save row: floating pill, small with the keyboard
    s1=pg.evaluate("(()=>{const e=document.querySelector('[data-e=save]'),r=e.getBoundingClientRect(),row=document.querySelector('#btns');return [Math.round(r.height),getComputedStyle(row).backgroundColor,getComputedStyle(row).pointerEvents,getComputedStyle(row).position]})()")
    ok(f'Save row floats with no solid bar: {s1}', s1[1] in ('rgba(0, 0, 0, 0)','transparent') and s1[2]=='none' and s1[3]=='sticky' and s1[0]>=40)
    pg.evaluate("document.documentElement.classList.add('kb')"); pg.wait_for_timeout(200)
    s2=pg.evaluate("Math.round(document.querySelector('[data-e=save]').getBoundingClientRect().height)")
    ok(f'Save button is smaller while the keyboard is open: {s1[0]} -> {s2}', s2<s1[0] and s2>=32)
    pg.evaluate("document.documentElement.classList.remove('kb')")
    # the Save button follows when the form scrolls
    pg.evaluate("document.querySelector('.sheet-body').scrollTop=0"); pg.wait_for_timeout(150)
    y0=pg.evaluate("Math.round(document.querySelector('[data-e=save]').getBoundingClientRect().bottom)")
    pg.evaluate("document.querySelector('.sheet-body').scrollTop=60"); pg.wait_for_timeout(150)
    y1=pg.evaluate("Math.round(document.querySelector('[data-e=save]').getBoundingClientRect().bottom)")
    ok(f'Save stays put while scrolling: {y0} {y1}', abs(y0-y1)<=2)
    ok('no script errors', not errs)
print('SUMMARY',sum(res),'/',len(res))
