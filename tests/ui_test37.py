# v12ab: Settings cleanup, workplace stop, one-line rates
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for vw,vh in ((390,844),(1100,800)):
        pg=b.new_page(viewport={'width':vw,'height':vh},service_workers='block'); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
        pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
        pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(500)
        pg.evaluate("document.querySelectorAll('details.sgroup').forEach(d=>d.open=true)"); pg.wait_for_timeout(200)
        txt=pg.inner_text('body')
        ok(f'[{vw}] no Google backup / Cloud sync / Supabase text', not any(w in txt for w in ('Google backup','Cloud sync','Supabase','Create account','Continue with Google')))
        ok(f'[{vw}] group names capitalised', 'Accounts and Names' in txt and 'Look and Feel' in txt)
        ok(f'[{vw}] account type on one row', pg.evaluate("(()=>{const a=document.querySelector('#atype-new').getBoundingClientRect(),k=document.querySelector('#atype-kind').getBoundingClientRect(),d=document.querySelector('[data-act=atype-add]').getBoundingClientRect();return Math.abs(a.top-k.top)<12&&Math.abs(a.top-d.top)<14})()"))
        n=pg.evaluate("document.querySelectorAll('.ratebox').length")
        if n:
            ok(f'[{vw}] each rate pair on one line', pg.evaluate("[...document.querySelectorAll('.ratebox')].every(r=>{const t=[...r.querySelectorAll('input')].map(i=>Math.round(i.getBoundingClientRect().top));return t.length==2&&Math.abs(t[0]-t[1])<4})"))
            pg.fill('[data-rate]','100'); pg.press('[data-rate]','Tab'); pg.wait_for_timeout(300)
            inv=pg.evaluate("parseFloat(document.querySelector('[data-rate-inv]').value)")
            ok(f'[{vw}] one side edits the other', abs(inv-0.01)<1e-6)
            pg.fill('[data-rate-inv]','0.02'); pg.press('[data-rate-inv]','Tab'); pg.wait_for_timeout(300)
            r=pg.evaluate("parseFloat(document.querySelector('[data-rate]').value)")
            ok(f'[{vw}] other direction too', abs(r-50)<1e-4)
        pg.fill('#workplace','Shinagawa'); pg.press('#workplace','Tab'); pg.wait_for_timeout(300)
        ok(f'[{vw}] workplace remembered', pg.evaluate("(async()=>{const m=await import('/js/core.js');return m.get().settings.workPlace})()")=='Shinagawa')
        ok(f'[{vw}] no page errors', not errs)
    b.close()
print('SUMMARY', sum(res), 'passed', len(res)-sum(res), 'failed')
