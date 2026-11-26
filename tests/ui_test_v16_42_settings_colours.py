# v16.42: named hex tokens, 27 colour ways with clear names, redesigned Settings (find box, icon rows)
from playwright.sync_api import sync_playwright
import pkhelp; pkhelp.patch(); import re
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
def lum(h):
    c=[int(h[i:i+2],16)/255 for i in (1,3,5)]; c=[x/12.92 if x<=.03928 else ((x+.055)/1.055)**2.4 for x in c]; return .2126*c[0]+.7152*c[1]+.0722*c[2]
def ratio(a,b): la,lb=sorted([lum(a),lum(b)],reverse=True); return (la+.05)/(lb+.05)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874},service_workers='block'); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    acc=pg.evaluate("import('/js/appearance.js').then(m=>Object.entries(m.ACCENTS).map(([k,a])=>[k,a.n,a.l,a.d]))")
    ok(f'{len(acc)} colour ways (27 expected)', len(acc)==27)
    names=[a[1] for a in acc]; ok('names are unique', len(set(names))==len(names))
    ok('every colour is a 6-digit hex', all(re.fullmatch(r'#[0-9A-F]{6}',h) for a in acc for arr in (a[2],a[3]) for h in arr))
    bad=[a[1] for a in acc if ratio(a[2][0],'#FFFFFF')<4.5]; ok(f'light accent reads on white (4.5:1) {bad}', not bad)
    bad=[a[1] for a in acc if ratio(a[3][0],a[3][2])<4.5]; ok(f'dark accent reads on dark page (4.5:1) {bad}', not bad)
    ok('old keys kept so saved choices still work', all(k in [a[0] for a in acc] for k in 'blue teal green purple rose orange graphite indigo ocean plum gold coral forest mono'.split()))
    ok('renamed: blue is Navy Blue, mono is Monochrome', dict((a[0],a[1]) for a in acc)['blue']=='Navy Blue' and dict((a[0],a[1]) for a in acc)['mono']=='Monochrome')
    # tokens exist
    tok=pg.evaluate("['--conf-hi','--light-green','--brand-violet','--coin-grey','--goal-gold','--sec-perf','--sec-other','--black'].map(t=>getComputedStyle(document.documentElement).getPropertyValue(t).trim())")
    ok(f'named colour tokens resolve {tok}', all(re.fullmatch(r'#[0-9A-Fa-f]{6}',t) for t in tok))
    pg.goto('http://localhost:8123/index.html#/settings'); pg.wait_for_selector('.sgroup'); pg.wait_for_timeout(300)
    ok('six groups with an icon tile and a count', pg.locator('details.sgroup').count()==6 and pg.locator('details.sgroup > summary .sgico svg').count()==6 and pg.locator('.sgn').count()==6)
    ok('find box exists', pg.locator('#setfind').count()==1)
    pg.fill('#setfind','backup'); pg.wait_for_timeout(200)
    ok('find: only matching groups stay', 1<=pg.locator('details.sgroup:not([hidden])').count()<=2 and pg.locator('details.sgroup[data-sgroup=data]:not([hidden])').count()==1)
    ok('find: the matching group opens', pg.locator('details.sgroup[data-sgroup=data]').get_attribute('open') is not None)
    pg.fill('#setfind','zzzzqq'); ok('find: nothing matches message', pg.locator('#setfind-none').is_visible() and pg.locator('details.sgroup:not([hidden])').count()==0)
    pg.fill('#setfind',''); ok('find: clearing brings everything back', pg.locator('details.sgroup:not([hidden])').count()==6 and not pg.locator('#setfind-none').is_visible())
    pg.fill('#setfind','colour'); pg.wait_for_timeout(200); ok('find: colour reaches the Appearance section', pg.locator('details.sgroup[data-sgroup=look]:not([hidden])').count()==1)
    ok('no page errors %s'%errs[:2], not errs)
n=sum(res); print(f'{n}/{len(res)} passed'); print('fails', len(res)-n)
