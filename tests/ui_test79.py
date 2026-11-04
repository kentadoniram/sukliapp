# v13.25: "What was it?" typed as a list (coke, 2 bread, soap) offers Count by group and keeps the parts
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.titleCase=false})})()")
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    pg.fill('#f-what','Lawson'); pg.wait_for_timeout(300); ok('no hint for a plain name', pg.locator('.partshint').count()==0)
    pg.fill('#f-what','coke, 2 onigiri, tissue, mystery thing'); pg.wait_for_timeout(400)
    ok('hint appears for a list', pg.locator('.partshint').count()==1 and '4 things' in pg.inner_text('.partshint'))
    pg.evaluate("document.querySelector('[data-e=parts-use]').click()"); pg.wait_for_timeout(500)
    rows=pg.evaluate("[...document.querySelectorAll('.cnt')].map(r=>[r.querySelector('.cnt-g').value,r.querySelector('.cnt-n').value])")
    ok('counts filled by guess %s'%rows, ['drinks','1'] in rows and ['snacks','2'] in rows and ['household','1'] in rows and ['','1'] in rows)
    pg.evaluate("(()=>{const s=[...document.querySelectorAll('.cnt-g')].find(x=>!x.value); s.value='other'; s.dispatchEvent(new Event('change',{bubbles:true}));})()")
    pg.fill('#f-amount','640'); pg.click('#btns .btn'); pg.wait_for_timeout(800)
    t=pg.evaluate("(async()=>{const m=await import('/js/core.js');const t=m.get().txs.filter(x=>!x.deleted&&x.name&&x.name.startsWith('coke'))[0];return t&&[t.counts,t.parts,t.name]})()")
    ok('saved counts and parts, name kept as typed: %s'%t, t and t[2]=='coke, 2 onigiri, tissue, mystery thing' and len(t[1])==4 and {'g':'snacks','n':2} in t[0])
    # a place name with a comma can be dismissed
    pg.wait_for_timeout(1500); pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    pg.fill('#f-what','Kawasaki, Kanagawa'); pg.wait_for_timeout(300); ok('hint also on a place name', pg.locator('.partshint').count()==1)
    pg.evaluate("document.querySelector('[data-e=parts-off]').click()"); pg.wait_for_timeout(300); ok('Not a list hides it', pg.locator('.partshint').count()==0)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
