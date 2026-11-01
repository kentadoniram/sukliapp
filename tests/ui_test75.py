# v13.19: Count by group on an entry (Advanced only) and the Spending by group page
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.goto('http://localhost:8123/#/spend'); pg.wait_for_timeout(600)
    t=pg.inner_text('#view'); ok('empty page explains how it works', 'Count by group' in t and 'rough' in t)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    ok('entry offers Count by group', pg.locator('[data-e=counts-on]').count()==1)
    pg.click('[data-e=counts-on]'); pg.wait_for_timeout(300)
    ok('one row appears', pg.locator('.cnt').count()==1)
    # pieces reject a decimal and say why
    pg.fill('#f-what','Lawson'); pg.fill('#f-amount','500')
    pg.evaluate("(()=>{const s=document.querySelector('.cnt-g'); s.value='drinks'; s.dispatchEvent(new Event('change',{bubbles:true}));})()")
    pg.fill('.cnt-n','1.5'); pg.click('#btns .btn'); pg.wait_for_timeout(400)
    ok('a decimal count of pieces is refused with a reason', pg.locator('#err:not([hidden])').count()==1 and 'whole' in pg.inner_text('#err').lower())
    pg.fill('.cnt-n','3'); pg.click('[data-e=count-add]'); pg.wait_for_timeout(200)
    pg.evaluate("(()=>{const s=document.querySelectorAll('.cnt-g')[1]; s.value='snacks'; s.dispatchEvent(new Event('change',{bubbles:true}));})()")
    pg.locator('.cnt-n').nth(1).fill('2'); pg.click('#btns .btn'); pg.wait_for_timeout(700)
    saved=pg.evaluate("(async()=>{const m=await import('/js/core.js');const t=m.get().txs.filter(x=>!x.deleted&&x.counts&&x.counts.length)[0];return t&&t.counts})()")
    ok('counts saved as typed: %s'%saved, saved==[{'g':'drinks','n':3},{'g':'snacks','n':2}])
    # weights keep real decimals
    pg.evaluate("(async()=>{const m=await import('/js/spendgroups.js');m.addGroup('beef','kg')})()")
    r=pg.evaluate("(async()=>{const m=await import('/js/spendgroups.js'),c=await import('/js/core.js');return [m.countLines(c.get(),[{g:'beef',n:'0,35'}]),m.countLines(c.get(),[{g:'beef',n:'0'}]),m.countLines(c.get(),[{g:'',n:'2'}])]})()")
    ok('0,35 kg stays 0.35', r[0].get('lines')==[{'g':'beef','n':0.35}]); ok('zero refused', 'error' in r[1]); ok('count without a group refused', 'error' in r[2])
    # many receipts: page shows about amounts with ranges
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');const d0=c.get();const acct=d0.accounts.find(a=>!a.deleted&&a.include).id;const cat=d0.categories.find(x=>!x.deleted&&x.kind==='expense').id;
      c.commit(d=>{const T=c.nowStamp().slice(0,8);for(let i=0;i<24;i++){const dr=1+(i%3),sn=i%4,rm=i%2;const total=dr*140+sn*190+rm*540+(i%5);
      d.txs.push(c.stamp({id:'s'+i,kind:'expense',date:T+String(1+(i%27)).padStart(2,'0')+' 12:00:00',name:'Shop'+(i%2),amount:total,cur:c.HOME,fx:1,cat,acct,counts:[{g:'drinks',n:dr},...(sn?[{g:'snacks',n:sn}]:[]),...(rm?[{g:'ready meals',n:rm}]:[])]}))}})})()""")
    pg.goto('http://localhost:8123/#/spend'); pg.wait_for_timeout(2500)
    t=pg.inner_text('#view'); print(t[:500].replace('\n',' | '))
    ok('page lists groups with about and a range', 'about' in t and ' to ' in t and 'drinks' in t.lower() and 'ready meals' in t.lower())
    ok('says estimates never change totals', 'never change' in t)
    pg.click('[data-act=spend-range][data-k=all]'); pg.wait_for_timeout(2500); ok('period chip works', pg.locator('.chip.on:text-is("All")').count()==1)
    # Simple mode hides it
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='simple'})})()"); pg.wait_for_timeout(500)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    ok('Simple mode hides Count by group', not pg.locator('#countsrow').is_visible())
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
