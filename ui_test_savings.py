# v15.5: Savings goals
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    r=pg.evaluate("""(async()=>{const S=await import('/js/savings.js'),c=await import('/js/core.js');
      const db={accounts:[{id:'a1',name:'Pot',cur:c.HOME,open:500,type:'bank',include:true}],txs:[],settings:c.get().settings,goals:[]};
      const T='2026-01-01';
      const m=S.goalStats(db,{id:'g',name:'x',target:1000,start:100,log:[{amt:300},{amt:-50}],due:'2026-04-01',created:'2025-12-01'},T);
      const l=S.goalStats(db,{id:'g',name:'x',target:1000,acct:'a1',log:[]},T);
      const late=S.goalStats(db,{id:'g',name:'x',target:1000,start:10,log:[],due:'2025-12-01'},T);
      const done=S.goalStats(db,{id:'g',name:'x',target:300,start:400,log:[]},T);
      return {m,l:{saved:l.saved,linked:l.linked,pct:l.pct},late:{late:late.late,pm:late.perMonth},done:done.reached};})()""")
    print(r)
    ok('manual goal: saved 350, 35 percent, 650 left', abs(r['m']['saved']-350)<1e-6 and abs(r['m']['pct']-35)<1e-6 and abs(r['m']['left']-650)<1e-6)
    ok('needs about 217 a month for 3 months', r['m']['monthsLeft']==3 and abs(r['m']['perMonth']-650/3)<1e-6)
    ok('pace and estimate shown after 14+ days', r['m']['pace'] and r['m']['eta'])
    ok('linked goal follows the account balance', r['l']['linked'] and abs(r['l']['saved']-500)<1e-6 and abs(r['l']['pct']-50)<1e-6)
    ok('past target date is flagged, no per month', r['late']['late'] and r['late']['pm'] is None)
    ok('reached when saved covers the target', r['done'])
    pg.goto('http://localhost:8123/#/savings'); pg.wait_for_selector('.savingspage'); pg.wait_for_timeout(400)
    ok('empty state offers ideas', 'Save Toward Something' in pg.inner_text('.savingspage') and pg.locator('.chip[data-act=goal-new]').count()>=6)
    pg.evaluate("document.querySelector('.chip[data-act=goal-new]').click()"); pg.wait_for_selector('form input[name=n]'); pg.wait_for_timeout(300)
    ok('idea fills the name', pg.input_value('input[name=n]')=='Travel Fund')
    pg.fill('input[name=t]','50000'); pg.evaluate("document.querySelector('form .btn:not(.ghost)').click()"); pg.wait_for_selector('.goalcard'); pg.wait_for_timeout(300)
    ok('goal card shows', 'Travel Fund' in pg.inner_text('.goalcard') and '0%' in pg.inner_text('.goalcard') and pg.locator('.goalcard .badge svg').count()==1)
    pg.evaluate("document.querySelector('[data-act=goal-add]').click()"); pg.wait_for_selector('input[name=a]'); pg.fill('input[name=a]','5000'); pg.evaluate("document.querySelector('form .btn:not(.ghost)').click()"); pg.wait_for_timeout(400)
    ok('adding money moves progress to 10 percent', '10%' in pg.inner_text('.goalcard'))
    pg.evaluate("document.querySelector('[data-act=goal-take]').click()"); pg.wait_for_selector('input[name=a]'); pg.fill('input[name=a]','1000'); pg.evaluate("document.querySelector('form .btn:not(.ghost)').click()"); pg.wait_for_timeout(400)
    ok('taking out lowers it to 8 percent', '8%' in pg.inner_text('.goalcard'))
    pg.evaluate("document.querySelector('[data-act=goal-hist]').click()"); pg.wait_for_selector('[data-rm]'); n=pg.locator('[data-rm]').count()
    pg.evaluate("document.querySelector('[data-rm]').click()"); pg.wait_for_timeout(400)
    ok('history lists two and can remove one', n==2 and ('2%' in pg.inner_text('.goalcard') or '10%' in pg.inner_text('.goalcard') or '8%' not in pg.inner_text('.goalcard')))
    # link to an account
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'sv',name:'Savings Pot',cur:c.HOME,type:'bank',open:12000,include:true,archived:false}))})})()")
    pg.evaluate("document.querySelector('[data-act=goal-edit]').click()"); pg.wait_for_selector('select[name=a]'); pg.select_option('select[name=a]','sv'); pg.evaluate("document.querySelector('form .btn:not(.ghost)').click()"); pg.wait_for_timeout(400)
    t=pg.inner_text('.goalcard')
    ok('linked goal follows the account (24 percent) and hides Add Money', '24%' in t and pg.locator('[data-act=goal-add]').count()==0 and 'Savings Pot' in t)
    # menu has Savings
    pg.evaluate("document.querySelector('[data-act=menu]').click()"); pg.wait_for_timeout(300)
    ok('menu lists Savings', pg.locator('.drawer a[href="#/savings"]').count()==1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # csv round trip
    csv=pg.evaluate("(async()=>{const m=await import('/js/sukliCsv.js'),c=await import('/js/core.js');return m.exportSukliCSV(c.get())})()")
    ok('CSV has a Goal row', '"Goal"' in csv and 'Travel Fund' in csv)
    back=pg.evaluate("""async(csv)=>{const m=await import('/js/sukliCsv.js'),c=await import('/js/core.js');const db=JSON.parse(JSON.stringify(c.get()));db.goals=[];m.importSukliCSV(db,csv);return db.goals.map(g=>[g.name,g.target,g.acct])}""",csv)
    ok('goal comes back from the CSV %s'%back, back and back[0][0]=='Travel Fund' and back[0][1]==50000 and back[0][2]=='sv')
    # delete -> bin
    pg.evaluate("document.querySelector('[data-act=goal-edit]').click()"); pg.wait_for_selector('[data-del]'); pg.evaluate("document.querySelector('[data-del]').click()"); pg.wait_for_selector('[data-yes]',timeout=3000)
    pg.evaluate("document.querySelector('[data-yes]').click()"); pg.wait_for_timeout(500)
    ok('removed goal goes to the recycle bin', pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.binItems(c.get()).some(i=>i.kind==='goal')})()") and pg.locator('.goalcard').count()==0)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
