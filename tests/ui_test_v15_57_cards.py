# v15.57: shared card design system; Theme 1 Home cards share one look, other tabs and Legacy unchanged
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
Q="""(()=>{const out=[];for(const e of document.querySelectorAll('#view .ui-card, #view .week, #view section.card, #view .cardbox')){if(e.closest('.coll')&&e!==e.closest('.coll'))continue;const s=getComputedStyle(e);if(e.closest('.coll')!==e&&e.closest('.coll'))continue;out.push([e.className.split(' ')[0],s.borderRadius,s.boxShadow!=='none',s.backgroundImage])}return out})()"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1500)
    ok('view carries the screen name', pg.evaluate("document.getElementById('view').dataset.screen")=='home')
    ok('week and coll cards use ui-card', pg.locator('.week.ui-card').count()==1 and pg.locator('.coll.ui-card').count()>=2)
    r=pg.evaluate(Q); print(r)
    ok('every Home card has the same radius', len({x[1] for x in r})==1 and r[0][1]=="24px")
    ok('every Home card is raised (shadow) and has no gradient', all(x[2] and x[3]=='none' for x in r))
    ok('main-home-card keeps its gradient', pg.evaluate("getComputedStyle(document.querySelector('.main-home-card')).backgroundImage")!='none')
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(800)
    ok('other tab not restyled', pg.evaluate("[...document.querySelectorAll('#view .coll')].every(e=>getComputedStyle(e).borderRadius==='14px')"))
    pg.evaluate("document.querySelector('[data-act=look][data-k=design][data-v=legacy]').click()"); pg.wait_for_timeout(400)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1200)
    ok('Legacy Home keeps 14px cards', pg.evaluate("[...document.querySelectorAll('#view .coll')].every(e=>getComputedStyle(e).borderRadius==='14px')"))
    ok('no page errors %s'%errs, not errs)
