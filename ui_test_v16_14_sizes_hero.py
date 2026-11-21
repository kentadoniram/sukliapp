import re, sys
sys.path.insert(0, '.')
from playwright.sync_api import sync_playwright
from tests.invnavhelp import go_invest
def ok(n, c): print(('PASS ' if c else 'FAIL ') + n); res.append(bool(c))
res = []
d = open('design.css').read(); s = open('styles.css').read()
ok('design.css has the height scale and the roles', all(x in d for x in ['--h-46: 46px', '--h-field:', '--h-btn-sm:', '--h-chip:', '--h-touch:']))
ok('only one base .chip rule', len(re.findall(r'(?m)^\.chip\s*\{', s)) == 1)
ok('control table: chip fill and padding are the rendered ones', '.chip { --ct-bg: var(--rule); --ct-bd: var(--rule); --ct-r: var(--r-pill); --ct-pad: 0 16px;' in d)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file', state='attached'); pg.set_input_files('#first-file', '/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    probe = """(h)=>{const m=document.createElement('div');m.id='pr';m.innerHTML=h;document.body.appendChild(m);const g=s=>getComputedStyle(m.querySelector(s));return {chip:[g('.chip').minHeight,g('.chip').paddingLeft,g('.chip').borderRadius.slice(0,3)],btn:g('.btn').minHeight,sm:g('.btn.sm').minHeight,inp:g('input').minHeight}}"""
    r = pg.evaluate(probe, '<span class="chip">a</span><button class="btn">b</button><button class="btn sm">c</button><input>')
    print(r)
    ok('chip is 38px tall with 16px side padding and pill corners', r['chip'][0] == '38px' and r['chip'][1] == '16px')
    ok('field is 46px; small button has no fixed height on a mouse screen', r['inp'] == '46px' and r['sm'] == '0px')
    ok('only one .btn.sm base rule', len(re.findall(r'(?m)^\.btn\.sm\s*\{', s)) == 1)
    pg.evaluate("document.getElementById('pr').remove();document.documentElement.style.setProperty('--h-field','60px')")
    ok('changing --h-field once resizes inputs', pg.evaluate("(()=>{const i=document.createElement('input');document.body.appendChild(i);return getComputedStyle(i).minHeight})()") == '60px')
    pg.evaluate("document.documentElement.style.removeProperty('--h-field')")
    for design, want in [('theme1', True), ('legacy', False)]:
        pg.evaluate("async(d)=>{const a=await import('/js/appearance.js');a.setLook({design:d,theme:'light'});}", design); pg.wait_for_timeout(300)
        go_invest(pg, None, 700, 'overview')
        bg = pg.evaluate("getComputedStyle(document.querySelector('.inv-card .sc-front, .nwcard.one div.nwmain')).backgroundImage")
        bw = pg.evaluate("getComputedStyle(document.querySelector('.inv-card .sc-front, .nwcard.one div.nwmain')).borderTopWidth")
        ok('Investments summary %s the attention card in %s' % ('uses' if want else 'does not use', design), (bw == '0px') == want)
    pg.evaluate("async()=>{const a=await import('/js/appearance.js');a.setLook({design:'theme1',theme:'light'});}")
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(900)
    ok('Home main card still has the attention look', pg.evaluate("getComputedStyle(document.querySelector('.main-home-card')).overflow") in ('visible', 'hidden'))
    ok('card({design:hero}) is accepted', pg.evaluate("(async()=>{const c=await import('/js/components.js');return c.card({design:'hero',body:'x'}).includes('ui-card--hero')})()"))
    ok('no page errors %s' % errs, not errs)
    b.close()
print('fails', res.count(False))
