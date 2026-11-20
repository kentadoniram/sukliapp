from playwright.sync_api import sync_playwright
import re
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
d=open('design.css').read(); s=open('styles.css').read()
ok('design.css holds the palette, type, radius, spacing and card designs', all(x in d for x in ['--paper:','--fz-13:','--r-card:','--sp-3:','.ui-card--flat','.ui-card--raised','.ui-card--tint']))
ok('styles.css defines no colour tokens of its own (only uses them)', not re.search(r'^:root[^{]*\{[^}]*--paper\s*:',s,re.M))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    html=pg.evaluate("""(async()=>{const c=await import('/js/components.js');return [c.card({body:'a'}),c.card({design:'flat',body:'a'}),c.card({design:'nope',body:'a'}),c.card({design:'tint',tone:'warn',cls:'x',body:'a'}),c.CARD_DESIGNS]})()""")
    ok('card() adds a design class only for a known design %s'%html[:4], 'ui-card--' not in html[0] and 'ui-card--flat' in html[1] and 'ui-card--' not in html[2] and 'ui-card--tint' in html[3] and 'x' in html[3])
    pg.evaluate("""(async()=>{const c=await import('/js/components.js');const m=document.createElement('div');m.id='probe';m.innerHTML=['','flat','raised','tint'].map(x=>c.card({design:x,body:'x'})).join('');document.body.appendChild(m)})()"""); pg.wait_for_timeout(300)
    r=pg.evaluate("""[...document.querySelectorAll('#probe .ui-card')].map(e=>{const c=getComputedStyle(e);return [c.borderTopLeftRadius,c.boxShadow==='none'?'none':'shadow',c.backgroundColor,c.borderTopColor]})""")
    print(r)
    ok('Design 2 (flat): outline, no shadow', r[1][1]=='none' and r[1][3]!='rgba(0, 0, 0, 0)')
    ok('Design 3 (raised): 18px corners, shadow, no outline', r[2][0]=='18px' and r[2][1]=='shadow' and r[2][3]=='rgba(0, 0, 0, 0)')
    ok('Design 4 (tint): tinted fill that differs from the theme card, no shadow', r[3][2]!=r[0][2] and r[3][1]=='none')
    # one change in design.css moves every user of the token
    pg.evaluate("document.body.style.setProperty('--card-r','30px')"); 
    ok('changing --card-r once restyles the theme card', pg.evaluate("getComputedStyle(document.querySelector('#probe .ui-card')).borderTopLeftRadius")=='30px')
    pg.evaluate("document.body.style.removeProperty('--card-r')")
    a=pg.evaluate("(()=>{const e=document.querySelector('.hint')||document.body;return getComputedStyle(document.documentElement).getPropertyValue('--fz-13')})()")
    ok('type scale steps exist and follow the text-size setting %s'%a.strip()[:40], 'calc(13px' in a.replace('  ',' '))
    ok('no errors',not errs)
    b.close()
