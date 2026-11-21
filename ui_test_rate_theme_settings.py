# v15.8: the three rate options share one theme (dark too); Settings holds no typed rates; saved entries keep their own rate
from playwright.sync_api import sync_playwright
import pkhelp; pkhelp.patch()
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for scheme in ['dark','light']:
        ctx=b.new_context(viewport={'width':390,'height':844},color_scheme=scheme,service_workers='block'); pg=ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
        pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
        pg.evaluate("(async()=>{const f=await import('/js/fxview.js');f.openConverter({from:'USDT',to:'PHP',amount:1,rate:63.06,onApply:()=>{}})})()"); pg.wait_for_selector('#cv-manual'); pg.wait_for_timeout(300)
        cs=lambda i: pg.evaluate("i=>{const s=getComputedStyle(document.querySelector(i));return [s.backgroundColor,s.color,s.borderTopColor]}",i)
        for m in ['#cv-latest','#cv-manual','#cv-setrate']:
            pg.click(m); pg.wait_for_timeout(150)
            others=[x for x in ['#cv-latest','#cv-manual','#cv-setrate'] if x!=m]
            st={x:cs(x) for x in others}
            ok(f'{scheme}: the two unselected options match when {m} is selected', st[others[0]]==st[others[1]])
            ok(f'{scheme}: selected {m} differs from unselected in a themed way', cs(m)[0]!=st[others[0]][0])
            if m=='#cv-manual': pg.screenshot(path=f'/tmp/fx_{scheme}.png')
        # the dark panel does not turn light
        bg=pg.evaluate("getComputedStyle(document.querySelector('#cv-manual')).backgroundColor")
        if scheme=='dark':
            pg.click('#cv-latest'); pg.wait_for_timeout(100)
            rgb=[int(x) for x in cs('#cv-manual')[0][4:-1].split(',')[:3]]
            ok('dark: unselected option is a dark colour %s'%rgb, max(rgb)<120)
            rgb=[int(x) for x in cs('#cv-latest')[0][4:-1].split(',')[:3]]
            ok('dark: selected option is a dark tint, not light green %s'%rgb, max(rgb)<120)
        ok(f'{scheme}: no errors {errs}', not errs)
        ctx.close()
    # Settings and saved entries
    ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page()
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    r=pg.evaluate("""(async()=>{const c=await import('/js/core.js');const db=c.get();
      const t=db.txs.find(x=>!x.deleted&&x.cur!==c.HOME&&x.fx>0); const before=[t.fx,t.hfx,c.homePer(db,t)];
      c.commit(d=>{d.settings.rates=d.settings.rates||{};d.settings.rates[t.cur]=(t.fx||1)*3});
      const mid=[t.fx,t.hfx,c.homePer(c.get(),c.get().txs.find(x=>x.id===t.id))];
      c.commit(d=>{delete d.settings.rates[t.cur]});
      const after=[t.fx,t.hfx,c.homePer(c.get(),c.get().txs.find(x=>x.id===t.id))];
      return {before,mid,after,cur:t.cur}})()""")
    ok('a typed Settings rate never changes a saved entry %s'%r, r['before'][:2]==r['mid'][:2]==r['after'][:2] and abs(r['before'][2]-r['mid'][2])<1e-9 and abs(r['before'][2]-r['after'][2])<1e-9)
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_selector('.ratebox',state='attached'); pg.evaluate('document.querySelectorAll("details").forEach(d=>d.open=true)'); pg.wait_for_timeout(150); pg.wait_for_timeout(300)
    ok('Settings: today\'s rates are read-only, no typed-rate editor, no old list when none', pg.locator('[data-act=rate-open]').count()==0 and pg.locator('.oldrates').count()==0 and pg.locator('.ratebox button.fxlink').count()==0)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.rates=d.settings.rates||{};d.settings.rates.USD=61})})()"); pg.goto('http://localhost:8123/#/settings'); pg.wait_for_selector('.oldrates',timeout=5000)
    ok('an old typed rate is listed with Remove', pg.locator('.oldrate [data-act=rate-live]').count()==1)
    pg.evaluate("document.querySelector('.oldrate [data-act=rate-live]').click()"); pg.wait_for_timeout(400)
    ok('Remove clears it', pg.locator('.oldrates').count()==0)
print('fails',res.count(False))
