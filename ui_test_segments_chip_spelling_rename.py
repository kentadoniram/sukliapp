# v15.28: segmented controls replace tabs, chip text centred, installment spelling, APR Edit/Remove spacing, Rename Platform wording
import glob
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
bad=[f for f in glob.glob('js/*.js')+['README.md'] if 'nstalment' in open(f).read()]
ok('no "instalment" spelling left in code or README %s'%bad, not bad)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.goto('http://localhost:8123/#/styleguide'); pg.wait_for_timeout(800); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    off=pg.evaluate("""[...document.querySelectorAll('.sgsec .chip')].map(c=>{const r=document.createRange();r.selectNodeContents(c);const t=r.getBoundingClientRect(),b=c.getBoundingClientRect();return [Math.abs((t.left+t.right)/2-(b.left+b.right)/2),Math.abs((t.top+t.bottom)/2-(b.top+b.bottom)/2)]})""")
    ok('Style Guide chips: text centred across and up and down %s'%off[:4], off and all(x<=1.6 and y<=1.6 for x,y in off))
    ok('Style Guide has a Chips section and a segmented-control demo', pg.locator('.sgsec:has-text("Chips")').count()>=1 and pg.locator('.sgsec .segi').count()>=2)
    sw=pg.evaluate("(async()=>{const c=await import('/js/components.js');return c.segChoice({label:'Spot <b>',on:true,act:'x',v:'1'})})()")
    ok('segChoice is a pressed segment with an escaped label', 'aria-pressed="true"' in sw and 'segi on' in sw and '&lt;b&gt;' in sw)
    rad=pg.evaluate("(()=>{const g=document.querySelector('.segm'),i=document.querySelector('.segm .segi.on');const a=getComputedStyle(g),b=getComputedStyle(i);return [parseFloat(a.borderTopLeftRadius),parseFloat(b.borderTopLeftRadius),b.backgroundColor!==getComputedStyle(g).backgroundColor]})()")
    ok('segmented control: outer corners rounded, selected segment rounded and filled %s'%rad, rad[0]>=12 and rad[1]>=8 and rad[2])
    g=pg.evaluate("""(()=>{const d=document.createElement('div');d.className='aprbtns';d.innerHTML='<button class="linkbtn">Edit</button><button class="linkbtn danger">Remove</button>';document.body.appendChild(d);const [a,b]=[...d.children].map(x=>x.getBoundingClientRect());d.remove();return b.left-a.right})()""")
    ok('APR history: Edit and Remove have space between them (%spx)'%g, g>=10)
    pg.evaluate("(async()=>{const m=await import('/js/platform.js');m.openPlatform('Binance')})()"); pg.wait_for_selector('.platset',timeout=4000)
    t=pg.inner_text('.platset')
    ok('platform sheet: "Rename Platform" and says it does not rename the accounts', 'Rename Platform' in t and 'does not rename your individual accounts' in t)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
