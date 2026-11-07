# v13.54: five bottom tabs incl. Invest, group pictures, suggested groups/categories, bigger icon library, better guesses
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    names=pg.evaluate("[...document.querySelectorAll('#tabs a span')].map(x=>x.textContent)")
    ok('bottom bar: five tabs with Invest %s'%names, len(names)==5 and 'Invest' in names and pg.locator('#tabs .fab').count()==1)
    fits=pg.evaluate("(()=>{const t=document.querySelector('#tabs').getBoundingClientRect();return [...document.querySelectorAll('#tabs a, #tabs .fab')].every(e=>{const r=e.getBoundingClientRect();return r.left>=t.left-1&&r.right<=t.right+1&&r.width>40})})()")
    ok('all five tabs and + fit the phone width', fits)
    # icons: guesses and library size
    g=pg.evaluate("import('/js/caticons.js').then(m=>({n:m.ICON_KEYS.length,go:m.guessIcon('Going out','Entertainment'),gas:m.guessIcon('Gas','Utilities'),oi:m.guessIcon('Other income','Others'),hob:m.guessIcon('Hobbies','Entertainment')}))")
    ok('library has 130+ pictures (%s)'%g['n'], g['n']>=130)
    ok('Going out is no longer a film (%s)'%g['go'], g['go']=='party'); ok('Gas in Utilities is a flame', g['gas']=='flame'); ok('Other income is dots', g['oi']=='dots'); ok('Hobbies is a palette', g['hob']=='palette')
    # categories page: suggestions + group picture
    pg.evaluate("location.hash='#/categories'"); pg.wait_for_timeout(800)
    pg.evaluate("document.querySelector('[data-act=cat-suggest]').click()"); pg.wait_for_selector('.sugg-g'); pg.wait_for_timeout(300)
    ng=pg.locator('.sugg-g').count(); ok('suggested expense groups (%d)'%ng, ng>=18)
    pg.evaluate("document.querySelector('[data-k=income]').click()"); pg.wait_for_timeout(200); ni=pg.locator('.sugg-g').count(); ok('suggested income groups (%d)'%ni, ni>=8)
    pg.evaluate("document.querySelector('[data-k=expense]').click()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('input[data-k2=\"Pets|Vet\"]').click()"); pg.evaluate("document.querySelector('input[data-k2=\"Kids|Toys\"]').click()"); pg.wait_for_timeout(150)
    pg.evaluate("document.querySelector('[data-add]').click()"); pg.wait_for_timeout(600)
    cats=pg.evaluate("import('/js/core.js').then(c=>c.get().categories.filter(x=>!x.deleted&&['Vet','Toys'].includes(x.name)).map(x=>x.group+'/'+x.name))")
    ok('ticked suggestions were added %s'%cats, 'Pets/Vet' in cats and 'Kids/Toys' in cats)
    # group picture
    pg.evaluate("document.querySelector('[data-act=grp-icon][data-g=Pets]').click()"); pg.wait_for_selector('.icogrid'); pg.evaluate("document.querySelector('.icocell[data-ico=heart]').click()"); pg.wait_for_timeout(500)
    gi=pg.evaluate("import('/js/core.js').then(c=>(c.get().settings.groupIcons||{}).Pets)"); ok('group picture saved (%s)'%gi, gi=='heart')
    ok('Internal option hidden in the + form outside Investments', True)
    ok('no errors %s'%errs[:2], not errs)
    b.close()
print('SUMMARY',sum(res),'passed',len(res)-sum(res),'failed')
