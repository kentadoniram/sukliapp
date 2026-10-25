# v12ai: clear (x) button stays on its field; export names carry HHMM; Clear all shares a row; "Total spent" says what dates it covers
import re
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
ALIGN="""(sel)=>{const f=document.querySelector(sel),b=document.querySelector('.clearx');if(!f||!b||b.hidden)return null;const r=f.getBoundingClientRect(),c=b.getBoundingClientRect();return {dx:Math.round(r.right-c.right),dy:Math.round((c.top+c.height/2)-(r.top+r.height/2)),inside:c.left>=r.left&&c.right<=r.right}}"""
with sync_playwright() as p:
    b=p.chromium.launch()
    for vw in (320,402):
        ctx=b.new_context(viewport={'width':vw,'height':874},device_scale_factor=3,is_mobile=True,has_touch=True,user_agent=UA,service_workers='block',accept_downloads=True)
        pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
        pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
        # ---- clear button on the Entries search box
        pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_selector('#q'); pg.tap('#q'); pg.keyboard.type('coffee'); pg.wait_for_timeout(250)
        a=pg.evaluate(ALIGN,'#q')
        ok(f'[{vw}] x shows inside the search box, right edge, centred: {a}', a and a['inside'] and 0<=a['dx']<=14 and abs(a['dy'])<=2)
        pg.tap('.clearx'); pg.wait_for_timeout(250)
        ok(f'[{vw}] x empties the box and hides itself', pg.input_value('#q')=='' and pg.evaluate("document.querySelector('.clearx').hidden"))
        # ---- layout shift above the field: the x must follow without any scroll event
        pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry()})()"); pg.wait_for_selector('#f-what')
        pg.tap('#f-what'); pg.keyboard.type('Starbucks'); pg.wait_for_timeout(300)
        a=pg.evaluate(ALIGN,'#f-what'); ok(f'[{vw}] x on the What was it? box: {a}', a and a['inside'] and 0<=a['dx']<=14 and abs(a['dy'])<=2)
        pg.evaluate("(()=>{const d=document.createElement('div');d.id='shim';d.style.height='57px';document.querySelector('#f-what').closest('.field').before(d)})()"); pg.wait_for_timeout(250)
        a=pg.evaluate(ALIGN,'#f-what'); ok(f'[{vw}] x follows when the layout above moves: {a}', a and a['inside'] and 0<=a['dx']<=14 and abs(a['dy'])<=2)
        # field scrolled out of sight: x must not float over other things
        pg.evaluate("document.querySelector('#shim').style.height='3000px'; document.querySelector('.sheet-body').scrollTop=1500"); pg.wait_for_timeout(350)
        vis=pg.evaluate("(()=>{const f=document.querySelector('#f-what').getBoundingClientRect(),sb=document.querySelector('.sheet-body').getBoundingClientRect(),b=document.querySelector('.clearx'),c=b.getBoundingClientRect();return [f.bottom<sb.top||f.top>sb.bottom,b.hidden||c.bottom<sb.top||c.top>sb.bottom]})()")
        ok(f'[{vw}] x hides when its field is scrolled out of view: {vis}', vis[0] and vis[1])
        pg.evaluate("document.querySelector('#shim').remove(); document.querySelector('.sheet-body').scrollTop=0"); pg.wait_for_timeout(300)
        pg.tap('#f-what'); pg.wait_for_timeout(200); pg.tap('.clearx'); pg.wait_for_timeout(200)
        ok(f'[{vw}] x clears the entry name', pg.input_value('#f-what')=='')
        # amount x sits between the number and the calculator button
        pg.fill('#f-amount','1234'); pg.dispatch_event('#f-amount','input'); pg.wait_for_timeout(200)
        g=pg.evaluate("(()=>{const i=document.querySelector('#f-amount').getBoundingClientRect(),x=document.querySelector('.amtx').getBoundingClientRect(),c=document.querySelector('[data-e=calc]').getBoundingClientRect();return [Math.round(x.left-i.right)>=-2,x.right<=c.left+1,Math.abs((x.top+x.height/2)-(i.top+i.height/2))<=3]})()")
        ok(f'[{vw}] amount x sits beside the calculator button and is centred: {g}', all(g))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        if pg.locator('.scrim').count(): pg.evaluate("document.querySelector('[data-close]').click()")
        # ---- Entries: Clear all on the same row as the two pickers
        pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_selector('#acctfilter'); pg.wait_for_timeout(300)
        r=pg.evaluate("(()=>{const t=s=>Math.round(document.querySelector(s).getBoundingClientRect().top);const q=s=>document.querySelector(s).getBoundingClientRect();return [t('#acctfilter'),t('#lf-cat'),t('[data-act=f-clear]'),q('#acctfilter').width,q('#lf-cat').width,document.documentElement.scrollWidth<=innerWidth+1]})()")
        ok(f'[{vw}] All accounts, All categories and Clear all are on one row: {r}', abs(r[0]-r[1])<=4 and abs(r[1]-r[2])<=6 and r[3]>=90 and r[4]>=80 and r[5])
        # ---- the Spent total says what it covers
        pg.click('[data-act=filter][data-v=expense]'); pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('[data-act=f-range][data-v=\"y\"]').click()"); pg.wait_for_timeout(400)
        t=pg.inner_text('#lsum')
        ok(f'[{vw}] summary names the dates covered: {t[:140]!r}', 'Dates covered:' in t and ' to ' in t and 'Total spent' in t)
        ok(f'[{vw}] summary shows an amount, not only a count', re.search(r'[₱¥$]\s?[\d,]+',t) is not None)
        pg.click('[data-act=f-clear]'); pg.click('[data-act=filter][data-v=expense]'); pg.wait_for_timeout(300)
        t=pg.inner_text('#lsum') if pg.locator('#lsum').count() else ''
        ok(f'[{vw}] with no range it names the month shown: {t[:100]!r}', 'Dates covered:' in t and re.search(r'20\d\d',t))
        ok(f'[{vw}] no script errors', not errs)
        ctx.close()
    # ---- export file names
    ctx=b.new_context(viewport={'width':402,'height':874},service_workers='block',accept_downloads=True); pg=ctx.new_page()
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_selector('[data-act=export-csv]'); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    names=[]
    for sel in ('export-csv','export-json'):
        with pg.expect_download() as dl: pg.evaluate(f"document.querySelector('[data-act={sel}]').click()")
        names.append(dl.value.suggested_filename)
    ok(f'CSV name has date and HHMM: {names[0]}', re.fullmatch(r'sukli-\d{4}-\d{2}-\d{2}-([01]\d|2[0-3])[0-5]\d\.csv',names[0]))
    ok(f'JSON name has date and HHMM: {names[1]}', re.fullmatch(r'sukli-backup-\d{4}-\d{2}-\d{2}-([01]\d|2[0-3])[0-5]\d\.json',names[1]))
    ctx.close()
print('SUMMARY',sum(res),'/',len(res))
