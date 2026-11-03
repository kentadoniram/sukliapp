# v13.34: merchant + branch + place
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';const a=d.accounts.find(x=>!x.deleted&&x.cur==='JPY')||d.accounts[0];
      for(let i=0;i<3;i++) d.txs.push(c.stamp({id:'lf'+i,kind:'expense',date:'2026-10-1'+i+' 12:00:00',acct:a.id,cur:a.cur,amount:500+i,fx:1,name:'Groceries',merchant:'Life Tsukagoshi'}))})})()""")
    pg.evaluate("document.querySelector('[data-act=mer-edit]')||0")
    pg.evaluate("(async()=>{await import('/js/merchantset.js');const el=document.createElement('button');el.dataset.m='Life Tsukagoshi';window.__el=el;document.body.appendChild(el);const u=await import('/js/ui.js');u.ACT['mer-edit'](el)})()"); pg.wait_for_selector('input[name=br]'); pg.wait_for_timeout(300)
    pg.fill('input[name=m]','Life'); pg.fill('input[name=br]','Tsukagoshi'); pg.fill('input[name=place]','Tsukagoshi, Saiwai Ward, Kawasaki, Kanagawa')
    pg.evaluate("document.querySelector('input[name=m]').closest('form').requestSubmit()"); pg.wait_for_timeout(800)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get();return [d.txs.filter(t=>t.merchant==='Life'&&t.branch==='Tsukagoshi').length,JSON.stringify(d.settings.merchantInfo)]})()")
    ok('3 entries now Life / Tsukagoshi, place saved %s'%r, r[0]==3 and 'Saiwai Ward' in r[1])
    # second branch from entry form, same merchant
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{merchant:'Life'}})})()"); pg.wait_for_selector('#branchrow'); pg.wait_for_timeout(400)
    ok('branch row shows after merchant', pg.locator('#branchrow:not([hidden])').count()==1)
    pg.click('#branchrow [data-e=branchpick]'); pg.wait_for_timeout(300)
    ok('existing branch offered', 'Tsukagoshi' in pg.inner_text('body'))
    pg.click('[data-b=Tsukagoshi]'); pg.fill('#f-amount','300'); pg.fill('#f-what','Milk'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.name==='Milk');return t&&[t.merchant,t.branch]})()"); ok('saved with branch %s'%r, r==['Life','Tsukagoshi'])
    r=pg.evaluate("(async()=>{const m=await import('/js/merchantset.js');return m.branchesOf((await import('/js/core.js')).get(),'Life').map(b=>[b.name,b.n])})()"); ok('one merchant, branch counts %s'%r, r==[['Tsukagoshi',4]])
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
