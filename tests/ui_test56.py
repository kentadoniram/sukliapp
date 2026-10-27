# v12as: one-line platform actions, graph beside value, pie symbol and sheet
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(900)
    r=pg.evaluate("""(()=>{const v=document.querySelector('.nwl b').getBoundingClientRect(),g=document.querySelector('.ivgraph').getBoundingClientRect();return {vy:v.top,gy:g.top,vx:v.left,gx:g.left,gr:g.right,cw:document.querySelector('.nwmain').getBoundingClientRect().right}})()""")
    ok('graph is beside the value %s'%r, r['gx']>r['vx']+100 and abs(r['gy']-r['vy'])<60 and r['gr']<=r['cw']+1)
    rows=pg.evaluate("(()=>{const bs=[...document.querySelectorAll('.btnrow.oneline')][0];if(!bs)return null;const t=[...bs.children].map(c=>Math.round(c.getBoundingClientRect().top));return [t,bs.scrollWidth,bs.clientWidth]})()")
    ok('platform actions on one line %s'%rows, rows and len(set(rows[0]))==1 and rows[1]<=rows[2]+1)
    ok('pie symbol on the group row', pg.evaluate("(()=>{const p=document.querySelector('.piebtn'),s=document.querySelector('.grprow .seg');return !!p&&!!s&&Math.abs(p.getBoundingClientRect().top-s.getBoundingClientRect().top)<30})()"))
    pg.click('.piebtn'); pg.wait_for_selector('#ivp .donut'); pg.wait_for_timeout(300)
    t=pg.inner_text('#ivp'); ok('pie shows percentages', '%' in t and 'KuCoin' in t.replace('KUCOIN','KuCoin') or '%' in t)
    n=pg.locator('#ivp .slice').count(); ok('slices %d'%n, n>=2)
    pg.click('#ivp .pielegend button >> nth=0'); pg.wait_for_timeout(300)
    ok('tapping a name lists what is inside', pg.locator('#ivp .calfacts li').count()>=1)
    pg.click('#ivp [data-md=type]'); pg.wait_for_timeout(300); ok('switch to asset type', 'Cryptocurrency' in pg.inner_text('#ivp'))
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
